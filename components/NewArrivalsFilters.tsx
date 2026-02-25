"use client";

// NewArrivalsFilters — Client Component.

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tag } from "lucide-react";

const CATEGORIES = [
  "Electronics",
  "Clothing",
  "Footwear",
  "Sports & Fitness",
  "Kitchen & Home",
  "Furniture",
  "Stationery",
];

interface NewArrivalsFiltersProps {
  category?: string;
}

export default function NewArrivalsFilters({ category = "" }: NewArrivalsFiltersProps) {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const push = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("page");
      for (const [key, val] of Object.entries(updates)) {
        if (val) params.set(key, val);
        else params.delete(key);
      }
      router.push(`/new-arrivals?${params.toString()}`);
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
          className="h-10 appearance-none rounded-full border border-gray-200 bg-white pl-9 pr-8 text-sm text-gray-700 shadow-sm transition hover:border-violet-300 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
          aria-label="Filter by category"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Clear */}
      {category && (
        <button
          onClick={() => push({ category: undefined })}
          className="h-10 rounded-full border border-gray-200 bg-white px-4 text-sm text-gray-500 shadow-sm transition hover:border-violet-300 hover:text-violet-600"
        >
          Clear filter
        </button>
      )}
    </div>
  );
}
