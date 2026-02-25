import type { Metadata } from "next";
import { Sparkles, Tag } from "lucide-react";
import NewArrivalCard from "@/components/NewArrivalCard";
import NewArrivalsFilters from "@/components/NewArrivalsFilters";
import Pagination from "@/components/Pagination";
import { queryNewArrivals } from "@/lib/queries/new-arrival";
import { getWishlistProductIds } from "@/lib/actions/wishlist";
import type { NewArrivalsSearchParams } from "@/types";

export const dynamic = "force-dynamic";


// ── Metadata ──────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "New Arrivals — ShopNest",
  description:
    "Discover our latest products — freshly added to ShopNest. Shop new electronics, clothing, footwear and more.",
};

// ── Page ──────────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 12;

interface PageProps {
  searchParams?: Promise<NewArrivalsSearchParams>;
}

export default async function NewArrivalsPage({ searchParams }: PageProps) {
  const params   = await (searchParams ?? Promise.resolve({} as NewArrivalsSearchParams));
  const category = params.category?.trim() || undefined;
  const page     = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  // Fetch new arrivals directly via Prisma (no HTTP round-trip)
  const { items, totalItems, totalPages, currentPage } = await queryNewArrivals({
    category,
    page,
    limit: ITEMS_PER_PAGE,
  });

  // Pre-fetch wishlist state (null when logged out)
  const wishlistedIds = await getWishlistProductIds().catch(() => [] as string[]);
  const wishlistedSet = new Set(wishlistedIds);

  // Preserved params for pagination links
  const preserved: Record<string, string | undefined> = {
    ...(category && { category }),
  };

  return (
    <div className="py-8 sm:py-10">
      {/* ── Hero banner ── */}
      <div className="mb-10 overflow-hidden rounded-2xl bg-linear-to-r from-violet-700 via-indigo-600 to-sky-500 p-8 text-white shadow-xl shadow-violet-200">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-widest">
                Just Dropped
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              New Arrivals
            </h1>
            <p className="mt-1.5 max-w-lg text-sm text-violet-100">
              The freshest additions to our catalogue — curated picks across
              every category, added regularly.
            </p>
          </div>

          {/* Stats pill */}
          {totalItems > 0 && (
            <div className="shrink-0 rounded-2xl bg-white/15 px-6 py-4 text-center backdrop-blur-sm">
              <p className="text-3xl font-extrabold">{totalItems}</p>
              <p className="mt-0.5 text-xs font-medium text-violet-100 uppercase tracking-wider">
                New{totalItems === 1 ? " Item" : " Items"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <NewArrivalsFilters category={category ?? ""} />

        {totalItems > 0 && (
          <p className="shrink-0 text-sm text-gray-500">
            <span className="font-semibold text-gray-800">{totalItems}</span>{" "}
            item{totalItems !== 1 ? "s" : ""}
            {category ? ` in ${category}` : ""}
          </p>
        )}
      </div>

      {/* ── Content ── */}
      {items.length === 0 ? (
        <EmptyState category={category} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item, idx) => (
              <NewArrivalCard
                key={item.id}
                item={item}
                priority={idx < 4}
                isWishlisted={wishlistedSet.has(item.product.id)}
              />
            ))}
          </div>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div className="mt-10 flex justify-center">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                basePath="/new-arrivals"
                searchParams={preserved}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ category }: { category?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-violet-50">
        <Tag className="h-8 w-8 text-violet-300" />
      </div>
      <h2 className="text-lg font-semibold text-gray-700">No new arrivals found</h2>
      <p className="mt-1 max-w-sm text-sm text-gray-400">
        {category
          ? `No new arrivals in "${category}" at the moment. Try a different category!`
          : "No new arrivals at the moment. Check back soon for freshly added products!"}
      </p>
    </div>
  );
}
