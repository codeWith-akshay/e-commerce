import Image from "next/image";
import Link from "next/link";
import { ShoppingCart, ShoppingBag } from "lucide-react";
import { getCart } from "@/lib/actions/cart";
import { QuantityForm, RemoveForm, ClearCartButton } from "@/components/CartItemControls";

// Never cache the cart — always fresh
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Your Cart | ShopNext",
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const FREE_SHIPPING_THRESHOLD = 50;
const SHIPPING_FEE = 5.99;

// ─────────────────────────────────────────────────────────────────────────────
// Category badge colours (matches ProductCard / product detail page)
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Electronics: "bg-blue-50 text-blue-700",
  Clothing: "bg-pink-50 text-pink-700",
  "Home & Kitchen": "bg-amber-50 text-amber-700",
  Books: "bg-emerald-50 text-emerald-700",
  Sports: "bg-orange-50 text-orange-700",
  Beauty: "bg-purple-50 text-purple-700",
};

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default async function CartPage() {
  const result = await getCart();

  // ── Unauthenticated ────────────────────────────────────────────────────────
  if (!result.success && result.code === "UNAUTHENTICATED") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-50">
          <ShoppingCart className="h-9 w-9 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sign in to view your cart</h1>
          <p className="mt-2 text-gray-500">
            Your cart items are saved to your account.
          </p>
        </div>
        <Link
          href="/products"
          className="rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 active:scale-95"
        >
          Continue shopping
        </Link>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (!result.success) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-gray-500">Something went wrong loading your cart.</p>
        <p className="text-sm text-red-400">{result.error}</p>
        <Link
          href="/products"
          className="rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
        >
          Continue shopping
        </Link>
      </div>
    );
  }

  const items = result.data ?? [];

  // ── Empty cart ─────────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gray-100">
          <ShoppingBag className="h-9 w-9 text-gray-300" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your cart is empty</h1>
          <p className="mt-2 text-gray-500">
            Looks like you haven&apos;t added anything yet.
          </p>
        </div>
        <Link
          href="/products"
          className="rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 active:scale-95"
        >
          Shop products
        </Link>
      </div>
    );
  }

  // ── Calculations ───────────────────────────────────────────────────────────
  const subtotal = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const total = subtotal + shipping;
  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);

  // ── Cart page ──────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Your Cart</h1>
          <p className="mt-1 text-sm text-gray-500">
            {totalQty} {totalQty === 1 ? "item" : "items"}
          </p>
        </div>
        <ClearCartButton />
      </div>

      {/* Grid: items (2/3) + summary (1/3) */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:items-start">

        {/* ── Items list ────────────────────────────────────────────────────── */}
        <div className="space-y-4 lg:col-span-2">
          {items.map((item) => {
            const badgeClass =
              CATEGORY_COLORS[item.product.category.name] ?? "bg-gray-100 text-gray-600";
            const imageUrl = item.product.images?.[0] ?? null;
            const lineTotal = item.product.price * item.quantity;

            return (
              <article
                key={item.id}
                className="flex gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-xs transition hover:shadow-sm sm:gap-5"
              >
                {/* Thumbnail */}
                <Link
                  href={`/products/${item.product.id}`}
                  className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-gray-50 sm:h-28 sm:w-28"
                  aria-label={`View ${item.product.title}`}
                >
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt={item.product.title}
                      fill
                      sizes="(max-width: 640px) 96px, 112px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ShoppingBag className="h-8 w-8 text-gray-200" />
                    </div>
                  )}
                </Link>

                {/* Info + controls */}
                <div className="flex flex-1 flex-col justify-between gap-2 py-0.5">
                  {/* Top row: category + title + unit price */}
                  <div className="space-y-1">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}
                    >
                      {item.product.category.name}
                    </span>
                    <Link
                      href={`/products/${item.product.id}`}
                      className="block text-sm font-semibold text-gray-900 hover:text-indigo-600 sm:text-base"
                    >
                      {item.product.title}
                    </Link>
                    <p className="text-sm text-gray-500">
                      ${item.product.price.toFixed(2)} each
                    </p>
                  </div>

                  {/* Bottom row: qty stepper + remove + line total */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <QuantityForm
                        cartItemId={item.id}
                        quantity={item.quantity}
                        stock={item.product.stock}
                      />
                      <RemoveForm cartItemId={item.id} />
                    </div>
                    <span className="text-sm font-bold text-indigo-600">
                      ${lineTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* ── Order summary ─────────────────────────────────────────────────── */}
        <aside className="top-24 rounded-2xl border border-gray-100 bg-white p-6 shadow-xs lg:sticky">
          <h2 className="text-base font-semibold text-gray-900">Order summary</h2>

          <ul className="mt-5 space-y-3 text-sm text-gray-600">
            <li className="flex justify-between">
              <span>
                Subtotal ({totalQty} {totalQty === 1 ? "item" : "items"})
              </span>
              <span className="font-medium text-gray-900">${subtotal.toFixed(2)}</span>
            </li>
            <li className="flex justify-between">
              <span>Shipping</span>
              {shipping === 0 ? (
                <span className="font-medium text-emerald-600">Free</span>
              ) : (
                <span className="font-medium text-gray-900">${shipping.toFixed(2)}</span>
              )}
            </li>
            {shipping > 0 && (
              <li className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Add ${(FREE_SHIPPING_THRESHOLD - subtotal).toFixed(2)} more for free
                shipping
              </li>
            )}
          </ul>

          <div className="my-5 h-px bg-gray-100" />

          <div className="flex items-center justify-between">
            <span className="text-base font-semibold text-gray-900">Total</span>
            <span className="text-xl font-bold text-gray-900">${total.toFixed(2)}</span>
          </div>

          {/* Checkout CTA */}
          <Link
            href="/checkout"
            className="mt-6 flex w-full items-center justify-center rounded-2xl bg-indigo-600 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 active:scale-95"
          >
            Proceed to checkout
          </Link>

          <Link
            href="/products"
            className="mt-3 block text-center text-sm text-gray-400 hover:text-gray-600"
          >
            Continue shopping
          </Link>
        </aside>
      </div>
    </div>
  );
}
