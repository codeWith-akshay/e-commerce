// DealCard — Server Component.
//
// Renders a product card enriched with deal-specific UI:
//   • "X% OFF" ribbon in the corner
//   • Crossed-out original price + highlighted discounted price
//   • Badge label pill (Flash Sale, Clearance, etc.)
//   • Countdown strip showing time remaining
// Client interactivity — wishlist + cart — is delegated to the same islands
// used by the regular ProductCard.

import Image from "next/image";
import Link from "next/link";
import { Star, Clock, Flame, Package } from "lucide-react";
import AddToCartButton from "@/components/AddToCartButton";
import WishlistButton from "@/components/WishlistButton";
import type { DealListItem } from "@/lib/queries/deal";

// ── Helpers ───────────────────────────────────────────────────────────────────

function discountedPrice(originalPrice: number, discountPercent: number): number {
  return +(originalPrice * (1 - discountPercent / 100)).toFixed(2);
}

/** Human-readable time remaining. Returns null when < 1 hour. */
function timeRemaining(endsAt: Date): string {
  const ms = endsAt.getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "< 1 hour left";
  if (hours < 24) return `${hours}h left`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h left`;
}

/** Star rating mini component. */
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

/** Badge label → colour class map. */
const BADGE_COLORS: Record<string, string> = {
  "Flash Sale":    "bg-rose-500   text-white",
  "Clearance":     "bg-orange-500 text-white",
  "Weekend Deal":  "bg-violet-600 text-white",
  "Summer Sale":   "bg-sky-500    text-white",
  "Limited Offer": "bg-amber-500  text-white",
  "Big Savings":   "bg-emerald-600 text-white",
  "Seasonal Sale": "bg-teal-600   text-white",
};
function getBadgeColor(label: string) {
  return BADGE_COLORS[label] ?? "bg-indigo-600 text-white";
}

// ── DealCard ──────────────────────────────────────────────────────────────────

export default function DealCard({
  deal,
  priority = false,
  isWishlisted = false,
  showWishlist = true,
}: {
  deal:          DealListItem;
  priority?:     boolean;
  isWishlisted?: boolean;
  showWishlist?: boolean;
}) {
  const { product, discountPercent, badgeLabel, endsAt } = deal;
  const image      = product.images[0];
  const salePrice  = discountedPrice(product.price, discountPercent);
  const isLowStock = product.stock > 0 && product.stock <= 5;
  const isOutOfStock = product.stock === 0;
  const timeLeft   = timeRemaining(endsAt);
  const urgency    = timeLeft.includes("h") && !timeLeft.includes("d");

  return (
    <Link
      href={`/products/${product.id}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm ring-1 ring-transparent transition duration-300 hover:-translate-y-1 hover:border-rose-100 hover:shadow-lg hover:ring-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
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

        {/* Discount ribbon */}
        <div className="absolute left-0 top-4 z-10">
          <div className="flex items-center gap-1 rounded-r-full bg-rose-500 pl-3 pr-4 py-1.5 shadow-md shadow-rose-500/30">
            <Flame className="h-3.5 w-3.5 text-white" />
            <span className="text-xs font-bold text-white tracking-wide">
              {discountPercent % 1 === 0 ? discountPercent : discountPercent.toFixed(1)}% OFF
            </span>
          </div>
        </div>

        {/* Badge label */}
        <span className={`absolute right-2.5 top-2.5 z-10 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${getBadgeColor(badgeLabel)}`}>
          {badgeLabel}
        </span>

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
        {showWishlist && (
          <div className="absolute right-2.5 bottom-2.5 z-10 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <WishlistButton productId={product.id} isWishlisted={isWishlisted} />
          </div>
        )}
      </div>

      {/* ── Info ── */}
      <div className="flex flex-1 flex-col p-4">
        {/* Category */}
        <span className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          {product.category}
        </span>

        {/* Title */}
        <h3 className="mb-2 line-clamp-2 text-sm font-semibold leading-snug text-gray-800 group-hover:text-rose-600 transition-colors">
          {product.title}
        </h3>

        {/* Star rating */}
        <StarRating rating={product.rating} />

        {/* Prices */}
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-lg font-bold text-rose-600">
            ${salePrice.toFixed(2)}
          </span>
          <span className="text-sm text-gray-400 line-through">
            ${product.price.toFixed(2)}
          </span>
          <span className="ml-auto text-xs font-semibold text-emerald-600">
            Save ${(product.price - salePrice).toFixed(2)}
          </span>
        </div>

        {/* Time remaining */}
        <div className={`mt-2 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
          urgency
            ? "bg-rose-50 text-rose-600"
            : "bg-gray-50 text-gray-500"
        }`}>
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>{timeLeft}</span>
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
