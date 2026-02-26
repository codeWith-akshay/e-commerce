import Link from "next/link";
import { Eye } from "lucide-react";
import { Prisma, OrderStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import Pagination from "@/components/Pagination";
import AdminProductSearch from "@/components/AdminProductSearch";
import AdminOrderStatusFilter from "@/components/AdminOrderStatusFilter";

export const revalidate = 60;

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 15;

// Derived from the Prisma enum — stays in sync if OrderStatus ever changes.
const VALID_STATUSES = new Set<string>(Object.values(OrderStatus));

const STATUS_STYLES: Record<string, string> = {
  PENDING:    "bg-yellow-50 text-yellow-700 ring-yellow-600/20",
  PROCESSING: "bg-blue-50   text-blue-700   ring-blue-600/20",
  SHIPPED:    "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  DELIVERED:  "bg-green-50  text-green-700  ring-green-600/20",
  CANCELLED:  "bg-red-50    text-red-700    ring-red-600/20",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<{
    page?:   string;
    search?: string;
    status?: string;
  }>;
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getOrders(page: number, search: string, status: string) {
  const where: Prisma.OrderWhereInput = {};

  if (status && VALID_STATUSES.has(status)) {
    where.status = status as OrderStatus;
  }
  if (search) {
    where.user = {
      email: { contains: search, mode: "insensitive" },
    };
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip:    (page - 1) * PAGE_SIZE,
      take:    PAGE_SIZE,
      orderBy: { createdAt: "desc" },
      select: {
        id:          true,
        totalAmount: true,
        status:      true,
        createdAt:   true,
        user: {
          select: { email: true, name: true },
        },
        // Only quantity is used — summed for the item-count badge.
      orderItems: {
        select: { quantity: true },
      },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  const { page: pageParam, search = "", status = "" } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  // Narrow to a valid enum value so the typed filter component is satisfied.
  const safeStatus: OrderStatus | "" = VALID_STATUSES.has(status)
    ? (status as OrderStatus)
    : "";

  const { orders, total, totalPages } = await getOrders(page, search, safeStatus);

  const hasFilters = !!(search || safeStatus);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Orders</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          {total.toLocaleString()} order{total !== 1 ? "s" : ""}
          {hasFilters ? " matching filters" : " total"}
        </p>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <AdminProductSearch
          defaultValue={search}
          placeholder="Search by email…"
          paramName="search"
          basePath="/admin/orders"
          currentParams={{ search: search || undefined, status: safeStatus || undefined }}
        />
        <AdminOrderStatusFilter
          current={safeStatus}
          basePath="/admin/orders"
          currentParams={{ search: search || undefined, status: safeStatus || undefined }}
        />
        {hasFilters && (
          <Link
            href="/admin/orders"
            className="text-sm text-slate-500 transition hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded"
          >
            Clear filters
          </Link>
        )}
      </div>

      {/* Table card */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3">Order ID</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    {hasFilters
                      ? "No orders match the current filters."
                      : "No orders yet."}
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const itemCount = order.orderItems.reduce<number>(
                    (sum, item) => sum + item.quantity,
                    0,
                  );
                  const statusStyle =
                    STATUS_STYLES[order.status] ?? STATUS_STYLES.PENDING;

                  return (
                    <tr
                      key={order.id}
                      className="transition-colors hover:bg-slate-50/60"
                    >
                      {/* Order ID */}
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-500">
                        #{order.id.slice(-8).toUpperCase()}
                      </td>

                      {/* Customer */}
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-slate-800">
                          {order.user.name ?? "—"}
                        </p>
                        <p className="text-xs text-slate-400">
                          {order.user.email}
                        </p>
                      </td>

                      {/* Items */}
                      <td className="px-4 py-3.5 text-slate-500">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium">
                          {itemCount} item{itemCount !== 1 ? "s" : ""}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3.5 text-right font-semibold text-slate-800">
                        ${order.totalAmount.toFixed(2)}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${statusStyle}`}
                        >
                          {order.status.charAt(0) +
                            order.status.slice(1).toLowerCase()}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3.5 text-slate-500">
                        {new Date(order.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day:   "numeric",
                          year:  "numeric",
                        })}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-indigo-600 ring-1 ring-inset ring-indigo-200 transition hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-slate-100 px-4 py-3">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              basePath="/admin/orders"
              searchParams={{
                search: search  || undefined,
                status: safeStatus  || undefined,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
