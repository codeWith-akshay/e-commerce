/**
 * POST /api/payments/retry
 *
 * Retry a failed payment for an existing order.
 *
 * Flow:
 *   1. Auth + ownership check.
 *   2. Load Payment; verify status === FAILED and retryCount < MAX_RETRIES.
 *   3. Cancel the previous provider intent (Stripe only — best-effort).
 *   4. Atomically increment retryCount + update Payment status to PENDING inside
 *      a transaction that re-checks retryCount to prevent concurrent races.
 *   5. Create a new gateway intent with a fresh idempotency key.
 *   6. Persist new providerPaymentId / providerOrderId.
 *   7. If retryCount has now reached MAX_RETRIES, lock the order.
 *
 * Body: { orderId: string }
 *
 * Returns (Stripe):   { provider, clientSecret, paymentId, retriesRemaining }
 * Returns (Razorpay): { provider, razorpayOrderId, keyId, paymentId, retriesRemaining }
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import {
  stripeCreateIntent,
  stripeCancelIntent,
  razorpayCreateOrder,
} from "@/lib/payment-gateway";

const MAX_RETRIES = 3;

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { orderId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { orderId } = body;
  if (!orderId?.trim()) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  }

  // ── Load order + payment ─────────────────────────────────────────────────────
  const order = await prisma.order.findUnique({
    where: { id: orderId, userId },
    select: {
      id:          true,
      totalAmount: true,
      status:      true,
      payment: {
        select: {
          id:                true,
          status:            true,
          retryCount:        true,
          provider:          true,
          providerPaymentId: true,
          providerOrderId:   true,
        },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (!order.payment) {
    return NextResponse.json(
      { error: "No payment record found for this order. Use create-intent first." },
      { status: 422 }
    );
  }

  const payment = order.payment;

  // ── Guard: only FAILED payments can be retried ──────────────────────────────
  if (payment.status === "PAID") {
    return NextResponse.json(
      { error: "Order is already paid.", code: "ALREADY_PAID" },
      { status: 422 }
    );
  }
  if (payment.status === "PENDING") {
    return NextResponse.json(
      { error: "A payment is still in progress. Complete or cancel it first.", code: "PAYMENT_PENDING" },
      { status: 422 }
    );
  }
  if (order.status === "PAYMENT_LOCKED") {
    return NextResponse.json(
      { error: "Order is locked after maximum payment attempts.", code: "ORDER_PAYMENT_LOCKED" },
      { status: 422 }
    );
  }

  // ── Guard: retry cap ────────────────────────────────────────────────────────
  if (payment.retryCount >= MAX_RETRIES) {
    await prisma.order.update({
      where: { id: orderId },
      data:  { status: "PAYMENT_LOCKED", lockedAt: new Date() },
    });
    return NextResponse.json(
      {
        error: "Maximum payment attempts reached. Order is now locked.",
        code:  "MAX_RETRIES_EXCEEDED",
      },
      { status: 422 }
    );
  }

  // ── Step 1: Cancel old provider intent (best-effort, before DB mutation) ────
  // Cancelling first is safer — if the DB update fails, the old intent is still
  // dead, but because we haven't incremented retryCount, the next call retries
  // cleanly with the same count.
  if (payment.provider === "STRIPE" && payment.providerPaymentId) {
    await stripeCancelIntent(payment.providerPaymentId);
  }
  // Razorpay orders cannot be cancelled via API in the standard plan — simply
  // allow the old order to expire (they expire after 15 minutes if unpaid).

  // ── Step 2: Atomic increment inside a serializable transaction ─────────────
  // Re-read retryCount inside the transaction to guard against concurrent calls.
  let newRetryCount: number;
  try {
    const updated = await prisma.$transaction(
      async (tx) => {
        const fresh = await tx.payment.findUnique({
          where:  { id: payment.id },
          select: { retryCount: true, status: true },
        });

        if (!fresh) throw new Error("PAYMENT_NOT_FOUND");
        if (fresh.retryCount >= MAX_RETRIES) throw new Error("MAX_RETRIES_EXCEEDED");
        if (fresh.status === "PAID") throw new Error("ALREADY_PAID");

        // Reset order from PAYMENT_FAILED → PENDING while a new attempt is in
        // flight. Using updateMany with a status filter makes this a no-op if the
        // order is in any other state (e.g., already PENDING or PROCESSING).
        await tx.order.updateMany({
          where: { id: orderId, status: "PAYMENT_FAILED" as import("@prisma/client").OrderStatus },
          data:  { status: "PENDING" },
        });

        return tx.payment.update({
          where: { id: payment.id },
          data:  {
            retryCount:        { increment: 1 },
            status:            "PENDING",
            // Clear old provider reference — will be set below
            providerPaymentId: null,
            providerOrderId:   null,
            failureReason:     null,
          },
          select: { retryCount: true },
        });
      },
      { isolationLevel: "Serializable" }
    );
    newRetryCount = updated.retryCount;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "MAX_RETRIES_EXCEEDED") {
      await prisma.order.update({
        where: { id: orderId },
        data:  { status: "PAYMENT_LOCKED", lockedAt: new Date() },
      });
      return NextResponse.json(
        { error: "Maximum payment attempts reached. Order is now locked.", code: "MAX_RETRIES_EXCEEDED" },
        { status: 422 }
      );
    }
    if (msg === "ALREADY_PAID") {
      return NextResponse.json({ error: "Order is already paid.", code: "ALREADY_PAID" }, { status: 422 });
    }
    console.error("[payments/retry] transaction error", err);
    return NextResponse.json({ error: "Database error. Please try again." }, { status: 500 });
  }

  // ── Step 3: Create new provider intent ──────────────────────────────────────
  const amountMinor    = Math.round(order.totalAmount * 100);
  // Idempotency key is unique per attempt so each retry creates a new intent.
  const idempotencyKey = `order_${orderId}_attempt_${newRetryCount}`;
  const retriesRemaining = MAX_RETRIES - newRetryCount;

  try {
    if (payment.provider === "STRIPE") {
      const intent = await stripeCreateIntent(
        amountMinor,
        "inr",
        { orderId, userId, attempt: String(newRetryCount) },
        idempotencyKey
      );

      await prisma.payment.update({
        where: { id: payment.id },
        data:  { providerPaymentId: intent.providerPaymentId },
      });

      // ── After max retries reached, lock the order ─────────────────────────
      if (retriesRemaining === 0) {
        await prisma.order.update({
          where: { id: orderId },
          data:  { status: "PAYMENT_LOCKED", lockedAt: new Date() },
        });
      }

      return NextResponse.json({
        provider:         "STRIPE",
        clientSecret:     intent.clientSecret,
        paymentId:        payment.id,
        retriesRemaining,
      });
    }

    // ── Razorpay ─────────────────────────────────────────────────────────────
    const rzpOrder = await razorpayCreateOrder(
      amountMinor,
      "INR",
      `ord_${orderId.slice(-20)}`,
      { orderId, userId, attempt: String(newRetryCount) }
    );

    await prisma.payment.update({
      where: { id: payment.id },
      data:  { providerOrderId: rzpOrder.razorpayOrderId },
    });

    if (retriesRemaining === 0) {
      await prisma.order.update({
        where: { id: orderId },
        data:  { status: "PAYMENT_LOCKED", lockedAt: new Date() },
      });
    }

    return NextResponse.json({
      provider:         "RAZORPAY",
      razorpayOrderId:  rzpOrder.razorpayOrderId,
      keyId:            rzpOrder.keyId,
      paymentId:        payment.id,
      retriesRemaining,
    });
  } catch (err) {
    // Gateway call failed — roll payment status back to FAILED so the user
    // can try again (the retryCount increment stays to prevent bypass).
    await prisma.payment.update({
      where: { id: payment.id },
      data:  { status: "FAILED", failureReason: "Gateway error during retry." },
    });
    console.error("[payments/retry] gateway error", err);
    return NextResponse.json(
      { error: "Gateway error. Please try again later." },
      { status: 502 }
    );
  }
}
