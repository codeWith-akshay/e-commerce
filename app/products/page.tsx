import { Suspense } from "react";
import type { Metadata } from "next";
import { Package } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import ProductFilters from "@/components/ProductFilters";
import ProductsPagination from "@/components/ProductsPagination";
import { queryProducts } from "@/lib/queries/product";
import type { ProductsSearchParams } from "@/types";
import { getWishlistProductIds } from "@/lib/actions/wishlist";
import { isEnabled }              from "@/lib/actions/feature-flags";
import { FLAGS }                  from "@/lib/flags";

// ProductsSearchParams lives in @/types — re-exported here for any legacy imports
export type { ProductsSearchParams };

// ── Cache strategy ────────────────────────────────────────────────────────────
// This page reads searchParams, so Next.js already infers dynamic rendering.
// Declaring it explicitly avoids any accidental static caching and serves as
// clear documentation of intent.
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// Static data
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  "Electronics",
  "Clothing",
  "Footwear",
  "Sports & Fitness",
  "Home & Kitchen",
  "Furniture",
  "Stationery",
];

const PRODUCTS_PER_PAGE = 12;

// ─────────────────────────────────────────────────────────────────────────────
// Metadata
// ─────────────────────────────────────────────────────────────────────────────

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<ProductsSearchParams>;
}): Promise<Metadata> {
  const params = await searchParams;
  const parts: string[] = [];
  if (params.search) parts.push(`"${params.search}"`);
  if (params.category) parts.push(params.category);

  return {
    title: parts.length ? `${parts.join(" · ")} — Products` : "All Products",
    description:
      "Browse our full catalogue. Filter by category, price, and rating.",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Data fetching
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert URL search-param strings (all `string | undefined`) to the typed
 * `ProductsQuery` shape that `queryProducts()` expects (numbers pre-parsed).
 */
function toQueryParams(params: ProductsSearchParams) {
  const parseF = (s?: string): number | undefined => {
    if (!s) return undefined;
    const n = parseFloat(s);
    return isNaN(n) ? undefined : n;
  };

  return {
    search:    params.search   || undefined,
    category:  params.category || undefined,
    minPrice:  parseF(params.minPrice),
    maxPrice:  parseF(params.maxPrice),
    minRating: parseF(params.minRating),
    page:      params.page ? Math.max(1, parseInt(params.page, 10) || 1) : 1,
    sortBy:    params.sortBy || undefined,
    order:     params.order  || undefined,
    limit:     PRODUCTS_PER_PAGE,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-20 text-center">
      <Package className="h-12 w-12 text-gray-300" strokeWidth={1.5} />
      <div>
        <p className="text-sm font-semibold text-gray-500">
          {hasFilters ? "No products match your filters" : "No products yet"}
        </p>
        <p className="mt-1 text-xs text-gray-400">
          {hasFilters
            ? "Try adjusting your search or filters."
            : "Check back soon or run pnpm db:seed."}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Product grid skeleton (Suspense fallback)
// ─────────────────────────────────────────────────────────────────────────────

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: PRODUCTS_PER_PAGE }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse overflow-hidden rounded-2xl border border-gray-100 bg-white"
        >
          <div className="h-48 bg-gray-100" />
          <div className="space-y-3 p-4">
            <div className="h-3 w-16 rounded-full bg-gray-100" />
            <div className="h-4 w-4/5 rounded-lg bg-gray-200" />
            <div className="h-3 w-3/5 rounded-md bg-gray-100" />
            <div className="flex items-center justify-between pt-1">
              <div className="h-5 w-16 rounded-lg bg-gray-200" />
              <div className="h-7 w-7 rounded-lg bg-gray-100" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Async product grid (streamed)
// ─────────────────────────────────────────────────────────────────────────────

async function ProductGrid({ params }: { params: ProductsSearchParams }) {
  const [data, wishlistEnabled, rawIds] = await Promise.all([
    queryProducts(toQueryParams(params)),
    isEnabled(FLAGS.WISHLIST_ENABLED),
    getWishlistProductIds(),
  ]);
  // Normalise to Set<string> regardless of whether getWishlistProductIds returns
  // a string[] or a Set<string>, and skip the set entirely when disabled.
  const wishlistedIds = new Set<string>(
    wishlistEnabled ? (rawIds as unknown as Iterable<string>) : []
  );

  const hasFilters = !!(
    params.search ||
    params.category ||
    params.minPrice ||
    params.maxPrice ||
    params.minRating
  );

  return (
    <>
      {/* Results meta */}
      <p className="mb-5 text-sm text-gray-500">
        {data.totalProducts > 0 ? (
          <>
            Showing{" "}
            <span className="font-semibold text-gray-800">
              {data.products.length}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-gray-800">
              {data.totalProducts}
            </span>{" "}
            products
          </>
        ) : null}
      </p>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data.products.length > 0 ? (
          data.products.map((product, i) => (
            // First 4 products are likely above the fold on page 1 — mark as
            // priority so the browser fetches them without waiting for JS.
            // All subsequent cards use the default lazy loading.
            <ProductCard
              key={product.id}
              product={product}
              priority={i < 4}
              isWishlisted={wishlistedIds.has(product.id)}
              showWishlist={wishlistEnabled}
            />
          ))
        ) : (
          <EmptyState hasFilters={hasFilters} />
        )}
      </div>

      {/* Pagination */}
      {data.totalPages > 1 && (
        <ProductsPagination
          currentPage={data.currentPage}
          totalPages={data.totalPages}
          searchParams={params}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<ProductsSearchParams>;
}) {
  const params = await searchParams;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          All Products
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Browse, filter, and find exactly what you&apos;re looking for.
        </p>
      </div>

      {/* Filters — client island */}
      <ProductFilters
        categories={CATEGORIES}
        currentParams={params}
      />

      {/* Grid — streamed */}
      <Suspense key={JSON.stringify(params)} fallback={<ProductGridSkeleton />}>
        <ProductGrid params={params} />
      </Suspense>
    </div>
  );
}
