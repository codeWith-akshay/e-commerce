import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ShoppingBag, ChevronLeft, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { getCart } from "@/lib/actions/cart";
import { getShippingCalc } from "@/lib/actions/order";
import { getSessionUserId } from "@/lib/session";

// CheckoutFormDynamic is a Client Component that wraps the lazy-loaded form
// with ssr:false (ssr:false is only valid inside Client Components).
import CheckoutForm from "@/components/CheckoutFormDynamic";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout | ShopNext",
};

export default async function CheckoutPage() {
  // ── Auth guard ─────────────────────────────────────────────────────────────
  const userId = await getSessionUserId();
  if (!userId) redirect("/login?redirectTo=/checkout");

  // ── Fetch cart ─────────────────────────────────────────────────────────────
  const result = await getCart();

  if (!result.success || !result.data?.length) {
    redirect("/cart");
  }

  const items = result.data;

  // ── Calculations ───────────────────────────────────────────────────────────
  const subtotal = items.reduce(
    (s, i) => s + (i.product.price + (i.variant?.priceDelta ?? 0)) * i.quantity,
    0
  );
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  // getShippingCalc checks the FREE_SHIPPING_PROMO feature flag — same logic
  // used by placeOrder so the displayed total matches what gets charged.
  const shippingCalc = await getShippingCalc(subtotal);
  const shipping     = shippingCalc.amount;
  const total        = Math.round((subtotal + shipping) * 100) / 100;

  return (
    <div className="pb-16">
      {/* Back link */}
      <Link
        href="/cart"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to cart
      </Link>

      <h1 className="mb-8 text-2xl font-bold text-gray-900 sm:text-3xl">Checkout</h1>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-start">

        {/* ── Left: shipping form ─────────────────────────────────────────── */}
        <section>
          <h2 className="mb-5 text-base font-semibold text-gray-900">
            Shipping information
          </h2>
          <Suspense fallback={null}>
            <CheckoutForm subtotal={subtotal} shipping={shipping} />
          </Suspense>

          {/* Trust badges */}
          <div className="mt-6 flex items-center gap-2 text-xs text-gray-400">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
            Your information is encrypted and secure.
          </div>
        </section>

        {/* ── Right: order summary ────────────────────────────────────────── */}
        <aside className="top-24 rounded-2xl border border-gray-100 bg-white p-6 shadow-xs lg:sticky">
          <h2 className="text-base font-semibold text-gray-900">
            Order summary
            <span className="ml-2 text-sm font-normal text-gray-400">
              ({totalQty} {totalQty === 1 ? "item" : "items"})
            </span>
          </h2>

          {/* Items */}
          <ul className="mt-5 divide-y divide-gray-50">
            {items.map((item) => {
              const image = item.product.images?.[0] ?? null;
              return (
                <li key={item.id} className="flex gap-3 py-3">
                  {/* Thumbnail */}
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gray-50">
                    {image ? (
                      <Image
                        src={image}
                        alt={item.product.title}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <ShoppingBag className="h-5 w-5 text-gray-200" />
                      </div>
                    )}
                    {/* Qty badge */}
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white leading-none">
                      {item.quantity}
                    </span>
                  </div>

                  {/* Name + price */}
                  <div className="flex flex-1 items-center justify-between gap-2 min-w-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-800">
                        {item.product.title}
                      </p>
                      {item.variant && (
                        <p className="text-xs text-gray-400">
                          {item.variant.name}: {item.variant.value}
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-gray-900">
                      ${((item.product.price + (item.variant?.priceDelta ?? 0)) * item.quantity).toFixed(2)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Totals */}
          <div className="mt-4 space-y-2 border-t border-gray-100 pt-4 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-medium text-gray-900">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping</span>
              {shipping === 0 ? (
                <span className="font-medium text-emerald-600">Free</span>
              ) : (
                <span className="font-medium text-gray-900">${shipping.toFixed(2)}</span>
              )}
            </div>
            {/* Only show the upsell hint when the promo is actually active */}
            {shippingCalc.promoActive && shipping > 0 && (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Add ${(shippingCalc.threshold - subtotal).toFixed(2)} more for free shipping
              </p>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
            <span className="text-base font-semibold text-gray-900">Total</span>
            <span className="text-xl font-bold text-gray-900">${total.toFixed(2)}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
