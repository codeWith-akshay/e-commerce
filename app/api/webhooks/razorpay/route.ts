/**
 * POST /api/webhooks/razorpay
 *
 * Handles Razorpay webhook events for payment confirmation and failure.
 *
 * Relevant events:
 *   payment.captured  → mark Payment PAID; advance Order to PROCESSING
 *   payment.failed    → mark Payment FAILED; increment retryCount;
 *                       lock Order after MAX_RETRIES
 *
 * Security:
 *   Signature is verified via HMAC-SHA256 using RAZORPAY_KEY_SECRET before any
 *   DB write.  Raw body string is used — never json-parse before this step.
 *
 * Idempotency:
 *   All mutations check current status and are no-ops if already terminal.
 *   Razorpay guarantees at-least-once delivery; this handler is safe to re-run.
 */

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { razorpayVerifyWebhook } from "@/lib/payment-gateway";
import { handleRazorpayRefundWebhook } from "@/lib/actions/refund";
import {
  rollbackOrderStockInTx,
  rollbackOrderStock,
} from "@/lib/actions/stock-reservation";

const MAX_RETRIES = 3;

// ── Razorpay webhook payload shapes (minimal) ──────────────────────────────

interface RazorpayPaymentCapturedPayload {
  payment: {
    entity: {
      id:         string;   // razorpay payment id — becomes providerPaymentId
      order_id:   string;   // razorpay order id   — matches providerOrderId
      amount:     number;   // in paise
      currency:   string;
      status:     string;
      captured:   boolean;
      method:     string;
      error_code?:         string;
      error_description?:  string;
    };
  };
}

export async function POST(req: NextRequest) {
  // ── 1. Read raw body ────────────────────────────────────────────────────────
  const rawBody   = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";

  if (!signature) {
    return NextResponse.json({ error: "Missing x-razorpay-signature header" }, { status: 400 });
  }

  // ── 2. Verify signature ─────────────────────────────────────────────────────
  try {
    await razorpayVerifyWebhook(rawBody, signature);
  } catch (err) {
    console.error("[webhook/razorpay] signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // ── 3. Parse event ──────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: { event: string; payload: any };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  // ── 4. Dispatch ─────────────────────────────────────────────────────────────
  try {
    switch (body.event) {
      case "payment.captured": {
        const entity = body.payload?.payment?.entity;
        if (entity) await handlePaymentCaptured(entity);
        break;
      }

      case "payment.failed": {
        const entity = body.payload?.payment?.entity;
        if (entity) await handlePaymentFailed(entity);
        break;
      }

      // ── Refund lifecycle events ────────────────────────────────────────────
      case "refund.processed":
      case "refund.speed.changed":
      case "refund.failed":
        await handleRazorpayRefundWebhook(body as Parameters<typeof handleRazorpayRefundWebhook>[0]);
        break;

      default:
        // Acknowledge all other events so Razorpay stops retrying them.
        break;
    }
  } catch (err) {
    console.error(`[webhook/razorpay] handler error for ${body.event}`, err);
    return NextResponse.json({ error: "Internal handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// payment.captured
// ─────────────────────────────────────────────────────────────────────────────

async function handlePaymentCaptured(
  entity: RazorpayPaymentCapturedPayload["payment"]["entity"]
) {
  // Razorpay sends order_id (their order) — look up our Payment via providerOrderId.
  const payment = await prisma.payment.findFirst({
    where:  { providerOrderId: entity.order_id },
    select: { id: true, status: true, orderId: true },
  });

  if (!payment) {
    console.warn(`[webhook/razorpay] no Payment for order_id ${entity.order_id}`);
    return;
  }

  // Idempotency guard.
  if (payment.status === "PAID") return;

  // Store Razorpay's payment id now that we have it (was unknown at order creation).
  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data:  {
        status:            "PAID",
        paidAt:            new Date(),
        providerPaymentId: entity.id,    // rzp_pay_xxx
        metadata:          entity as unknown as import("@prisma/client").Prisma.InputJsonValue,
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
        note:        `Payment confirmed via Razorpay (${entity.id})`,
        changedById: "system",
      },
    }),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// payment.failed
// ─────────────────────────────────────────────────────────────────────────────

async function handlePaymentFailed(
  entity: RazorpayPaymentCapturedPayload["payment"]["entity"]
) {
  const payment = await prisma.payment.findFirst({
    where:  { providerOrderId: entity.order_id },
    select: { id: true, status: true, retryCount: true, orderId: true },
  });

  if (!payment) {
    console.warn(`[webhook/razorpay] no Payment for failed order_id ${entity.order_id}`);
    return;
  }

  // ── Idempotency: already confirmed paid — nothing to do ───────────────────
  if (payment.status === "PAID") return;

  // ── Idempotency: previously processed as FAILED — crash-recovery path ─────
  //
  // If the order is PAYMENT_LOCKED, the rollback may not have run (crash after
  // status update).  Re-triggering rollbackOrderStock is always safe — its
  // internal ROLLED_BACK guard makes it a no-op when already complete.
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

  const failureReason = entity.error_description ?? "Payment failed";

  // ── Atomically stamp Payment FAILED and increment retryCount ─────────────
  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data:  { status: "FAILED", failureReason, retryCount: { increment: 1 } },
    select: { retryCount: true },
  });

  if (updated.retryCount >= MAX_RETRIES) {
    // ── Terminal failure: rollback stock + lock order in one atomic tx ──────
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
    // ── Transient failure: surface state so dashboards stay current ─────────
    //
    // Stock is intentionally NOT restored here — the order is still live and
    // the user has remaining retry attempts.  The retry route resets the
    // order back to PENDING when a new payment attempt is initiated.
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
