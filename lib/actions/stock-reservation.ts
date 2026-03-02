"use server";

import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** How long (milliseconds) stock is held before auto-release. */
const RESERVATION_TTL_MS = 10 * 60 * 1_000; // 10 minutes

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ReservationItem = {
  productId: string;
  quantity:  number;
  /** Null / undefined = base product. Non-null = reserve this specific variant. */
  variantId?: string | null;
};

export type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string; code?: string };

// ─────────────────────────────────────────────────────────────────────────────
// reserveStockForUser / reserveStock
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Internal core — soft-hold stock for a known userId.
 * Called directly by placeOrderAction (userId already verified) and by
 * the user-facing reserveStock wrapper below.
 *
 * For each item:
 *   1. Checks available stock (stockQuantity − reservedQty).
 *   2. Creates a StockReservation row (expiresAt = now + 10 min).
 *   3. Increments Inventory.reservedQty so concurrent callers see the hold.
 *
 * Runs inside a Serializable transaction so two concurrent checkouts cannot
 * both read the same available qty and both succeed when one unit remains.
 *
 * Existing PENDING reservations for the same user+product are replaced
 * (old one released, new one created) so re-entering checkout is idempotent.
 */
export async function reserveStockForUser(
  userId: string,
  items:  ReservationItem[],
): Promise<ActionResult<{ reservationIds: string[] }>> {
  if (items.length === 0) {
    return { success: false, error: "No items to reserve.", code: "EMPTY" };
  }

  try {
    const reservationIds = await prisma.$transaction(
      async (tx) => {
        const expiry = new Date(Date.now() + RESERVATION_TTL_MS);
        const ids: string[] = [];

        for (const item of items) {
          // ── Release any existing PENDING reservation this user has ───────
          const existing = await tx.stockReservation.findFirst({
            where: { productId: item.productId, userId, status: "PENDING" },
            select: { id: true, quantity: true },
          });

          if (existing) {
            // Give reserved qty back before re-reserving
            await tx.inventory.updateMany({
              where: { productId: item.productId },
              data: { reservedQty: { decrement: existing.quantity } },
            });
            await tx.stockReservation.update({
              where: { id: existing.id },
              data: { status: "RELEASED" },
            });
          }

          // ── Check available stock ──────────────────────────────────────
          const inventory = await tx.inventory.findUnique({
            where: { productId: item.productId },
            select: { stockQuantity: true, reservedQty: true },
          });

          // Fall back to Product.stock if no Inventory row exists yet
          if (!inventory) {
            const product = await tx.product.findUnique({
              where: { id: item.productId },
              select: { stock: true, title: true, isActive: true, sku: true },
            });

            if (!product || !product.isActive) {
              throw new ReservationError(
                "One or more products are unavailable.",
                "PRODUCT_INACTIVE"
              );
            }

            if (product.stock < item.quantity) {
              throw new ReservationError(
                `Not enough stock available (requested ${item.quantity}, remaining ${product.stock}).`,
                "INSUFFICIENT_STOCK"
              );
            }

            // Auto-create the Inventory row so reservedQty is properly tracked
            // from this point forward. upsert handles the race where a parallel
            // Serializable transaction creates the same row first — Postgres will
            // detect the dependency conflict and abort one of the two transactions.
            await tx.inventory.upsert({
              where:  { productId: item.productId },
              create: {
                productId:     item.productId,
                sku:           product.sku ?? item.productId,
                stockQuantity: product.stock,
                reservedQty:   item.quantity,
              },
              update: {
                reservedQty: { increment: item.quantity },
              },
            });
          } else {
            const available = inventory.stockQuantity - inventory.reservedQty;
            if (available < item.quantity) {
              throw new ReservationError(
                `Not enough stock available (requested ${item.quantity}, available ${available}).`,
                "INSUFFICIENT_STOCK"
              );
            }

            // ── Increment reservedQty ────────────────────────────────────
            await tx.inventory.updateMany({
              where: { productId: item.productId },
              data: { reservedQty: { increment: item.quantity } },
            });
          }

          // ── Create reservation row ─────────────────────────────────────
          const reservation = await tx.stockReservation.create({
            data: { productId: item.productId, userId, quantity: item.quantity, expiresAt: expiry },
            select: { id: true },
          });

          ids.push(reservation.id);
        }

        return ids;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 8_000 }
    );

    return { success: true, data: { reservationIds } };
  } catch (err) {
    if (err instanceof ReservationError) {
      return { success: false, error: err.message, code: err.code };
    }
    console.error("[reserveStockForUser]", err);
    return { success: false, error: "Failed to reserve stock. Please try again.", code: "INTERNAL" };
  }
}

/**
 * User-facing wrapper — reads session to obtain userId, then delegates to
 * reserveStockForUser. Call reserveStockForUser directly when the caller
 * already has a verified userId (e.g., inside placeOrderAction).
 */
export async function reserveStock(
  items: ReservationItem[]
): Promise<ActionResult<{ reservationIds: string[] }>> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { success: false, error: "You must be logged in.", code: "UNAUTHENTICATED" };
  }
  return reserveStockForUser(userId, items);
}

// ─────────────────────────────────────────────────────────────────────────────
// releaseReservations  — user abandoned checkout
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Release all PENDING stock reservations for the current user.
 * Call when the user navigates away from checkout or payment fails.
 */
export async function releaseReservations(): Promise<ActionResult> {
  const userId = await getSessionUserId();
  if (!userId) return { success: false, error: "Unauthenticated.", code: "UNAUTHENTICATED" };

  return releaseReservationsForUser(userId);
}

/** Non-server-action variant — can be called from within other server actions. */
export async function releaseReservationsForUser(userId: string): Promise<ActionResult> {
  try {
    await prisma.$transaction(
      async (tx) => {
        const pending = await tx.stockReservation.findMany({
          where:  { userId, status: "PENDING" },
          select: { id: true, productId: true, quantity: true, variantId: true },
        });

        if (pending.length === 0) return;

        // Sequential loop — parallel writes inside a transaction can trigger
        // unnecessary P2034 serialization failures under high concurrency.
        // The `gte` guard prevents reservedQty from going negative on any
        // double-release bug (e.g., duplicate cron + user cancel race).
        for (const r of pending) {
          await tx.inventory.updateMany({
            where: { productId: r.productId, reservedQty: { gte: r.quantity } },
            data:  { reservedQty: { decrement: r.quantity } },
          });
          if (r.variantId) {
            await tx.productVariant.updateMany({
              where: { id: r.variantId, reservedQty: { gte: r.quantity } },
              data:  { reservedQty: { decrement: r.quantity } },
            });
          }
        }

        await tx.stockReservation.updateMany({
          where: { id: { in: pending.map((r) => r.id) } },
          data:  { status: "RELEASED" },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 8_000 },
    );

    return { success: true };
  } catch (err) {
    console.error("[releaseReservations]", err);
    return { success: false, error: "Failed to release reservations.", code: "INTERNAL" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// confirmReservations  — called inside placeOrder transaction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert PENDING reservations to CONFIRMED and link them to the order.
 * Must be called INSIDE an existing Prisma transaction (tx).
 *
 * After confirmation, Inventory.reservedQty is decremented because the stock
 * has already been hard-deducted from Product.stock in placeOrder.
 *
 * Uses a sequential loop (not Promise.all) to avoid P2034 serialization
 * failures under high concurrency inside the caller's Serializable tx.
 * The `gte` guard prevents reservedQty from going negative.
 */
export async function confirmReservationsInTx(
  tx:      Prisma.TransactionClient,
  userId:  string,
  orderId: string,
): Promise<void> {
  const pending = await tx.stockReservation.findMany({
    where:  { userId, status: "PENDING" },
    select: { id: true, productId: true, quantity: true, variantId: true },
  });

  if (pending.length === 0) return;

  // Sequential loop: undo the soft-hold for each reservation.
  // The `gte` guard makes each decrement a no-op if reservedQty was already
  // corrected by a concurrent expiry run, preventing it going negative.
  for (const r of pending) {
    await tx.inventory.updateMany({
      where: { productId: r.productId, reservedQty: { gte: r.quantity } },
      data:  { reservedQty: { decrement: r.quantity } },
    });
    // Also undo the variant-level hold when this reservation carried one.
    if (r.variantId) {
      await tx.productVariant.updateMany({
        where: { id: r.variantId, reservedQty: { gte: r.quantity } },
        data:  { reservedQty: { decrement: r.quantity } },
      });
    }
  }

  await tx.stockReservation.updateMany({
    where: { id: { in: pending.map((r) => r.id) } },
    data:  { status: "CONFIRMED", orderId },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// rollbackOrderStock  — restore inventory on terminal payment failure
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Restore every unit of stock that was hard-deducted when the order was placed,
 * then mark the related StockReservation rows as ROLLED_BACK.
 *
 * Call this function when a payment is permanently unrecoverable (order locked
 * after exhausted retries, or order explicitly cancelled by admin / user).
 * It MUST NOT be called for COD orders — those are fulfilled without payment.
 *
 * Idempotency
 * ───────────
 * The function exits without side-effects if any StockReservation for this
 * orderId already carries status ROLLED_BACK.  Duplicate webhook deliveries,
 * admin retriggers, or crash-recovery re-runs are all safe.
 *
 * Concurrency
 * ───────────
 * Must be called inside a Serializable transaction (or use the standalone
 * rollbackOrderStock wrapper which starts one automatically).  Two simultaneous
 * rollbacks for the same order contend on the same StockReservation rows;
 * Postgres will abort one with P2034, and on retry it will immediately find
 * ROLLED_BACK rows and exit early — no double-release possible.
 *
 * What is restored
 * ────────────────
 * • Product.stock              — the authoritative catalogue count
 * • Inventory.stockQuantity    — the warehouse count mirrors the deduction
 * • ProductVariant.stock       — when the order line carried a specific variant
 * • InventoryTransaction row   — audit trail entry (reason: PAYMENT_ROLLBACK)
 *
 * What is NOT touched
 * ─────────────────
 * • Inventory.reservedQty      — was already decremented by confirmReservationsInTx
 *                                at order placement; no adjustment needed here.
 * • Order rows / OrderItems    — caller owns those status transitions.
 */
export async function rollbackOrderStockInTx(
  tx:      Prisma.TransactionClient,
  orderId: string,
): Promise<void> {
  // ── Idempotency guard ──────────────────────────────────────────────────────
  // If even one reservation for this order is already ROLLED_BACK, the full
  // rollback already ran (or is in progress from another concurrent call that
  // will commit first).  Exit immediately — no double-release.
  const alreadyRolledBack = await tx.stockReservation.findFirst({
    where:  { orderId, status: "ROLLED_BACK" },
    select: { id: true },
  });
  if (alreadyRolledBack) return;

  // ── Load CONFIRMED reservations for this order ────────────────────────────
  // StockReservation rows capture the exact quantities that went through the
  // checkout soft-hold and were promoted to CONFIRMED in placeOrder step 7.
  const confirmed = await tx.stockReservation.findMany({
    where:  { orderId, status: "CONFIRMED" },
    select: { id: true, productId: true, quantity: true, variantId: true },
  });

  // No CONFIRMED rows → order either never had reservations or was already
  // processed.  No-op is safe.
  if (confirmed.length === 0) return;

  // ── Sort for deterministic lock acquisition order ─────────────────────────
  // Same (productId, variantId) sort used in placeOrder step 5 to prevent
  // deadlocks when two rollback transactions run simultaneously.
  const sorted = [...confirmed].sort((a, b) => {
    const p = a.productId.localeCompare(b.productId);
    return p !== 0 ? p : (a.variantId ?? "").localeCompare(b.variantId ?? "");
  });

  for (const r of sorted) {
    // ── Restore Product.stock ─────────────────────────────────────────────
    // A plain increment is safe: placeOrder's gte-guarded decrement ensured
    // stock never went below 0, so adding back can only approach the original.
    await tx.product.updateMany({
      where: { id: r.productId },
      data:  { stock: { increment: r.quantity } },
    });

    // ── Restore Inventory.stockQuantity + audit row ───────────────────────
    const inv = await tx.inventory.findUnique({
      where:  { productId: r.productId },
      select: { id: true },
    });
    if (inv) {
      await tx.inventory.updateMany({
        where: { id: inv.id },
        data:  { stockQuantity: { increment: r.quantity } },
      });
      await tx.inventoryTransaction.create({
        data: {
          inventoryId: inv.id,
          delta:       r.quantity,          // positive = stock coming back
          reason:      "PAYMENT_ROLLBACK",
          reference:   orderId,
          variantId:   r.variantId ?? null,
        },
      });
    }

    // ── Restore ProductVariant.stock ──────────────────────────────────────
    if (r.variantId) {
      await tx.productVariant.updateMany({
        where: { id: r.variantId },
        data:  { stock: { increment: r.quantity } },
      });
    }
  }

  // ── Stamp reservations ROLLED_BACK — the idempotency sentinel ────────────
  // This write is intentionally LAST: if the loop crashes mid-way the guard
  // remains unset, so the next invocation retries the full loop cleanly.
  await tx.stockReservation.updateMany({
    where: { id: { in: sorted.map((r) => r.id) } },
    data:  { status: "ROLLED_BACK" },
  });
}

/**
 * Standalone wrapper — starts its own Serializable transaction.
 *
 * Use this from webhook handlers, scheduled jobs, and admin cancel flows.
 * Returns { success: true } both on a fresh rollback and on an idempotent
 * no-op (already rolled back).  Only returns an error on infrastructure
 * failures (DB timeout, network error, etc.).
 */
export async function rollbackOrderStock(orderId: string): Promise<ActionResult> {
  if (!orderId?.trim()) {
    return { success: false, error: "orderId is required.", code: "INVALID_INPUT" };
  }
  try {
    await prisma.$transaction(
      async (tx) => { await rollbackOrderStockInTx(tx, orderId); },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 },
    );
    return { success: true };
  } catch (err) {
    console.error("[rollbackOrderStock]", err);
    return { success: false, error: "Failed to rollback order stock.", code: "INTERNAL" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// expireStaleReservations  — called by cron
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find every PENDING reservation past its expiresAt and release the held stock.
 *
 * Concurrency safety:
 *   1. The single `UPDATE...RETURNING` atomically claims exactly the rows that
 *      THIS call transitions PENDING → EXPIRED.  A simultaneous cron run
 *      receives a disjoint (or empty) set of rows — no double-release.
 *   2. The subsequent inventory decrements run inside a transaction so a
 *      mid-loop crash cannot leave reservedQty partially decremented.
 *   3. A sequential loop (not Promise.all) avoids P2034 serialization noise.
 *   4. The `gte` guard on each decrement makes the row a no-op if another
 *      path already decremented it, so reservedQty never goes negative.
 *
 * Returns the number of reservations that were expired.
 */
export async function expireStaleReservations(): Promise<number> {
  const now = new Date();

  // ── Single atomic CTE: claim rows AND decrement reservedQty in one round-trip.
  //
  // Previous two-phase design had a split-phase gap: if phase-2 failed after
  // phase-1 committed, StockReservation rows were permanently EXPIRED but
  // Inventory.reservedQty stayed elevated with no retry path.
  //
  // This CTE eliminates that gap:
  //   • `claimed`  — atomically transitions all eligible PENDING rows to EXPIRED
  //                  and returns their (productId, quantity) pairs.
  //   • `totals`   — sums quantities per product so products with multiple
  //                  simultaneous expiries get a single UPDATE, not N updates.
  //   • Final UPDATE — decrements reservedQty in bulk, clamped to 0 by GREATEST
  //                  so it can never go negative regardless of prior state.
  //
  // Two simultaneous cron runs see disjoint sets from `claimed` (the WHERE
  // status='PENDING' filter), so there is no double-release.
  const result = await prisma.$queryRaw<{ expired_count: bigint }[]>`
    WITH claimed AS (
      UPDATE stock_reservations
      SET    status = 'EXPIRED'
      WHERE  status = 'PENDING'
        AND  "expiresAt" < ${now}
      RETURNING "productId", quantity
    ),
    totals AS (
      SELECT "productId", SUM(quantity)::int AS total_qty
      FROM   claimed
      GROUP  BY "productId"
    )
    UPDATE inventory
    SET    "reservedQty" = GREATEST(0, "reservedQty" - totals.total_qty)
    FROM   totals
    WHERE  inventory."productId" = totals."productId"
    RETURNING (SELECT COUNT(*) FROM claimed)::bigint AS expired_count
  `;

  // All rows from the CTE are committed atomically — either all expire and
  // all reservedQty decrements commit, or nothing changes.
  const expired = result.length > 0 ? Number(result[0].expired_count) : 0;
  if (expired > 0) {
    console.info(`[expireStaleReservations] expired ${expired} reservation(s)`);
  }
  return expired;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal error class
// ─────────────────────────────────────────────────────────────────────────────

class ReservationError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "ReservationError";
  }
}
