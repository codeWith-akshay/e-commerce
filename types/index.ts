// ─────────────────────────────────────────────────────────────────────────────
// Domain Types
// Mirrors the Prisma schema — but decoupled so they can be used in
// client components and API responses without importing Prisma directly.
// ─────────────────────────────────────────────────────────────────────────────

// ── User & Role ───────────────────────────────────────────────────────────────
// Single source of truth lives in ./user. Re-exported here so callers can use
// either `import from "@/types"` or `import from "@/types/user"`.
export type { Role, IUser, IUser as User, PaginatedUsersResponse } from "./user";

// ── Core Models ──────────────────────────────────────────────────────────────

// Re-exported from dedicated files — import directly from there when you only
// need a single type, or from "@/types" for everything at once.
export type { Product } from "./product";
export type { CartItem } from "./cart";
export type { WishlistItem, WishlistToggleResult } from "./wishlist";
export type { NewsletterSubscription, NewsletterSubscribeResult } from "./newsletter";
export type { DealProduct, DealListItem, DealsResult, DealsSearchParams } from "./deal";
export type { NewArrivalProduct, NewArrivalListItem, NewArrivalsResult, NewArrivalsSearchParams } from "./new-arrival";

// ── Navigation ───────────────────────────────────────────────────────────────

export interface NavLinkChild {
  label: string;
  href: string;
}

export interface NavLink {
  label: string;
  href: string;
  children?: NavLinkChild[];
}

export interface FooterLink {
  label: string;
  href: string;
}

// ── API Shapes ───────────────────────────────────────────────────────────────

/** Response shape for GET /api/cart/count */
export interface CartCountResponse {
  count: number;
}

/** Generic API error response */
export interface ApiError {
  error: string;
  status?: number;
}

// ── UI Helpers ───────────────────────────────────────────────────────────────

export interface SocialLink {
  label: string;
  href: string;
  /**
   * Lucide icon component — typed as React.ComponentType so client and
   * server components can both use it without pulling in lucide types directly.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon: React.ComponentType<any>;
  hoverColor: string;
}

export interface FooterPerk {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon: React.ComponentType<any>;
  label: string;
  desc: string;
}

// ── Products page ────────────────────────────────────────────────────────────

/** URL search-param shape for /products and its child components. */
export interface ProductsSearchParams {
  search?: string;
  category?: string;
  minPrice?: string;
  maxPrice?: string;
  minRating?: string;
  page?: string;
  sortBy?: string;
  order?: string;
}
