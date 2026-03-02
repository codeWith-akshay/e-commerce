"use client";

/**
 * InventorySearchFilters
 *
 * Client component that drives inventory table filtering via URL search params.
 * Debounces the search input (300 ms) so we don't push a new route on every keystroke.
 * Status filter is immediate.
 */

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, X, Loader2, Filter } from "lucide-react";

type Status = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "";

const STATUS_OPTIONS: { value: Status; label: string; color: string }[] = [
  { value: "", label: "All",     color: "text-gray-700 border-gray-300   bg-white          data-[active=true]:border-indigo-500 data-[active=true]:bg-indigo-600 data-[active=true]:text-white" },
  { value: "IN_STOCK",     label: "In Stock",     color: "text-emerald-700 border-emerald-200 bg-emerald-50                    data-[active=true]:bg-emerald-600 data-[active=true]:text-white data-[active=true]:border-emerald-600" },
  { value: "LOW_STOCK",    label: "Low Stock",    color: "text-amber-700   border-amber-200   bg-amber-50                      data-[active=true]:bg-amber-600   data-[active=true]:text-white data-[active=true]:border-amber-600" },
  { value: "OUT_OF_STOCK", label: "Out of Stock", color: "text-red-700     border-red-200     bg-red-50                        data-[active=true]:bg-red-600     data-[active=true]:text-white data-[active=true]:border-red-600" },
];

interface Props {
  currentSearch: string;
  currentStatus: Status;
}

export default function InventorySearchFilters({ currentSearch, currentStatus }: Props) {
  const router   = useRouter();
  const pathname = usePathname();
  const [search, setSearch]           = useState(currentSearch);
  const [isPending, startTransition]  = useTransition();

  // Debounce search: push URL 400 ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== currentSearch) pushURL(search, currentStatus);
    }, 400);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const pushURL = useCallback(
    (newSearch: string, newStatus: Status) => {
      const qs = new URLSearchParams();
      if (newSearch) qs.set("search", newSearch);
      if (newStatus) qs.set("status", newStatus);
      // Reset page to 1 on any filter change
      startTransition(() => {
        router.push(`${pathname}${qs.toString() ? `?${qs}` : ""}`);
      });
    },
    [router, pathname],
  );

  function handleStatusChange(s: Status) {
    setSearch(search); // keep current search value
    pushURL(search, s);
  }

  function clearSearch() {
    setSearch("");
    pushURL("", currentStatus);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search input */}
      <div className="relative flex-1 min-w-50 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search product or SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-8 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
        {search && (
          <button
            onClick={clearSearch}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Status filter pills */}
      <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
        <Filter className="ml-1.5 h-3.5 w-3.5 text-gray-400 shrink-0" />
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            data-active={currentStatus === opt.value}
            onClick={() => handleStatusChange(opt.value)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${opt.color}`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Loading spinner when navigating */}
      {isPending && (
        <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
      )}
    </div>
  );
}
