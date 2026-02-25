import Link from "next/link";
import {
  CheckCircle2,
  Package,
  Truck,
  MapPin,
  Home,
  ShoppingBag,
} from "lucide-react";
import type { Metadata } from "next";
import { getOrderById } from "@/lib/actions/order";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Order Confirmed | ShopNest",
};

interface Props {
  searchParams: Promise<{ orderId?: string }>;
}

const STEPS = [
  {
    Icon: Package,
    label: "Order Confirmed",
    desc: "We've received your order and it's being prepared.",
    active: true,
  },
  {
    Icon: Truck,
    label: "Shipped",
    desc: "You'll receive a tracking number once dispatched.",
    active: false,
  },
  {
    Icon: MapPin,
    label: "Delivered",
    desc: "Your order arrives at your doorstep.",
    active: false,
  },
];

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const { orderId } = await searchParams;
  const orderResult = orderId ? await getOrderById(orderId) : null;
  const order = orderResult?.success ? orderResult.data : null;

  return (
    <main className="min-h-[calc(100vh-5rem)] bg-gradient-to-b from-indigo-50/70 via-white to-white px-4 py-16">
      <div className="mx-auto w-full max-w-lg">

        {/* ── Hero: icon + heading ────────────────────────────────── */}
        <div className="flex flex-col items-center text-center">
          {/* Layered decorative rings */}
          <div className="relative mb-8">
            <span className="absolute inset-0 -m-4 rounded-full bg-emerald-100/60" />
            <span className="absolute inset-0 -m-2 rounded-full bg-emerald-100" />
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500 shadow-xl shadow-emerald-200">
              <CheckCircle2 className="h-12 w-12 text-white" strokeWidth={1.5} />
            </div>
          </div>

          <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">
            Payment Successful
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
            Thank you for your order!
          </h1>
          <p className="mt-3 max-w-sm text-base leading-relaxed text-gray-500">
            Your order has been confirmed and is now being prepared.
            A confirmation email will be on its way shortly.
          </p>
        </div>

        {/* ── Order summary card ──────────────────────────────────── */}
        {order && (
          <div className="mt-10 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            {/* Card header */}
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/60 px-6 py-4">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-indigo-500" />
                <span className="text-sm font-semibold text-gray-900">Order Summary</span>
              </div>
              <span className="rounded-full bg-amber-50 px-3 py-0.5 text-xs font-semibold capitalize text-amber-700 ring-1 ring-amber-100">
                {order.status}
              </span>
            </div>

            {/* Card body */}
            <dl className="divide-y divide-dashed divide-gray-100 px-6 py-1 text-sm">
              <div className="flex justify-between py-3 text-gray-600">
                <dt>Order ID</dt>
                <dd className="font-mono text-xs font-medium text-gray-800">
                  {order.id.slice(0, 16)}&hellip;
                </dd>
              </div>
              <div className="flex justify-between py-3 text-gray-600">
                <dt>Items ordered</dt>
                <dd className="font-semibold text-gray-900">{order.orderItems.length}</dd>
              </div>
              <div className="flex justify-between py-3">
                <dt className="font-semibold text-gray-900">Total paid</dt>
                <dd className="text-lg font-bold text-indigo-600">
                  ${order.totalAmount.toFixed(2)}
                </dd>
              </div>
            </dl>
          </div>
        )}

        {/* ── What happens next ───────────────────────────────────── */}
        <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-sm font-semibold text-gray-900">
            What happens next?
          </h2>
          <ol className="space-y-5">
            {STEPS.map(({ Icon, label, desc, active }, i) => (
              <li key={i} className="flex items-start gap-4">
                {/* Step number bubble */}
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                    active
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {i + 1}
                </div>
                {/* Step info */}
                <div className="pt-0.5">
                  <div className="flex items-center gap-2">
                    <Icon
                      className={`h-4 w-4 ${active ? "text-indigo-500" : "text-gray-300"}`}
                    />
                    <p
                      className={`text-sm font-semibold ${
                        active ? "text-gray-900" : "text-gray-400"
                      }`}
                    >
                      {label}
                    </p>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400">{desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* ── CTA buttons ─────────────────────────────────────────── */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 active:scale-95"
          >
            <Home className="h-4 w-4" />
            Go to Home
          </Link>
          <Link
            href="/products"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-6 py-3.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 active:scale-95"
          >
            <ShoppingBag className="h-4 w-4" />
            Continue Shopping
          </Link>
        </div>

        {/* ── Footer note ─────────────────────────────────────────── */}
        <p className="mt-8 text-center text-xs text-gray-400">
          Need help?{" "}
          <a
            href="mailto:support@shopnest.com"
            className="font-medium text-indigo-500 underline-offset-2 hover:underline"
          >
            Contact support
          </a>
          . We&apos;re happy to assist.
        </p>
      </div>
    </main>
  );
}
