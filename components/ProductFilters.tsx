"use client";

// ProductFilters — the ONLY client component on the products page.
// All it does is update URL search params; the server re-renders the grid.
// Kept deliberately small to minimise the client JS bundle.

import { useRef, useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, SlidersHorizontal, X, ChevronDown } from "lucide-react";
import type { ProductsSearchParams } from "@/types";

interface ProductFiltersProps {
  categories: string[];
  currentParams: ProductsSearchParams;
}

const SORT_OPTIONS = [
  { value: "createdAt:desc", label: "Newest first" },
  { value: "createdAt:asc", label: "Oldest first" },
  { value: "price:asc", label: "Price: low → high" },
  { value: "price:desc", label: "Price: high → low" },
  { value: "rating:desc", label: "Top rated" },
] as const;

const RATING_OPTIONS = [
  { value: "", label: "Any rating" },
  { value: "4", label: "4 ★ & above" },
  { value: "3", label: "3 ★ & above" },
  { value: "2", label: "2 ★ & above" },
] as const;

export default function ProductFilters({
  categories,
  currentParams,
}: ProductFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Local state (mirrors URL; only search is debounced) ─────────────────
  const [search, setSearch] = useState(currentParams.search ?? "");
  const [showAdvanced, setShowAdvanced] = useState(
    !!(
      currentParams.minPrice ||
      currentParams.maxPrice ||
      currentParams.minRating
    )
  );

  // Sync local search input when the URL param changes externally
  // (e.g. browser back/forward navigation).
  // React-recommended pattern: track the previous prop value in state and
  // update during render instead of inside a useEffect body, which avoids
  // the cascading-render problem the linter warns about.
  const [prevSearchParam, setPrevSearchParam] = useState(currentParams.search);
  if (prevSearchParam !== currentParams.search) {
    setPrevSearchParam(currentParams.search);
    setSearch(currentParams.search ?? "");
  }

  // ── URL update helper ────────────────────────────────────────────────────
  function pushParams(
    updates: Partial<ProductsSearchParams> & { _resetPage?: boolean }
  ) {
    const { _resetPage, ...rest } = updates;
    const next: ProductsSearchParams = { ...currentParams, ...rest };

    // Reset to page 1 whenever filters change
    if (_resetPage !== false) delete next.page;

    const q = new URLSearchParams();
    (Object.entries(next) as [string, string | undefined][]).forEach(
      ([k, v]) => {
        if (v && v.trim() !== "") q.set(k, v.trim());
      }
    );

    startTransition(() => {
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    });
  }

  // ── Debounced search ─────────────────────────────────────────────────────
  function handleSearchChange(value: string) {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushParams({ search: value || undefined });
    }, 400);
  }

  // ── Sort (combined sortBy + order in one select) ─────────────────────────
  const currentSort = `${currentParams.sortBy ?? "createdAt"}:${currentParams.order ?? "desc"}`;

  function handleSortChange(value: string) {
    const [sortBy, order] = value.split(":") as [string, "asc" | "desc"];
    pushParams({ sortBy, order });
  }

  // ── Active filter count (for badge) ─────────────────────────────────────
  const activeCount = [
    currentParams.category,
    currentParams.minPrice,
    currentParams.maxPrice,
    currentParams.minRating,
    currentParams.search,
  ].filter(Boolean).length;

  function clearAll() {
    setSearch("");
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div
      className={`mb-8 space-y-3 transition-opacity duration-200 ${isPending ? "opacity-60 pointer-events-none" : "opacity-100"}`}
    >
      {/* ── Primary row: search + category + sort ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-56 max-w-sm">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
          <label htmlFor="product-search" className="sr-only">
            Search products
          </label>
          <input
            id="product-search"
            type="search"
            placeholder="Search products…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full rounded-full border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-200"
          />
          {search && (
            <button
              aria-label="Clear search"
              onClick={() => handleSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-gray-400 hover:text-gray-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Category */}
        <div className="relative">
          <label htmlFor="category-filter" className="sr-only">
            Filter by category
          </label>
          <select
            id="category-filter"
            value={currentParams.category ?? ""}
            onChange={(e) =>
              pushParams({ category: e.target.value || undefined })
            }
            className="appearance-none rounded-full border border-gray-200 bg-gray-50 py-2.5 pl-4 pr-9 text-sm text-gray-700 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-200"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
        </div>

        {/* Sort */}
        <div className="relative">
          <label htmlFor="sort-filter" className="sr-only">
            Sort by
          </label>
          <select
            id="sort-filter"
            value={currentSort}
            onChange={(e) => handleSortChange(e.target.value)}
            className="appearance-none rounded-full border border-gray-200 bg-gray-50 py-2.5 pl-4 pr-9 text-sm text-gray-700 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-200"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
        </div>

        {/* Advanced toggle */}
        <button
          onClick={() => setShowAdvanced((p) => !p)}
          className={`flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-sm font-medium transition ${
            showAdvanced
              ? "border-indigo-300 bg-indigo-50 text-indigo-700"
              : "border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100"
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          Filters
          {activeCount > 0 && (
            <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
              {activeCount}
            </span>
          )}
        </button>

        {/* Clear all */}
        {activeCount > 0 && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-red-500"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Clear all
          </button>
        )}
      </div>

      {/* ── Advanced row: price range + rating ── */}
      {showAdvanced && (
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4">
          {/* Min price */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="min-price"
              className="text-xs font-medium text-gray-500"
            >
              Min price ($)
            </label>
            <input
              id="min-price"
              type="number"
              min={0}
              placeholder="0"
              defaultValue={currentParams.minPrice ?? ""}
              onBlur={(e) =>
                pushParams({ minPrice: e.target.value || undefined })
              }
              className="w-28 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          {/* Max price */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="max-price"
              className="text-xs font-medium text-gray-500"
            >
              Max price ($)
            </label>
            <input
              id="max-price"
              type="number"
              min={0}
              placeholder="Any"
              defaultValue={currentParams.maxPrice ?? ""}
              onBlur={(e) =>
                pushParams({ maxPrice: e.target.value || undefined })
              }
              className="w-28 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          {/* Min rating */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="min-rating"
              className="text-xs font-medium text-gray-500"
            >
              Min rating
            </label>
            <div className="relative">
              <select
                id="min-rating"
                value={currentParams.minRating ?? ""}
                onChange={(e) =>
                  pushParams({ minRating: e.target.value || undefined })
                }
                className="appearance-none w-36 rounded-xl border border-gray-200 bg-white py-2 pl-3 pr-8 text-sm text-gray-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
              >
                {RATING_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
