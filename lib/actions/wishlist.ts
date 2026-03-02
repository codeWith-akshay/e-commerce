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
// Revalidation helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Invalidate all pages that display per-user wishlist state so they re-render
 * with fresh data.  Also revalidates the root layout so the Navbar's
 * WishlistCount badge reflects the new count immediately.
 */
function revalidateWishlistPaths(productId: string) {
  revalidatePath("/", "layout");        // navbar WishlistCount badge (all pages)
  revalidatePath("/");                  // home page featured products
  revalidatePath("/wishlist");          // wishlist page itself
  revalidatePath("/products");          // product listing
  revalidatePath(`/products/${productId}`); // individual product detail
  revalidatePath("/deals");             // deals listing
  revalidatePath("/new-arrivals");      // new arrivals listing
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
      revalidateWishlistPaths(productId);
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
    revalidateWishlistPaths(productId);
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

// ─────────────────────────────────────────────────────────────────────────────
// getWishlist
// Full wishlist rows with product details for the /wishlist page.
// ─────────────────────────────────────────────────────────────────────────────

export type WishlistItem = {
  id:        string;
  createdAt: Date;
  product: {
            id:          string;
            title:       string;
            description: string;
            price:       number;
            stock:       number;
            rating:      number;
            images:      string[];
            isActive:    boolean;
            category: { name: string };
          };
};

export async function getWishlist(): Promise<WishlistActionResult<WishlistItem[]>> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { success: false, error: "You must be logged in.", code: "UNAUTHENTICATED" };
  }

  try {
    const rows = await prisma.wishlist.findMany({
      where:   { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id:        true,
        createdAt: true,
        product: {
          select: {
            id:          true,
            title:       true,
            description: true,
            price:       true,
            stock:       true,
            rating:      true,
            images:      true,
            isActive:    true,
            category: { select: { name: true } },
          },
        },
      },
    });

    return { success: true, data: rows };
  } catch (err) {
    return prismaError(err);
  }
}
