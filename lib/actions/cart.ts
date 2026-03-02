"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { invalidate, CacheKeys } from "@/lib/redis";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Shared result type
// Server actions must NOT throw — thrown errors bubble a raw message to the
// client in development and a generic one in production.
// Return a discriminated union instead so callers can pattern-match cleanly.
// ─────────────────────────────────────────────────────────────────────────────

export type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string; code?: string };

// ─────────────────────────────────────────────────────────────────────────────
// Validation schemas
// ─────────────────────────────────────────────────────────────────────────────

const addToCartSchema = z.object({
  productId: z.string().cuid("Invalid product ID."),
  quantity:  z.number().int().min(1).max(99).default(1),
  variantId: z.string().cuid("Invalid variant ID.").optional().nullable(),
});

const updateCartSchema = z.object({
  cartItemId: z.string().cuid("Invalid cart item ID."),
  quantity:   z.number().int().min(0).max(99),
});

const removeCartSchema = z.object({
  cartItemId: z.string().cuid("Invalid cart item ID."),
});

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Maximum allowed quantity per line-item. */
const MAX_QUANTITY = 99;

function prismaError(err: unknown): ActionResult {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2003 — foreign-key violation (e.g. product deleted mid-request)
    if (err.code === "P2003") {
      return {
        success: false,
        error: "Product no longer exists. Please refresh the page.",
        code: err.code,
      };
    }
    return {
      success: false,
      error: "Database error. Please try again.",
      code: err.code,
    };
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    return {
      success: false,
      error: "Service temporarily unavailable. Please try again later.",
      code: "DB_INIT",
    };
  }

  return { success: false, error: "An unexpected error occurred." };
}

// ─────────────────────────────────────────────────────────────────────────────
// addToCart
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add a product (optionally a specific variant) to the authenticated user's cart.
 * - If a cart row already exists for (userId, productId, variantId), increments quantity.
 * - Otherwise creates a new row.
 * - Stock check uses variant.stock when variantId is supplied.
 * - Revalidates /cart so any cached page reflects the change immediately.
 */
export async function addToCart(
  productId: string,
  /** How many units to add. Defaults to 1. */
  quantity  = 1,
  /** Specific variant to add. Null / undefined = base product. */
  variantId?: string | null,
): Promise<ActionResult<{ cartItemId: string; quantity: number }>> {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const userId = await getSessionUserId();
  if (!userId) {
    return { success: false, error: "You must be logged in to add items to your cart.", code: "UNAUTHENTICATED" };
  }

  // ── Validate input ──────────────────────────────────────────────────────────
  const parsed = addToCartSchema.safeParse({ productId, quantity, variantId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input.", code: "INVALID_INPUT" };
  }

  const resolvedVariantId = parsed.data.variantId ?? null;

  try {
    // ── Verify product exists & is active ───────────────────────────────────
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, stock: true, title: true, isActive: true },
    });

    if (!product || !product.isActive) {
      return { success: false, error: "Product not found.", code: "NOT_FOUND" };
    }

    // ── Resolve available stock (variant overrides parent when present) ──────
    let availableStock = product.stock;

    if (resolvedVariantId) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: resolvedVariantId, productId }, // also validates variant belongs to this product
        select: { id: true, stock: true },
      });

      if (!variant) {
        return { success: false, error: "Product variant not found.", code: "NOT_FOUND" };
      }

      availableStock = variant.stock;
    }

    if (availableStock === 0) {
      return { success: false, error: `"${product.title}" is out of stock.`, code: "OUT_OF_STOCK" };
    }

    // ── Look up existing cart row ───────────────────────────────────────────
    // Use findFirst (not findUnique) because the DB unique constraint on
    // (userId, productId, variantId) does not enforce uniqueness for NULL
    // variantId in Postgres — so we always rely on the application query.
    const existing = await prisma.cart.findFirst({
      where: { userId, productId, variantId: resolvedVariantId },
      select: { id: true, quantity: true },
    });

    const addQty = Math.max(1, Math.floor(quantity));

    if (existing) {
      const newQty = Math.min(existing.quantity + addQty, MAX_QUANTITY, availableStock);

      if (existing.quantity >= Math.min(MAX_QUANTITY, availableStock)) {
        return {
          success: false,
          error: `You already have the maximum available quantity in your cart.`,
          code: "MAX_QUANTITY",
        };
      }

      const updated = await prisma.cart.update({
        where: { id: existing.id },
        data: { quantity: newQty },
        select: { id: true, quantity: true },
      });

      revalidatePath("/cart");
      revalidatePath("/", "layout");
      await invalidate(CacheKeys.cartCount(userId));
      return { success: true, data: { cartItemId: updated.id, quantity: updated.quantity } };
    }

    // New cart row
    const created = await prisma.cart.create({
      data: {
        userId,
        productId,
        variantId: resolvedVariantId,
        quantity:  Math.min(addQty, availableStock, MAX_QUANTITY),
      },
      select: { id: true, quantity: true },
    });

    revalidatePath("/cart");
    revalidatePath("/", "layout");
    await invalidate(CacheKeys.cartCount(userId));
    return { success: true, data: { cartItemId: created.id, quantity: created.quantity } };
  } catch (err) {
    console.error("[addToCart]", err);
    return prismaError(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// addToCartAction  (FormData-compatible wrapper for React 19 useActionState)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Form-action variant of addToCart, compatible with React 19 `useActionState`.
 *
 * Reads `productId` and `quantity` from FormData so the caller can use a
 * plain <form action={addToCartAction}> with no JavaScript at all, or wire it
 * to `useActionState` for progressive-enhancement with a toast on the client.
 */
export async function addToCartAction(
  _prevState: ActionResult<{ cartItemId: string; quantity: number }> | null,
  formData: FormData
): Promise<ActionResult<{ cartItemId: string; quantity: number }>> {
  const productId  = (formData.get("productId")  as string | null)?.trim() ?? "";
  const variantId  = (formData.get("variantId")  as string | null)?.trim() || null;
  const quantityRaw = formData.get("quantity");
  const quantity = quantityRaw ? Math.max(1, parseInt(String(quantityRaw), 10) || 1) : 1;
  return addToCart(productId, quantity, variantId);
}

// ─────────────────────────────────────────────────────────────────────────────
// updateCartQuantity
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update the quantity of an existing cart item.
 * Passing quantity = 0 is equivalent to removeFromCart.
 */
export async function updateCartQuantity(
  cartItemId: string,
  quantity: number
): Promise<ActionResult<{ quantity: number }>> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { success: false, error: "You must be logged in.", code: "UNAUTHENTICATED" };
  }

  const parsed = updateCartSchema.safeParse({ cartItemId, quantity: Math.floor(quantity) });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input.", code: "INVALID_INPUT" };
  }

  try {
    // Cap at available stock — use variant.stock when the item is variant-specific
    const item = await prisma.cart.findUnique({
      where: { id: cartItemId },
      select: {
        id:      true,
        userId:  true,
        variant: { select: { stock: true } },
        product: { select: { stock: true } },
      },
    });

    if (!item || item.userId !== userId) {
      return { success: false, error: "Cart item not found.", code: "NOT_FOUND" };
    }

    const qty = parsed.data.quantity;

    // qty = 0 → delete
    if (qty === 0) {
      await prisma.cart.delete({ where: { id: cartItemId } });
      revalidatePath("/cart");
      revalidatePath("/", "layout");
      await invalidate(CacheKeys.cartCount(userId));
      return { success: true, data: { quantity: 0 } };
    }

    // Cap at available stock (variant overrides parent when present)
    const availableStock = item.variant?.stock ?? item.product.stock;
    const safeQty = Math.min(qty, availableStock, MAX_QUANTITY);

    const updated = await prisma.cart.update({
      where: { id: cartItemId },
      data: { quantity: safeQty },
      select: { quantity: true },
    });

    revalidatePath("/cart");
    revalidatePath("/", "layout");
    await invalidate(CacheKeys.cartCount(userId));
    return { success: true, data: { quantity: updated.quantity } };
  } catch (err) {
    console.error("[updateCartQuantity]", err);
    return prismaError(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// removeFromCart
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// updateCartQuantityAction  (FormData wrapper for useActionState)
// ─────────────────────────────────────────────────────────────────────────────

export async function updateCartQuantityAction(
  _prevState: ActionResult<{ quantity: number }> | null,
  formData: FormData
): Promise<ActionResult<{ quantity: number }>> {
  const cartItemId = (formData.get("cartItemId") as string | null)?.trim() ?? "";
  const quantity = parseInt((formData.get("quantity") as string | null) ?? "0", 10);
  return updateCartQuantity(cartItemId, isNaN(quantity) ? 0 : quantity);
}

// ─────────────────────────────────────────────────────────────────────────────
// removeFromCartAction  (FormData wrapper for useActionState)
// ─────────────────────────────────────────────────────────────────────────────

export async function removeFromCartAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const cartItemId = (formData.get("cartItemId") as string | null)?.trim() ?? "";
  return removeFromCart(cartItemId);
}

// ─────────────────────────────────────────────────────────────────────────────
// clearCartAction  (FormData wrapper for useActionState)
// ─────────────────────────────────────────────────────────────────────────────

export async function clearCartAction(
  _prevState: ActionResult<{ deleted: number }> | null,
  _formData: FormData
): Promise<ActionResult<{ deleted: number }>> {
  return clearCart();
}

/** Remove a single cart line-item by its id. */
export async function removeFromCart(cartItemId: string): Promise<ActionResult> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { success: false, error: "You must be logged in.", code: "UNAUTHENTICATED" };
  }

  const parsed = removeCartSchema.safeParse({ cartItemId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input.", code: "INVALID_INPUT" };
  }

  try {
    // Ownership check — prevent users from deleting each other's items
    const item = await prisma.cart.findUnique({
      where: { id: cartItemId },
      select: { userId: true },
    });

    if (!item || item.userId !== userId) {
      return { success: false, error: "Cart item not found.", code: "NOT_FOUND" };
    }

    await prisma.cart.delete({ where: { id: cartItemId } });

    revalidatePath("/cart");
    revalidatePath("/", "layout");
    await invalidate(CacheKeys.cartCount(userId));
    return { success: true };
  } catch (err) {
    console.error("[removeFromCart]", err);
    return prismaError(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// clearCart
// ─────────────────────────────────────────────────────────────────────────────

/** Remove all items from the authenticated user's cart. */
export async function clearCart(): Promise<ActionResult<{ deleted: number }>> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { success: false, error: "You must be logged in.", code: "UNAUTHENTICATED" };
  }

  try {
    const { count } = await prisma.cart.deleteMany({ where: { userId } });

    revalidatePath("/cart");
    revalidatePath("/", "layout");
    await invalidate(CacheKeys.cartCount(userId));
    return { success: true, data: { deleted: count } };
  } catch (err) {
    console.error("[clearCart]", err);
    return prismaError(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getCart
// ─────────────────────────────────────────────────────────────────────────────

export type CartLineItem = {
  id: string;
  quantity: number;
  createdAt: Date;
  variantId: string | null;
  /** Null for base-product cart rows. */
  variant: {
    id:         string;
    name:       string;        // e.g. "Size"
    value:      string;        // e.g. "XL"
    sku:        string | null;
    priceDelta: number;        // adjustment on top of product.price
    stock:      number;
  } | null;
  product: {
    id:     string;
    title:  string;
    price:  number;
    images: string[];
    stock:  number;
    category: { name: string };
  };
};

/**
 * Fetch the full cart for the authenticated user.
 * Ordered by `createdAt` ascending (oldest items first).
 */
export async function getCart(): Promise<ActionResult<CartLineItem[]>> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { success: true, data: [] }; // unauthenticated → empty cart
  }

  try {
    const items = await prisma.cart.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: {
        id:        true,
        quantity:  true,
        createdAt: true,
        variantId: true,
        variant: {
          select: {
            id:         true,
            name:       true,
            value:      true,
            sku:        true,
            priceDelta: true,
            stock:      true,
          },
        },
        product: {
          select: {
            id:       true,
            title:    true,
            price:    true,
            images:   true,
            stock:    true,
            category: { select: { name: true } },
          },
        },
      },
    });

    return { success: true, data: items };
  } catch (err) {
    console.error("[getCart]", err);
    return prismaError(err);
  }
}
