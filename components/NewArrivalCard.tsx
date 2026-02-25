// NewArrivalCard — Server Component.
//
// Renders a product card enriched with new-arrival UI:
//   • "NEW" badge in the corner
//   • "Featured X days ago" caption
//   • Subtle sparkle/star accent

import Image from "next/image";
import Link from "next/link";
import { Star, Sparkles, Package } from "lucide-react";
import AddToCartButton from "@/components/AddToCartButton";
import WishlistButton from "@/components/WishlistButton";
import type { NewArrivalListItem } from "@/lib/queries/new-arrival";

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysAgo(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

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
              full  ? "fill-amber-400 text-amber-400"
              : half ? "fill-amber-200 text-amber-400"
              :        "fill-gray-100 text-gray-300"
            }`}
            strokeWidth={1.5}
          />
        );
      })}
      <span className="ml-1 text-xs font-medium text-gray-500">{rating.toFixed(1)}</span>
    </div>
  );
}

// ── Category color map (same as ProductCard) ─────────────────────────────────
const categoryColors: Record<string, string> = {
  Electronics:      "bg-blue-50 text-blue-700",
  Clothing:         "bg-pink-50 text-pink-700",
  Footwear:         "bg-orange-50 text-orange-700",
  "Sports & Fitness": "bg-green-50 text-green-700",
  "Kitchen & Home": "bg-amber-50 text-amber-700",
  Furniture:        "bg-purple-50 text-purple-700",
  Stationery:       "bg-teal-50 text-teal-700",
};
function getCategoryColor(category: string) {
  return categoryColors[category] ?? "bg-indigo-50 text-indigo-700";
}

// ── NewArrivalCard ────────────────────────────────────────────────────────────

export default function NewArrivalCard({
  item,
  priority = false,
  isWishlisted = false,
}: {
  item:          NewArrivalListItem;
  priority?:     boolean;
  isWishlisted?: boolean;
}) {
  const { product, featuredAt } = item;
  const image        = product.images[0];
  const isLowStock   = product.stock > 0 && product.stock <= 5;
  const isOutOfStock = product.stock === 0;

  return (
    <Link
      href={`/products/${product.id}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm ring-1 ring-transparent transition duration-300 hover:-translate-y-1 hover:border-violet-100 hover:shadow-lg hover:ring-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
    >
      {/* ── Image ── */}
      <div className="relative h-52 w-full overflow-hidden bg-gray-50">
        {image ? (
          <Image
            src={image}
            alt={product.title}
            fill
            priority={priority}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Package className="h-12 w-12 text-gray-300" />
          </div>
        )}

        {/* NEW badge */}
        <div className="absolute left-2.5 top-2.5 z-10 flex items-center gap-1 rounded-full bg-linear-to-r from-violet-600 to-indigo-500 px-2.5 py-1 shadow-md shadow-violet-400/30">
          <Sparkles className="h-3 w-3 text-white" />
          <span className="text-[10px] font-bold tracking-widest text-white uppercase">New</span>
        </div>

        {/* Stock badges */}
        {isOutOfStock && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
            <span className="rounded-full bg-gray-800 px-3 py-1 text-xs font-semibold text-white">
              Out of Stock
            </span>
          </div>
        )}
        {isLowStock && !isOutOfStock && (
          <span className="absolute bottom-2.5 left-2.5 z-10 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white">
            Only {product.stock} left
          </span>
        )}

        {/* Wishlist */}
        <div className="absolute right-2.5 bottom-2.5 z-10 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <WishlistButton productId={product.id} isWishlisted={isWishlisted} />
        </div>
      </div>

      {/* ── Info ── */}
      <div className="flex flex-1 flex-col p-4">
        {/* Category */}
        <span className={`mb-1.5 inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${getCategoryColor(product.category)}`}>
          {product.category}
        </span>

        {/* Title */}
        <h3 className="mb-2 line-clamp-2 text-sm font-semibold leading-snug text-gray-800 group-hover:text-violet-600 transition-colors">
          {product.title}
        </h3>

        {/* Star rating */}
        <StarRating rating={product.rating} />

        {/* Price */}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-lg font-bold text-gray-900">
            ${product.price.toFixed(2)}
          </span>
          <span className="text-[10px] text-gray-400 tabular-nums">
            Added {daysAgo(featuredAt)}
          </span>
        </div>

        {/* Add to cart */}
        <div className="mt-3">
          <AddToCartButton
            productId={product.id}
            productTitle={product.title}
            stock={product.stock}
            className="w-full"
          />
        </div>
      </div>
    </Link>
  );
}
