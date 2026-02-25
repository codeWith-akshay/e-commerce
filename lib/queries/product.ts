import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

// ─────────────────────────────────────────────────────────────────────────────
// Shared product query utilities
//
// Used by both the /api/products route handler AND the /products Server
// Component so the WHERE clause is defined in one place.
//
// Centralising the query:
//   • Eliminates the HTTP round-trip when the products page renders
//     server-side (no loopback fetch, no NEXT_PUBLIC_APP_URL dependency).
//   • Keeps filtering / sorting logic consistent between the API and the page.
//   • Explicit select — never return schema fields added in the future
//     (cost price, supplier id, internal notes, etc.) to the public API.
// ─────────────────────────────────────────────────────────────────────────────

// ── Constants ─────────────────────────────────────────────────────────────────

export const DEFAULT_PAGE  = 1;
export const DEFAULT_LIMIT = 12;
export const MAX_LIMIT     = 100;

const SORT_FIELDS   = ["price", "rating", "createdAt"] as const;
type  SortField     = (typeof SORT_FIELDS)[number];

// ── Types ─────────────────────────────────────────────────────────────────────

/** All fields are optional — omitted means "no filter / use default". */
export interface ProductsQuery {
  search?:    string | null;
  category?:  string | null;
  minPrice?:  number;
  maxPrice?:  number;
  minRating?: number;
  page?:      number;
  limit?:     number;
  /** One of "price" | "rating" | "createdAt". Unknown values fall back to "createdAt". */
  sortBy?:    string;
  /** "asc" | "desc". Unknown values fall back to "desc". */
  order?:     string;
}

/** Columns returned by list queries — kept trim to avoid over-fetching. */
export interface ProductListItem {
  id:          string;
  title:       string;
  description: string;
  price:       number;
  stock:       number;
  category:    string;
  rating:      number;
  images:      string[];
  createdAt:   Date;
}

export interface ProductsResult {
  products:      ProductListItem[];
  totalProducts: number;
  totalPages:    number;
  currentPage:   number;
  limit:         number;
}

// ── queryProducts ─────────────────────────────────────────────────────────────

/**
 * Execute a paginated, filtered product query directly against Prisma.
 *
 * Accepts pre-parsed, pre-validated params.
 * HTTP-level validation (price-range check, rating-range check, → 400 status)
 * stays in the route handler. Page components call this after converting URL
 * strings to numbers.
 */
export async function queryProducts(
  params: ProductsQuery = {},
): Promise<ProductsResult> {
  const { search, category, minPrice, maxPrice, minRating } = params;

  const page  = Math.max(1, params.page  ?? DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit ?? DEFAULT_LIMIT));

  const sortBy: SortField =
    SORT_FIELDS.includes(params.sortBy as SortField)
      ? (params.sortBy as SortField)
      : "createdAt";

  const order: Prisma.SortOrder =
    params.order === "asc" ? "asc" : "desc";

  // ── WHERE clause ────────────────────────────────────────────────────────────

  const where: Prisma.ProductWhereInput = {
    // Full-text search across title + description
    ...(search && {
      OR: [
        { title:       { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ],
    }),

    // Exact category filter (category is a relation — filter via nested name)
    ...(category && {
      category: { name: { equals: category, mode: "insensitive" } },
    }),

    // Price range
    ...((minPrice !== undefined || maxPrice !== undefined) && {
      price: {
        ...(minPrice !== undefined && { gte: minPrice }),
        ...(maxPrice !== undefined && { lte: maxPrice }),
      },
    }),

    // Rating floor
    ...(minRating !== undefined && {
      rating: { gte: minRating },
    }),
  };

  // ── Parallel count + paginated fetch ────────────────────────────────────────

  const skip = (page - 1) * limit;

  const [totalProducts, rawProducts] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { [sortBy]: order },
      skip,
      take: limit,
      select: {
        id:          true,
        title:       true,
        description: true,
        price:       true,
        stock:       true,
        // Select only the name from the category relation to avoid over-fetching
        category:    { select: { name: true } },
        rating:      true,
        images:      true,
        createdAt:   true,
      },
    }),
  ]);

  // Flatten the nested category object to match ProductListItem.category: string
  const products = rawProducts.map(({ category, ...p }) => ({
    ...p,
    category: category.name,
  }));

  return {
    products,
    totalProducts,
    totalPages:  Math.ceil(totalProducts / limit),
    currentPage: page,
    limit,
  };
}
