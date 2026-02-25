// ─────────────────────────────────────────────────────────────────────────────
// New Arrival types
//
// Mirrors the Prisma `NewArrival` model — decoupled from Prisma so these types
// are safe to import in Client Components and API response bodies.
// ─────────────────────────────────────────────────────────────────────────────

/** Subset of Product fields included in every new-arrival response. */
export interface NewArrivalProduct {
  id:          string;
  title:       string;
  description: string;
  price:       number;
  stock:       number;
  category:    string;
  rating:      number;
  images:      string[];
}

/** Shape returned by list queries. */
export interface NewArrivalListItem {
  id:         string;
  featuredAt: Date;
  product:    NewArrivalProduct;
}

/** Paginated list result. */
export interface NewArrivalsResult {
  items:      NewArrivalListItem[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  limit:      number;
}

/** URL search-param shape for /new-arrivals and its child components. */
export interface NewArrivalsSearchParams {
  category?: string;
  page?:     string;
}
