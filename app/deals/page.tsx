import type { Metadata } from "next";
import { Flame, Tag } from "lucide-react";
import DealCard from "@/components/DealCard";
import DealsFilters from "@/components/DealsFilters";
import Pagination from "@/components/Pagination";
import { queryDeals } from "@/lib/queries/deal";
import { getWishlistProductIds } from "@/lib/actions/wishlist";
import { isEnabled }              from "@/lib/actions/feature-flags";
import { FLAGS }                  from "@/lib/flags";
import type { DealsSearchParams } from "@/types";

export const dynamic = "force-dynamic";


// ── Metadata ──────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "Deals — ShopNest",
  description:
    "Browse exclusive limited-time deals and flash sales. Big savings on electronics, clothing, footwear and more.",
};

// ── Page ──────────────────────────────────────────────────────────────────────

const DEALS_PER_PAGE = 12;

interface PageProps {
  searchParams?: Promise<DealsSearchParams>;
}

export default async function DealsPage({ searchParams }: PageProps) {
  const params   = await (searchParams ?? Promise.resolve({} as DealsSearchParams));
  const category = params.category?.trim() || undefined;
  const sortBy   = params.sortBy?.trim()   || "discount";
  const page     = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  // Fetch deals directly via Prisma (no HTTP round-trip)
  const { deals, totalDeals, totalPages, currentPage } = await queryDeals({
    category,
    sortBy,
    page,
    limit: DEALS_PER_PAGE,
  });

  // Pre-fetch wishlist state (server-side, null when logged out)
  const [wishlistEnabled, wishlistedIds] = await Promise.all([
    isEnabled(FLAGS.WISHLIST_ENABLED),
    getWishlistProductIds().catch(() => new Set<string>()),
  ]);
  const wishlistedSet = wishlistEnabled ? wishlistedIds : new Set<string>();

  // Preserved params for pagination links
  const preserved: Record<string, string | undefined> = {
    ...(category && { category }),
    ...(sortBy !== "discount" && { sortBy }),
  };

  return (
    <div className="py-8 sm:py-10">
      {/* ── Hero banner ── */}
      <div className="mb-10 overflow-hidden rounded-2xl bg-linear-to-r from-rose-600 via-rose-500 to-orange-400 p-8 text-white shadow-xl shadow-rose-200">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
                <Flame className="h-5 w-5 text-white" />
              </div>
              <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-widest">
                Limited Time
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Hot Deals
            </h1>
            <p className="mt-1.5 max-w-lg text-sm text-rose-100">
              Flash sales and exclusive discounts — updated regularly. Grab them
              before they&apos;re gone!
            </p>
          </div>

          {/* Stats pill */}
          {totalDeals > 0 && (
            <div className="shrink-0 rounded-2xl bg-white/15 px-6 py-4 text-center backdrop-blur-sm">
              <p className="text-3xl font-extrabold">{totalDeals}</p>
              <p className="mt-0.5 text-xs font-medium text-rose-100 uppercase tracking-wider">
                Active{totalDeals === 1 ? " Deal" : " Deals"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <DealsFilters category={category ?? ""} sortBy={sortBy} />

        {totalDeals > 0 && (
          <p className="shrink-0 text-sm text-gray-500">
            <span className="font-semibold text-gray-800">{totalDeals}</span>{" "}
            deal{totalDeals !== 1 ? "s" : ""}
            {category ? ` in ${category}` : ""}
          </p>
        )}
      </div>

      {/* ── Content ── */}
      {deals.length === 0 ? (
        <EmptyState category={category} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {deals.map((deal, idx) => (
              <DealCard
                key={deal.id}
                deal={deal}
                priority={idx < 4}
                isWishlisted={wishlistedSet.has(deal.product.id)}
                showWishlist={wishlistEnabled}
              />
            ))}
          </div>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div className="mt-10 flex justify-center">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                basePath="/deals"
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
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-50">
        <Tag className="h-8 w-8 text-rose-300" />
      </div>
      <h2 className="text-lg font-semibold text-gray-700">No deals found</h2>
      <p className="mt-1 max-w-sm text-sm text-gray-400">
        {category
          ? `There are no active deals in "${category}" right now. Check back soon!`
          : "There are no active deals right now. Check back soon — new deals drop regularly!"}
      </p>
    </div>
  );
}
