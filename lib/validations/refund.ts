/**
 * lib/validations/refund.ts
 *
 * Zod schemas for the full refund lifecycle:
 *   requestRefund  — customer-side submission
 *   approveRefund  — admin approval (with optional amount override)
 *   rejectRefund   — admin rejection
 */

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

const positiveAmount = z
  .number({ error: "Amount must be a number." })
  .positive("Amount must be positive.")
  .multipleOf(0.01, "Amount must have at most 2 decimal places.");

// ─────────────────────────────────────────────────────────────────────────────
// requestRefundSchema  (user-facing)
// ─────────────────────────────────────────────────────────────────────────────

export const refundItemSchema = z.object({
  /** OrderItem.id being refunded. */
  orderItemId: z.string().cuid("Invalid order item ID."),
  /** How many units of this item to refund (must be ≥ 1). */
  quantity: z
    .number({ error: "Quantity must be a number." })
    .int("Quantity must be a whole number.")
    .min(1, "Quantity must be at least 1."),
  /**
   * Amount the customer expects for this line.
   * Validated server-side against quantity × unit price from the database.
   */
  amount: positiveAmount,
});

export const requestRefundSchema = z.object({
  orderId: z.string().cuid("Invalid order ID."),
  items: z
    .array(refundItemSchema)
    .min(1, "Select at least one item to refund.")
    .max(50),
  /** Customer-supplied explanation — shown to admin and kept in history. */
  reason: z.string().min(10, "Describe your reason (min 10 characters).").max(1_000).trim(),
  /** Optional: link this refund to an existing return request. */
  returnRequestId: z.string().cuid().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// approveRefundSchema  (admin-facing)
// ─────────────────────────────────────────────────────────────────────────────

export const approveRefundSchema = z.object({
  refundId: z.string().cuid("Invalid refund ID."),
  /**
   * Admin may approve a lower amount than requested (partial approval).
   * Omit to approve the full requested amount.
   */
  approvedAmount: positiveAmount.optional(),
  adminNote: z.string().max(1_000).trim().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// rejectRefundSchema  (admin-facing)
// ─────────────────────────────────────────────────────────────────────────────

export const rejectRefundSchema = z.object({
  refundId: z.string().cuid("Invalid refund ID."),
  adminNote: z.string().min(5, "Provide a reason for rejection (min 5 chars).").max(1_000).trim(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Inferred types
// ─────────────────────────────────────────────────────────────────────────────

export type RequestRefundInput  = z.infer<typeof requestRefundSchema>;
export type RefundItemInput     = z.infer<typeof refundItemSchema>;
export type ApproveRefundInput  = z.infer<typeof approveRefundSchema>;
export type RejectRefundInput   = z.infer<typeof rejectRefundSchema>;
