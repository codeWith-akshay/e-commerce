import Link from "next/link";
import { Suspense } from "react";
import {
  Package,
  ShoppingCart,
  Users,
  DollarSign,
  Clock,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  Star,
  CheckCircle2,
  XCircle,
  Loader2,
  Truck,
  Box,
} from "lucide-react";
import prisma from "@/lib/prisma";
import type { RevenueDataPoint } from "@/components/RevenueChart";
import RevenueChartClient from "@/components/RevenueChartClient";
import {
  getDashboardSummary,
  getRevenueByPeriod,
  getUserGrowthByDay,
  type DailyUserGrowth,
} from "@/lib/queries/analytics";

// ── Revalidate every 60 s (ISR) ───────────────────────────────────────────────
export const revalidate = 60;

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<
  string,
  { pill: string; icon: React.ComponentType<{ className?: string }>; bar: string }
> = {
  PENDING:    { pill: "bg-yellow-50 text-yellow-700 ring-yellow-600/20", icon: Clock,        bar: "bg-yellow-400" },
  PROCESSING: { pill: "bg-blue-50   text-blue-700   ring-blue-600/20",   icon: Loader2,      bar: "bg-blue-400"   },
  SHIPPED:    { pill: "bg-indigo-50 text-indigo-700 ring-indigo-600/20", icon: Truck,        bar: "bg-indigo-400" },
  DELIVERED:  { pill: "bg-green-50  text-green-700  ring-green-600/20",  icon: CheckCircle2, bar: "bg-emerald-400"},
  CANCELLED:  { pill: "bg-red-50    text-red-700    ring-red-600/20",    icon: XCircle,      bar: "bg-red-400"    },
};

// ── Data helpers ──────────────────────────────────────────────────────────────
async function getStats() {
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1); // this month start
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const [
    totalProducts,
    totalOrders,
    totalUsers,
    revenueAgg,
    thisMonthOrders,
    lastMonthOrders,
    thisMonthRevenue,
    lastMonthRevenue,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.order.count(),
    prisma.user.count(),
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { status: { notIn: ["CANCELLED", "PENDING"] } },
    }),
    prisma.order.count({ where: { createdAt: { gte: start } } }),
    prisma.order.count({ where: { createdAt: { gte: prevStart, lte: prevEnd } } }),
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { status: { notIn: ["CANCELLED", "PENDING"] }, createdAt: { gte: start } },
    }),
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { status: { notIn: ["CANCELLED", "PENDING"] }, createdAt: { gte: prevStart, lte: prevEnd } },
    }),
  ]);

  const pct = (cur: number, prev: number) =>
    prev === 0 ? null : Math.round(((cur - prev) / prev) * 100);

  return {
    totalProducts,
    totalOrders,
    totalUsers,
    totalRevenue:      revenueAgg._sum.totalAmount ?? 0,
    thisMonthOrders,
    lastMonthOrders,
    thisMonthRevenue:  thisMonthRevenue._sum.totalAmount  ?? 0,
    lastMonthRevenue:  lastMonthRevenue._sum.totalAmount  ?? 0,
    orderTrend:        pct(thisMonthOrders,                             lastMonthOrders),
    revenueTrend:      pct(thisMonthRevenue._sum.totalAmount ?? 0, lastMonthRevenue._sum.totalAmount ?? 0),
  };
}

async function getOrderStatusBreakdown() {
  const rows = await prisma.order.groupBy({
    by:      ["status"],
    _count:  { status: true },
    orderBy: { _count: { status: "desc" } },
  });
  const total = rows.reduce((s, r) => s + r._count.status, 0) || 1;
  return rows.map((r) => ({ status: r.status, count: r._count.status, percentage: Math.round((r._count.status / total) * 100) }));
}

async function getRecentOrders() {
  return prisma.order.findMany({
    take:    8,
    orderBy: { createdAt: "desc" },
    select: {
      id:          true,
      totalAmount: true,
      status:      true,
      createdAt:   true,
      user: { select: { name: true, email: true } },
    },
  });
}

async function getTopProducts() {
  const rows = await prisma.orderItem.groupBy({
    by:      ["productId"],
    _sum:    { price: true, quantity: true },
    orderBy: { _sum: { price: "desc" } },
    take:    5,
  });
  const raw = await prisma.product.findMany({
    where:  { id: { in: rows.map((r) => r.productId) } },
    select: { id: true, title: true, category: { select: { name: true } }, images: true, rating: true },
  });
  const products = raw.map(({ category, ...p }) => ({ ...p, category: category.name }));
  return rows.map((r) => {
    const p = products.find((x) => x.id === r.productId)!;
    return { ...p, revenue: r._sum.price ?? 0, sold: r._sum.quantity ?? 0 };
  });
}

async function getLowStockProducts() {
  // Use each product's own lowStockThreshold instead of a hardcoded number.
  // Prisma doesn't support "WHERE stock < lowStockThreshold" in findMany,
  // so we use a raw query and limit to 5 for the dashboard widget.
  const raw = await prisma.$queryRaw<
    { id: string; title: string; stock: number; lowStockThreshold: number; category: string; images: string[] }[]
  >`
    SELECT p.id, p.title, p.stock, p."lowStockThreshold",
           c.name AS category, p.images
    FROM   products p
    JOIN   categories c ON c.id = p."categoryId"
    WHERE  p.stock < p."lowStockThreshold"
      AND  p."isActive" = true
      AND  p."deletedAt" IS NULL
    ORDER BY p.stock ASC
    LIMIT 5
  `;
  return raw;
}

async function getMonthlyRevenue(): Promise<RevenueDataPoint[]> {
  // Use the centralised analytics query (30-day daily breakdown aggregated by month)
  try {
    const daily = await getRevenueByPeriod(365);
    // Group by "Mon YY" label for the chart
    const map = new Map<string, number>();
    for (const point of daily) {
      const label = new Date(point.date).toLocaleString("en-US", {
        month: "short",
        year:  "2-digit",
      });
      map.set(label, (map.get(label) ?? 0) + point.revenue);
    }
    return Array.from(map.entries()).map(([month, revenue]) => ({ month, revenue }));
  } catch {
    return [];
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function TrendBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${up ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
      <TrendingUp className={`h-3 w-3 ${up ? "" : "rotate-180"}`} />
      {up ? "+" : ""}{pct}%
    </span>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, trend, icon: Icon, from, to,
}: {
  label:  string;
  value:  string;
  sub?:   string;
  trend?: number | null;
  icon:   React.ComponentType<{ className?: string }>;
  from:   string;
  to:     string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60 transition hover:shadow-md">
      {/* BG decoration */}
      <div className={`absolute -right-4 -top-4 h-24 w-24 rounded-full bg-linear-to-br ${from} ${to} opacity-10`} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-1.5 truncate text-2xl font-bold tracking-tight text-slate-800 sm:text-3xl">{value}</p>
          {(sub || trend !== undefined) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {trend !== undefined && <TrendBadge pct={trend ?? null} />}
              {sub && <p className="text-xs text-slate-400">{sub}</p>}
            </div>
          )}
        </div>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br ${from} ${to} shadow-md`}>
          <Icon className="h-5 w-5 text-white" />
        </span>
      </div>
    </div>
  );
}

// ── User Growth Widget (server component — no JS chart needed) ────────────────
function UserGrowthWidget({
  rows,
  total30d,
}: {
  rows:     DailyUserGrowth[];
  total30d: number;
}) {
  // Show last 14 days (or all if fewer)
  const visible  = rows.slice(-14);
  const maxDaily = Math.max(...visible.map((r) => r.newUsers), 1);

  // Today vs yesterday delta
  const today     = visible[visible.length - 1]?.newUsers ?? 0;
  const yesterday = visible[visible.length - 2]?.newUsers ?? 0;
  const dayDelta  = today - yesterday;

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-800">User Growth</h3>
          <p className="text-xs text-slate-400 mt-0.5">New registrations · last 30 days</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-2xl font-bold text-slate-800">{total30d}</p>
            <p className="text-xs text-slate-400">new users</p>
          </div>
          {dayDelta !== 0 && (
            <span
              className={`inline-flex items-center gap-0.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                dayDelta > 0
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-red-100 text-red-600"
              }`}
            >
              {dayDelta > 0 ? "+" : ""}
              {dayDelta} today
            </span>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No registration data yet.</p>
      ) : (
        <>
          {/* Spark bar chart */}
          <div className="mb-5 flex h-20 items-end gap-1">
            {visible.map((row) => {
              const heightPct = Math.max((row.newUsers / maxDaily) * 100, 4);
              return (
                <div
                  key={row.date}
                  className="group relative flex-1"
                  title={`${row.date}: ${row.newUsers} new user${row.newUsers !== 1 ? "s" : ""}`}
                >
                  <div
                    className="w-full rounded-t-sm bg-sky-400 transition-all group-hover:bg-sky-500"
                    style={{ height: `${heightPct}%` }}
                  />
                  {/* inline tooltip on hover */}
                  <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    {row.newUsers}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Last 7 rows table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-400">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 text-right font-medium">New</th>
                  <th className="pb-2 text-right font-medium">Total</th>
                  <th className="w-32 pb-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.slice(-7).reverse().map((row) => {
                  const barPct = Math.round((row.newUsers / maxDaily) * 100);
                  return (
                    <tr key={row.date} className="border-b border-slate-50 last:border-0">
                      <td className="py-1.5 text-slate-500">
                        {new Date(row.date).toLocaleDateString("en-US", {
                          month: "short", day: "numeric",
                        })}
                      </td>
                      <td className="py-1.5 text-right font-semibold text-slate-800">
                        {row.newUsers}
                      </td>
                      <td className="py-1.5 text-right text-slate-400">
                        {row.cumulative.toLocaleString()}
                      </td>
                      <td className="py-1.5 pl-3">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-sky-400"
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function AdminDashboardPage() {
  const [stats, statusBreakdown, recentOrders, topProducts, lowStock, monthlyRevenue, summary, userGrowth] =
    await Promise.all([
      getStats(),
      getOrderStatusBreakdown(),
      getRecentOrders(),
      getTopProducts(),
      getLowStockProducts(),
      getMonthlyRevenue(),
      getDashboardSummary(),
      getUserGrowthByDay(30),
    ]);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <div className="space-y-6">

      {/* ── Welcome banner ── */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-r from-indigo-600 via-violet-600 to-purple-600 p-6 text-white shadow-lg sm:p-8">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23ffffff%22 fill-opacity=%220.05%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-100" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-indigo-200">{today}</p>
            <h2 className="mt-1 text-2xl font-bold sm:text-3xl">Welcome back! 👋</h2>
            <p className="mt-1 text-sm text-indigo-200">
              Heres whats happening with your store today.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/products/create"
              className="inline-flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/30"
            >
              <Package className="h-4 w-4" /> Add Product
            </Link>
            <Link
              href="/admin/orders"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-indigo-600 shadow-sm transition hover:bg-indigo-50"
            >
              <ShoppingCart className="h-4 w-4" /> View Orders
            </Link>
            <Link
              href="/admin/inventory"
              className="inline-flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/30"
            >
              <Box className="h-4 w-4" /> Inventory
            </Link>
            <Link
              href="/admin/audit"
              className="inline-flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/30"
            >
              <AlertTriangle className="h-4 w-4" /> Audit Log
            </Link>
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Revenue"
          value={`$${fmt(stats.totalRevenue)}`}
          sub={`$${fmt(stats.thisMonthRevenue)} this month`}
          trend={stats.revenueTrend}
          icon={DollarSign}
          from="from-emerald-400" to="to-teal-500"
        />
        <StatCard
          label="Total Orders"
          value={stats.totalOrders.toLocaleString()}
          sub={`${stats.thisMonthOrders} this month`}
          trend={stats.orderTrend}
          icon={ShoppingCart}
          from="from-indigo-400" to="to-violet-500"
        />
        <StatCard
          label="Products"
          value={stats.totalProducts.toLocaleString()}
          sub={`${lowStock.length} low stock`}
          icon={Package}
          from="from-violet-400" to="to-purple-500"
        />
        <StatCard
          label="Customers"
          value={stats.totalUsers.toLocaleString()}
          sub="registered accounts"
          icon={Users}
          from="from-sky-400" to="to-blue-500"
        />
      </div>

      {/* ── 30-day analytics summary ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {[
          { label: "Revenue (30d)",    value: `$${fmt(summary.totalRevenue30d)}` },
          { label: "Orders (30d)",     value: summary.totalOrders30d.toLocaleString() },
          { label: "Avg Order Value",  value: `$${fmt(summary.averageOrderValue)}` },
          { label: "New Users (30d)",  value: summary.newUsers30d.toLocaleString() },
          { label: "Pending Orders",   value: summary.pendingOrders.toLocaleString() },
          { label: "Delivered (30d)",  value: summary.deliveredOrders30d.toLocaleString() },
          { label: "Cancelled (30d)",  value: summary.cancelledOrders30d.toLocaleString() },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-xs">
            <p className="text-xs font-medium text-gray-400">{item.label}</p>
            <p className="mt-1 text-lg font-bold text-gray-900">{item.value}</p>
          </div>
        ))}
      </div>

      {/* ── User growth (last 30 days) ── */}
      <UserGrowthWidget rows={userGrowth} total30d={summary.newUsers30d} />

      {/* ── Revenue chart + Order status side by side ── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">

        {/* Revenue chart – takes 2/3 */}
        <div className="xl:col-span-2 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-slate-800">Revenue Overview</h3>
              <p className="text-xs text-slate-400 mt-0.5">Last 12 months · excludes pending &amp; cancelled</p>
            </div>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">
              ${fmt(stats.totalRevenue)} total
            </span>
          </div>
          <Suspense
            fallback={
              <div className="flex h-72 items-center justify-center text-sm text-slate-400">
                Loading chart…
              </div>
            }
          >
            <RevenueChartClient data={monthlyRevenue} />
          </Suspense>
        </div>

        {/* Order status breakdown – takes 1/3 */}
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
          <h3 className="mb-4 text-base font-semibold text-slate-800">Order Status</h3>
          {statusBreakdown.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">No orders yet.</p>
          ) : (
            <ul className="space-y-3">
              {statusBreakdown.map(({ status, count, percentage }) => {
                const cfg = STATUS_CFG[status] ?? STATUS_CFG.PENDING;
                const Icon = cfg.icon;
                return (
                  <li key={status}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 font-medium text-slate-700">
                        <Icon className="h-3.5 w-3.5 text-slate-400" />
                        {status.charAt(0) + status.slice(1).toLowerCase()}
                      </span>
                      <span className="text-xs text-slate-400">{count} ({percentage}%)</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${cfg.bar} transition-all`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ── Top products + Low stock ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Top products */}
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h3 className="text-base font-semibold text-slate-800">Top Products</h3>
            <Link href="/admin/products" className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {topProducts.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">No sales data yet.</p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {topProducts.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50/60">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">
                    {i + 1}
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.images[0] ? (
                    <img src={p.images[0]} alt={p.title} className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-300">
                      <Box className="h-4 w-4" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{p.title}</p>
                    <p className="flex items-center gap-1 text-xs text-slate-400">
                      <Star className="h-3 w-3 text-amber-400" />{p.rating.toFixed(1)}
                      <span className="text-slate-300">·</span>{p.sold} sold
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-slate-700">
                    ${fmt(p.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Low stock alert */}
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h3 className="flex items-center gap-2 text-base font-semibold text-slate-800">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Low Stock Alert
            </h3>
            <Link href="/admin/products" className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">
              Manage <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {lowStock.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              <p className="text-sm font-medium text-slate-600">All products are well stocked!</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {lowStock.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50/60">
                  {p.images[0] ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={p.images[0]} alt={p.title} className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-300">
                      <Box className="h-4 w-4" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{p.title}</p>
                    <p className="text-xs text-slate-400">{p.category}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset ${
                    p.stock === 0
                      ? "bg-red-50 text-red-700 ring-red-600/20"
                      : "bg-amber-50 text-amber-700 ring-amber-600/20"
                  }`}>
                    {p.stock === 0 ? "Out of stock" : `${p.stock} left`}
                  </span>
                  {p.stock > 0 && (
                    <span className="ml-1 shrink-0 text-[10px] text-slate-400">
                      / {p.lowStockThreshold} threshold
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Recent orders ── */}
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Recent Orders</h3>
            <p className="text-xs text-slate-400 mt-0.5">Latest 8 orders across all customers</p>
          </div>
          <Link href="/admin/orders" className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-5 py-3">Order</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                    No orders yet.
                  </td>
                </tr>
              ) : (
                recentOrders.map((order) => {
                  const cfg = STATUS_CFG[order.status] ?? STATUS_CFG.PENDING;
                  const StatusIcon = cfg.icon;
                  const initials = (order.user.name ?? order.user.email ?? "?")
                    .trim().split(/\s+/).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
                  return (
                    <tr key={order.id} className="group transition-colors hover:bg-slate-50/60">
                      <td className="px-5 py-3.5 font-mono text-xs font-semibold text-slate-500">
                        #{order.id.slice(-8).toUpperCase()}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-indigo-400 to-violet-500 text-[10px] font-bold text-white">
                            {initials}
                          </div>
                          <span className="max-w-35 truncate text-slate-700">
                            {order.user.name ?? order.user.email}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-slate-800">
                        ${fmt(order.totalAmount)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cfg.pill}`}>
                          <StatusIcon className="h-3 w-3" />
                          {order.status.charAt(0) + order.status.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">
                        {new Date(order.createdAt).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric",
                        })}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 opacity-0 shadow-xs transition group-hover:opacity-100 hover:border-indigo-300 hover:text-indigo-600"
                        >
                          View <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

