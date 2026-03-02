/**
 * POST /api/webhooks/stripe
 *
 * Handles Stripe webhook events for payment confirmation and failure.
 *
 * Relevant events:
 *   payment_intent.succeeded        → mark Payment PAID; advance Order to PROCESSING
 *   payment_intent.payment_failed   → mark Payment FAILED; increment retryCount;
 *                                     lock Order after MAX_RETRIES
 *
 * Security:
 *   Every request is verified via Stripe's HMAC webhook signature before any DB
 *   write is attempted.  Raw body bytes are used for signature verification —
 *   never parse via req.json() before this step.
 *
 * Idempotency:
 *   All mutations are no-ops if the Payment is already in a terminal state
 *   (PAID / FAILED with retryCount >= MAX_RETRIES).  Stripe may deliver the
 *   same event more than once; this handler returns 200 in all such cases.
 */

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { stripeVerifyWebhook } from "@/lib/payment-gateway";
import { handleStripeRefundWebhook } from "@/lib/actions/refund";
import {
  rollbackOrderStockInTx,
  rollbackOrderStock,
} from "@/lib/actions/stock-reservation";

// Stripe requires the raw body — read via req.arrayBuffer() (App Router default).
// No body-parser config needed: Next.js App Router never pre-parses the body.
const MAX_RETRIES = 3;

export async function POST(req: NextRequest) {
  // ── 1. Read raw bytes (required for HMAC verification) ─────────────────────
  const rawBody   = Buffer.from(await req.arrayBuffer());
  const signature = req.headers.get("stripe-signature") ?? "";

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  // ── 2. Verify signature ─────────────────────────────────────────────────────
  let event: import("stripe").Stripe.Event;
  try {
    event = await stripeVerifyWebhook(rawBody, signature);
  } catch (err) {
    console.error("[webhook/stripe] signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // ── 3. Dispatch ─────────────────────────────────────────────────────────────
  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(
          event.data.object as import("stripe").Stripe.PaymentIntent
        );
        break;

      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(
          event.data.object as import("stripe").Stripe.PaymentIntent
        );
        break;

      // ── Refund lifecycle events ────────────────────────────────────────
      case "charge.refunded":
      case "refund.created":
      case "refund.updated":
      case "refund.failed":
        await handleStripeRefundWebhook(event);
        break;

      default:
        // Unhandled event — acknowledge anyway to stop Stripe retrying.
        break;
    }
  } catch (err) {
    console.error(`[webhook/stripe] handler error for ${event.type}`, err);
    // Return 500 so Stripe retries delivery (do NOT return 400 — that stops retries).
    return NextResponse.json({ error: "Internal handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// payment_intent.succeeded
// ─────────────────────────────────────────────────────────────────────────────

async function handlePaymentIntentSucceeded(
  intent: import("stripe").Stripe.PaymentIntent
) {
  // Find Payment by providerPaymentId — set when the intent was created.
  const payment = await prisma.payment.findUnique({
    where:  { providerPaymentId: intent.id },
    select: { id: true, status: true, orderId: true },
  });

  if (!payment) {
    // Could be a payment not handled by this app — log and continue.
    console.warn(`[webhook/stripe] no Payment found for intent ${intent.id}`);
    return;
  }

  // Idempotency guard — already processed.
  if (payment.status === "PAID") return;

  // ── Atomic success transition ─────────────────────────────────────────────
  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data:  {
        status:    "PAID",
        paidAt:    new Date(),
        metadata:  intent as unknown as import("@prisma/client").Prisma.InputJsonValue,
      },
    }),
    prisma.order.update({
      where: { id: payment.orderId },
      data:  { status: "PROCESSING" },
    }),
    prisma.orderStatusHistory.create({
      data: {
        orderId:     payment.orderId,
        status:      "PROCESSING",
        note:        `Payment confirmed via Stripe (${intent.id})`,
        changedById: "system",
      },
    }),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// payment_intent.payment_failed
// ─────────────────────────────────────────────────────────────────────────────

async function handlePaymentIntentFailed(
  intent: import("stripe").Stripe.PaymentIntent
) {
  const payment = await prisma.payment.findUnique({
    where:  { providerPaymentId: intent.id },
    select: { id: true, status: true, retryCount: true, orderId: true },
  });

  if (!payment) {
    console.warn(`[webhook/stripe] no Payment found for failed intent ${intent.id}`);
    return;
  }

  // ── Idempotency: already confirmed paid — nothing to do ───────────────────
  if (payment.status === "PAID") return;

  // ── Idempotency: previously processed as FAILED — crash-recovery path ─────
  //
  // If the payment is already FAILED and the order is PAYMENT_LOCKED, a prior
  // invocation set the status but may have crashed before (or during) the
  // stock rollback. Re-running rollbackOrderStock is safe — the internal
  // idempotency guard (ROLLED_BACK sentinel) makes it a no-op if already done.
  if (payment.status === "FAILED") {
    const order = await prisma.order.findUnique({
      where:  { id: payment.orderId },
      select: { status: true },
    });
    if (order?.status === "PAYMENT_LOCKED") {
      await rollbackOrderStock(payment.orderId);
    }
    return;
  }

  const failureReason = intent.last_payment_error?.message ?? "Payment failed";

  // ── Atomically stamp Payment FAILED and increment retryCount ─────────────
  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data:  { status: "FAILED", failureReason, retryCount: { increment: 1 } },
    select: { retryCount: true },
  });

  if (updated.retryCount >= MAX_RETRIES) {
    // ── Terminal failure: rollback stock + lock order in one atomic tx ──────
    //
    // Serializable isolation ensures:
    //   • rollbackOrderStockInTx reads a consistent snapshot of StockReservation
    //     rows and cannot interleave with another rollback call for same order.
    //   • ROLLED_BACK sentinel is written last inside rollbackOrderStockInTx,
    //     so a crash before that point leaves the guard clear for retry.
    await prisma.$transaction(
      async (tx) => {
        await rollbackOrderStockInTx(tx, payment.orderId);
        await tx.order.update({
          where: { id: payment.orderId },
          data:  { status: "PAYMENT_LOCKED", lockedAt: new Date() },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId:     payment.orderId,
            status:      "PAYMENT_LOCKED" as import("@prisma/client").OrderStatus,
            note:        `Order locked after ${MAX_RETRIES} failed payment attempts. Stock restored.`,
            changedById: "system",
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 },
    );
  } else {
    // ── Transient failure: surface state to Order so dashboards stay correct ─
    //
    // Order stays in PAYMENT_FAILED until the user initiates a retry, at which
    // point the retry route resets it back to PENDING. Stock is NOT restored
    // here — the order is still live and the user has remaining attempts.
    await prisma.$transaction([
      prisma.order.update({
        where: { id: payment.orderId },
        data:  { status: "PAYMENT_FAILED" as import("@prisma/client").OrderStatus },
      }),
      prisma.orderStatusHistory.create({
        data: {
          orderId:     payment.orderId,
          status:      "PAYMENT_FAILED" as import("@prisma/client").OrderStatus,
          note:        `Payment attempt failed: ${failureReason}`,
          changedById: "system",
        },
      }),
    ]);
  }
}
