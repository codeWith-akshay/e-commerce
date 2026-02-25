"use client";

// DealsFilters — Client Component.
// Updates the URL search params when the user changes category or sort,
// triggering the Server Component to re-render with new query results.

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, Tag } from "lucide-react";

const CATEGORIES = [
  "Electronics",
  "Clothing",
  "Footwear",
  "Sports & Fitness",
  "Kitchen & Home",
  "Furniture",
  "Stationery",
];

const SORT_OPTIONS = [
  { value: "discount",   label: "Biggest Discount" },
  { value: "endingSoon", label: "Ending Soon" },
  { value: "price:asc",  label: "Price: Low → High" },
  { value: "price:desc", label: "Price: High → Low" },
];

interface DealsFiltersProps {
  category?: string;
  sortBy?:   string;
}

export default function DealsFilters({ category = "", sortBy = "discount" }: DealsFiltersProps) {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const push = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      // Reset page on filter change
      params.delete("page");
      for (const [key, val] of Object.entries(updates)) {
        if (val) params.set(key, val);
        else params.delete(key);
      }
      router.push(`/deals?${params.toString()}`);
    },
    [router, searchParams],
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Category */}
      <div className="relative flex items-center">
        <Tag className="pointer-events-none absolute left-3 h-4 w-4 text-gray-400" />
        <select
          value={category}
          onChange={(e) => push({ category: e.target.value || undefined })}
          className="h-10 appearance-none rounded-full border border-gray-200 bg-white pl-9 pr-8 text-sm text-gray-700 shadow-sm transition hover:border-rose-300 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
          aria-label="Filter by category"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Sort */}
      <div className="relative flex items-center">
        <SlidersHorizontal className="pointer-events-none absolute left-3 h-4 w-4 text-gray-400" />
        <select
          value={sortBy}
          onChange={(e) => push({ sortBy: e.target.value })}
          className="h-10 appearance-none rounded-full border border-gray-200 bg-white pl-9 pr-8 text-sm text-gray-700 shadow-sm transition hover:border-rose-300 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
          aria-label="Sort deals"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Clear */}
      {(category || sortBy !== "discount") && (
        <button
          onClick={() => push({ category: undefined, sortBy: undefined })}
          className="h-10 rounded-full border border-gray-200 bg-white px-4 text-sm text-gray-500 shadow-sm transition hover:border-rose-300 hover:text-rose-600"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
