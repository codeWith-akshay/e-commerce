/**
 * POST /api/payments/create-intent
 *
 * Creates a gateway PaymentIntent / Razorpay Order for an existing order and
 * persists a Payment row.  Called immediately after the user submits checkout.
 *
 * Body: { orderId: string; provider: "STRIPE" | "RAZORPAY" }
 *
 * Returns (Stripe):   { provider, clientSecret, paymentId }
 * Returns (Razorpay): { provider, razorpayOrderId, keyId, paymentId }
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import {
  stripeCreateIntent,
  razorpayCreateOrder,
} from "@/lib/payment-gateway";

const MAX_RETRIES = 3;

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: { orderId?: string; provider?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { orderId, provider } = body;

  if (!orderId?.trim()) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  }
  if (provider !== "STRIPE" && provider !== "RAZORPAY") {
    return NextResponse.json(
      { error: 'provider must be "STRIPE" or "RAZORPAY"' },
      { status: 400 }
    );
  }

  // ── Load order (ownership check) ────────────────────────────────────────────
  const order = await prisma.order.findUnique({
    where: { id: orderId, userId },
    select: {
      id:          true,
      totalAmount: true,
      status:      true,
      lockedAt:    true,
      payment:     { select: { id: true, status: true, retryCount: true } },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // ── Guard: order is locked after exhausted retries ──────────────────────────
  if (order.status === "PAYMENT_LOCKED") {
    return NextResponse.json(
      {
        error:
          "This order has been locked after too many failed payment attempts. " +
          "Please contact support.",
        code: "ORDER_PAYMENT_LOCKED",
      },
      { status: 422 }
    );
  }

  // ── Guard: payment already confirmed ────────────────────────────────────────
  if (order.payment?.status === "PAID") {
    return NextResponse.json(
      { error: "This order has already been paid.", code: "ALREADY_PAID" },
      { status: 422 }
    );
  }

  // ── Guard: retry count gate (handled here if Payment row exists already) ────
  if (order.payment && order.payment.retryCount >= MAX_RETRIES) {
    // Lock the order and refuse further intents — belt-and-suspenders guard.
    await prisma.order.update({
      where: { id: orderId },
      data:  { status: "PAYMENT_LOCKED", lockedAt: new Date() },
    });
    return NextResponse.json(
      {
        error: "Maximum payment attempts reached. Order has been locked.",
        code:  "MAX_RETRIES_EXCEEDED",
      },
      { status: 422 }
    );
  }

  // ── Amount in minor units ────────────────────────────────────────────────────
  // totalAmount stored as Float (INR) → convert to paise
  const amountMinor = Math.round(order.totalAmount * 100);

  // Idempotency key: stable per (order, attempt number) so retrying this API
  // call with the same attempt number never double-creates an intent.
  const attemptNumber = (order.payment?.retryCount ?? 0) + 1;
  const idempotencyKey = `order_${orderId}_attempt_${attemptNumber}`;

  try {
    if (provider === "STRIPE") {
      const intent = await stripeCreateIntent(
        amountMinor,
        "inr",
        { orderId, userId },
        idempotencyKey
      );

      // Upsert Payment row — create on first call, update providerPaymentId on re-call.
      const payment = await prisma.payment.upsert({
        where:  { orderId },
        create: {
          orderId,
          userId,
          amount:            order.totalAmount,
          currency:          "INR",
          status:            "PENDING",
          provider:          "STRIPE",
          providerPaymentId: intent.providerPaymentId,
          retryCount:        0,
        },
        update: {
          providerPaymentId: intent.providerPaymentId,
          status:            "PENDING",
        },
        select: { id: true },
      });

      return NextResponse.json({
        provider:     "STRIPE",
        clientSecret: intent.clientSecret,
        paymentId:    payment.id,
      });
    }

    // ── Razorpay ─────────────────────────────────────────────────────────────
    const rzpOrder = await razorpayCreateOrder(
      amountMinor,
      "INR",
      `ord_${orderId.slice(-20)}`, // receipt: ≤40 chars
      { orderId, userId }
    );

    const payment = await prisma.payment.upsert({
      where:  { orderId },
      create: {
        orderId,
        userId,
        amount:         order.totalAmount,
        currency:       "INR",
        status:         "PENDING",
        provider:       "RAZORPAY",
        providerOrderId: rzpOrder.razorpayOrderId,
        retryCount:     0,
      },
      update: {
        providerOrderId: rzpOrder.razorpayOrderId,
        status:          "PENDING",
      },
      select: { id: true },
    });

    return NextResponse.json({
      provider:        "RAZORPAY",
      razorpayOrderId: rzpOrder.razorpayOrderId,
      keyId:           rzpOrder.keyId,
      paymentId:       payment.id,
    });
  } catch (err) {
    console.error("[payments/create-intent]", err);
    return NextResponse.json(
      { error: "Failed to create payment intent. Please try again." },
      { status: 502 }
    );
  }
}
