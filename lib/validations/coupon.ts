/**
 * lib/validations/coupon.ts
 */

import { z } from "zod";

// Base object — no refinements so .partial() can be called on it
const couponBaseSchema = z.object({
  code:              z
    .string()
    .min(3, "Code must be at least 3 characters.")
    .max(30)
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]+$/, "Code can only contain letters, numbers, dashes and underscores."),
  type:              z.enum(["PERCENTAGE", "FIXED_AMOUNT", "FREE_SHIPPING"]),
  value:             z.number().positive("Value must be positive.").max(100_000),
  minOrderAmount:    z.number().min(0).default(0),
  maxDiscountAmount: z.number().positive().optional().nullable(),
  maxUsageCount:     z.number().int().positive().optional().nullable(),
  maxUsagePerUser:   z.number().int().min(1).default(1),
  isActive:          z.boolean().default(true),
  startsAt:          z.coerce.date().default(() => new Date()),
  expiresAt:         z.coerce.date().optional().nullable(),
});

// Refinements shared between create and update.
// Generic over T so the output type flows through .refine() unchanged —
// using z.ZodObject<any> would cause Zod to lose field types (unknown).
function addCouponRefinements<T extends z.ZodObject<z.ZodRawShape>>(schema: T) {
  return schema
    .refine(
      (data) =>
        !data.expiresAt || (data.expiresAt as Date) > ((data.startsAt as Date | undefined) ?? new Date(0)),
      { message: "Expiry date must be after start date.", path: ["expiresAt"] }
    )
    .refine(
      (data) =>
        !(data.type === "PERCENTAGE" && ((data.value as number) ?? 0) > 100),
      { message: "Percentage discount cannot exceed 100%.", path: ["value"] }
    );
}

export const createCouponSchema = addCouponRefinements(couponBaseSchema);

// .partial() is called on the base object (before refinements), then refinements re-applied
export const updateCouponSchema = addCouponRefinements(
  couponBaseSchema.partial().extend({
    id: z.string().cuid("Invalid coupon ID."),
  })
);

export const applyCouponSchema = z.object({
  code:        z.string().min(1, "Enter a coupon code.").max(30).trim().toUpperCase(),
  orderAmount: z.number().positive(),
});

export type CreateCouponInput = z.infer<typeof createCouponSchema>;
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;
export type ApplyCouponInput  = z.infer<typeof applyCouponSchema>;
