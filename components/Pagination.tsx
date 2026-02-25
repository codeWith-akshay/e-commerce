// Pagination — pure Server Component.
//
// Generic, route-agnostic pagination. Ships zero client JS — every page
// button is a plain Next.js <Link> that preserves all existing search params.
//
// Usage:
//   <Pagination
//     currentPage={3}
//     totalPages={12}
//     basePath="/products"
//     searchParams={{ category: "Electronics", search: "mac" }}
//   />
//
// The active page is omitted from the URL (canonical form) and page=1 is
// never written — both result in the clean base URL.

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface PaginationProps {
  /** Current active page (1-based). */
  currentPage: number;
  /** Total number of pages. */
  totalPages: number;
  /** Pathname to link to, e.g. "/products" or "/blog". */
  basePath: string;
  /**
   * Existing query params to preserve on every link (e.g. filters).
   * The "page" key is managed internally and will be overwritten.
   */
  searchParams?: Record<string, string | undefined>;
  /**
   * Name of the query param that controls the page number.
   * Defaults to "page".
   */
  pageParam?: string;
  /** Extra classes applied to the <nav> wrapper. */
  className?: string;
  /**
   * How many sibling pages to show on each side of the active page.
   * Defaults to 1.  Increase for wider pagination bars.
   */
  siblings?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the href for a given page number, preserving all searchParams and
 * omitting page=1 for a canonical URL.
 */
function buildHref(
  basePath: string,
  searchParams: Record<string, string | undefined>,
  pageParam: string,
  page: number
): string {
  const q = new URLSearchParams();

  Object.entries(searchParams).forEach(([k, v]) => {
    if (v && k !== pageParam) q.set(k, v);
  });

  if (page > 1) q.set(pageParam, String(page));

  const qs = q.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * Produce an array of page numbers (1-based) interspersed with -1 as an
 * ellipsis sentinel.
 *
 * Example — page 6 of 20, siblings=1:
 *   [1, -1, 5, 6, 7, -1, 20]
 */
function buildRange(
  current: number,
  total: number,
  siblings: number
): (number | -1)[] {
  // No ellipsis needed for small page counts
  const window = 2 * siblings + 5; // first + last + siblings×2 + current + 2 ellipsis slots
  if (total <= window) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const left = Math.max(current - siblings, 1);
  const right = Math.min(current + siblings, total);
  const showLeftDots = left > 2;
  const showRightDots = right < total - 1;

  const pages: (number | -1)[] = [1];
  if (showLeftDots) pages.push(-1);
  for (let i = left; i <= right; i++) {
    if (i !== 1 && i !== total) pages.push(i);
  }
  if (showRightDots) pages.push(-1);
  pages.push(total);

  return pages;
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles (defined once, kept outside the component to avoid object allocation
// on every render)
// ─────────────────────────────────────────────────────────────────────────────

const base =
  "flex h-9 min-w-9 select-none items-center justify-center rounded-xl border px-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1";

const styles = {
  active: `${base} border-indigo-600 bg-indigo-600 text-white shadow-sm`,
  default: `${base} border-gray-200 bg-white text-gray-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700`,
  disabled: `${base} cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300`,
  arrow: `${base} border-gray-200 bg-white px-3 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700`,
  arrowDisabled: `${base} cursor-not-allowed border-gray-100 bg-gray-50 px-3 text-gray-300`,
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function Pagination({
  currentPage,
  totalPages,
  basePath,
  searchParams = {},
  pageParam = "page",
  className = "",
  siblings = 1,
}: PaginationProps) {
  // Nothing to render for a single page
  if (totalPages <= 1) return null;

  const range = buildRange(currentPage, totalPages, siblings);
  const isFirst = currentPage === 1;
  const isLast = currentPage === totalPages;

  const href = (page: number) =>
    buildHref(basePath, searchParams, pageParam, page);

  return (
    <nav
      aria-label="Pagination navigation"
      className={`flex flex-wrap items-center justify-center gap-1.5 ${className}`}
    >
      {/* ── Previous ─────────────────────────────────────────────────────── */}
      {isFirst ? (
        <span aria-disabled="true" aria-label="Previous page" className={styles.arrowDisabled}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          <span className="ml-1 hidden sm:inline">Prev</span>
        </span>
      ) : (
        <Link
          href={href(currentPage - 1)}
          aria-label="Go to previous page"
          className={styles.arrow}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          <span className="ml-1 hidden sm:inline">Prev</span>
        </Link>
      )}

      {/* ── Page numbers ─────────────────────────────────────────────────── */}
      {range.map((page, idx) => {
        if (page === -1) {
          return (
            <span
              key={`dots-${idx}`}
              aria-hidden="true"
              className="flex h-9 w-6 items-center justify-center text-sm text-gray-400"
            >
              …
            </span>
          );
        }

        if (page === currentPage) {
          return (
            <span
              key={page}
              aria-current="page"
              aria-label={`Page ${page}, current page`}
              className={styles.active}
            >
              {page}
            </span>
          );
        }

        return (
          <Link
            key={page}
            href={href(page)}
            aria-label={`Go to page ${page}`}
            className={styles.default}
          >
            {page}
          </Link>
        );
      })}

      {/* ── Next ─────────────────────────────────────────────────────────── */}
      {isLast ? (
        <span aria-disabled="true" aria-label="Next page" className={styles.arrowDisabled}>
          <span className="mr-1 hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </span>
      ) : (
        <Link
          href={href(currentPage + 1)}
          aria-label="Go to next page"
          className={styles.arrow}
        >
          <span className="mr-1 hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}
    </nav>
  );
}
