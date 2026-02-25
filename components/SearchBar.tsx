"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Search, Loader2, X, ArrowRight } from "lucide-react";
import type { SearchResult } from "@/app/api/search/route";

// ─────────────────────────────────────────────────────────────────────────────
// SearchBar
//
// Self-contained client component for the header search.
//
// Behaviour:
//   • Debounces input 300 ms → GET /api/search?q=...
//   • Shows a floating dropdown with up to 6 live results
//   • Arrow keys navigate results; Enter opens the highlighted product
//   • Pressing Enter with no highlighted item → /products?search=<query>
//   • Clicking a result → /products/[id]
//   • "See all results" footer → /products?search=<query>
//   • Escape / click-outside closes the dropdown
//   • Works identically for desktop and mobile (controlled via `inputId`)
// ─────────────────────────────────────────────────────────────────────────────

interface SearchBarProps {
  /** id forwarded to the <input> — must be unique per page */
  inputId: string;
  /** Extra class applied to the outer wrapper */
  className?: string;
  /** Ref forwarded to the <input> so the parent can programmatically focus */
  inputRef?: React.RefObject<HTMLInputElement | null>;
  placeholder?: string;
}

const DEBOUNCE_MS = 300;

export default function SearchBar({
  inputId,
  className = "",
  inputRef,
  placeholder = "Search products, brands, categories…",
}: SearchBarProps) {
  const router = useRouter();

  const [query,    setQuery]    = useState("");
  const [results,  setResults]  = useState<SearchResult[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [open,     setOpen]     = useState(false);
  const [cursor,   setCursor]   = useState(-1);   // keyboard-nav index

  const wrapperRef  = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef    = useRef<AbortController | null>(null);

  // ── Fetch results ────────────────────────────────────────────────────────

  const fetchResults = useCallback(async (q: string) => {
    // Cancel any in-flight request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q)}&limit=6`,
        { signal: abortRef.current.signal },
      );
      if (!res.ok) throw new Error("search failed");
      const data: SearchResult[] = await res.json();
      setResults(data);
      setCursor(-1);
      setOpen(true);
    } catch (err: unknown) {
      // Ignore abort errors — they fire on every rapid keystroke
      if (err instanceof Error && err.name !== "AbortError") {
        setResults([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Debounce on input change ───────────────────────────────────────────

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setQuery(val);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (val.trim().length === 0) {
        setResults([]);
        setOpen(false);
        setLoading(false);
        return;
      }

      setLoading(true); // optimistic spinner before debounce fires
      debounceRef.current = setTimeout(() => fetchResults(val.trim()), DEBOUNCE_MS);
    },
    [fetchResults],
  );

  // ── Keyboard navigation ───────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (!open) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((prev) => Math.max(prev - 1, -1));
      } else if (e.key === "Escape") {
        setOpen(false);
        setCursor(-1);
      }
    },
    [open, results.length],
  );

  // ── Form submit — navigate to full search page ──────────────────────

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = query.trim();
      if (!trimmed) return;

      if (cursor >= 0 && results[cursor]) {
        // A result is highlighted — navigate directly to that product
        router.push(`/products/${results[cursor].id}`);
      } else {
        router.push(`/products?search=${encodeURIComponent(trimmed)}`);
      }
      setOpen(false);
    },
    [query, cursor, results, router],
  );

  // ── Click on a result ────────────────────────────────────────────────

  const handleResultClick = useCallback(
    (id: string) => {
      router.push(`/products/${id}`);
      setOpen(false);
      setQuery("");
    },
    [router],
  );

  // ── Click "See all results" ──────────────────────────────────────────

  const handleSeeAll = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`/products?search=${encodeURIComponent(trimmed)}`);
    setOpen(false);
  }, [query, router]);

  // ── Clear button ─────────────────────────────────────────────────────

  const handleClear = useCallback(() => {
    setQuery("");
    setResults([]);
    setOpen(false);
    setCursor(-1);
    if (inputRef) {
      (inputRef as React.RefObject<HTMLInputElement>).current?.focus();
    }
  }, [inputRef]);

  // ── Close on click outside ───────────────────────────────────────────

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // ── Cleanup on unmount ───────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────

  const showDropdown = open && query.trim().length > 0;

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <form onSubmit={handleSubmit} role="search" autoComplete="off">
        <label htmlFor={inputId} className="sr-only">
          Search products
        </label>

        {/* Input wrapper */}
        <div className="relative">
          {/* Search icon / loader */}
          <div
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2"
            aria-hidden="true"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
            ) : (
              <Search className="h-4 w-4 text-gray-400" />
            )}
          </div>

          <input
            id={inputId}
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="search"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showDropdown}
            aria-controls={`${inputId}-listbox`}
            aria-activedescendant={
              cursor >= 0 ? `${inputId}-result-${cursor}` : undefined
            }
            placeholder={placeholder}
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (results.length > 0) setOpen(true);
            }}
            className="w-full rounded-full border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-9 text-sm text-gray-900 placeholder-gray-400 outline-none ring-offset-2 transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-200"
          />

          {/* Clear button — only when there's text */}
          {query.length > 0 && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-gray-400 transition hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </form>

      {/* ── Dropdown ── */}
      {showDropdown && (
        <div
          id={`${inputId}-listbox`}
          role="listbox"
          aria-label="Search results"
          className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-150"
        >
          {results.length === 0 && !loading ? (
            /* No results */
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Search className="h-8 w-8 text-gray-200" strokeWidth={1.5} />
              <p className="text-sm font-medium text-gray-500">
                No products found for &ldquo;{query}&rdquo;
              </p>
              <p className="text-xs text-gray-400">
                Try a different keyword or browse all products.
              </p>
            </div>
          ) : (
            <>
              {/* Result list */}
              <ul className="divide-y divide-gray-50 py-1">
                {results.map((r, i) => (
                  <li
                    key={r.id}
                    id={`${inputId}-result-${i}`}
                    role="option"
                    aria-selected={cursor === i}
                  >
                    <button
                      type="button"
                      onClick={() => handleResultClick(r.id)}
                      onMouseEnter={() => setCursor(i)}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${
                        cursor === i ? "bg-indigo-50" : "hover:bg-gray-50"
                      }`}
                    >
                      {/* Thumbnail */}
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
                        {r.image ? (
                          <Image
                            src={r.image}
                            alt={r.title}
                            fill
                            sizes="40px"
                            className="object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-lg">
                            🛍️
                          </span>
                        )}
                      </div>

                      {/* Text */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {r.title}
                        </p>
                        <p className="text-xs text-gray-500">{r.category}</p>
                      </div>

                      {/* Price */}
                      <span className="shrink-0 text-sm font-bold text-indigo-600">
                        ${r.price.toFixed(2)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              {/* Footer — "See all results" */}
              <div className="border-t border-gray-100 px-4 py-2.5">
                <button
                  type="button"
                  onClick={handleSeeAll}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50"
                >
                  <span>
                    See all results for &ldquo;{query}&rdquo;
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
