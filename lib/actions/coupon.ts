"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getSessionUserId, getSessionRole } from "@/lib/session";
import {
  createCouponSchema,
  updateCouponSchema,
  applyCouponSchema,
  type CreateCouponInput,
} from "@/lib/validations/coupon";

// ─────────────────────────────────────────────────────────────────────────────
// Shared result type
// ─────────────────────────────────────────────────────────────────────────────

export type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string; code?: string };

// ─────────────────────────────────────────────────────────────────────────────
// applyCoupon  — validate & compute discount for the current cart total
// ─────────────────────────────────────────────────────────────────────────────

export type CouponValidationResult = {
  couponId:       string;
  code:           string;
  type:           string;
  discountAmount: number;
  finalAmount:    number;
};

/**
 * Validates a coupon code against the current cart total.
 * Returns the discount amount and resulting total — does NOT write to the DB.
 * The couponId is passed to placeOrder at checkout.
 */
export async function applyCoupon(
  code: string,
  orderAmount: number
): Promise<ActionResult<CouponValidationResult>> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { success: false, error: "You must be logged in.", code: "UNAUTHENTICATED" };
  }

  const parsed = applyCouponSchema.safeParse({ code, orderAmount });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input.", code: "INVALID_INPUT" };
  }

  const { code: cleanCode } = parsed.data;
  const now = new Date();

  try {
    const coupon = await prisma.coupon.findUnique({
      where: { code: cleanCode },
    });

    if (!coupon) {
      return { success: false, error: "Coupon code not found.", code: "NOT_FOUND" };
    }

    // ── Active check ──────────────────────────────────────────────────────────
    if (!coupon.isActive) {
      return { success: false, error: "This coupon is no longer active.", code: "INACTIVE" };
    }

    // ── Date window ───────────────────────────────────────────────────────────
    if (coupon.startsAt > now) {
      return { success: false, error: "This coupon is not yet valid.", code: "NOT_STARTED" };
    }
    if (coupon.expiresAt && coupon.expiresAt < now) {
      return { success: false, error: "This coupon has expired.", code: "EXPIRED" };
    }

    // ── Global usage cap ─────────────────────────────────────────────────────
    if (coupon.maxUsageCount !== null && coupon.usageCount >= coupon.maxUsageCount) {
      return { success: false, error: "This coupon has reached its usage limit.", code: "USAGE_LIMIT" };
    }

    // ── Minimum order amount ──────────────────────────────────────────────────
    if (orderAmount < coupon.minOrderAmount) {
      return {
        success: false,
        error: `Minimum order amount for this coupon is ₹${coupon.minOrderAmount.toFixed(2)}.`,
        code: "MIN_ORDER",
      };
    }

    // ── Per-user usage cap ────────────────────────────────────────────────────
    const userUsageCount = await prisma.couponUsage.count({
      where: { couponId: coupon.id, userId },
    });
    if (userUsageCount >= coupon.maxUsagePerUser) {
      return {
        success: false,
        error: `You have already used this coupon the maximum number of times.`,
        code: "USER_USAGE_LIMIT",
      };
    }

    // ── Calculate discount ────────────────────────────────────────────────────
    let discountAmount = 0;

    if (coupon.type === "PERCENTAGE") {
      discountAmount = (orderAmount * coupon.value) / 100;
      if (coupon.maxDiscountAmount !== null) {
        discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
      }
    } else if (coupon.type === "FIXED_AMOUNT") {
      discountAmount = Math.min(coupon.value, orderAmount);
    } else if (coupon.type === "FREE_SHIPPING") {
      discountAmount = 0; // handled at order level
    }

    discountAmount = Math.round(discountAmount * 100) / 100;
    const finalAmount = Math.max(0, orderAmount - discountAmount);

    return {
      success: true,
      data: {
        couponId:       coupon.id,
        code:           coupon.code,
        type:           coupon.type,
        discountAmount,
        finalAmount,
      },
    };
  } catch (err) {
    console.error("[applyCoupon]", err);
    return { success: false, error: "Failed to validate coupon. Please try again." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin — createCoupon
// ─────────────────────────────────────────────────────────────────────────────

export async function createCoupon(
  input: CreateCouponInput
): Promise<ActionResult<{ id: string; code: string }>> {
  const role = await getSessionRole();
  if (!role) redirect("/login");
  if (role !== "ADMIN" && role !== "SUPERADMIN") {
    return { success: false, error: "Forbidden.", code: "FORBIDDEN" };
  }

  const parsed = createCouponSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input.", code: "INVALID_INPUT" };
  }

  try {
    const coupon = await prisma.coupon.create({
      data: {
        code:             parsed.data.code,
        type:             parsed.data.type,
        value:            parsed.data.value,
        minOrderAmount:   parsed.data.minOrderAmount,
        maxDiscountAmount: parsed.data.maxDiscountAmount ?? null,
        maxUsageCount:    parsed.data.maxUsageCount     ?? null,
        maxUsagePerUser:  parsed.data.maxUsagePerUser,
        isActive:         parsed.data.isActive,
        startsAt:         parsed.data.startsAt,
        expiresAt:        parsed.data.expiresAt         ?? null,
      },
      select: { id: true, code: true },
    });

    revalidatePath("/admin/coupons");
    return { success: true, data: coupon };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { success: false, error: "A coupon with this code already exists.", code: "DUPLICATE" };
    }
    console.error("[createCoupon]", err);
    return { success: false, error: "Failed to create coupon." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin — toggleCouponActive
// ─────────────────────────────────────────────────────────────────────────────

export async function toggleCouponActive(couponId: string): Promise<ActionResult> {
  const role = await getSessionRole();
  if (!role) redirect("/login");
  if (role !== "ADMIN" && role !== "SUPERADMIN") {
    return { success: false, error: "Forbidden.", code: "FORBIDDEN" };
  }

  try {
    const coupon = await prisma.coupon.findUnique({
      where: { id: couponId },
      select: { isActive: true },
    });

    if (!coupon) return { success: false, error: "Coupon not found.", code: "NOT_FOUND" };

    await prisma.coupon.update({
      where: { id: couponId },
      data:  { isActive: !coupon.isActive },
    });

    revalidatePath("/admin/coupons");
    return { success: true };
  } catch (err) {
    console.error("[toggleCouponActive]", err);
    return { success: false, error: "Failed to update coupon." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin — deleteCoupon
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteCoupon(couponId: string): Promise<ActionResult> {
  const role = await getSessionRole();
  if (!role) redirect("/login");
  if (role !== "ADMIN" && role !== "SUPERADMIN") {
    return { success: false, error: "Forbidden.", code: "FORBIDDEN" };
  }

  try {
    await prisma.coupon.delete({ where: { id: couponId } });
    revalidatePath("/admin/coupons");
    return { success: true };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return { success: false, error: "Coupon not found.", code: "NOT_FOUND" };
    }
    console.error("[deleteCoupon]", err);
    return { success: false, error: "Failed to delete coupon." };
  }
}
