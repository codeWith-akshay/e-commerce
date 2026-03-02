import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ChevronLeft,
  User,
  Calendar,
  Hash,
  MapPin,
  CreditCard,
  StickyNote,
  Clock,
  Layers,
  Truck,
  CheckCircle2,
  XCircle,
  Package,
  ExternalLink,
} from "lucide-react";
import prisma from "@/lib/prisma";
import AdminOrderStatusUpdate from "@/components/AdminOrderStatusUpdate";

export const revalidate = 0;

// ── Types ─────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ id: string }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const fmtDateTime = (d: Date | string) =>
  new Date(d).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: React.ReactNode }> = {
  PENDING:    { label: "Pending",    badge: "bg-amber-50  text-amber-700  ring-amber-600/20",   icon: <Clock       className="h-3.5 w-3.5" /> },
  PROCESSING: { label: "Processing", badge: "bg-blue-50   text-blue-700   ring-blue-600/20",    icon: <Layers      className="h-3.5 w-3.5" /> },
  SHIPPED:    { label: "Shipped",    badge: "bg-violet-50 text-violet-700 ring-violet-600/20",  icon: <Truck       className="h-3.5 w-3.5" /> },
  DELIVERED:  { label: "Delivered",  badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  CANCELLED:  { label: "Cancelled",  badge: "bg-red-50    text-red-700    ring-red-600/20",     icon: <XCircle     className="h-3.5 w-3.5" /> },
};

const PAYMENT_BADGE: Record<string, string> = {
  PAID:    "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  PENDING: "bg-amber-50  text-amber-700  ring-amber-600/20",
  FAILED:  "bg-red-50    text-red-700    ring-red-600/20",
  REFUNDED:"bg-purple-50 text-purple-700 ring-purple-600/20",
};

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getOrder(id: string) {
  return prisma.order.findUnique({
    where: { id },
    select: {
      id:             true,
      subtotal:       true,
      discountAmount: true,
      taxAmount:      true,
      shippingAmount: true,
      totalAmount:    true,
      status:         true,
      notes:          true,
      createdAt:      true,
      updatedAt:      true,
      user: {
        select: { id: true, name: true, email: true, createdAt: true },
      },
      shippingAddress: {
        select: { fullName: true, addressLine1: true, addressLine2: true, city: true, state: true, postalCode: true, country: true },
      },
      payment: {
        select: { status: true, createdAt: true },
      },
      statusHistory: {
        select: { status: true, note: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
      orderItems: {
        select: {
          id:       true,
          quantity: true,
          price:    true,
          product: {
            select: {
              id:       true,
              title:    true,
              images:   true,
              category: { select: { name: true } },
            },
          },
        },
        orderBy: { product: { title: "asc" } },
      },
    },
  });
}

type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrder>>>;

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return { title: `Order #${id.slice(-8).toUpperCase()} — Admin` };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminOrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();

  const cfg       = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.PENDING;
  const itemCount = order.orderItems.reduce(
    (s: number, i: OrderDetail["orderItems"][number]) => s + i.quantity, 0,
  );
  const hasDiscount = order.discountAmount > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">

      {/* ── Top bar ── */}
      <div>
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Orders
        </Link>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-800">
              Order{" "}
              <span className="font-mono text-xl text-slate-500">
                #{order.id.slice(-8).toUpperCase()}
              </span>
            </h2>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${cfg.badge}`}>
              {cfg.icon}
              {cfg.label}
            </span>
            {order.payment && (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${PAYMENT_BADGE[order.payment.status] ?? PAYMENT_BADGE.PENDING}`}>
                <CreditCard className="h-3 w-3" />
                {order.payment.status.charAt(0) + order.payment.status.slice(1).toLowerCase()}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Placed {fmtDateTime(order.createdAt)}
          </p>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* ══ LEFT (2 cols): items + financials + history ══ */}
        <div className="space-y-6 lg:col-span-2">

          {/* Order items */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Package className="h-4 w-4 text-indigo-500" />
                Order Items
              </h3>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                {itemCount} item{itemCount !== 1 ? "s" : ""}
              </span>
            </div>

            <ul className="divide-y divide-slate-100">
              {order.orderItems.map((item: OrderDetail["orderItems"][number]) => (
                <li key={item.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                    {item.product.images[0] ? (
                      <Image
                        src={item.product.images[0]}
                        alt={item.product.title}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-300">
                        <Package className="h-5 w-5" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{item.product.title}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 font-medium">
                        {item.product.category.name}
                      </span>
                      <span>Qty: {item.quantity}</span>
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-slate-800">
                      {fmt(item.price * item.quantity)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {item.quantity} × {fmt(item.price)}
                    </p>
                  </div>

                  <Link
                    href={`/products/${item.product.id}`}
                    target="_blank"
                    className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition"
                    title="View product"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </li>
              ))}
            </ul>

            {/* Financial breakdown */}
            <div className="rounded-b-2xl border-t border-slate-100 bg-slate-50/60 px-5 py-4 space-y-2">
              <div className="flex justify-between text-sm text-slate-500">
                <span>Subtotal</span>
                <span>{fmt(order.subtotal)}</span>
              </div>
              {hasDiscount && (
                <div className="flex justify-between text-sm text-emerald-600">
                  <span>Discount</span>
                  <span>− {fmt(order.discountAmount)}</span>
                </div>
              )}
              {order.taxAmount > 0 && (
                <div className="flex justify-between text-sm text-slate-500">
                  <span>Tax</span>
                  <span>{fmt(order.taxAmount)}</span>
                </div>
              )}
              {order.shippingAmount > 0 && (
                <div className="flex justify-between text-sm text-slate-500">
                  <span>Shipping</span>
                  <span>{fmt(order.shippingAmount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-800">
                <span>Total</span>
                <span>{fmt(order.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Status history timeline */}
          {order.statusHistory.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Clock className="h-4 w-4 text-indigo-500" />
                  Status History
                </h3>
              </div>
              <ul className="px-5 py-4 space-y-0">
                {order.statusHistory.map((h, idx) => {
                  const hcfg = STATUS_CONFIG[h.status] ?? STATUS_CONFIG.PENDING;
                  const isLast = idx === order.statusHistory.length - 1;
                  return (
                    <li key={idx} className="relative flex gap-4">
                      {/* timeline connector */}
                      {!isLast && (
                        <div className="absolute left-3.5 top-8 bottom-0 w-px bg-slate-100" />
                      )}
                      <div className={`relative z-10 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-2 ring-white ${
                        isLast ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-400"
                      }`}>
                        {hcfg.icon}
                      </div>
                      <div className={`pb-5 ${isLast ? "" : ""}`}>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${hcfg.badge}`}>
                          {hcfg.label}
                        </span>
                        {h.note && (
                          <p className="mt-1 text-xs text-slate-500">{h.note}</p>
                        )}
                        <p className="mt-1 text-[10px] text-slate-400">{fmtDateTime(h.createdAt)}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Notes */}
          {order.notes && (
            <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-5 shadow-sm">
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-700">
                <StickyNote className="h-3.5 w-3.5" />
                Order Notes
              </h3>
              <p className="text-sm text-amber-800 leading-relaxed">{order.notes}</p>
            </div>
          )}
        </div>

        {/* ══ RIGHT (1 col): meta + customer + address + status update ══ */}
        <div className="space-y-4">

          {/* Customer */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <User className="h-3.5 w-3.5" />
              Customer
            </h3>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-indigo-400 to-violet-500 text-sm font-bold text-white">
                {(order.user.name ?? order.user.email).charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {order.user.name ?? "—"}
                </p>
                <p className="truncate text-xs text-slate-500">{order.user.email}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Member since {fmtDate(order.user.createdAt)}
            </p>
            <Link
              href={`/admin/orders?search=${encodeURIComponent(order.user.email)}`}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
            >
              All orders by user <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          {/* Shipping address */}
          {order.shippingAddress && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <MapPin className="h-3.5 w-3.5" />
                Shipping Address
              </h3>
              <address className="not-italic text-sm text-slate-700 leading-relaxed">
                {order.shippingAddress.fullName}<br />
                {order.shippingAddress.addressLine1}<br />
                {order.shippingAddress.addressLine2 && <>{order.shippingAddress.addressLine2}<br /></>}
                {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}<br />
                {order.shippingAddress.country}
              </address>
            </div>
          )}

          {/* Payment */}
          {order.payment && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <CreditCard className="h-3.5 w-3.5" />
                Payment
              </h3>
              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Status</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${PAYMENT_BADGE[order.payment.status] ?? PAYMENT_BADGE.PENDING}`}>
                    {order.payment.status.charAt(0) + order.payment.status.slice(1).toLowerCase()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Amount</span>
                  <span className="font-semibold text-slate-700">{fmt(order.totalAmount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Date</span>
                  <span>{fmtDate(order.payment.createdAt)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Order meta */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <Hash className="h-3.5 w-3.5" />
              Order Info
            </h3>
            <div className="space-y-2 text-xs text-slate-500">
              <div>
                <span className="block text-slate-400">Order ID</span>
                <span className="break-all font-mono text-slate-700">{order.id}</span>
              </div>
              <div className="flex gap-4">
                <div>
                  <span className="block text-slate-400">Placed</span>
                  <span className="flex items-center gap-1 text-slate-700">
                    <Calendar className="h-3 w-3" />
                    {fmtDate(order.createdAt)}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-400">Updated</span>
                  <span className="flex items-center gap-1 text-slate-700">
                    <Calendar className="h-3 w-3" />
                    {fmtDate(order.updatedAt)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Status update */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
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
