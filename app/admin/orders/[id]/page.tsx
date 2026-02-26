import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, User, Calendar, Hash } from "lucide-react";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import AdminOrderStatusUpdate from "@/components/AdminOrderStatusUpdate";

export const revalidate = 0; // always fresh for a detail page

// ── Types ─────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ id: string }>;
}

// ── Status styling ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  PENDING:    "bg-yellow-50 text-yellow-700 ring-yellow-600/20",
  PROCESSING: "bg-blue-50   text-blue-700   ring-blue-600/20",
  SHIPPED:    "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  DELIVERED:  "bg-green-50  text-green-700  ring-green-600/20",
  CANCELLED:  "bg-red-50    text-red-700    ring-red-600/20",
};

// ── Types ───────────────────────────────────────────────────────────────────

type OrderDetail = Prisma.OrderGetPayload<{
  select: {
    id:          true;
    totalAmount: true;
    status:      true;
    createdAt:   true;
    updatedAt:   true;
    user: {
      select: { id: true; name: true; email: true; createdAt: true };
    };
    orderItems: {
      select: {
        id:       true;
        quantity: true;
        price:    true;
        product: {
          select: {
            id:       true;
            title:    true;
            category: { select: { name: true } };
            images:   true;
          };
        };
      };
    };
  };
}>;

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getOrder(id: string): Promise<OrderDetail | null> {
  return prisma.order.findUnique({
    where: { id },
    select: {
      id:          true,
      totalAmount: true,
      status:      true,
      createdAt:   true,
      updatedAt:   true,
      user: {
        select: { id: true, name: true, email: true, createdAt: true },
      },
      orderItems: {
        select: {
          id:       true,
          quantity: true,
          price:    true,
          product: {
            select: { id: true, title: true, category: { select: { name: true } }, images: true },
          },
        },
        orderBy: { product: { title: "asc" } },
      },
    },
  });
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return { title: `Order #${id.slice(-8).toUpperCase()} — Admin` };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminOrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const order = await getOrder(id);

  if (!order) notFound();

  const statusStyle = STATUS_STYLES[order.status] ?? STATUS_STYLES.PENDING;
  const statusLabel =
    order.status.charAt(0) + order.status.slice(1).toLowerCase();

  const itemCount = order.orderItems.reduce(
    (sum: number, item: OrderDetail["orderItems"][number]) => sum + item.quantity,
    0,
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Breadcrumb + heading */}
      <div>
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Orders
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-bold text-slate-800">
            Order{" "}
            <span className="font-mono text-xl text-slate-500">
              #{order.id.slice(-8).toUpperCase()}
            </span>
          </h2>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${statusStyle}`}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Left column (2/3): items + totals ── */}
        <div className="space-y-6 lg:col-span-2">
          {/* Order items */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-800">
                Order Items{" "}
                <span className="font-normal text-slate-400">
                  ({itemCount} item{itemCount !== 1 ? "s" : ""})
                </span>
              </h3>
            </div>
            <ul className="divide-y divide-slate-100">
              {order.orderItems.map((item) => (
                <li key={item.id} className="flex items-center gap-4 px-5 py-4">
                  {/* Product image */}
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
                    {item.product.images[0] ? (
                      <Image
                        src={item.product.images[0]}
                        alt={item.product.title}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-slate-300">
                        N/A
                      </div>
                    )}
                  </div>

                  {/* Title + category */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {item.product.title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {item.product.category.name}
                    </p>
                  </div>

                  {/* Qty × price */}
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-slate-800">
                      ${(item.price * item.quantity).toFixed(2)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {item.quantity} × ${item.price.toFixed(2)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            {/* Totals footer */}
            <div className="rounded-b-xl border-t border-slate-100 bg-slate-50/60 px-5 py-4">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Subtotal</span>
                <span>${order.totalAmount.toFixed(2)}</span>
              </div>
              <div className="mt-2 flex justify-between text-base font-bold text-slate-800">
                <span>Total</span>
                <span>${order.totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right column (1/3): meta + status update ── */}
        <div className="space-y-4">
          {/* Customer info */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Customer
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-slate-700">
                <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="font-medium">{order.user.name ?? "—"}</span>
              </div>
              <p className="truncate text-xs text-slate-500">{order.user.email}</p>
              <p className="text-xs text-slate-400">
                Member since{" "}
                {new Date(order.user.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  year:  "numeric",
                })}
              </p>
            </div>
          </div>

          {/* Order meta */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Order Info
            </h3>
            <div className="space-y-2.5 text-xs text-slate-500">
              <div className="flex items-start gap-2">
                <Hash className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                <div>
                  <span className="block text-slate-400">Order ID</span>
                  <span className="break-all font-mono text-slate-700">{order.id}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <div>
                  <span className="block text-slate-400">Placed</span>
                  <span className="text-slate-700">
                    {new Date(order.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day:   "numeric",
                      year:  "numeric",
                    })}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <div>
                  <span className="block text-slate-400">Last updated</span>
                  <span className="text-slate-700">
                    {new Date(order.updatedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day:   "numeric",
                      year:  "numeric",
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Status update */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Manage Status
            </h3>
            <AdminOrderStatusUpdate
              orderId={order.id}
              currentStatus={order.status}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
