"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma, OrderStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getSessionUserId, getSessionRole } from "@/lib/session";
import { invalidate, CacheKeys } from "@/lib/redis";
import { checkoutSchema, updateOrderStatusSchema } from "@/lib/validations/order";
import { confirmReservationsInTx, reserveStockForUser, releaseReservationsForUser } from "@/lib/actions/stock-reservation";
import { isEnabled } from "@/lib/actions/feature-flags";
import { FLAGS }     from "@/lib/flags";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string; code?: string };

/** Public shape of a placed order returned to callers. */
export type PlacedOrder = {
  orderId: string;
  totalAmount: number;
  itemCount: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Error helpers
// ─────────────────────────────────────────────────────────────────────────────

function prismaError(err: unknown): ActionResult {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      // Foreign-key violation — product may have been removed
      case "P2003":
        return {
          success: false,
          error: "One or more products are no longer available.",
          code: err.code,
        };
      // Unique constraint — concurrent order with same items
      case "P2002":
        return {
          success: false,
          error: "A duplicate record was detected. Please try again.",
          code: err.code,
        };
      // Serialization failure — two concurrent transactions conflicted
      case "P2034":
        return {
          success: false,
          error: "Too many simultaneous orders detected. Please try again.",
          code: "P2034",
        };
      default:
        return {
          success: false,
          error: "Database error. Please try again.",
          code: err.code,
        };
    }
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
// Shipping constants  (single source of truth for UI and order creation)
// ─────────────────────────────────────────────────────────────────────────────

/** Flat shipping fee applied when free shipping is not in effect. */
const SHIPPING_BASE     = 49;

/** Minimum subtotal (inclusive) required to qualify for free shipping. */
const FREE_SHIPPING_MIN = 999;

// ─────────────────────────────────────────────────────────────────────────────
// getShippingCalc  — shared UI + backend shipping helper
// ─────────────────────────────────────────────────────────────────────────────

export type ShippingCalc = {
  /** Shipping charge to display / charge. 0 when free shipping applies. */
  amount:      number;
  /** True when the FREE_SHIPPING_PROMO feature flag is currently enabled. */
  promoActive: boolean;
  /** Subtotal threshold to unlock free shipping (only relevant when promoActive). */
  threshold:   number;
};

/**
 * Canonical shipping calculation used by every page that needs to display
 * or charge shipping.  Checks the FREE_SHIPPING_PROMO feature flag so the
 * cart, checkout summary, and order creation all agree on the amount.
 *
 * Usage in a Server Component:
 *   const shipping = await getShippingCalc(subtotal);
 */
export async function getShippingCalc(subtotal: number): Promise<ShippingCalc> {
  const promoActive = await isEnabled(FLAGS.FREE_SHIPPING_PROMO);
  const amount      = (promoActive && subtotal >= FREE_SHIPPING_MIN) ? 0 : SHIPPING_BASE;
  return { amount, promoActive, threshold: FREE_SHIPPING_MIN };
}

// ─────────────────────────────────────────────────────────────────────────────
// placeOrder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert the authenticated user's cart into a confirmed Order.
 *
 * Steps (all-or-nothing inside a Prisma interactive transaction):
 *   1. Re-fetch cart items inside the transaction for a consistent read.
 *   2. Calculate totals.
 *   3. Create the Order row with subtotal/total breakdown.
 *   4. Bulk-insert OrderItem rows (price snapshot from product at this moment).
 *   5. Atomically check-and-decrement each product's stock (sorted by ID to avoid
 *      deadlocks). A single UPDATE … WHERE stock >= qty is the lock — if count=0
 *      the product is out of stock and the whole transaction rolls back.
 *   6. Mirror the deduction into Inventory rows + write InventoryTransaction audit.
 *   7. Confirm any pending StockReservations (links them to this order).
 *   8. Create the initial OrderStatusHistory entry.
 *   9. Delete all cart rows for this user.
 *
 * After the transaction:
 *   - Revalidates /cart (badge count) and the root layout (Navbar CartCount).
 *   - Redirects to /checkout/success — NOTE: redirect() throws a special Next.js
 *     signal and must be called OUTSIDE try/catch to propagate correctly.
 */
export async function placeOrder(
  options?: { shippingAddressId?: string; couponId?: string; notes?: string; paymentProvider?: string }
): Promise<ActionResult<PlacedOrder>> {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const userId = await getSessionUserId();
  if (!userId) {
    return {
      success: false,
      error: "You must be logged in to place an order.",
      code: "UNAUTHENTICATED",
    };
  }

  // ── Free shipping promo (resolved before the tx — async functions can't be awaited inside prisma.$transaction) ─
  const { promoActive: freeShippingEnabled } = await getShippingCalc(0);
  // Note: getShippingCalc is only used here for the flag value; the actual per-order
  // amount is computed inside the tx once we know the real subtotal.
  // Re-use the module-level constants SHIPPING_BASE / FREE_SHIPPING_MIN directly.

  // ── Result carrier (populated inside the try block, used after) ────────────
  let placed: PlacedOrder | null = null;

  try {
    placed = await prisma.$transaction(
      async (tx) => {
        // ── 1. Fetch cart items (fresh read inside the tx) ─────────────────
        const cartItems = await tx.cart.findMany({
          where: { userId },
          select: {
            id: true,
            quantity: true,
            productId: true,
            variantId: true,
            variant: {
              select: {
                id: true,
                name: true,
                value: true,
                priceDelta: true,
                stock: true,
              },
            },
            product: {
              select: {
                id: true,
                title: true,
                price: true,
                stock: true,
                isActive: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        });

        if (cartItems.length === 0) {
          throw new OrderError("Your cart is empty.", "EMPTY_CART");
        }

        // Guard inactive products
        const inactive = cartItems.find((i) => !i.product.isActive);
        if (inactive) {
          throw new OrderError(
            `"${inactive.product.title}" is no longer available.`,
            "PRODUCT_INACTIVE"
          );
        }

        // ── 2. Calculate totals ───────────────────────────────────────────
        const subtotal = cartItems.reduce(
          (sum, item) =>
            sum + (item.product.price + (item.variant?.priceDelta ?? 0)) * item.quantity,
          0
        );
        const roundedSubtotal = Math.round(subtotal * 100) / 100;
        const shippingAmount  = (freeShippingEnabled && roundedSubtotal >= FREE_SHIPPING_MIN) ? 0 : SHIPPING_BASE;
        const roundedTotal    = Math.round((roundedSubtotal + shippingAmount) * 100) / 100;

        // ── 3. Create Order ───────────────────────────────────
        const order = await tx.order.create({
          data: {
            userId,
            subtotal:         roundedSubtotal,
            discountAmount:   0,
            taxAmount:        0,
            shippingAmount:   shippingAmount,
            totalAmount:      roundedTotal,
            shippingAddressId: options?.shippingAddressId ?? null,
            couponId:          options?.couponId          ?? null,
            notes:             options?.notes             ?? null,
          },
          select: { id: true },
        });

        // ── 4. Bulk-insert OrderItems ─────────────────────────────────────
        await tx.orderItem.createMany({
          data: cartItems.map((item) => ({
            orderId:   order.id,
            productId: item.productId,
            variantId: item.variantId ?? null,
            quantity:  item.quantity,
            // price snapshot includes any per-variant delta
            price:     item.product.price + (item.variant?.priceDelta ?? 0),
          })),
        });

        // ── 5. Atomic stock check-and-decrement ───────────────────────────
        //
        // Process products in ascending productId order to ensure all
        // concurrent transactions acquire row locks in the same sequence,
        // which eliminates the classic deadlock scenario.
        //
        // The UPDATE ... WHERE stock >= qty is a single atomic statement:
        // if another transaction already decremented stock below the threshold,
        // count will be 0 and we abort immediately — no overselling possible.
        // Sort by (productId, variantId) so all concurrent transactions acquire
        // row locks in the same sequence — prevents classic deadlock scenarios.
        const sortedItems = [...cartItems].sort((a, b) => {
          const prodCmp = a.productId.localeCompare(b.productId);
          if (prodCmp !== 0) return prodCmp;
          return (a.variantId ?? "").localeCompare(b.variantId ?? "");
        });

        for (const item of sortedItems) {
          const { count } = await tx.product.updateMany({
            where: { id: item.productId, stock: { gte: item.quantity } },
            data:  { stock: { decrement: item.quantity } },
          });

          if (count === 0) {
            // Re-read for a precise error message (stock may now be 0)
            const current = await tx.product.findUnique({
              where: { id: item.productId },
              select: { stock: true },
            });
            throw new OrderError(
              `"${item.product.title}" only has ${current?.stock ?? 0} unit(s) left ` +
                `(requested ${item.quantity}).`,
              "INSUFFICIENT_STOCK"
            );
          }

          // When the item is for a specific variant, also decrement the variant's
          // own stock.  The variant-level gte guard mirrors the product-level one
          // so overselling a specific variant is equally impossible.
          if (item.variantId) {
            const { count: vCount } = await tx.productVariant.updateMany({
              where: { id: item.variantId, stock: { gte: item.quantity } },
              data:  { stock: { decrement: item.quantity } },
            });
            if (vCount === 0) {
              throw new OrderError(
                `"${item.product.title}" ` +
                  `(${item.variant?.name ?? "variant"}: ${item.variant?.value ?? ""}) ` +
                  `only has ${item.variant?.stock ?? 0} unit(s) left ` +
                  `(requested ${item.quantity}).`,
                "INSUFFICIENT_STOCK"
              );
            }
          }
        }

        // ── 6. Mirror deduction into Inventory + write audit trail ────────
        //
        // Inventory rows are optional (not every product has one), so we
        // skip gracefully if absent rather than failing the order.
        //
        // Sequential loop instead of Promise.all: parallel writes inside a
        // Serializable transaction can trigger unnecessary serialization
        // failures (Postgres error 40001 / Prisma P2034) under high concurrency.
        for (const item of cartItems) {
          const inv = await tx.inventory.findUnique({
            where:  { productId: item.productId },
            select: { id: true },
          });
          if (!inv) continue;

          // Use updateMany with a gte guard so Inventory.stockQuantity can
          // never go negative even if it has drifted below Product.stock.
          // (Product.stock was already validated in step 5.)
          await tx.inventory.updateMany({
            where: { id: inv.id, stockQuantity: { gte: item.quantity } },
            data:  { stockQuantity: { decrement: item.quantity } },
          });

          await tx.inventoryTransaction.create({
            data: {
              inventoryId: inv.id,
              delta:       -item.quantity,
              reason:      "SALE",
              reference:   order.id,
              variantId:   item.variantId ?? null,
            },
          });
        }

        // ── 7. Confirm any pending stock reservations ─────────────────────
        //
        // If the user passed through the reservation flow (reserveStock was
        // called at checkout start), this confirms those reservations and
        // removes the soft-hold from Inventory.reservedQty.
        await confirmReservationsInTx(tx, userId, order.id);

        // ── 8. Write initial status history entry ─────────────────────────
        await tx.orderStatusHistory.create({
          data: {
            orderId:     order.id,
            status:      "PENDING",
            note:        "Order placed",
            changedById: userId,
          },
        });

        // ── 9. Clear user's cart ──────────────────────────────────────────
        await tx.cart.deleteMany({ where: { userId } });

        return {
          orderId:     order.id,
          totalAmount: roundedTotal,
          itemCount:   cartItems.length,
        };
      },
      {
        // Serializable provides the strongest isolation guarantee.
        // Under READ COMMITTED the atomic updateMany (step 5) already prevents
        // overselling; Serializable adds a second safety net by aborting any
        // transaction whose snapshot has become stale (Postgres raises P2034).
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 12_000,
      }
    );
  } catch (err) {
    // ── Domain errors (stock, empty cart) ──────────────────────────────────
    if (err instanceof OrderError) {
      return { success: false, error: err.message, code: err.code };
    }
    // ── Prisma / infrastructure errors ────────────────────────────────────
    return prismaError(err);
  }

  // ── Post-transaction side-effects (outside try/catch) ─────────────────────
  revalidatePath("/cart");
  revalidatePath("/", "layout");
  await invalidate(CacheKeys.cartCount(userId));

  // redirect() throws a Next.js-internal signal — never wrap in try/catch.
  redirect(`/checkout/success?orderId=${placed.orderId}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// placeOrderAction  (FormData-compatible wrapper for useActionState)
// ─────────────────────────────────────────────────────────────────────────────

/** Validated shipping address extracted from the checkout form. */
export type ShippingAddress = {
  fullName: string;
  phone: string;
  address: string;
  city: string;
  pincode: string;
};

/**
 * Drop-in for React 19 `useActionState`.
 * Validates all required checkout fields via Zod before calling placeOrder.
 */
export async function placeOrderAction(
  _prevState: ActionResult<PlacedOrder> | null,
  formData: FormData
): Promise<ActionResult<PlacedOrder>> {
  // ── Auth (needed here to create the address record) ──────────────────────
  const userId = await getSessionUserId();
  if (!userId) {
    return {
      success: false,
      error: "You must be logged in to place an order.",
      code: "UNAUTHENTICATED",
    };
  }

  const raw = {
    addressId:       formData.get("addressId")       ?? undefined,
    couponCode:      formData.get("couponCode")       ?? undefined,
    paymentProvider: formData.get("paymentProvider")  ?? "COD",
    notes:           formData.get("notes")            ?? undefined,
    newAddress: formData.get("fullName") ? {
      fullName:     formData.get("fullName"),
      phone:        formData.get("phone"),
      addressLine1: formData.get("addressLine1") ?? formData.get("address"),
      city:         formData.get("city"),
      state:        formData.get("state") ?? "",
      postalCode:   formData.get("postalCode") ?? formData.get("pincode"),
    } : undefined,
  };

  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) {
    // Promote nested newAddress.* sub-errors to top-level field keys so the
    // form can display them next to the correct input.
    const fmt = parsed.error.format() as Record<string, unknown>;
    const flat: Record<string, string> = {};

    for (const [key, val] of Object.entries(fmt)) {
      if (key === "_errors") continue;

      if (key === "newAddress") {
        // Hoist each sub-field error up: { newAddress: { state: { _errors: [...] } } }
        // → { state: "State is required." }
        for (const [subKey, subVal] of Object.entries(val as Record<string, unknown>)) {
          if (subKey === "_errors") continue;
          const errs = (subVal as { _errors?: string[] })?._errors;
          if (errs?.[0]) flat[subKey] = errs[0];
        }
        continue;
      }

      const errs = (val as { _errors?: string[] })?._errors;
      if (errs?.[0]) flat[key] = errs[0];
    }

    return { success: false, error: JSON.stringify(flat), code: "VALIDATION" };
  }

  // ── Reserve stock ───────────────────────────────────────────────────────────
  //
  // Fetch the cart (minimal read) and create Serializable PENDING holds for
  // every item BEFORE any side-effects (address creation, coupon lookup).
  // This means a stock-out error is surfaced immediately, at the top of the
  // form, without creating dangling address rows.
  //
  // If placeOrder later fails (e.g., P2034 retry needed, address DB error),
  // we release the holds so the user can retry without waiting for the 10-min TTL.
  //
  // On success, placeOrder step 7 (confirmReservationsInTx) converts
  // PENDING → CONFIRMED and decrements Inventory.reservedQty atomically.
  const cartItems = await prisma.cart.findMany({
    where:  { userId },
    select: { productId: true, quantity: true, variantId: true },
  });

  if (cartItems.length === 0) {
    return { success: false, error: "Your cart is empty.", code: "EMPTY_CART" };
  }

  const reservation = await reserveStockForUser(
    userId,
    cartItems.map(({ productId, quantity, variantId }) => ({ productId, quantity, variantId })),
  );

  if (!reservation.success) {
    // Nothing was committed — reservation tx rolled back — no cleanup needed.
    return {
      success: false,
      error:   reservation.error,
      code:    reservation.code ?? "INSUFFICIENT_STOCK",
    };
  }

  // ── Resolve shipping address ─────────────────────────────────────────────
  // Prefer an existing saved address; otherwise persist the inline address
  // the user just typed so it's linked to the order and visible in history.
  let shippingAddressId: string | null = parsed.data.addressId ?? null;

  if (!shippingAddressId && parsed.data.newAddress) {
    try {
      const addr = await prisma.address.create({
        data: {
          userId,
          label:        "Home",
          fullName:     parsed.data.newAddress.fullName,
          phone:        parsed.data.newAddress.phone,
          addressLine1: parsed.data.newAddress.addressLine1,
          city:         parsed.data.newAddress.city,
          state:        parsed.data.newAddress.state,
          postalCode:   parsed.data.newAddress.postalCode,
        },
        select: { id: true },
      });
      shippingAddressId = addr.id;
    } catch (err) {
      console.error("[placeOrderAction] address create failed", err);
      // Release the stock hold before returning so the user can retry immediately.
      await releaseReservationsForUser(userId).catch(
        (e) => console.error("[placeOrderAction] reservation release failed after address error", e),
      );
      return {
        success: false,
        error: "Failed to save your shipping address. Please try again.",
        code: "ADDRESS_ERROR",
      };
    }
  }

  // ── Resolve coupon ID from code ──────────────────────────────────────────
  // applyCoupon already ran on the client to show the discount preview;
  // here we just look up the ID so placeOrder can link it to the order row.
  let couponId: string | null = null;
  if (parsed.data.couponCode) {
    const coupon = await prisma.coupon.findFirst({
      where:  { code: parsed.data.couponCode, isActive: true },
      select: { id: true },
    });
    couponId = coupon?.id ?? null;
  }

  // ── Place the order ──────────────────────────────────────────────────────────
  //
  // placeOrder runs a Serializable transaction that:
  //   • Step 5: atomically decrements Product.stock (WHERE stock >= qty guard).
  //   • Step 6: mirrors decrement into Inventory.stockQuantity.
  //   • Step 7: confirmReservationsInTx — converts the PENDING soft-holds to
  //             CONFIRMED, decrements Inventory.reservedQty, and links each
  //             StockReservation row to this order.
  //
  // On success placeOrder calls redirect() and never returns to this function.
  // On failure it returns an ActionResult — we then release the reservations
  // so the user can retry without waiting for the 10-minute expiry TTL.
  const result = await placeOrder({
    shippingAddressId: shippingAddressId ?? undefined,
    couponId:          couponId          ?? undefined,
    notes:             parsed.data.notes,
    paymentProvider:   parsed.data.paymentProvider,
  });

  // Reaching this line means placeOrder returned a failure (success redirects).
  await releaseReservationsForUser(userId).catch(
    (e) => console.error("[placeOrderAction] reservation release failed", e),
  );

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// getOrders  — fetch order history for the current user
// ─────────────────────────────────────────────────────────────────────────────

export type OrderSummary = {
  id: string;
  totalAmount: number;
  status: string;
  createdAt: Date;
  itemCount: number;
};

/**
 * Return a paginated list of orders for the authenticated user, newest first.
 * Designed for an order-history server component — no client JS required.
 */
export async function getOrders(
  page = 1,
  pageSize = 10
): Promise<ActionResult<{ orders: OrderSummary[]; total: number }>> {
  const userId = await getSessionUserId();
  if (!userId) {
    return {
      success: false,
      error: "You must be logged in to view orders.",
      code: "UNAUTHENTICATED",
    };
  }

  try {
    const [orders, total] = await prisma.$transaction([
      prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          totalAmount: true,
          status: true,
          createdAt: true,
          _count: { select: { orderItems: true } },
        },
      }),
      prisma.order.count({ where: { userId } }),
    ]);

    return {
      success: true,
      data: {
        orders: orders.map((o) => ({
          id: o.id,
          totalAmount: o.totalAmount,
          status: o.status,
          createdAt: o.createdAt,
          itemCount: o._count.orderItems,
        })),
        total,
      },
    };
  } catch (err) {
    return prismaError(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getOrderById  — full order detail for the success/detail page
// ─────────────────────────────────────────────────────────────────────────────

export type OrderDetail = {
  id: string;
  totalAmount: number;
  status: string;
  createdAt: Date;
  orderItems: {
    id: string;
    quantity: number;
    price: number;
    product: {
      id: string;
      title: string;
      images: string[];
      category: string;
    };
  }[];
};

/**
 * Fetch a single order with all its line items.
 * Verifies the order belongs to the authenticated user.
 */
export async function getOrderById(
  orderId: string
): Promise<ActionResult<OrderDetail>> {
  const userId = await getSessionUserId();
  if (!userId) {
    return {
      success: false,
      error: "You must be logged in to view this order.",
      code: "UNAUTHENTICATED",
    };
  }

  if (!orderId?.trim()) {
    return { success: false, error: "Order ID is required.", code: "INVALID_INPUT" };
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId, userId }, // ownership enforced at DB level
      select: {
        id: true,
        totalAmount: true,
        status: true,
        createdAt: true,
        orderItems: {
          select: {
            id: true,
            quantity: true,
            price: true,
            product: {
              select: {
                id: true,
                title: true,
                images: true,
                category: { select: { name: true } },
              },
            },
          },
          orderBy: { id: "asc" },
        },
      },
    });

    if (!order) {
      return { success: false, error: "Order not found.", code: "NOT_FOUND" };
    }

    return {
      success: true,
      data: {
        id: order.id,
        totalAmount: order.totalAmount,
        status: order.status,
        createdAt: order.createdAt,
        orderItems: order.orderItems.map(({ product, ...item }) => ({
          ...item,
          product: { ...product, category: product.category.name },
        })),
      },
    };
  } catch (err) {
    return prismaError(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal domain error class
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Thrown inside the Prisma transaction to signal a business-rule violation
 * (empty cart, insufficient stock). Distinguishes domain errors from
 * infrastructure / Prisma errors in the catch block.
 */
class OrderError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "OrderError";
    this.code = code;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin — updateOrderStatus
// ─────────────────────────────────────────────────────────────────────────────

export interface UpdateOrderStatusState {
  error?: string;
  success?: boolean;
}

/**
 * Updates an order's status and writes a status history entry.
 * Admin / SuperAdmin only.
 * Designed for `useActionState` — bind the orderId before use:
 *   const bound = updateOrderStatusAction.bind(null, orderId);
 */
export async function updateOrderStatusAction(
  orderId: string,
  _prev: UpdateOrderStatusState,
  formData: FormData,
): Promise<UpdateOrderStatusState> {
  // ── Auth guard ────────────────────────────────────────────────────────────
  const userId = await getSessionUserId();
  const role   = await getSessionRole();
  if (!role) redirect("/login");
  if (role !== "ADMIN" && role !== "SUPERADMIN") redirect("/");

  // ── Validate inputs ───────────────────────────────────────────────────────
  const parsed = updateOrderStatusSchema.safeParse({
    orderId,
    status: formData.get("status"),
    note:   formData.get("note") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { status, note } = parsed.data;

  // ── Persist order status + history entry in one transaction ───────────────
  try {
    await prisma.$transaction([
      prisma.order.update({
        where: { id: orderId },
        data:  { status: status as OrderStatus },
      }),
      prisma.orderStatusHistory.create({
        data: {
          orderId,
          status:      status as OrderStatus,
          note:        note ?? null,
          changedById: userId!,
        },
      }),
    ]);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return { error: "Order not found." };
    }
    console.error("[updateOrderStatusAction]", err);
    return { error: "Failed to update order status. Please try again." };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);

  return { success: true };
}
