import Link from "next/link";
import { Eye } from "lucide-react";
import { Prisma, OrderStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import Pagination from "@/components/Pagination";
import AdminProductSearch from "@/components/AdminProductSearch";
import AdminOrderStatusFilter from "@/components/AdminOrderStatusFilter";

export const revalidate = 60;

const PAGE_SIZE = 15;

const VALID_STATUSES = new Set<string>(Object.values(OrderStatus));

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-yellow-50 text-yellow-700 ring-yellow-600/20",
  PROCESSING: "bg-blue-50 text-blue-700 ring-blue-600/20",
  SHIPPED: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  DELIVERED: "bg-green-50 text-green-700 ring-green-600/20",
  CANCELLED: "bg-red-50 text-red-700 ring-red-600/20",
};

// ✅ Strong Prisma Type
type OrderWithRelations = Prisma.OrderGetPayload<{
  select: {
    id: true;
    totalAmount: true;
    status: true;
    createdAt: true;
    user: {
      select: {
        email: true;
        name: true;
      };
    };
    orderItems: {
      select: {
        quantity: true;
      };
    };
  };
}>;

interface PageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: string;
  }>;
}

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
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        totalAmount: true,
        status: true,
        createdAt: true,
        user: {
          select: { email: true, name: true },
        },
        orderItems: {
          select: { quantity: true },
        },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders: orders as OrderWithRelations[],
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  const { page: pageParam, search = "", status = "" } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const safeStatus: OrderStatus | "" = VALID_STATUSES.has(status)
    ? (status as OrderStatus)
    : "";

  const { orders, total, totalPages } = await getOrders(
    page,
    search,
    safeStatus
  );

  const hasFilters = !!(search || safeStatus);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Orders</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          {total.toLocaleString()} order{total !== 1 ? "s" : ""}
          {hasFilters ? " matching filters" : " total"}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <AdminProductSearch
          defaultValue={search}
          placeholder="Search by email…"
          paramName="search"
          basePath="/admin/orders"
          currentParams={{
            search: search || undefined,
            status: safeStatus || undefined,
          }}
        />
        <AdminOrderStatusFilter
          current={safeStatus}
          basePath="/admin/orders"
          currentParams={{
            search: search || undefined,
            status: safeStatus || undefined,
          }}
        />
        {hasFilters && (
          <Link
            href="/admin/orders"
            className="text-sm text-slate-500 transition hover:text-indigo-600"
          >
            Clear filters
          </Link>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {orders.map((order) => {
                // ✅ Fully Typed – No implicit any
                const itemCount: number = order.orderItems.reduce(
                  (sum: number, item: { quantity: number }) =>
                    sum + item.quantity,
                  0
                );

                return (
                  <tr key={order.id}>
                    <td className="px-4 py-3.5">
                      #{order.id.slice(-8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3.5">
                      {order.user.name ?? "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      {itemCount} item{itemCount !== 1 ? "s" : ""}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      ${order.totalAmount.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="border-t border-slate-100 px-4 py-3">
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
    </div>
  );
}