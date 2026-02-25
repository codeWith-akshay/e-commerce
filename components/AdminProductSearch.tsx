"use client";

// AdminProductSearch — client island.
//
// Receives the base path and current search params from the parent Server
// Component so this component does NOT need usePathname / useSearchParams.
// Those hooks required a <Suspense> boundary and opted the whole subtree into
// dynamic rendering; passing props instead keeps things simpler and lighter.

import { useRouter } from "next/navigation";
import { useTransition, useRef } from "react";
import { Search, X } from "lucide-react";

export default function AdminProductSearch({
  defaultValue = "",
  placeholder  = "Search products\u2026",
  paramName    = "search",
  basePath,
  currentParams = {},
}: {
  defaultValue?: string;
  placeholder?:  string;
  paramName?:    string;
  /** Pathname to push to, e.g. "/admin/products". */
  basePath: string;
  /** All current search params from the parent page. */
  currentParams?: Record<string, string | undefined>;
}) {
  const router   = useRouter();
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function submit(value: string) {
    const next = new URLSearchParams();
    // Preserve all current params except the search param and page.
    for (const [k, v] of Object.entries(currentParams)) {
      if (k !== paramName && k !== "page" && v) next.set(k, v);
    }
    if (value.trim()) next.set(paramName, value.trim());
    // page intentionally omitted — resets to 1 on new search.
    const qs = next.toString();
    startTransition(() => router.push(qs ? `${basePath}?${qs}` : basePath));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") submit(e.currentTarget.value);
  }

  function clear() {
    if (inputRef.current) inputRef.current.value = "";
    submit("");
  }

  return (
    <div className="relative w-full max-w-xs">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        ref={inputRef}
        type="search"
        defaultValue={defaultValue}
        placeholder={placeholder}
        onKeyDown={handleKeyDown}
        className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-8 text-sm text-slate-700 placeholder:text-slate-400 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-60"
        disabled={pending}
        aria-label={placeholder}
      />
      {defaultValue && !pending && (
        <button
          onClick={clear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
