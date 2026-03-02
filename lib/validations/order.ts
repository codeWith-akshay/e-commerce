/**
 * lib/validations/order.ts
 *
 * Zod schemas for order placement, address, and status updates.
 */

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Address
// ─────────────────────────────────────────────────────────────────────────────

export const addressSchema = z.object({
  label:        z.string().max(50).default("Home"),
  fullName:     z.string().min(1, "Full name is required.").max(100).trim(),
  phone:        z
    .string()
    .min(7, "Enter a valid phone number.")
    .max(20)
    .regex(/^[+\d\s\-()]+$/, "Enter a valid phone number."),
  addressLine1: z.string().min(1, "Address is required.").max(255).trim(),
  addressLine2: z.string().max(255).trim().optional().nullable(),
  city:         z.string().min(1, "City is required.").max(100).trim(),
  state:        z.string().min(1, "State is required.").max(100).trim(),
  country:      z.string().length(2, "Use 2-letter country code.").default("IN"),
  postalCode:   z.string().min(3, "Postal code is required.").max(20).trim(),
  isDefault:    z.boolean().default(false),
});

// ─────────────────────────────────────────────────────────────────────────────
// Checkout
// ─────────────────────────────────────────────────────────────────────────────

export const checkoutSchema = z.object({
  /** Existing saved address ID — use this OR provide newAddress. */
  addressId:       z.string().cuid().optional(),
  /** Inline new address to save and use for this order. */
  newAddress:      addressSchema.optional(),
  /** Optional discount coupon code. */
  couponCode:      z.string().max(30).trim().toUpperCase().optional(),
  paymentProvider: z.enum(["STRIPE", "RAZORPAY", "COD"]).default("COD"),
  notes:           z.string().max(500).trim().optional(),
}).refine(
  (data) => data.addressId ?? data.newAddress,
  { message: "Provide either a saved address or a new address.", path: ["addressId"] }
);

// ─────────────────────────────────────────────────────────────────────────────
// Order status update  (admin)
// ─────────────────────────────────────────────────────────────────────────────

export const updateOrderStatusSchema = z.object({
  orderId: z.string().cuid("Invalid order ID."),
  status:  z.enum(["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]),
  note:    z.string().max(500).trim().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Return request
// ─────────────────────────────────────────────────────────────────────────────

export const returnRequestSchema = z.object({
  orderId:     z.string().cuid("Invalid order ID."),
  orderItemId: z.string().cuid("Invalid order item ID."),
  reason:      z.string().min(10, "Describe the reason (min 10 chars).").max(1000).trim(),
  images:      z.array(z.string().url()).max(5).default([]),
});

// ─────────────────────────────────────────────────────────────────────────────
// Inferred types
// ─────────────────────────────────────────────────────────────────────────────

export type AddressInput           = z.infer<typeof addressSchema>;
export type CheckoutInput          = z.infer<typeof checkoutSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type ReturnRequestInput     = z.infer<typeof returnRequestSchema>;
