// ─────────────────────────────────────────────────────────────────────────────
// Deal types
//
// Mirrors the Prisma `Deal` model — decoupled from Prisma so these types are
// safe to import in Client Components and API response bodies.
// ─────────────────────────────────────────────────────────────────────────────

/** Subset of Product fields included in every deal response. */
export interface DealProduct {
  id:          string;
  title:       string;
  description: string;
  price:       number;
  stock:       number;
  category:    string;
  rating:      number;
  images:      string[];
}

/** Shape returned by list and detail queries. */
export interface DealListItem {
  id:              string;
  discountPercent: number;
  badgeLabel:      string;
  startsAt:        Date;
  endsAt:          Date;
  product:         DealProduct;
}

/** Paginated list result. */
export interface DealsResult {
  deals:      DealListItem[];
  totalDeals: number;
  totalPages: number;
  currentPage: number;
  limit:      number;
}

/** URL search-param shape for /deals and its child components. */
export interface DealsSearchParams {
  category?: string;
  sortBy?:   string;   // "discount" | "price:asc" | "price:desc" | "endingSoon"
  page?:     string;
}
