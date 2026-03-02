import Link from "next/link";
import { redirect } from "next/navigation";
import { Heart, ShoppingBag } from "lucide-react";
import type { Metadata } from "next";
import { getSessionUserId } from "@/lib/session";
import { getWishlist } from "@/lib/actions/wishlist";
import { isEnabled } from "@/lib/actions/feature-flags";
import { FLAGS } from "@/lib/flags";
import ProductCard from "@/components/ProductCard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Wishlist | ShopNest",
  description: "Products you've saved for later.",
};

export default async function WishlistPage() {
  // ── Auth guard ─────────────────────────────────────────────────────────────
  const userId = await getSessionUserId();
  if (!userId) redirect("/login?redirectTo=/wishlist");

  // ── Feature flag guard ─────────────────────────────────────────────────────
  const wishlistEnabled = await isEnabled(FLAGS.WISHLIST_ENABLED);
  if (!wishlistEnabled) redirect("/products");

  // ── Data ───────────────────────────────────────────────────────────────────
  const result = await getWishlist();

  if (!result.success) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-gray-500">Something went wrong loading your wishlist.</p>
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

  // ── Empty state ────────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-pink-50">
          <Heart className="h-9 w-9 text-pink-300" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your wishlist is empty</h1>
          <p className="mt-2 text-gray-500">
            Save products you&apos;re interested in by clicking the&nbsp;
            <Heart className="inline h-4 w-4 text-pink-400" fill="currentColor" /> icon.
          </p>
        </div>
        <Link
          href="/products"
          className="rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 active:scale-95"
        >
          Browse products
        </Link>
      </div>
    );
  }

  // ── Wishlist grid ──────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">My Wishlist</h1>
          <p className="mt-1 text-sm text-gray-500">
            {items.length} {items.length === 1 ? "item" : "items"} saved
          </p>
        </div>
        <Link
          href="/products"
          className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100"
        >
          <ShoppingBag className="h-4 w-4" />
          Continue shopping
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map(({ product }) => (
          <ProductCard
            key={product.id}
            product={{
              id:          product.id,
              title:       product.title,
              description: product.description,
              price:       product.price,
              stock:       product.stock,
              rating:      product.rating,
              images:      product.images,
              category:    product.category.name,
            }}
            isWishlisted
            showWishlist
          />
        ))}
      </div>
    </div>
  );
}
