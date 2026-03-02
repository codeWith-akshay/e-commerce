import Link from "next/link";
import type { Metadata } from "next";
import {
  ShoppingCart,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  Package,
  ChevronRight,
  Search,
  RotateCcw,
  DollarSign,
  Layers,
} from "lucide-react";
import { OrderStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import Pagination from "@/components/Pagination";
import OrderStatusFilterPills from "@/components/OrderStatusFilterPills";
import OrderSearchInput from "@/components/OrderSearchInput";

export const metadata: Metadata = { title: "Orders | Admin" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;
const VALID_STATUSES = new Set<string>(Object.values(OrderStatus));

interface PageProps {
  searchParams: Promise<{ page?: string; search?: string; status?: string }>;
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; dot: string; badge: string; icon: React.ReactNode }
> = {
  PENDING: {
    label: "Pending",
    dot:   "bg-amber-400",
    badge: "bg-amber-50 text-amber-700 ring-amber-200",
    icon:  <Clock className="h-3 w-3" />,
  },
  PROCESSING: {
    label: "Processing",
    dot:   "bg-blue-400",
    badge: "bg-blue-50 text-blue-700 ring-blue-200",
    icon:  <Layers className="h-3 w-3" />,
  },
  SHIPPED: {
    label: "Shipped",
    dot:   "bg-indigo-400",
    badge: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    icon:  <Truck className="h-3 w-3" />,
  },
  DELIVERED: {
    label: "Delivered",
    dot:   "bg-emerald-400",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    icon:  <CheckCircle2 className="h-3 w-3" />,
  },
  CANCELLED: {
    label: "Cancelled",
    dot:   "bg-red-400",
    badge: "bg-red-50 text-red-700 ring-red-200",
    icon:  <XCircle className="h-3 w-3" />,
  },
};

// ── Data ──────────────────────────────────────────────────────────────────────

async function getOrdersData(page: number, search: string, status: string) {
  type Where = NonNullable<NonNullable<Parameters<typeof prisma.order.findMany>[0]>["where"]>;
  const where: Where = {};
  if (status && VALID_STATUSES.has(status)) where.status = status as OrderStatus;
  if (search) where.user = { OR: [
    { email: { contains: search, mode: "insensitive" } },
    { name:  { contains: search, mode: "insensitive" } },
  ]};

  const [orders, total, statusCounts, revenueAgg] = await Promise.all([
    prisma.order.findMany({
      where,
      skip:    (page - 1) * PAGE_SIZE,
      take:    PAGE_SIZE,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, totalAmount: true, status: true,
        subtotal: true, discountAmount: true,
        createdAt: true, updatedAt: true,
        user:       { select: { email: true, name: true } },
        orderItems: { select: { quantity: true } },
        payment:    { select: { status: true } },
      },
    }),
    prisma.order.count({ where }),
    // Per-status counts for KPI cards (no filter — always global)
    prisma.order.groupBy({ by: ["status"], _count: { id: true } }),
    // Total revenue of non-cancelled orders
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { status: { not: "CANCELLED" } },
    }),
  ]);

  const counts: Partial<Record<OrderStatus, number>> = {};
  for (const r of statusCounts) counts[r.status] = r._count.id;

  return {
    orders,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    counts,
    totalRevenue: revenueAgg._sum.totalAmount ?? 0,
  };
}

type OrderRow = Awaited<ReturnType<typeof getOrdersData>>["orders"][number];

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  const { page: pageParam, search = "", status = "" } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const safeStatus: OrderStatus | "" = VALID_STATUSES.has(status) ? (status as OrderStatus) : "";

  const { orders, total, totalPages, counts, totalRevenue } =
    await getOrdersData(page, search, safeStatus);

  const hasFilters = !!(search || safeStatus);
  const totalOrders = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);

  const kpis = [
    {
      label:   "Total Orders",
      value:   totalOrders.toLocaleString(),
      sub:     "all time",
      icon:    <ShoppingCart className="h-5 w-5" />,
      color:   "bg-indigo-50 text-indigo-600",
      ring:    "ring-indigo-100",
    },
    {
      label:   "Revenue",
      value:   `₹${(totalRevenue / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
      sub:     "non-cancelled",
      icon:    <DollarSign className="h-5 w-5" />,
      color:   "bg-emerald-50 text-emerald-600",
      ring:    "ring-emerald-100",
    },
    {
      label:   "Pending",
      value:   (counts.PENDING ?? 0).toLocaleString(),
      sub:     "awaiting action",
      icon:    <Clock className="h-5 w-5" />,
      color:   "bg-amber-50 text-amber-600",
      ring:    "ring-amber-100",
    },
    {
      label:   "Processing",
      value:   (counts.PROCESSING ?? 0).toLocaleString(),
      sub:     "being packed",
      icon:    <Layers className="h-5 w-5" />,
      color:   "bg-blue-50 text-blue-600",
      ring:    "ring-blue-100",
    },
    {
      label:   "Shipped",
      value:   (counts.SHIPPED ?? 0).toLocaleString(),
      sub:     "in transit",
      icon:    <Truck className="h-5 w-5" />,
      color:   "bg-violet-50 text-violet-600",
      ring:    "ring-violet-100",
    },
    {
      label:   "Delivered",
      value:   (counts.DELIVERED ?? 0).toLocaleString(),
      sub:     "completed",
      icon:    <CheckCircle2 className="h-5 w-5" />,
      color:   "bg-teal-50 text-teal-600",
      ring:    "ring-teal-100",
    },
  ];

  return (
    <div className="space-y-7">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
              <ShoppingCart className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Orders</h1>
          </div>
          <p className="ml-10 text-sm text-gray-500">
            Manage, track, and fulfil every customer order.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 shadow-sm">
            <TrendingUp className="h-3.5 w-3.5 text-indigo-500" />
            {total.toLocaleString()} {hasFilters ? "matching" : "total"}
          </span>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <div
            key={k.label}
            className={`flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm ring-1 ${k.ring}`}
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${k.color}`}>
              {k.icon}
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums tracking-tight text-gray-900">{k.value}</p>
              <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-gray-500">{k.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{k.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3">
        <OrderSearchInput
          defaultValue={search}
          basePath="/admin/orders"
          currentStatus={safeStatus || undefined}
        />
        <OrderStatusFilterPills
          current={safeStatus}
          basePath="/admin/orders"
          currentSearch={search || undefined}
        />
        {hasFilters && (
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-500 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <RotateCcw className="h-3 w-3" />
            Clear filters
          </Link>
        )}
      </div>

      {/* ── Table ── */}
      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-20 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100">
            <Package className="h-7 w-7 text-indigo-400" />
          </div>
          <p className="text-base font-semibold text-gray-700">No orders found</p>
          <p className="mt-1 text-sm text-gray-400">
            {hasFilters ? "Try adjusting your search or filters." : "Orders will appear here once placed."}
          </p>
          {hasFilters && (
            <Link
              href="/admin/orders"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Clear filters
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <th className="px-5 py-3.5">Order</th>
                    <th className="px-4 py-3.5">Customer</th>
                    <th className="px-4 py-3.5 text-center">Items</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Payment</th>
                    <th className="px-4 py-3.5 text-right">Amount</th>
                    <th className="px-4 py-3.5 text-right">Date</th>
                    <th className="px-4 py-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {orders.map((order) => (
                    <OrderRow key={order.id} order={order} />
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="border-t border-gray-100 px-5 py-3">
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  basePath="/admin/orders"
                  searchParams={{
                    search: search || undefined,
                    status: safeStatus || undefined,
                  }}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Table row (sync, no client state needed) ───────────────────────────────

function OrderRow({ order }: { order: OrderRow }) {
  const cfg = STATUS_CONFIG[order.status];
  const itemCount = order.orderItems.reduce((s, i) => s + i.quantity, 0);
  const shortId   = order.id.slice(-8).toUpperCase();

  // Customer avatar initials
  const name  = order.user.name ?? order.user.email;
  const parts = name.trim().split(/\s+/);
  const av    = parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();

  const payStatus = order.payment?.status;
  const payBadge  =
    payStatus === "COMPLETED"
      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
      : payStatus === "FAILED"
      ? "bg-red-50 text-red-600 ring-1 ring-red-200"
      : payStatus === "PENDING"
      ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
      : "bg-gray-100 text-gray-500 ring-1 ring-gray-200";
  const payLabel = payStatus
    ? payStatus.charAt(0) + payStatus.slice(1).toLowerCase()
    : "—";

  const date = new Date(order.createdAt);
  const dateStr = date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const timeStr = date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

  return (
    <tr className="group transition-colors hover:bg-indigo-50/20">
      {/* Order ID */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full shrink-0 ${cfg.dot}`} />
          <div>
            <p className="font-mono text-xs font-bold text-gray-700">#{shortId}</p>
          </div>
        </div>
      </td>

      {/* Customer */}
      <td className="px-4 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-indigo-400 to-violet-500 text-xs font-bold text-white">
            {av}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-800 max-w-32">
              {order.user.name ?? "—"}
            </p>
            <p className="truncate text-xs text-gray-400 max-w-32">{order.user.email}</p>
          </div>
        </div>
      </td>

      {/* Items */}
      <td className="px-4 py-4 text-center">
        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-gray-100 px-2 text-xs font-semibold text-gray-600">
          {itemCount}
        </span>
      </td>

      {/* Status */}
      <td className="px-4 py-4">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${cfg.badge}`}>
          {cfg.icon}
          {cfg.label}
        </span>
      </td>

      {/* Payment */}
      <td className="px-4 py-4">
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${payBadge}`}>
          {payLabel}
        </span>
      </td>

      {/* Amount */}
      <td className="px-4 py-4 text-right">
        <p className="text-sm font-bold text-gray-900">
          ₹{(order.totalAmount / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
        </p>
        {order.discountAmount > 0 && (
          <p className="text-xs text-emerald-600">
            −₹{(order.discountAmount / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })} off
          </p>
        )}
      </td>

      {/* Date */}
      <td className="px-4 py-4 text-right">
        <p className="text-xs font-medium text-gray-700">{dateStr}</p>
        <p className="text-xs text-gray-400">{timeStr}</p>
      </td>

      {/* Action */}
      <td className="px-4 py-4 text-center">
        <Link
          href={`/admin/orders/${order.id}`}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 group-hover:border-indigo-300"
        >
          View <ChevronRight className="h-3 w-3" />
        </Link>
      </td>
    </tr>
  );
}