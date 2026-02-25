"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string; code?: string };

/** Shape of a cart row joined with its product, as fetched below. */
type CartItemWithProduct = {
  id: string;
  quantity: number;
  productId: string;
  product: {
    id: string;
    title: string;
    price: number;
    stock: number;
  };
};

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
// Stock validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check every cart item against current product stock.
 * Returns the first out-of-stock item title, or null if everything is fine.
 */
function findStockIssue(items: CartItemWithProduct[]): string | null {
  for (const item of items) {
    if (item.product.stock < item.quantity) {
      return `"${item.product.title}" only has ${item.product.stock} unit(s) left (requested ${item.quantity}).`;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// placeOrder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert the authenticated user's cart into a confirmed Order.
 *
 * Steps (all-or-nothing inside a Prisma interactive transaction):
 *   1. Re-fetch cart items inside the transaction for a consistent read.
 *   2. Validate stock for every item.
 *   3. Create the Order row.
 *   4. Bulk-insert OrderItem rows (price snapshot from product at this moment).
 *   5. Decrement each product's stock by the ordered quantity.
 *   6. Delete all cart rows for this user.
 *
 * After the transaction:
 *   - Revalidates /cart (badge count) and the root layout (Navbar CartCount).
 *   - Redirects to /checkout/success — NOTE: redirect() throws a special Next.js
 *     signal and must be called OUTSIDE try/catch to propagate correctly.
 */
export async function placeOrder(): Promise<ActionResult<PlacedOrder>> {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const userId = await getSessionUserId();
  if (!userId) {
    return {
      success: false,
      error: "You must be logged in to place an order.",
      code: "UNAUTHENTICATED",
    };
  }

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
            product: {
              select: {
                id: true,
                title: true,
                price: true,
                stock: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        });

        if (cartItems.length === 0) {
          throw new OrderError("Your cart is empty.", "EMPTY_CART");
        }

        // ── 2. Stock validation ───────────────────────────────────────────
        const stockIssue = findStockIssue(cartItems);
        if (stockIssue) {
          throw new OrderError(stockIssue, "INSUFFICIENT_STOCK");
        }

        // ── 3. Calculate total (price snapshot) ───────────────────────────
        const totalAmount = cartItems.reduce(
          (sum, item) => sum + item.product.price * item.quantity,
          0
        );

        // Round to 2 decimal places to avoid floating-point drift
        const roundedTotal = Math.round(totalAmount * 100) / 100;

        // ── 4. Create Order ───────────────────────────────────────────────
        const order = await tx.order.create({
          data: {
            userId,
            totalAmount: roundedTotal,
            // status defaults to PENDING via schema
          },
          select: { id: true },
        });

        // ── 5. Bulk-insert OrderItems ─────────────────────────────────────
        await tx.orderItem.createMany({
          data: cartItems.map((item) => ({
            orderId: order.id,
            productId: item.productId,
            quantity: item.quantity,
            price: item.product.price, // snapshot
          })),
        });

        // ── 6. Decrement product stock ────────────────────────────────────
        // Run concurrently — each update targets a different row.
        await Promise.all(
          cartItems.map((item) =>
            tx.product.update({
              where: { id: item.productId },
              data: { stock: { decrement: item.quantity } },
            })
          )
        );

        // ── 7. Clear user's cart ──────────────────────────────────────────
        await tx.cart.deleteMany({ where: { userId } });

        return {
          orderId: order.id,
          totalAmount: roundedTotal,
          itemCount: cartItems.length,
        };
      },
      {
        // Serializable ensures no concurrent order can read stale stock values.
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        // 10-second timeout — generous for a typical checkout payload.
        timeout: 10_000,
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
  // revalidatePath before redirect so the cart badge is stale-free on return.
  revalidatePath("/cart");
  revalidatePath("/", "layout");

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
 *
 * Validates all required shipping-address fields before calling placeOrder.
 * On success the action redirects — the returned `ActionResult` is only
 * reached when validation or business-rule errors occur.
 *
 * ```tsx
 * const [state, formAction, isPending] = useActionState(placeOrderAction, null);
 * <form action={formAction}>
 *   <input name="fullName" />
 *   ...
 *   <button type="submit">Place order</button>
 * </form>
 * ```
 */
export async function placeOrderAction(
  _prevState: ActionResult<PlacedOrder> | null,
  formData: FormData
): Promise<ActionResult<PlacedOrder>> {
  // ── Address validation ─────────────────────────────────────────────────────
  const str = (key: string) => (formData.get(key) as string | null)?.trim() ?? "";

  const fullName = str("fullName");
  const phone    = str("phone");
  const address  = str("address");
  const city     = str("city");
  const pincode  = str("pincode");

  const fieldErrors: Record<string, string> = {};
  if (!fullName)                               fieldErrors.fullName = "Full name is required.";
  if (!phone)                                  fieldErrors.phone    = "Phone number is required.";
  else if (!/^\+?[\d\s\-()]{7,15}$/.test(phone)) fieldErrors.phone = "Enter a valid phone number.";
  if (!address)                                fieldErrors.address  = "Address is required.";
  if (!city)                                   fieldErrors.city     = "City is required.";
  if (!pincode)                                fieldErrors.pincode  = "Pincode is required.";
  else if (!/^\d{4,10}$/.test(pincode))        fieldErrors.pincode  = "Enter a valid pincode.";

  if (Object.keys(fieldErrors).length > 0) {
    // Serialise field errors as JSON so the client component can map them to fields.
    return {
      success: false,
      error: JSON.stringify(fieldErrors),
      code: "VALIDATION",
    };
  }

  // Address is valid — proceed to place the order.
  // (Address storage can be wired to an Address model in a future iteration.)
  return placeOrder();
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

import { OrderStatus } from "@prisma/client";
import { getSessionRole } from "@/lib/session";

// Derive the valid set directly from Prisma's enum — stays in sync automatically.
const VALID_ORDER_STATUSES = new Set<string>(Object.values(OrderStatus));

export interface UpdateOrderStatusState {
  error?: string;
  success?: boolean;
}

/**
 * Updates an order's status.  Admin / SuperAdmin only.
 * Designed for `useActionState` — bind the orderId before use:
 *   const bound = updateOrderStatusAction.bind(null, orderId);
 */
export async function updateOrderStatusAction(
  orderId: string,
  _prev: UpdateOrderStatusState,
  formData: FormData,
): Promise<UpdateOrderStatusState> {
  // ── Auth guard ────────────────────────────────────────────────────────────
  const role = await getSessionRole();
  if (!role) redirect("/login");
  if (role !== "ADMIN" && role !== "SUPERADMIN") redirect("/");

  // ── Validate inputs ───────────────────────────────────────────────────────
  if (!orderId) return { error: "Missing order ID." };

  const status = formData.get("status")?.toString().trim() ?? "";
  if (!status || !VALID_ORDER_STATUSES.has(status)) {
    return { error: "Invalid status value." };
  }

  // ── Persist ───────────────────────────────────────────────────────────────
  try {
    await prisma.order.update({
      where: { id: orderId },
      data:  { status: status as OrderStatus },
    });
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

  // ── Revalidate ────────────────────────────────────────────────────────────
  // /admin dashboard revenue card counts only non-PENDING/CANCELLED orders;
  // a status change can alter that total so bust the dashboard cache too.
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);

  return { success: true };
}
