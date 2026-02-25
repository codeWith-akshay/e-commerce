import type { Product } from "./product";

// ─────────────────────────────────────────────────────────────────────────────
// Wishlist Types
// Mirrors the Prisma Wishlist model — decoupled for use in client components
// and API responses without importing Prisma directly.
// ─────────────────────────────────────────────────────────────────────────────

export interface WishlistItem {
  id: string;
  userId: string;
  productId: string;
  createdAt: Date;
  product: Product;
}

/** Lightweight shape used for toggle responses and client-side state */
export interface WishlistToggleResult {
  wishlisted: boolean;
  productId: string;
}
