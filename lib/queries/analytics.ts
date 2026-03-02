/**
 * lib/queries/analytics.ts
 *
 * Server-side analytics helpers for the admin dashboard.
 * All functions are read-only; heavy queries use raw SQL for performance.
 */

import prisma from "@/lib/prisma";
import { OrderStatus } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// Revenue over time
// ─────────────────────────────────────────────────────────────────────────────

export type DailyRevenue = {
  date:        string; // "YYYY-MM-DD"
  revenue:     number;
  orderCount:  number;
};

/**
 * Returns daily revenue and order count for the past `days` days,
 * ordered oldest → newest.  Only counts DELIVERED orders.
 */
export async function getRevenueByPeriod(days = 30): Promise<DailyRevenue[]> {
  const rows = await prisma.$queryRaw<
    { date: Date; revenue: bigint; order_count: bigint }[]
  >`
    SELECT
      DATE_TRUNC('day', "createdAt") AS date,
      SUM("totalAmount")             AS revenue,
      COUNT(*)                       AS order_count
    FROM orders
    WHERE
      "createdAt" >= NOW() - INTERVAL '1 day' * ${days}
      AND status = 'DELIVERED'::"OrderStatus"
    GROUP BY DATE_TRUNC('day', "createdAt")
    ORDER BY date ASC
  `;

  return rows.map((r) => ({
    date:       r.date.toISOString().slice(0, 10),
    revenue:    Number(r.revenue),
    orderCount: Number(r.order_count),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Top-selling products
// ─────────────────────────────────────────────────────────────────────────────

export type TopProduct = {
  productId:   string;
  name:        string;
  totalSold:   number;
  totalRevenue: number;
};

export async function getTopProducts(limit = 10): Promise<TopProduct[]> {
  const rows = await prisma.$queryRaw<
    { product_id: string; name: string; total_sold: bigint; total_revenue: bigint }[]
  >`
    SELECT
      oi."productId"       AS product_id,
      p."title"            AS name,
      SUM(oi."quantity")   AS total_sold,
      SUM(oi."price" * oi."quantity") AS total_revenue
    FROM order_items oi
    JOIN products    p  ON p."id" = oi."productId"
    JOIN orders      o  ON o."id" = oi."orderId"
    WHERE o.status = 'DELIVERED'::"OrderStatus"
    GROUP BY oi."productId", p."name"
    ORDER BY total_sold DESC
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    productId:    r.product_id,
    name:         r.name,
    totalSold:    Number(r.total_sold),
    totalRevenue: Number(r.total_revenue),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Order status breakdown  (raw SQL — includes percentage share)
// ─────────────────────────────────────────────────────────────────────────────

export type StatusCount = {
  status:     OrderStatus;
  count:      number;
  /** 0–100, rounded to 1 decimal place */
  percentage: number;
};

/**
 * Returns every order status with its absolute count and share of all orders.
 * Single SQL round-trip using a window function instead of a second COUNT query.
 */
export async function getOrderStatusBreakdown(): Promise<StatusCount[]> {
  const rows = await prisma.$queryRaw<
    { status: string; count: bigint; percentage: string }[]
  >`
    SELECT
      status::text                                                           AS status,
      COUNT(*)                                                               AS count,
      ROUND(
        COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER (), 0),
        1
      )                                                                      AS percentage
    FROM   orders
    GROUP  BY status
    ORDER  BY count DESC
  `;

  return rows.map((r) => ({
    status:     r.status as OrderStatus,
    count:      Number(r.count),
    percentage: parseFloat(r.percentage),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Average order value
// ─────────────────────────────────────────────────────────────────────────────

export async function getAverageOrderValue(days = 30): Promise<number> {
  const result = await prisma.order.aggregate({
    _avg:   { totalAmount: true },
    where:  {
      createdAt: { gte: new Date(Date.now() - days * 86_400_000) },
      status:    OrderStatus.DELIVERED,
    },
  });

  return result._avg.totalAmount ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// User growth over time  (daily new registrations + running total)
// ─────────────────────────────────────────────────────────────────────────────

export type DailyUserGrowth = {
  /** "YYYY-MM-DD" */
  date:       string;
  /** Users who registered on this specific day */
  newUsers:   number;
  /** Running cumulative total of all non-deleted users up to this day */
  cumulative: number;
};

/**
 * Returns one row per day for the past `days` days, ordered oldest → newest.
 *
 * The `cumulative` column is the total user count AS OF that day
 * (pre-window base count + running sum inside the window).
 *
 * Index used:  users("createdAt")  — already exists in schema.
 */
export async function getUserGrowthByDay(days = 30): Promise<DailyUserGrowth[]> {
  const rows = await prisma.$queryRaw<
    { date: Date; new_users: bigint; cumulative: bigint }[]
  >`
    WITH
      -- All users who registered before the window (baseline for running total)
      base AS (
        SELECT COUNT(*) AS total
        FROM   users
        WHERE  "createdAt" < NOW() - INTERVAL '1 day' * ${days}
          AND  "deletedAt" IS NULL
      ),
      -- Daily sign-up counts inside the window
      daily AS (
        SELECT
          DATE_TRUNC('day', "createdAt") AS date,
          COUNT(*)                        AS new_users
        FROM   users
        WHERE  "createdAt" >= NOW() - INTERVAL '1 day' * ${days}
          AND  "deletedAt" IS NULL
        GROUP  BY DATE_TRUNC('day', "createdAt")
      )
    SELECT
      daily.date,
      daily.new_users,
      (SELECT total FROM base)
        + SUM(daily.new_users) OVER (ORDER BY daily.date ROWS UNBOUNDED PRECEDING)
        AS cumulative
    FROM   daily
    ORDER  BY daily.date ASC
  `;

  return rows.map((r) => ({
    date:       r.date.toISOString().slice(0, 10),
    newUsers:   Number(r.new_users),
    cumulative: Number(r.cumulative),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// New user registrations
// ─────────────────────────────────────────────────────────────────────────────

export async function getNewUsersCount(days = 30): Promise<number> {
  return prisma.user.count({
    where: {
      createdAt: { gte: new Date(Date.now() - days * 86_400_000) },
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Revenue by category
// ─────────────────────────────────────────────────────────────────────────────

export type CategoryRevenue = {
  categoryId:   string;
  categoryName: string;
  revenue:      number;
  unitsSold:    number;
};

export async function getSalesByCategory(days = 30): Promise<CategoryRevenue[]> {
  const rows = await prisma.$queryRaw<
    {
      category_id:   string;
      category_name: string;
      revenue:       bigint;
      units_sold:    bigint;
    }[]
  >`
    SELECT
      c."id"                              AS category_id,
      c."name"                            AS category_name,
      SUM(oi."price" * oi."quantity")     AS revenue,
      SUM(oi."quantity")                  AS units_sold
    FROM order_items oi
    JOIN products    p  ON p."id"         = oi."productId"
    JOIN categories  c  ON c."id"         = p."categoryId"
    JOIN orders      o  ON o."id"         = oi."orderId"
    WHERE
      o."createdAt" >= NOW() - INTERVAL '1 day' * ${days}
      AND o.status = 'DELIVERED'::"OrderStatus"
    GROUP BY c."id", c."name"
    ORDER BY revenue DESC
  `;

  return rows.map((r) => ({
    categoryId:   r.category_id,
    categoryName: r.category_name,
    revenue:      Number(r.revenue),
    unitsSold:    Number(r.units_sold),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Composite dashboard summary  (TRUE single round-trip — one CTE query)
// ─────────────────────────────────────────────────────────────────────────────

export type DashboardSummary = {
  totalRevenue30d:    number;
  totalOrders30d:     number;
  averageOrderValue:  number;
  newUsers30d:        number;
  pendingOrders:      number;
  /** Delivered orders in the last 30 days — useful for fill-rate KPI */
  deliveredOrders30d: number;
  /** Cancelled orders in the last 30 days — useful for churn KPI */
  cancelledOrders30d: number;
};

/**
 * Fetches all dashboard KPIs in a SINGLE database round-trip using CTEs.
 *
 * Replaces the previous prisma.$transaction([...5 calls...]) approach which
 * issued 5 separate queries even inside a transaction.
 *
 * Query plan:
 *   - `rev`         → seq scan on orders filtered by createdAt + status (index: status,createdAt)
 *   - `ord`         → same scan reusing FILTER aggregates — no second pass
 *   - `pending_all` → index-only scan on orders(status)
 *   - `usr`         → index scan on users(createdAt)
 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const rows = await prisma.$queryRaw<
    [{
      total_revenue_30d:    string | null; // NUMERIC → string via bigdecimal
      avg_order_value:      string | null;
      total_orders_30d:     bigint;
      delivered_orders_30d: bigint;
      cancelled_orders_30d: bigint;
      pending_orders:       bigint;
      new_users_30d:        bigint;
    }]
  >`
    WITH
      rev AS (
        SELECT
          COALESCE(SUM("totalAmount"), 0)  AS total,
          COALESCE(AVG("totalAmount"), 0)  AS avg
        FROM  orders
        WHERE "createdAt" >= NOW() - INTERVAL '30 days'
          AND status = 'DELIVERED'::"OrderStatus"
      ),
      ord AS (
        SELECT
          COUNT(*)                                                               AS total,
          COUNT(*) FILTER (WHERE status = 'DELIVERED'::"OrderStatus")           AS delivered,
          COUNT(*) FILTER (WHERE status = 'CANCELLED'::"OrderStatus")           AS cancelled
        FROM  orders
        WHERE "createdAt" >= NOW() - INTERVAL '30 days'
      ),
      pending_all AS (
        SELECT COUNT(*) AS total
        FROM   orders
        WHERE  status = 'PENDING'::"OrderStatus"
      ),
      usr AS (
        SELECT COUNT(*) AS new_users
        FROM   users
        WHERE  "createdAt" >= NOW() - INTERVAL '30 days'
          AND  "deletedAt" IS NULL
      )
    SELECT
      rev.total         AS total_revenue_30d,
      rev.avg           AS avg_order_value,
      ord.total         AS total_orders_30d,
      ord.delivered     AS delivered_orders_30d,
      ord.cancelled     AS cancelled_orders_30d,
      pending_all.total AS pending_orders,
      usr.new_users     AS new_users_30d
    FROM rev, ord, pending_all, usr
  `;

  const r = rows[0];
  return {
    totalRevenue30d:    parseFloat(r.total_revenue_30d   ?? "0"),
    averageOrderValue:  parseFloat(r.avg_order_value     ?? "0"),
    totalOrders30d:     Number(r.total_orders_30d),
    deliveredOrders30d: Number(r.delivered_orders_30d),
    cancelledOrders30d: Number(r.cancelled_orders_30d),
    pendingOrders:      Number(r.pending_orders),
    newUsers30d:        Number(r.new_users_30d),
  };
}
