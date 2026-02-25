"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

// ─────────────────────────────────────────────────────────────────────────────
// Shared result type — server actions must NOT throw raw errors to the client
// ─────────────────────────────────────────────────────────────────────────────

export type WishlistActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string; code?: string };

// ─────────────────────────────────────────────────────────────────────────────
// Internal error mapper
// ─────────────────────────────────────────────────────────────────────────────

function prismaError(err: unknown): WishlistActionResult {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2003") {
      return { success: false, error: "Product no longer exists.", code: err.code };
    }
    return { success: false, error: "Database error. Please try again.", code: err.code };
  }
  if (err instanceof Prisma.PrismaClientInitializationError) {
    return { success: false, error: "Service temporarily unavailable.", code: "DB_INIT" };
  }
  return { success: false, error: "An unexpected error occurred." };
}

// ─────────────────────────────────────────────────────────────────────────────
// toggleWishlist
// Adds the product to the wishlist if it isn't there; removes it if it is.
// Returns the NEW wishlisted state so the client can update optimistically.
// ─────────────────────────────────────────────────────────────────────────────

export async function toggleWishlist(
  productId: string
): Promise<WishlistActionResult<{ wishlisted: boolean }>> {
  const userId = await getSessionUserId();
  if (!userId) {
    return {
      success: false,
      error: "You must be logged in to save items to your wishlist.",
      code: "UNAUTHENTICATED",
    };
  }

  if (!productId?.trim()) {
    return { success: false, error: "Invalid product.", code: "INVALID_INPUT" };
  }

  try {
    const existing = await prisma.wishlist.findUnique({
      where: { userId_productId: { userId, productId } },
      select: { id: true },
    });

    if (existing) {
      // Already wishlisted → remove
      await prisma.wishlist.delete({ where: { id: existing.id } });
      revalidatePath("/products");
      revalidatePath(`/products/${productId}`);
      return { success: true, data: { wishlisted: false } };
    }

    // Not yet wishlisted → add (verify product exists first)
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) {
      return { success: false, error: "Product not found.", code: "NOT_FOUND" };
    }

    await prisma.wishlist.create({ data: { userId, productId } });
    revalidatePath("/products");
    revalidatePath(`/products/${productId}`);
    return { success: true, data: { wishlisted: true } };
  } catch (err) {
    return prismaError(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getWishlistProductIds
// Returns the Set of productIds the authenticated user has wishlisted.
// Used by Server Components to pre-populate the initial wishlisted state on
// product cards without N+1 queries.
// Returns an empty set for unauthenticated users (no throw, graceful).
// ─────────────────────────────────────────────────────────────────────────────

export async function getWishlistProductIds(): Promise<Set<string>> {
  const userId = await getSessionUserId();
  if (!userId) return new Set();

  try {
    const rows = await prisma.wishlist.findMany({
      where: { userId },
      select: { productId: true },
    });
    return new Set(rows.map((r) => r.productId));
  } catch {
    // Non-critical — fall back to empty set rather than breaking the page
    return new Set();
  }
}
