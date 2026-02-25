// ProductCard — Server Component.
//
// All client interactivity is delegated to two tiny islands:
//   • <WishlistButton>   — heart toggle (DB-backed via server action)
//   • <AddToCartButton>  — cart action (useTransition + toast)
// The card itself generates static HTML with zero client JS.

import Image from "next/image";
import Link from "next/link";
import { Star, Package } from "lucide-react";
import AddToCartButton from "@/components/AddToCartButton";
import WishlistButton from "@/components/WishlistButton";

export type ProductCardData = {
  id: string;
  title: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  rating: number;
  images: string[];
};

// ── Star rating display ──────────────────────────────────────────────────────
function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => {
        const full = i < Math.floor(rating);
        const half = !full && i < Math.ceil(rating) && rating % 1 >= 0.3;
        return (
          <Star
            key={i}
            className={`h-3.5 w-3.5 ${
              full
                ? "fill-amber-400 text-amber-400"
                : half
                  ? "fill-amber-200 text-amber-400"
                  : "fill-gray-100 text-gray-300"
            }`}
            strokeWidth={1.5}
          />
        );
      })}
      <span className="ml-1 text-xs font-medium text-gray-500">
        {rating.toFixed(1)}
      </span>
    </div>
  );
}

// ── Category color map ───────────────────────────────────────────────────────
const categoryColors: Record<string, string> = {
  Electronics: "bg-blue-50 text-blue-700",
  Clothing: "bg-pink-50 text-pink-700",
  Footwear: "bg-orange-50 text-orange-700",
  "Sports & Fitness": "bg-green-50 text-green-700",
  "Kitchen & Home": "bg-amber-50 text-amber-700",
  Furniture: "bg-purple-50 text-purple-700",
  Stationery: "bg-teal-50 text-teal-700",
};

function getCategoryColor(category: string) {
  return categoryColors[category] ?? "bg-indigo-50 text-indigo-700";
}

// ── ProductCard ──────────────────────────────────────────────────────────────
/**
 * @param priority    — Set true for above-the-fold cards (LCP candidates).
 *                       Disabled by default so grid images are lazy-loaded.
 * @param isWishlisted — Whether the current user has wishlisted this product.
 *                       Passed from the Server Component parent (pre-fetched).
 */
export default function ProductCard({
  product,
  priority = false,
  isWishlisted = false,
}: {
  product: ProductCardData;
  priority?: boolean;
  isWishlisted?: boolean;
}) {
  const image = product.images[0];
  const isLowStock = product.stock > 0 && product.stock <= 5;
  const isOutOfStock = product.stock === 0;

  return (
    <Link
      href={`/products/${product.id}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm ring-1 ring-transparent transition duration-300 hover:-translate-y-1 hover:border-indigo-100 hover:shadow-lg hover:ring-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      {/* ── Image ── */}
      <div className="relative h-52 w-full overflow-hidden bg-gray-50">
        {image ? (
          <Image
            src={image}
            alt={product.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            priority={priority}
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          /* Placeholder when no image URL */
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-linear-to-br from-indigo-50 to-violet-50">
            <Package className="h-12 w-12 text-indigo-200" strokeWidth={1.5} />
            <span className="text-xs text-indigo-300">No image</span>
          </div>
        )}

        {/* Wishlist button — client island */}
        <WishlistButton productId={product.id} isWishlisted={isWishlisted} />

        {/* Stock badge */}
        {isOutOfStock && (
          <span className="absolute left-3 top-3 rounded-full bg-gray-800/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
            Out of stock
          </span>
        )}
        {isLowStock && (
          <span className="absolute left-3 top-3 rounded-full bg-red-500/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
            Only {product.stock} left
          </span>
        )}
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        {/* Category */}
        <span
          className={`inline-block w-fit rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${getCategoryColor(product.category)}`}
        >
          {product.category}
        </span>

        {/* Title */}
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900 group-hover:text-indigo-700 transition">
          {product.title}
        </h3>

        {/* Rating */}
        <StarRating rating={product.rating} />

        {/* Price + CTA */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <div>
            <span className="text-lg font-extrabold text-gray-900">
              ${product.price.toFixed(2)}
            </span>
          </div>

          <AddToCartButton
            productId={product.id}
            productTitle={product.title}
            stock={product.stock}
          />
        </div>
      </div>
    </Link>
  );
}
