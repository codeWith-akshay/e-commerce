"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getSessionUserId, getSessionRole } from "@/lib/session";
import {
  createReviewSchema,
  replyToReviewSchema,
  moderateReviewSchema,
  type CreateReviewInput,
  type ReplyToReviewInput,
} from "@/lib/validations/review";
import { invalidate, CacheKeys } from "@/lib/redis";

// ─────────────────────────────────────────────────────────────────────────────
// Shared result type
// ─────────────────────────────────────────────────────────────────────────────

export type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string; code?: string };

// ─────────────────────────────────────────────────────────────────────────────
// createReview
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Submit a product review.
 * One review per user per product (enforced by @@unique in schema).
 * Marks `isVerified = true` when the user has a completed order containing
 * the product.
 * New reviews start as `isApproved = false` and require admin moderation.
 */
export async function createReview(
  input: CreateReviewInput
): Promise<ActionResult<{ reviewId: string }>> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { success: false, error: "You must be logged in to leave a review.", code: "UNAUTHENTICATED" };
  }

  const parsed = createReviewSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
      code: "INVALID_INPUT",
    };
  }

  const { productId, rating, title, body, images } = parsed.data;

  try {
    // ── Check if product exists ────────────────────────────────────────────
    const product = await prisma.product.findUnique({
      where: { id: productId, isActive: true },
      select: { id: true },
    });

    if (!product) {
      return { success: false, error: "Product not found.", code: "NOT_FOUND" };
    }

    // ── Check verified purchase ────────────────────────────────────────────
    const verifiedPurchase = await prisma.orderItem.findFirst({
      where: {
        productId,
        order: { userId, status: "DELIVERED" },
      },
      select: { id: true },
    });

    const review = await prisma.review.create({
      data: {
        userId,
        productId,
        rating,
        title:      title ?? null,
        body,
        images,
        isVerified: !!verifiedPurchase,
        isApproved: false, // awaits admin moderation
      },
      select: { id: true },
    });

    revalidatePath(`/products/${productId}`);
    await invalidate(CacheKeys.product(productId));

    return { success: true, data: { reviewId: review.id } };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return {
        success: false,
        error: "You have already reviewed this product.",
        code: "DUPLICATE",
      };
    }
    console.error("[createReview]", err);
    return { success: false, error: "Failed to submit review. Please try again." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// deleteReview  (owner or admin)
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteReview(reviewId: string): Promise<ActionResult> {
  const userId = await getSessionUserId();
  const role   = await getSessionRole();

  if (!userId) {
    return { success: false, error: "You must be logged in.", code: "UNAUTHENTICATED" };
  }

  try {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, userId: true, productId: true },
    });

    if (!review) {
      return { success: false, error: "Review not found.", code: "NOT_FOUND" };
    }

    // Only the review owner or an admin/superadmin can delete
    const isOwner = review.userId === userId;
    const isAdmin = role === "ADMIN" || role === "SUPERADMIN";

    if (!isOwner && !isAdmin) {
      return { success: false, error: "Permission denied.", code: "FORBIDDEN" };
    }

    await prisma.review.delete({ where: { id: reviewId } });

    revalidatePath(`/products/${review.productId}`);
    revalidatePath("/admin/reviews");
    await invalidate(CacheKeys.product(review.productId));

    return { success: true };
  } catch (err) {
    console.error("[deleteReview]", err);
    return { success: false, error: "Failed to delete review." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// replyToReview  (admin only)
// ─────────────────────────────────────────────────────────────────────────────

export async function replyToReview(
  input: ReplyToReviewInput
): Promise<ActionResult<{ replyId: string }>> {
  const userId = await getSessionUserId();
  const role   = await getSessionRole();

  if (!userId) redirect("/login");
  if (role !== "ADMIN" && role !== "SUPERADMIN") {
    return { success: false, error: "Only admins can reply to reviews.", code: "FORBIDDEN" };
  }

  const parsed = replyToReviewSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input.", code: "INVALID_INPUT" };
  }

  try {
    const review = await prisma.review.findUnique({
      where: { id: parsed.data.reviewId },
      select: { id: true, productId: true },
    });

    if (!review) {
      return { success: false, error: "Review not found.", code: "NOT_FOUND" };
    }

    const reply = await prisma.reviewReply.create({
      data: {
        reviewId: parsed.data.reviewId,
        authorId: userId!,
        body:     parsed.data.body,
      },
      select: { id: true },
    });

    revalidatePath(`/products/${review.productId}`);
    return { success: true, data: { replyId: reply.id } };
  } catch (err) {
    console.error("[replyToReview]", err);
    return { success: false, error: "Failed to post reply." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin — moderateReview  (approve / reject)
// ─────────────────────────────────────────────────────────────────────────────

export async function moderateReview(
  reviewId: string,
  isApproved: boolean
): Promise<ActionResult> {
  const role = await getSessionRole();
  if (!role) redirect("/login");
  if (role !== "ADMIN" && role !== "SUPERADMIN") {
    return { success: false, error: "Forbidden.", code: "FORBIDDEN" };
  }

  const parsed = moderateReviewSchema.safeParse({ reviewId, isApproved });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input.", code: "INVALID_INPUT" };
  }

  try {
    const review = await prisma.review.update({
      where: { id: reviewId },
      data:  { isApproved },
      select: { productId: true },
    });

    revalidatePath(`/products/${review.productId}`);
    revalidatePath("/admin/reviews");
    await invalidate(CacheKeys.product(review.productId));

    return { success: true };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return { success: false, error: "Review not found.", code: "NOT_FOUND" };
    }
    console.error("[moderateReview]", err);
    return { success: false, error: "Failed to update review." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin — getPendingReviews
// ─────────────────────────────────────────────────────────────────────────────

export type PendingReview = {
  id:         string;
  rating:     number;
  title:      string | null;
  body:       string;
  isVerified: boolean;
  createdAt:  Date;
  user:       { id: string; name: string; email: string };
  product:    { id: string; title: string };
};

export async function getPendingReviews(
  page = 1,
  pageSize = 20
): Promise<ActionResult<{ reviews: PendingReview[]; total: number }>> {
  const role = await getSessionRole();
  if (!role) redirect("/login");
  if (role !== "ADMIN" && role !== "SUPERADMIN") redirect("/");

  try {
    const [reviews, total] = await prisma.$transaction([
      prisma.review.findMany({
        where:   { isApproved: false },
        orderBy: { createdAt: "asc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        select:  {
          id: true, rating: true, title: true, body: true,
          isVerified: true, createdAt: true,
          user:    { select: { id: true, name: true, email: true } },
          product: { select: { id: true, title: true } },
        },
      }),
      prisma.review.count({ where: { isApproved: false } }),
    ]);

    return { success: true, data: { reviews, total } };
  } catch (err) {
    console.error("[getPendingReviews]", err);
    return { success: false, error: "Failed to fetch reviews." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// createReviewFormAction  — FormData-compatible wrapper for useActionState
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Drop-in for React 19 `useActionState`.
 * Reads productId, rating, body from FormData, then delegates to createReview.
 */
export async function createReviewFormAction(
  _prevState: ActionResult<{ reviewId: string }> | null,
  formData: FormData
): Promise<ActionResult<{ reviewId: string }>> {
  const raw = {
    productId: formData.get("productId") as string,
    rating:    Number(formData.get("rating")),
    title:     (formData.get("title") as string) || undefined,
    body:      formData.get("body") as string,
    images:    [],
  };
  return createReview(raw as CreateReviewInput);
}
