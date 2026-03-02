"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma, TransactionReason } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getSessionRole, getSessionUserId } from "@/lib/session";

// NOTE: All exported values in a "use server" file must be async functions.
// Constants are kept module-private (no export).

// ─────────────────────────────────────────────────────────────────────────────
// Shared result type
// ─────────────────────────────────────────────────────────────────────────────

export type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string; code?: string };

// ─────────────────────────────────────────────────────────────────────────────
// Validation schemas
// ─────────────────────────────────────────────────────────────────────────────

const createInventorySchema = z.object({
  productId:         z.string().cuid("Invalid product ID."),
  sku:               z.string().min(1, "SKU is required.").max(100).trim().toUpperCase(),
  stockQuantity:     z.number().int().min(0).default(0),
  reorderLevel:      z.number().int().min(0).default(10),
  warehouseLocation: z.string().max(200).trim().optional().nullable(),
});

const adjustStockSchema = z.object({
  inventoryId: z.string().cuid("Invalid inventory ID."),
  delta:       z.number().int("Delta must be a whole number.").refine((v) => v !== 0, "Delta cannot be zero."),
  reason:      z.enum(["RESTOCK", "ADJUSTMENT", "DAMAGE", "RETURN", "SALE"]),
  reference:   z.string().max(200).trim().optional().nullable(),
  /** Optional free-text note shown in the admin transaction log. */
  note:        z.string().max(500).trim().optional().nullable(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Auth guard helpers
// ─────────────────────────────────────────────────────────────────────────────

async function requireAdmin() {
  const role = await getSessionRole();
  if (!role) redirect("/login");
  if (role !== "ADMIN" && role !== "SUPERADMIN") redirect("/");
  return role;
}

async function requireAdminWithId(): Promise<string> {
  const [role, userId] = await Promise.all([getSessionRole(), getSessionUserId()]);
  if (!role) redirect("/login");
  if (role !== "ADMIN" && role !== "SUPERADMIN") redirect("/");
  return userId ?? "";
}

// ─────────────────────────────────────────────────────────────────────────────
// createLowStockNotification  (internal helper)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends a LOW_STOCK notification to all active admins for the given product
 * IF no unread notification already exists for it.
 *
 * Accepts a pre-fetched `adminIds` array to avoid an N+1 query in batch
 * callers like `runLowStockScan`. Falls back to a DB lookup when omitted.
 *
 * Always runs OUTSIDE any transaction so a notification failure never
 * rolls back the stock adjustment that triggered it.
 */
async function notifyLowStock(
  productId:    string,
  productTitle: string,
  stock:        number,
  threshold:    number,
  adminIds?:    string[],
): Promise<void> {
  // ── Resolve admin IDs once ─────────────────────────────────────────────────
  let ids = adminIds;
  if (!ids) {
    const admins = await prisma.user.findMany({
      where:  { role: { in: ["ADMIN", "SUPERADMIN"] }, isActive: true, deletedAt: null },
      select: { id: true },
    });
    ids = admins.map((a) => a.id);
  }
  if (ids.length === 0) return;

  // ── De-duplicate via raw COUNT (index-only, fast) ─────────────────────────
  // Using a COUNT instead of findFirst avoids fetching a full row and is safe
  // to run concurrently — the final createMany has skipDuplicates as a guard
  // against the tiny race window between the count check and the insert.
  const [{ count }] = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) AS count
    FROM   notifications
    WHERE  "userId"               = ANY(${ids}::text[])
      AND  type                   = 'LOW_STOCK'
      AND  "isRead"               = false
      AND  metadata->>'productId' = ${productId}
    LIMIT  1
  `;
  if (Number(count) > 0) return;

  await prisma.notification.createMany({
    data: ids.map((userId) => ({
      userId,
      type:     "LOW_STOCK" as const,
      title:    `Low stock: ${productTitle}`,
      body:     `Only ${stock} unit${stock === 1 ? "" : "s"} remaining (threshold: ${threshold}).`,
      metadata: { productId, stock, threshold },
    })),
    skipDuplicates: true, // last-resort guard against parallel cron overlap
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// getInventoryDashboardStats  — single-query KPI aggregation
// ─────────────────────────────────────────────────────────────────────────────

export type InventoryDashboardStats = {
  totalProducts:          number;
  inStockCount:           number;
  lowStockCount:          number;
  outOfStockCount:        number;
  totalStockValue:        number;
  recentAdjustmentsCount: number;
};

export async function getInventoryDashboardStats(): Promise<ActionResult<InventoryDashboardStats>> {
  await requireAdmin();

  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1_000);

    const [[row], recentCount] = await Promise.all([
      prisma.$queryRaw<[{
        totalProducts:   bigint;
        inStockCount:    bigint;
        lowStockCount:   bigint;
        outOfStockCount: bigint;
        totalStockValue: number;
      }]>`
        SELECT
          COUNT(*)::bigint                                                              AS "totalProducts",
          COUNT(*) FILTER (WHERE i."stockQuantity" > i."reorderLevel")::bigint         AS "inStockCount",
          COUNT(*) FILTER (WHERE i."stockQuantity" > 0
                             AND i."stockQuantity" <= i."reorderLevel")::bigint        AS "lowStockCount",
          COUNT(*) FILTER (WHERE i."stockQuantity" = 0)::bigint                       AS "outOfStockCount",
          COALESCE(SUM(p.price * i."stockQuantity")::float, 0)                        AS "totalStockValue"
        FROM  inventory i
        JOIN  products  p ON p.id = i."productId"
        WHERE p."deletedAt" IS NULL
      `,
      prisma.inventoryTransaction.count({
        where: { createdAt: { gte: since24h } },
      }),
    ]);

    return {
      success: true,
      data: {
        totalProducts:          Number(row.totalProducts),
        inStockCount:           Number(row.inStockCount),
        lowStockCount:          Number(row.lowStockCount),
        outOfStockCount:        Number(row.outOfStockCount),
        totalStockValue:        row.totalStockValue,
        recentAdjustmentsCount: recentCount,
      },
    };
  } catch (err) {
    console.error("[getInventoryDashboardStats]", err);
    return { success: false, error: "Failed to load dashboard stats." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// createInventory  — create an inventory row for a product
// ─────────────────────────────────────────────────────────────────────────────

export async function createInventory(input: z.infer<typeof createInventorySchema>): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();

  const parsed = createInventorySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input.", code: "INVALID_INPUT" };
  }

  try {
    const inventory = await prisma.inventory.create({
      data: {
        productId:         parsed.data.productId,
        sku:               parsed.data.sku,
        stockQuantity:     parsed.data.stockQuantity,
        reorderLevel:      parsed.data.reorderLevel,
        warehouseLocation: parsed.data.warehouseLocation ?? null,
      },
      select: { id: true },
    });

    revalidatePath("/admin/inventory");
    return { success: true, data: { id: inventory.id } };
  } catch (err: unknown) {
    const prismaErr = err as { code?: string };
    if (prismaErr?.code === "P2002") {
      return { success: false, error: "Inventory record already exists for this product or SKU.", code: "DUPLICATE" };
    }
    console.error("[createInventory]", err);
    return { success: false, error: "Failed to create inventory record." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// adjustStock  — record a stock delta with a reason
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adjust stock by `delta` (positive = in, negative = out).
 *
 * Concurrency strategy (no race condition, no Serializable overhead):
 *   - For NEGATIVE deltas: the core `updateMany` uses an atomic
 *     `WHERE stockQuantity >= |delta|` guard.  Check and decrement are a
 *     single SQL statement — impossible for two concurrent writes to both
 *     succeed when only one unit remains.
 *   - For POSITIVE deltas (restocks): no guard needed.
 *   - `Product.stock` mirror and `InventoryTransaction` log are written in
 *     the SAME transaction — all three are always consistent.
 *   - If stock is reduced BELOW current reservedQty (e.g. admin DAMAGE
 *     write-off), reservedQty is capped to the new stock so available qty
 *     never silently goes negative.
 */
export async function adjustStock(input: z.infer<typeof adjustStockSchema>): Promise<ActionResult> {
  const performedById = await requireAdminWithId();

  const parsed = adjustStockSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input.", code: "INVALID_INPUT" };
  }

  const { inventoryId, delta, reason, reference, note } = parsed.data;

  let notifyPayload: { productId: string; title: string; newStock: number; threshold: number } | null = null;

  try {
    await prisma.$transaction(async (tx) => {
      // ── Snapshot stock before mutation for audit trail ──────────────────────
      const before = await tx.inventory.findUnique({
        where:  { id: inventoryId },
        select: { stockQuantity: true, reservedQty: true, reorderLevel: true, product: { select: { id: true, title: true } } },
      });
      if (!before) throw new Error("INVENTORY_NOT_FOUND");

      const previousStock = before.stockQuantity;

      // ── Atomic check-and-apply ──────────────────────────────────────────────
      const { count } = await tx.inventory.updateMany({
        where: {
          id: inventoryId,
          ...(delta < 0 ? { stockQuantity: { gte: -delta } } : {}),
        },
        data: { stockQuantity: { increment: delta } },
      });

      if (count === 0) throw new Error("INSUFFICIENT_STOCK");

      // ── Read post-update state ──────────────────────────────────────────────
      const after = await tx.inventory.findUniqueOrThrow({
        where:  { id: inventoryId },
        select: { stockQuantity: true, reservedQty: true, reorderLevel: true },
      });

      const newStock = after.stockQuantity;

      // ── Cap reservedQty if stock was reduced below current holds ──────────
      if (after.reservedQty > newStock) {
        await tx.inventory.update({
          where: { id: inventoryId },
          data:  { reservedQty: newStock },
        });
      }

      // ── Mirror into Product.stock ─────────────────────────────────────────
      await tx.product.update({
        where: { id: before.product.id },
        data:  { stock: newStock },
      });

      // ── Write movement audit trail with full snapshot ─────────────────────
      await tx.inventoryTransaction.create({
        data: {
          inventoryId,
          delta,
          reason,
          reference:     reference ?? null,
          note:          note      ?? null,
          previousStock,
          newStock,
          performedById: performedById || null,
        },
      });

      if (newStock <= after.reorderLevel) {
        notifyPayload = {
          productId: before.product.id,
          title:     before.product.title,
          newStock,
          threshold: after.reorderLevel,
        };
      }
    });

    if (notifyPayload) {
      const p = notifyPayload as { productId: string; title: string; newStock: number; threshold: number };
      await notifyLowStock(p.productId, p.title, p.newStock, p.threshold).catch(
        (err) => console.error("[adjustStock] notification error", err),
      );
    }

    revalidatePath("/admin/inventory");
    return { success: true };
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === "INVENTORY_NOT_FOUND") {
      return { success: false, error: "Inventory record not found.", code: "NOT_FOUND" };
    }
    if (error.message === "INSUFFICIENT_STOCK") {
      return { success: false, error: "Cannot reduce stock below zero.", code: "INSUFFICIENT_STOCK" };
    }
    console.error("[adjustStock]", err);
    return { success: false, error: "Failed to adjust stock." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getLowStockItems  — items at or below reorder threshold
// ─────────────────────────────────────────────────────────────────────────────

export type LowStockItem = {
  id:               string;
  sku:              string;
  stockQuantity:    number;
  reservedQty:      number;
  availableQty:     number;
  reorderLevel:     number;
  warehouseLocation: string | null;
  product: {
    id:       string;
    title:    string;
    slug:     string | null;   // schema: slug String?
    isActive: boolean;
  };
};

export async function getLowStockItems(): Promise<ActionResult<LowStockItem[]>> {
  await requireAdmin();

  try {
    // Prisma doesn't support comparing two columns directly in findMany,
    // so we use raw SQL for the reorderLevel comparison.
    const rawItems = await prisma.$queryRaw<Omit<LowStockItem, "availableQty">[]>`
      SELECT
        i.id,
        i.sku,
        i."stockQuantity",
        i."reservedQty",
        i."reorderLevel",
        i."warehouseLocation",
        json_build_object(
          'id',       p.id,
          'title',    p.title,
          'slug',     p.slug,
          'isActive', p."isActive"
        ) AS product
      FROM   inventory i
      JOIN   products  p ON p.id = i."productId"
      WHERE  i."stockQuantity" > 0
        AND  i."stockQuantity" <= i."reorderLevel"
        AND  p."deletedAt" IS NULL
      ORDER  BY (i."stockQuantity" - i."reorderLevel") ASC
      LIMIT  100
    `;
    const items: LowStockItem[] = rawItems.map((r) => ({
      ...r,
      availableQty: Math.max(0, r.stockQuantity - r.reservedQty),
    }));

    return { success: true, data: items };
  } catch (err) {
    console.error("[getLowStockItems]", err);
    return { success: false, error: "Failed to fetch low-stock items." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getInventoryTransactions  — history for a single inventory record
// ─────────────────────────────────────────────────────────────────────────────

export type InventoryTx = {
  id:            string;
  delta:         number;
  reason:        string;
  reference:     string | null;
  note:          string | null;
  previousStock: number | null;
  newStock:      number | null;
  createdAt:     Date;
  performedBy:   { id: string; name: string; email: string } | null;
};

export type FullInventoryTx = InventoryTx & {
  inventory: {
    id:  string;
    sku: string;
    product: { id: string; title: string };
  };
};

export async function getInventoryTransactions(
  inventoryId: string,
  page     = 1,
  pageSize = 20,
): Promise<ActionResult<{ transactions: InventoryTx[]; total: number }>> {
  await requireAdmin();

  try {
    const [transactions, total] = await Promise.all([
      prisma.inventoryTransaction.findMany({
        where:   { inventoryId },
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        select:  {
          id: true, delta: true, reason: true, reference: true, note: true,
          previousStock: true, newStock: true, createdAt: true,
          performedBy: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.inventoryTransaction.count({ where: { inventoryId } }),
    ]);

    return { success: true, data: { transactions, total } };
  } catch (err) {
    console.error("[getInventoryTransactions]", err);
    return { success: false, error: "Failed to fetch inventory transactions." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getAllInventoryTransactions  — paginated log ACROSS all SKUs (admin dashboard)
// ─────────────────────────────────────────────────────────────────────────────

export async function getAllInventoryTransactions(
  page     = 1,
  pageSize = 25,
): Promise<ActionResult<{ transactions: FullInventoryTx[]; total: number }>> {
  await requireAdmin();

  try {
    const [transactions, total] = await Promise.all([
      prisma.inventoryTransaction.findMany({
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        select:  {
          id: true, delta: true, reason: true, reference: true, note: true,
          previousStock: true, newStock: true, createdAt: true,
          performedBy: { select: { id: true, name: true, email: true } },
          inventory: {
            select: {
              id: true, sku: true,
              product: { select: { id: true, title: true } },
            },
          },
        },
      }),
      prisma.inventoryTransaction.count(),
    ]);

    return { success: true, data: { transactions, total } };
  } catch (err) {
    console.error("[getAllInventoryTransactions]", err);
    return { success: false, error: "Failed to fetch transaction log." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getInventoryListFiltered  — paginated inventory with search + status filter
// ─────────────────────────────────────────────────────────────────────────────

export type InventoryListItem = {
  id:                string;
  sku:               string;
  stockQuantity:     number;
  reservedQty:       number;
  availableQty:      number;
  reorderLevel:      number;
  warehouseLocation: string | null;
  updatedAt:         Date;
  stockStatus:       "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  product: {
    id: string; title: string; slug: string | null; isActive: boolean; price: number;
    category: { name: string };
    variants: { id: string; name: string; value: string; stock: number; reservedQty: number; sku: string | null }[];
  };
};

export async function getInventoryListFiltered(params: {
  page?:     number;
  pageSize?: number;
  search?:   string;
  status?:   "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "";
}): Promise<ActionResult<{ items: InventoryListItem[]; total: number }>> {
  await requireAdmin();

  const page     = Math.max(1, params.page     ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));
  const search   = params.search?.trim() ?? "";
  const status   = params.status ?? "";

  try {
    // Always exclude soft-deleted products — matches dashboard stats behaviour.
    const baseWhere = { product: { deletedAt: null } } as const;

    const searchFilter = search
      ? {
          ...baseWhere,
          OR: [
            { sku:     { contains: search, mode: "insensitive" as const } },
            { product: { title: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : baseWhere;

    const baseSelect = {
      id: true, sku: true, stockQuantity: true, reservedQty: true,
      reorderLevel: true, warehouseLocation: true, updatedAt: true,
      product: {
        select: {
          id: true, title: true, slug: true, isActive: true, price: true,
          category: { select: { name: true } },
          variants: { select: { id: true, name: true, value: true, stock: true, reservedQty: true, sku: true } },
        },
      },
    } as const;

    // Null-safe reorderLevel: if somehow null, fall back to schema default of 10.
    const threshold = (r: { reorderLevel: number }) => r.reorderLevel ?? 10;

    const toItem = (r: Awaited<ReturnType<typeof prisma.inventory.findMany<{ select: typeof baseSelect }>>>[number]): InventoryListItem => ({
      ...r,
      availableQty: Math.max(0, r.stockQuantity - r.reservedQty),
      stockStatus:
        r.stockQuantity === 0
          ? "OUT_OF_STOCK"
          : r.stockQuantity <= threshold(r)
          ? "LOW_STOCK"
          : "IN_STOCK",
    });

    if (!status) {
      const [raw, total] = await Promise.all([
        prisma.inventory.findMany({ where: searchFilter, skip: (page - 1) * pageSize, take: pageSize, orderBy: { updatedAt: "desc" }, select: baseSelect }),
        prisma.inventory.count({ where: searchFilter }),
      ]);
      return { success: true, data: { items: raw.map(toItem), total } };
    }

    // OUT_OF_STOCK can be pushed to DB layer; LOW_STOCK/IN_STOCK need a
    // column-vs-column comparison which Prisma findMany doesn't support, so
    // those are filtered in JS after fetching all matching rows.
    const statusWhere =
      status === "OUT_OF_STOCK" ? { stockQuantity: 0 } : {};

    const raw = await prisma.inventory.findMany({
      where:   { ...searchFilter, ...statusWhere },
      orderBy: { updatedAt: "desc" },
      select:  baseSelect,
    });

    // Use the same threshold() helper so classification matches toItem exactly.
    const filtered =
      status === "IN_STOCK"
        ? raw.filter((r) => r.stockQuantity > threshold(r))
        : status === "LOW_STOCK"
        ? raw.filter((r) => r.stockQuantity > 0 && r.stockQuantity <= threshold(r))
        : raw; // OUT_OF_STOCK already filtered by statusWhere above

    const total     = filtered.length;
    const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

    return { success: true, data: { items: paginated.map(toItem), total } };
  } catch (err) {
    console.error("[getInventoryListFiltered]", err);
    return { success: false, error: "Failed to fetch inventory list." };
  }
}

// Back-compat alias
export async function getInventoryList(
  page     = 1,
  pageSize = 25,
): Promise<ActionResult<{ items: InventoryListItem[]; total: number }>> {
  return getInventoryListFiltered({ page, pageSize });
}

// ─────────────────────────────────────────────────────────────────────────────
// getFilteredMovementLog  — full transaction log with filters
// ─────────────────────────────────────────────────────────────────────────────

export async function getFilteredMovementLog(params: {
  page?:      number;
  pageSize?:  number;
  productId?: string;
  from?:      string;
  to?:        string;
  reason?:    string;
}): Promise<ActionResult<{ transactions: FullInventoryTx[]; total: number }>> {
  await requireAdmin();

  const page     = Math.max(1, params.page     ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));

  const where: Prisma.InventoryTransactionWhereInput = {};
  if (params.productId) where.inventory = { productId: params.productId };
  if (params.reason)    where.reason    = params.reason as TransactionReason;
  if (params.from || params.to) {
    where.createdAt = {
      ...(params.from ? { gte: new Date(params.from) } : {}),
      ...(params.to   ? { lte: new Date(params.to)   } : {}),
    };
  }

  try {
    const [transactions, total] = await Promise.all([
      prisma.inventoryTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        select: {
          id: true, delta: true, reason: true, reference: true, note: true,
          previousStock: true, newStock: true, createdAt: true,
          performedBy: { select: { id: true, name: true, email: true } },
          inventory: {
            select: { id: true, sku: true, product: { select: { id: true, title: true } } },
          },
        },
      }),
      prisma.inventoryTransaction.count({ where }),
    ]);
    return { success: true, data: { transactions, total } };
  } catch (err) {
    console.error("[getFilteredMovementLog]", err);
    return { success: false, error: "Failed to fetch movement log." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getProductsForFilter  — minimal product list for the movement log selector
// ─────────────────────────────────────────────────────────────────────────────

export type ProductFilterItem = { id: string; title: string; sku: string };

export async function getProductsForFilter(): Promise<ActionResult<ProductFilterItem[]>> {
  await requireAdmin();
  try {
    const rows = await prisma.inventory.findMany({
      orderBy: { product: { title: "asc" } },
      select:  { sku: true, product: { select: { id: true, title: true } } },
    });
    return {
      success: true,
      data: rows.map((r) => ({ id: r.product.id, title: r.product.title, sku: r.sku })),
    };
  } catch (err) {
    console.error("[getProductsForFilter]", err);
    return { success: false, error: "Failed to fetch product list." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// runLowStockScan  — full sweep for the cron job
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scans all active products whose Inventory.stockQuantity is below their
 * reorderLevel and creates admin notifications for unnotified ones.
 *
 * Idempotency guarantees:
 *   - Admin IDs are fetched ONCE for the entire sweep (no N+1 per product).
 *   - Per-product de-dup uses a fast raw COUNT check.
 *   - `createMany` with `skipDuplicates:true` guards against the tiny race
 *     window if two cron runs overlap.
 *
 * Called by GET /api/cron/check-low-stock.
 */
export async function runLowStockScan(): Promise<{ notifiedCount: number; scannedCount: number }> {
  // ── 1. Fetch admin IDs once for the whole sweep (avoids N+1) ──────────────
  const admins = await prisma.user.findMany({
    where:  { role: { in: ["ADMIN", "SUPERADMIN"] }, isActive: true, deletedAt: null },
    select: { id: true },
  });
  if (admins.length === 0) return { notifiedCount: 0, scannedCount: 0 };
  const adminIds = admins.map((a) => a.id);

  // ── 2. Collect all low-stock products in one query ────────────────────────
  const lowItems = await prisma.$queryRaw<
    { productId: string; title: string; stockQuantity: number; reorderLevel: number }[]
  >`
    SELECT i."productId", p.title, i."stockQuantity", i."reorderLevel"
    FROM   inventory i
    JOIN   products  p ON p.id = i."productId"
    WHERE  i."stockQuantity" <= i."reorderLevel"
      AND  p."isActive"  = true
      AND  p."deletedAt" IS NULL
  `;

  // ── 3. Notify per product, reusing the pre-fetched admin list ─────────────
  let notifiedCount = 0;
  for (const item of lowItems) {
    try {
      await notifyLowStock(
        item.productId,
        item.title,
        item.stockQuantity,
        item.reorderLevel,
        adminIds,   // ← reuse; no extra DB query per product
      );
      notifiedCount++;
    } catch (err) {
      console.error("[runLowStockScan] notification error for product", item.productId, err);
    }
  }

  return { notifiedCount, scannedCount: lowItems.length };
}
