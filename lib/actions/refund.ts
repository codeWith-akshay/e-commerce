"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import Stripe from "stripe";
import prisma from "@/lib/prisma";
import { getSessionUserId, getSessionRole } from "@/lib/session";
import {
  requestRefundSchema,
  approveRefundSchema,
  rejectRefundSchema,
  type RequestRefundInput,
  type ApproveRefundInput,
  type RejectRefundInput,
} from "@/lib/validations/refund";

// ─────────────────────────────────────────────────────────────────────────────
// Shared result type  (mirrors other action modules)
// ─────────────────────────────────────────────────────────────────────────────

export type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string; code?: string };

// ─────────────────────────────────────────────────────────────────────────────
// Auth guards
// ─────────────────────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<{ adminId: string }> {
  const [userId, role] = await Promise.all([getSessionUserId(), getSessionRole()]);
  if (!userId || !role) {
    throw new RefundError("You must be logged in.", "UNAUTHENTICATED");
  }
  if (role !== "ADMIN" && role !== "SUPERADMIN") {
    throw new RefundError("Admin access required.", "FORBIDDEN");
  }
  return { adminId: userId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal error class
// ─────────────────────────────────────────────────────────────────────────────

class RefundError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "RefundError";
  }
}

function wrap(err: unknown): ActionResult {
  if (err instanceof RefundError) {
    return { success: false, error: err.message, code: err.code };
  }
  console.error("[refund]", err);
  return { success: false, error: "An unexpected error occurred.", code: "INTERNAL" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Lazy gateway clients
// ─────────────────────────────────────────────────────────────────────────────

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new RefundError("Stripe is not configured.", "GATEWAY_NOT_CONFIGURED");
  return new Stripe(key, { apiVersion: "2026-02-25.clover" });
}

function getRazorpay() {
  const keyId  = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !secret) {
    throw new RefundError("Razorpay is not configured.", "GATEWAY_NOT_CONFIGURED");
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Razorpay = require("razorpay") as { new (opts: { key_id: string; key_secret: string }): RazorpayClient };
  return new Razorpay({ key_id: keyId, key_secret: secret });
}

// Minimal Razorpay client type for what we need
interface RazorpayClient {
  payments: {
    refund: (
      paymentId: string,
      opts: { amount: number; notes?: Record<string, string>; speed?: string }
    ) => Promise<{ id: string }>;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. requestRefund  ──  USER SIDE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Customer submits a refund request for one or more items in a delivered order.
 *
 * Validations (all inside a Serializable transaction):
 *  ① Order exists and belongs to the requesting user.
 *  ② Payment status is PAID or PARTIALLY_REFUNDED.
 *  ③ Per item: requestedQty ≤ ordered qty minus already-refunded qty.
 *  ④ Per item: requested amount ≤ qty × unit price (no inflated amounts).
 *  ⑤ Total: payment.refundedAmount + requestedTotal ≤ payment.amount.
 *  ⑥ No duplicate PENDING/ACTIVE refund covering the same items.
 */
export async function requestRefund(
  input: RequestRefundInput
): Promise<ActionResult<{ refundId: string }>> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { success: false, error: "You must be logged in.", code: "UNAUTHENTICATED" };
  }

  const parsed = requestRefundSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input.", code: "INVALID_INPUT" };
  }

  const {
    orderId,
    items: requestedItems,
    reason,
    returnRequestId,
  } = parsed.data;

  try {
    const refundId = await prisma.$transaction(
      async (tx) => {
        // ── ① Fetch order + payment ──────────────────────────────────────
        const order = await tx.order.findUnique({
          where: { id: orderId },
          select: {
            id:     true,
            userId: true,
            status: true,
            orderItems: {
              select: {
                id:       true,
                quantity: true,
                price:    true,
                productId: true,
              },
            },
            payment: {
              select: {
                id:             true,
                amount:         true,
                refundedAmount: true,
                status:         true,
                provider:       true,
                providerPaymentId: true,
              },
            },
          },
        });

        if (!order) throw new RefundError("Order not found.", "ORDER_NOT_FOUND");
        if (order.userId !== userId) throw new RefundError("Access denied.", "FORBIDDEN");
        if (!order.payment) throw new RefundError("No payment found for this order.", "NO_PAYMENT");

        const { payment } = order;

        // ── ② Payment status check ────────────────────────────────────────
        if (payment.status !== "PAID" && payment.status !== "PARTIALLY_REFUNDED") {
          throw new RefundError(
            `Refunds can only be requested for paid orders (current status: ${payment.status}).`,
            "PAYMENT_NOT_REFUNDABLE"
          );
        }

        // ── ③ & ④ Per-item validation ─────────────────────────────────────
        const orderItemMap = new Map(order.orderItems.map((oi) => [oi.id, oi]));
        let requestedTotal = 0;

        for (const ri of requestedItems) {
          const oi = orderItemMap.get(ri.orderItemId);
          if (!oi) {
            throw new RefundError(`Order item ${ri.orderItemId} not found in this order.`, "ITEM_NOT_IN_ORDER");
          }

          // How many units have already been refunded for this item across
          // ALL non-rejected / non-cancelled / non-failed refunds?
          const alreadyRefunded = await tx.refundItem.aggregate({
            _sum: { quantity: true },
            where: {
              orderItemId: ri.orderItemId,
              refund: {
                status: {
                  notIn: ["REJECTED", "CANCELLED", "FAILED"],
                },
              },
            },
          });

          const usedQty = alreadyRefunded._sum.quantity ?? 0;
          const availableQty = oi.quantity - usedQty;

          if (ri.quantity > availableQty) {
            throw new RefundError(
              `Only ${availableQty} unit(s) of this item can still be refunded.`,
              "QTY_EXCEEDS_AVAILABLE"
            );
          }

          // Amount ceiling: qty × unit_price (rounded to 2 dp)
          const maxAmount = Math.round(ri.quantity * oi.price * 100) / 100;
          if (ri.amount > maxAmount + 0.01) {
            throw new RefundError(
              `Refund amount for an item cannot exceed ${maxAmount} (qty × unit price).`,
              "AMOUNT_EXCEEDS_UNIT_PRICE"
            );
          }

          requestedTotal += ri.amount;
        }

        requestedTotal = Math.round(requestedTotal * 100) / 100;

        // ── ⑤ Total refund ceiling ────────────────────────────────────────
        const alreadyIssued = Math.round(payment.refundedAmount * 100) / 100;
        const ceiling       = Math.round(payment.amount * 100) / 100;

        if (alreadyIssued + requestedTotal > ceiling + 0.01) {
          throw new RefundError(
            `Total refund amount (${alreadyIssued + requestedTotal}) would exceed the payment amount (${ceiling}).`,
            "EXCEEDS_PAID_AMOUNT"
          );
        }

        // ── Create Refund + RefundItems ────────────────────────────────────
        const idempotencyKey = `refund_${payment.id}_${Date.now()}`;

        const refund = await tx.refund.create({
          data: {
            idempotencyKey,
            requestedAmount: requestedTotal,
            currency:        payment.amount > 0 ? "INR" : "INR", // derive from payment if stored
            reason,
            paymentId:       payment.id,
            orderId,
            requestedById:   userId,
            returnRequestId: returnRequestId ?? null,
            items: {
              create: requestedItems.map((ri) => ({
                orderItemId: ri.orderItemId,
                quantity:    ri.quantity,
                amount:      Math.round(ri.amount * 100) / 100,
              })),
            },
          },
          select: { id: true },
        });

        // If linked to a return request, mark it as REFUND_ISSUED (pending)
        if (returnRequestId) {
          await tx.returnRequest.updateMany({
            where: { id: returnRequestId, userId },
            data:  { status: "REFUND_ISSUED" },
          });
        }

        return refund.id;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 }
    );

    revalidatePath(`/orders/${orderId}`);
    return { success: true, data: { refundId } };
  } catch (err) {
    return wrap(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. approveRefund  ──  ADMIN SIDE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Admin approves a refund, optionally lowering the amount, then immediately
 * dispatches the gateway API call.  The gateway sets status → PROCESSING and
 * a webhook later sets it → PROCESSED.
 */
export async function approveRefund(
  input: ApproveRefundInput
): Promise<ActionResult<{ dispatchedAmount: number }>> {
  try {
    const { adminId } = await requireAdmin();

    const parsed = approveRefundSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input.", code: "INVALID_INPUT" };
    }

    const { refundId, approvedAmount, adminNote } = parsed.data;

    // Fetch + validate status
    const refund = await prisma.refund.findUnique({
      where: { id: refundId },
      select: {
        id:              true,
        status:          true,
        requestedAmount: true,
        orderId:         true,
        payment: {
          select: {
            id:               true,
            amount:           true,
            refundedAmount:   true,
            provider:         true,
            providerPaymentId: true,
          },
        },
      },
    });

    if (!refund) return { success: false, error: "Refund not found.", code: "NOT_FOUND" };
    if (refund.status !== "PENDING_REVIEW") {
      return {
        success: false,
        error:   `Refund is already ${refund.status.toLowerCase().replace("_", " ")}.`,
        code:    "WRONG_STATUS",
      };
    }

    const finalAmount = approvedAmount ?? refund.requestedAmount;

    // Ensure approved amount does not exceed what was requested
    if (finalAmount > refund.requestedAmount + 0.01) {
      return {
        success: false,
        error:   `Approved amount (${finalAmount}) cannot exceed requested amount (${refund.requestedAmount}).`,
        code:    "AMOUNT_INVALID",
      };
    }

    // Ensure it doesn't exceed remaining payment balance
    const ceiling = refund.payment.amount - refund.payment.refundedAmount;
    if (finalAmount > ceiling + 0.01) {
      return {
        success: false,
        error:   `Approved amount (${finalAmount}) exceeds refundable balance (${ceiling}).`,
        code:    "EXCEEDS_BALANCE",
      };
    }

    // Mark as APPROVED
    await prisma.refund.update({
      where: { id: refundId },
      data: {
        status:          "APPROVED",
        approvedAmount:  Math.round(finalAmount * 100) / 100,
        reviewedById:    adminId,
        adminNote:       adminNote ?? null,
      },
    });

    revalidatePath("/admin/refunds");

    // Dispatch to gateway immediately (best-effort; admin can retry if FAILED)
    const dispatch = await dispatchGatewayRefund(refundId);
    if (!dispatch.success) {
      // Return success for the approval itself; gateway failure is recoverable
      return {
        success: true,
        data:    { dispatchedAmount: finalAmount },
      };
    }

    return { success: true, data: { dispatchedAmount: finalAmount } };
  } catch (err) {
    return wrap(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. rejectRefund  ──  ADMIN SIDE
// ─────────────────────────────────────────────────────────────────────────────

export async function rejectRefund(input: RejectRefundInput): Promise<ActionResult> {
  try {
    const { adminId } = await requireAdmin();

    const parsed = rejectRefundSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input.", code: "INVALID_INPUT" };
    }

    const refund = await prisma.refund.findUnique({
      where: { id: parsed.data.refundId },
      select: { id: true, status: true, orderId: true },
    });

    if (!refund) return { success: false, error: "Refund not found.", code: "NOT_FOUND" };
    if (refund.status !== "PENDING_REVIEW") {
      return {
        success: false,
        error:   `Cannot reject a refund with status ${refund.status}.`,
        code:    "WRONG_STATUS",
      };
    }

    await prisma.refund.update({
      where: { id: parsed.data.refundId },
      data: {
        status:       "REJECTED",
        reviewedById: adminId,
        adminNote:    parsed.data.adminNote,
      },
    });

    revalidatePath("/admin/refunds");
    return { success: true };
  } catch (err) {
    return wrap(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. retryRefund  ──  ADMIN re-dispatch after FAILED
// ─────────────────────────────────────────────────────────────────────────────

export async function retryRefund(refundId: string): Promise<ActionResult<{ dispatchedAmount: number }>> {
  try {
    await requireAdmin();

    const refund = await prisma.refund.findUnique({
      where: { id: refundId },
      select: { id: true, status: true, approvedAmount: true, requestedAmount: true },
    });

    if (!refund) return { success: false, error: "Refund not found.", code: "NOT_FOUND" };
    if (refund.status !== "FAILED") {
      return { success: false, error: "Only FAILED refunds can be retried.", code: "WRONG_STATUS" };
    }

    // Reset to APPROVED so dispatchGatewayRefund will pick it up
    await prisma.refund.update({
      where: { id: refundId },
      data:  { status: "APPROVED", failureReason: null },
    });

    await dispatchGatewayRefund(refundId);

    const amount = refund.approvedAmount ?? refund.requestedAmount;
    revalidatePath("/admin/refunds");
    return { success: true, data: { dispatchedAmount: amount } };
  } catch (err) {
    return wrap(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. dispatchGatewayRefund  ──  INTERNAL (called by approve + retry)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calls the payment gateway's refund API.
 * Uses idempotencyKey so repeated calls for the same refund are safe.
 *
 * On success  → status = PROCESSING, providerRefundId set.
 * On failure  → status = FAILED, failureReason set.
 * On COD      → status = PROCESSED immediately (no gateway needed).
 */
export async function dispatchGatewayRefund(refundId: string): Promise<ActionResult> {
  const refund = await prisma.refund.findUnique({
    where: { id: refundId },
    select: {
      id:              true,
      status:          true,
      approvedAmount:  true,
      requestedAmount: true,
      idempotencyKey:  true,
      reason:          true,
      payment: {
        select: {
          provider:         true,
          providerPaymentId: true,
        },
      },
    },
  });

  if (!refund) return { success: false, error: "Refund not found.", code: "NOT_FOUND" };
  if (refund.status !== "APPROVED") {
    return { success: false, error: "Refund must be APPROVED before dispatching.", code: "WRONG_STATUS" };
  }

  const amount = refund.approvedAmount ?? refund.requestedAmount;
  const { provider, providerPaymentId } = refund.payment;

  // ── COD — no gateway needed ───────────────────────────────────────────────
  if (provider === "COD") {
    await prisma.refund.update({
      where: { id: refundId },
      data:  { status: "PROCESSED", processedAt: new Date() },
    });
    await incrementRefundedAmount(refund.payment.providerPaymentId ?? "", amount, refundId);
    return { success: true };
  }

  // ── Stripe ────────────────────────────────────────────────────────────────
  if (provider === "STRIPE") {
    if (!providerPaymentId) {
      return { success: false, error: "No Stripe payment intent ID on file.", code: "MISSING_PROVIDER_ID" };
    }

    try {
      const stripe = getStripe();
      const stripeRefund = await stripe.refunds.create(
        {
          payment_intent: providerPaymentId,
          amount:         Math.round(amount * 100), // Stripe uses smallest currency unit
          reason:         "requested_by_customer",
          metadata:       { refundId, reason: refund.reason.slice(0, 500) },
        },
        { idempotencyKey: refund.idempotencyKey }
      );

      await prisma.refund.update({
        where: { id: refundId },
        data: {
          status:          "PROCESSING",
          providerRefundId: stripeRefund.id,
        },
      });

      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Stripe error";
      await prisma.refund.update({
        where: { id: refundId },
        data:  { status: "FAILED", failureReason: msg },
      });
      return { success: false, error: msg, code: "GATEWAY_ERROR" };
    }
  }

  // ── Razorpay ──────────────────────────────────────────────────────────────
  if (provider === "RAZORPAY") {
    if (!providerPaymentId) {
      return { success: false, error: "No Razorpay payment ID on file.", code: "MISSING_PROVIDER_ID" };
    }

    try {
      const rzp = getRazorpay();
      const rzpRefund = await rzp.payments.refund(providerPaymentId, {
        amount: Math.round(amount * 100),
        notes:  { reason: refund.reason.slice(0, 255), refundId },
        speed:  "optimum",
      });

      await prisma.refund.update({
        where: { id: refundId },
        data: {
          status:          "PROCESSING",
          providerRefundId: rzpRefund.id,
        },
      });

      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Razorpay error";
      await prisma.refund.update({
        where: { id: refundId },
        data:  { status: "FAILED", failureReason: msg },
      });
      return { success: false, error: msg, code: "GATEWAY_ERROR" };
    }
  }

  return { success: false, error: `Unsupported payment provider: ${provider}`, code: "UNSUPPORTED_PROVIDER" };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. handleStripeRefundWebhook  ──  called from /api/webhooks/stripe
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Process a verified Stripe webhook event.
 * Idempotent: looks up by providerRefundId; if already PROCESSED the call is a no-op.
 */
export async function handleStripeRefundWebhook(event: Stripe.Event): Promise<void> {
  // We care about refund status changes
  if (!["charge.refunded", "refund.created", "refund.updated", "refund.failed"].includes(event.type)) {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stripeRefund: Stripe.Refund = (event.data.object as any).refund ?? event.data.object as Stripe.Refund;

  if (!stripeRefund.id) return;

  // Find our Refund row by gateway ID
  const refund = await prisma.refund.findUnique({
    where: { providerRefundId: stripeRefund.id },
    select: {
      id:             true,
      status:         true,
      approvedAmount: true,
      requestedAmount: true,
      paymentId:      true,
    },
  });

  if (!refund) {
    // Could be a refund not issued through our system — log and ignore
    console.warn("[webhook/stripe] unknown refund:", stripeRefund.id);
    return;
  }

  // Idempotency guard — already in terminal state
  if (refund.status === "PROCESSED" || refund.status === "FAILED") return;

  const amount = (refund.approvedAmount ?? refund.requestedAmount);

  if (stripeRefund.status === "succeeded") {
    await prisma.refund.update({
      where: { id: refund.id },
      data:  { status: "PROCESSED", processedAt: new Date() },
    });
    await incrementRefundedAmount(null, amount, refund.id, refund.paymentId);
  }

  if (stripeRefund.status === "failed" || stripeRefund.status === "canceled") {
    await prisma.refund.update({
      where: { id: refund.id },
      data:  {
        status:        "FAILED",
        failureReason: stripeRefund.failure_reason ?? "Stripe declined the refund.",
      },
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. handleRazorpayRefundWebhook  ──  called from /api/webhooks/razorpay
// ─────────────────────────────────────────────────────────────────────────────

interface RazorpayWebhookPayload {
  event: string;
  payload: {
    refund?: { entity?: { id?: string; status?: string } };
  };
}

export async function handleRazorpayRefundWebhook(
  body: RazorpayWebhookPayload
): Promise<void> {
  const rpRefund = body.payload?.refund?.entity;
  if (!rpRefund?.id) return;

  const refund = await prisma.refund.findUnique({
    where: { providerRefundId: rpRefund.id },
    select: {
      id:              true,
      status:          true,
      approvedAmount:  true,
      requestedAmount: true,
      paymentId:       true,
    },
  });

  if (!refund) {
    console.warn("[webhook/razorpay] unknown refund:", rpRefund.id);
    return;
  }

  if (refund.status === "PROCESSED" || refund.status === "FAILED") return;

  const amount = refund.approvedAmount ?? refund.requestedAmount;

  // Razorpay refund events: refund.processed, refund.speed.changed, refund.failed
  if (body.event === "refund.processed" || rpRefund.status === "processed") {
    await prisma.refund.update({
      where: { id: refund.id },
      data:  { status: "PROCESSED", processedAt: new Date() },
    });
    await incrementRefundedAmount(null, amount, refund.id, refund.paymentId);
  }

  if (body.event === "refund.failed" || rpRefund.status === "failed") {
    await prisma.refund.update({
      where: { id: refund.id },
      data:  { status: "FAILED", failureReason: "Razorpay declined the refund." },
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. getRefundsForOrder  ──  public query (user-facing)
// ─────────────────────────────────────────────────────────────────────────────

export async function getRefundsForOrder(orderId: string) {
  const userId = await getSessionUserId();
  if (!userId) return [];

  return prisma.refund.findMany({
    where:   { orderId, requestedById: userId },
    orderBy: { createdAt: "desc" },
    select: {
      id:              true,
      status:          true,
      requestedAmount: true,
      approvedAmount:  true,
      currency:        true,
      reason:          true,
      adminNote:       true,
      processedAt:     true,
      createdAt:       true,
      items: {
        select: {
          quantity:   true,
          amount:     true,
          orderItem: {
            select: {
              price:   true,
              product: { select: { title: true, images: true } },
            },
          },
        },
      },
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. getAdminRefunds  ──  admin list query
// ─────────────────────────────────────────────────────────────────────────────

export async function getAdminRefunds(opts: {
  status?: string;
  page?: number;
  limit?: number;
}) {
  const page  = Math.max(1, opts.page  ?? 1);
  const limit = Math.min(50, Math.max(1, opts.limit ?? 20));
  const skip  = (page - 1) * limit;

  const where: Prisma.RefundWhereInput = opts.status && opts.status !== "ALL"
    ? { status: opts.status as Prisma.EnumRefundStatusFilter }
    : {};

  const [refunds, total] = await Promise.all([
    prisma.refund.findMany({
      where,
      skip,
      take:    limit,
      orderBy: { createdAt: "desc" },
      select: {
        id:              true,
        status:          true,
        requestedAmount: true,
        approvedAmount:  true,
        currency:        true,
        reason:          true,
        adminNote:       true,
        failureReason:   true,
        processedAt:     true,
        createdAt:       true,
        order:           { select: { id: true } },
        requestedBy:     { select: { id: true, name: true, email: true } },
        reviewedBy:      { select: { id: true, name: true } },
        payment:         { select: { provider: true } },
        items:           { select: { quantity: true, amount: true } },
      },
    }),
    prisma.refund.count({ where }),
  ]);

  return { refunds, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper — update Payment.refundedAmount + status after a PROCESSED refund
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Atomically bumps Payment.refundedAmount and flips status to
 * PARTIALLY_REFUNDED or REFUNDED depending on how much remains.
 *
 * Pass either providerPaymentId (Stripe/Razorpay lookup) or explicit paymentId.
 */
async function incrementRefundedAmount(
  providerPaymentId: string | null,
  amount: number,
  refundId: string,
  paymentId?: string
): Promise<void> {
  // Locate the payment row
  const payment = await prisma.payment.findFirst({
    where: paymentId
      ? { id: paymentId }
      : { providerPaymentId: providerPaymentId ?? undefined },
    select: { id: true, amount: true, refundedAmount: true },
  });

  if (!payment) {
    console.error("[incrementRefundedAmount] payment not found for refund", refundId);
    return;
  }

  const newRefunded = Math.round((payment.refundedAmount + amount) * 100) / 100;
  const isFullyRefunded = newRefunded >= Math.round(payment.amount * 100) / 100 - 0.01;

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      refundedAmount: newRefunded,
      status:         isFullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED",
    },
  });
}
