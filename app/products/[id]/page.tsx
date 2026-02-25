import dynamic from "next/dynamic";
import { cache } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  Star,
  Package,
  ChevronRight,
  Tag,
  BarChart2,
  ShieldCheck,
  Truck,
  RefreshCw,
} from "lucide-react";

import { RelatedProductsSkeleton } from "@/components/RelatedProducts";
import ImageGalleryDynamic from "@/components/ImageGalleryDynamic";
import AddToCartFormDynamic from "@/components/AddToCartFormDynamic";
import prisma from "@/lib/prisma";

// ── Cache strategy ────────────────────────────────────────────────────────────
// Product detail pages change infrequently.  ISR with a 1-hour window gives
// near-static performance while still picking up price / stock updates.
export const revalidate = 3600;

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic imports — client islands, code-split
// ImageGallery and AddToCartForm use ssr:false — that call lives in their
// dedicated "use client" wrapper components (Next.js App Router requirement).
// ─────────────────────────────────────────────────────────────────────────────

// Related products — code-split into its own JS chunk; skeleton shown while chunk loads.
const RelatedProducts = dynamic(
  () => import("@/components/RelatedProducts"),
  { loading: () => <RelatedProductsSkeleton /> }
);

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

// The Product type is inferred from getProduct's Prisma select — kept here
// for explicit annotation in generateMetadata and the page component.
// ─────────────────────────────────────────────────────────────────────────────
// Data fetching helpers
// ─────────────────────────────────────────────────────────────────────────────

// Memoised with React cache() — deduplicates the DB call across generateMetadata
// and the page component within the same request with zero HTTP round-trip.
const getProduct = cache(async (id: string) => {
  const raw = await prisma.product.findUnique({
    where: { id },
    select: {
      id:          true,
      title:       true,
      description: true,
      price:       true,
      stock:       true,
      categoryId:  true,
      // Select only name from the relation — avoids over-fetching
      category:    { select: { name: true } },
      rating:      true,
      images:      true,
      createdAt:   true,
    },
  });
  if (!raw) return null;
  // Flatten nested category object to a plain string
  const { category, ...rest } = raw;
  return { ...rest, category: category.name };
});

// ─────────────────────────────────────────────────────────────────────────────
// generateMetadata — dynamic SEO per product
// ─────────────────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) return { title: "Product Not Found" };

  const description = product.description.slice(0, 160);

  return {
    title: `${product.title} | ShopNest`,
    description,
    openGraph: {
      title: product.title,
      description,
      images: product.images[0] ? [{ url: product.images[0] }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: product.title,
      description,
      images: product.images[0] ? [product.images[0]] : [],
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components (pure Server Components — zero client JS)
// ─────────────────────────────────────────────────────────────────────────────

// ── Star rating ──────────────────────────────────────────────────────────────
function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.3;

  return (
    <div
      className="flex items-center gap-1.5"
      aria-label={`Rated ${rating} out of 5`}
    >
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${
              i < full
                ? "fill-amber-400 text-amber-400"
                : !full && hasHalf && i === full
                  ? "fill-amber-200 text-amber-400"
                  : "fill-gray-100 text-gray-300"
            }`}
            strokeWidth={1.5}
          />
        ))}
      </div>
      <span className="text-sm font-semibold text-gray-700">
        {rating.toFixed(1)}
      </span>
      <span className="text-sm text-gray-400">/ 5.0</span>
    </div>
  );
}

// ── Stock badge ──────────────────────────────────────────────────────────────
function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 ring-1 ring-red-100">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        Out of Stock
      </span>
    );
  }
  if (stock <= 5) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-100">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Only {stock} left
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 ring-1 ring-green-100">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
      In Stock
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Category colour map (matches ProductCard)
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Electronics: "bg-blue-50 text-blue-700 ring-blue-100",
  Clothing: "bg-pink-50 text-pink-700 ring-pink-100",
  Footwear: "bg-orange-50 text-orange-700 ring-orange-100",
  "Sports & Fitness": "bg-green-50 text-green-700 ring-green-100",
  "Kitchen & Home": "bg-amber-50 text-amber-700 ring-amber-100",
  Furniture: "bg-purple-50 text-purple-700 ring-purple-100",
  Stationery: "bg-teal-50 text-teal-700 ring-teal-100",
};

function getCatColor(category: string) {
  return CATEGORY_COLORS[category] ?? "bg-indigo-50 text-indigo-700 ring-indigo-100";
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) notFound();

  const catColor = getCatColor(product.category);

  return (
    <div>
      {/* ── Breadcrumb ── */}
      <nav
        aria-label="Breadcrumb"
        className="mb-8 flex flex-wrap items-center gap-1.5 text-sm text-gray-400"
      >
        <Link href="/" className="transition hover:text-indigo-600">
          Home
        </Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        <Link href="/products" className="transition hover:text-indigo-600">
          Products
        </Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        <Link
          href={`/products?category=${encodeURIComponent(product.category)}`}
          className="transition hover:text-indigo-600"
        >
          {product.category}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        <span className="max-w-55 truncate font-medium text-gray-700">
          {product.title}
        </span>
      </nav>

      {/* ── Main two-column layout ── */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
        {/* ────────────────────────────────────────
            LEFT — Image gallery (client island)
        ──────────────────────────────────────── */}
        <ImageGalleryDynamic images={product.images} title={product.title} />

        {/* ────────────────────────────────────────
            RIGHT — Product info panel
        ──────────────────────────────────────── */}
        <div className="flex flex-col gap-5">
          {/* Category + stock row */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${catColor}`}
            >
              <Tag className="h-3 w-3" />
              {product.category}
            </span>
            <StockBadge stock={product.stock} />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-3xl lg:text-4xl">
            {product.title}
          </h1>

          {/* Rating */}
          <StarRating rating={product.rating} />

          {/* Price */}
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-extrabold text-gray-900">
              ${product.price.toFixed(2)}
            </span>
            {/* Strike-through "original" price for visual appeal — placeholder */}
            <span className="text-base font-medium text-gray-400 line-through">
              ${(product.price * 1.2).toFixed(2)}
            </span>
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600">
              −17%
            </span>
          </div>

          <hr className="border-gray-100" />

          {/* Description */}
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
              Description
            </h2>
            <p className="text-sm leading-relaxed text-gray-600">
              {product.description}
            </p>
          </div>

          {/* Specs row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
              <BarChart2 className="h-4 w-4 shrink-0 text-indigo-500" />
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                  Rating
                </p>
                <p className="text-sm font-bold text-gray-800">
                  {product.rating.toFixed(1)} / 5.0
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
              <Package className="h-4 w-4 shrink-0 text-indigo-500" />
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                  Stock
                </p>
                <p className="text-sm font-bold text-gray-800">
                  {product.stock > 0 ? `${product.stock} units` : "Unavailable"}
                </p>
              </div>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Add to cart — form action → server action, client island only for qty picker + toast */}
          <AddToCartFormDynamic
              productId={product.id}
              productTitle={product.title}
              stock={product.stock}
            />

          {/* Trust badges */}
          <div className="flex flex-wrap gap-4 pt-1 text-xs font-medium text-gray-500">
            <span className="flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5 text-indigo-400" />
              Free shipping over $50
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
              Secure checkout
            </span>
            <span className="flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5 text-indigo-400" />
              30-day returns
            </span>
          </div>
        </div>
      </div>

      {/* ── Related products — code-split via dynamic(), streamed via internal Suspense ── */}
      <RelatedProducts
        categoryId={product.categoryId}
        category={product.category}
        excludeId={product.id}
        limit={4}
      />
    </div>
  );
}
