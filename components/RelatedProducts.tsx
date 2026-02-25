// ─────────────────────────────────────────────────────────────────────────────
// RelatedProducts — reusable async Server Component
//
// Architecture:
//   RelatedProducts (default export, Server Component)
//     └─ <Suspense fallback={<RelatedProductsSkeleton />}>
//          └─ <RelatedProductsContent />  ← async, self-fetching
//
// Usage:
//   import RelatedProducts from "@/components/RelatedProducts";
//   <RelatedProducts category="Electronics" excludeId="abc123" />
//
// The component manages its own loading state via an internal Suspense
// boundary, so callers need no extra Suspense or dynamic import wiring.
// ─────────────────────────────────────────────────────────────────────────────

import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import prisma from "@/lib/prisma";
import ProductCard from "@/components/ProductCard";
import type { ProductCardData } from "@/components/ProductCard";
import { getWishlistProductIds } from "@/lib/actions/wishlist";

// ─────────────────────────────────────────────────────────────────────────────
// Public props interface (exported so callers can type-check)
// ─────────────────────────────────────────────────────────────────────────────

export interface RelatedProductsProps {
  /** categoryId (FK scalar) — used for the Prisma WHERE clause. */
  categoryId: string;
  /** Category display name — used for link text and URL. */
  category: string;
  /** Product id to exclude (the one currently being viewed). */
  excludeId: string;
  /**
   * How many related products to display.
   * @default 4
   */
  limit?: number;
  /**
   * Sort order: "rating" (default) or "latest".
   * @default "rating"
   */
  sortBy?: "rating" | "latest";
  /**
   * Revalidation interval in seconds for ISR.
   * @default 120
   */
  revalidate?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading skeleton (named export — reusable as a standalone fallback)
// ─────────────────────────────────────────────────────────────────────────────

export function RelatedProductsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <section className="mt-20 animate-pulse border-t border-gray-100 pt-14">
      {/* Header skeleton */}
      <div className="mb-8 flex items-end justify-between">
        <div className="space-y-2">
          <div className="h-3 w-24 rounded-md bg-gray-100" />
          <div className="h-6 w-44 rounded-xl bg-gray-200" />
        </div>
        <div className="h-4 w-20 rounded-md bg-gray-100" />
      </div>

      {/* Card skeletons */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-2xl border border-gray-100 bg-white"
          >
            {/* Image placeholder */}
            <div className="h-48 bg-gray-100" />
            {/* Content placeholder */}
            <div className="space-y-3 p-4">
              <div className="h-3 w-16 rounded-full bg-gray-100" />
              <div className="h-4 w-4/5 rounded-lg bg-gray-200" />
              <div className="h-3.5 w-3/5 rounded-md bg-gray-100" />
              <div className="flex items-center justify-between pt-1">
                <div className="h-5 w-16 rounded-lg bg-gray-200" />
                <div className="h-7 w-7 rounded-lg bg-gray-100" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Data fetcher — direct Prisma call (no loopback HTTP overhead during SSR)
// ─────────────────────────────────────────────────────────────────────────────

async function fetchRelatedProducts(
  categoryId: string,
  excludeId: string,
  limit: number,
  sortBy: "rating" | "latest",
): Promise<ProductCardData[]> {
  try {
    const rows = await prisma.product.findMany({
      where: {
        categoryId,
        id: { not: excludeId },
      },
      take:    limit,
      // Hits the @@index([categoryId, rating]) or @@index([categoryId, createdAt])
      orderBy: sortBy === "latest" ? { createdAt: "desc" } : { rating: "desc" },
      select: {
        id:          true,
        title:       true,
        description: true,
        price:       true,
        stock:       true,
        rating:      true,
        images:      true,
        // Select only .name — the rest of the Category object is not needed
        category:    { select: { name: true } },
      },
    });

    // Flatten nested category object to the plain string ProductCard expects
    return rows.map(({ category, ...rest }) => ({
      ...rest,
      category: category.name,
    }));
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Inner async Server Component — streams in after parent shell
// ─────────────────────────────────────────────────────────────────────────────

async function RelatedProductsContent({
  categoryId,
  category,
  excludeId,
  limit,
  sortBy,
}: Required<RelatedProductsProps>) {
  const [products, wishlistedIds] = await Promise.all([
    fetchRelatedProducts(categoryId, excludeId, limit, sortBy),
    getWishlistProductIds(),
  ]);

  if (products.length === 0) return null;

  return (
    <section className="mt-20 border-t border-gray-100 pt-14">
      {/* ── Section header ── */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
            More like this
          </p>
          <h2 className="mt-1 text-xl font-bold text-gray-900 sm:text-2xl">
            Related Products
          </h2>
        </div>
        <Link
          href={`/products?category=${encodeURIComponent(category)}`}
          className="hidden items-center gap-1 text-sm font-medium text-indigo-600 transition hover:underline sm:flex"
        >
          View all <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {/* ── Product grid ── */}
      <div
        className={`grid grid-cols-1 gap-5 sm:grid-cols-2 ${
          products.length >= 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"
        } ${products.length >= 4 ? "lg:grid-cols-4" : ""}`}
      >
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            isWishlisted={wishlistedIds.has(product.id)}
          />
        ))}
      </div>

      {/* ── Mobile "View all" link ── */}
      <div className="mt-6 flex justify-center sm:hidden">
        <Link
          href={`/products?category=${encodeURIComponent(category)}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-5 py-2.5 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100"
        >
          View all {category} <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Default export — wrapper that owns the Suspense boundary
// Callers import this and get streaming + skeleton for free.
// ─────────────────────────────────────────────────────────────────────────────

export default function RelatedProducts({
  categoryId,
  category,
  excludeId,
  limit = 4,
  sortBy = "rating",
  revalidate = 120,
}: RelatedProductsProps) {
  return (
    <Suspense fallback={<RelatedProductsSkeleton count={limit} />}>
      <RelatedProductsContent
        categoryId={categoryId}
        category={category}
        excludeId={excludeId}
        limit={limit}
        sortBy={sortBy}
        revalidate={revalidate}
      />
    </Suspense>
  );
}
