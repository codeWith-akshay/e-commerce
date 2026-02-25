import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

// ─────────────────────────────────────────────────────────────────────────────
// Shared new-arrival query utilities
//
// Used by both the /api/new-arrivals route handler AND the /new-arrivals Server
// Component to avoid the HTTP round-trip.
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_PAGE  = 1;
export const DEFAULT_LIMIT = 12;
export const MAX_LIMIT     = 100;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NewArrivalsQuery {
  category?: string | null;
  page?:     number;
  limit?:    number;
}

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

export interface NewArrivalListItem {
  id:         string;
  featuredAt: Date;
  product:    NewArrivalProduct;
}

export interface NewArrivalsResult {
  items:       NewArrivalListItem[];
  totalItems:  number;
  totalPages:  number;
  currentPage: number;
  limit:       number;
}

// ── Select shape ──────────────────────────────────────────────────────────────

// Raw DB row returned by the JOIN query
interface RawNewArrivalRow {
  id:          string;
  featuredAt:  Date;
  productId:   string;
  title:       string;
  description: string;
  price:       number;
  stock:       number;
  rating:      number;
  images:      string[];
  category:    string;
}

function rowToNewArrivalListItem(row: RawNewArrivalRow): NewArrivalListItem {
  return {
    id:         row.id,
    featuredAt: row.featuredAt,
    product: {
      id:          row.productId,
      title:       row.title,
      description: row.description,
      price:       Number(row.price),
      stock:       Number(row.stock),
      category:    row.category,
      rating:      Number(row.rating),
      images:      row.images,
    },
  };
}

// ── queryNewArrivals ──────────────────────────────────────────────────────────

/**
 * Execute a paginated new-arrivals query using a single JOIN across
 * new_arrivals, products, and categories. Ordered by `featuredAt DESC`.
 *
 * Fires exactly 2 DB queries (data + count) regardless of result size,
 * instead of the 4 queries Prisma’s ORM generates via its
 * “select-in” relation-loading strategy.
 */
export async function queryNewArrivals(
  params: NewArrivalsQuery = {},
): Promise<NewArrivalsResult> {
  const { category } = params;

  const page  = Math.max(1, params.page  ?? DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit ?? DEFAULT_LIMIT));
  const skip  = (page - 1) * limit;

  // Optional category filter — parameterised, never interpolated raw.
  const categoryFilter = category
    ? Prisma.sql`AND LOWER(c.name) = LOWER(${category})`
    : Prisma.empty;

  const [rawItems, countResult] = await Promise.all([
    prisma.$queryRaw<RawNewArrivalRow[]>(Prisma.sql`
      SELECT
        na.id,
        na."featuredAt",
        p.id            AS "productId",
        p.title,
        p.description,
        p.price,
        p.stock,
        p.rating,
        p.images,
        c.name          AS category
      FROM new_arrivals na
      JOIN products    p ON p.id  = na."productId"
      JOIN categories  c ON c.id  = p."categoryId"
      WHERE na."isActive" = true
        ${categoryFilter}
      ORDER BY na."featuredAt" DESC
      LIMIT  ${limit}
      OFFSET ${skip}
    `),

    prisma.$queryRaw<[{ count: bigint }]>(Prisma.sql`
      SELECT COUNT(*) AS count
      FROM new_arrivals na
      JOIN products    p ON p.id  = na."productId"
      JOIN categories  c ON c.id  = p."categoryId"
      WHERE na."isActive" = true
        ${categoryFilter}
    `),
  ]);

  const totalItems = Number(countResult[0].count);

  return {
    items:       rawItems.map(rowToNewArrivalListItem),
    totalItems,
    totalPages:  Math.max(1, Math.ceil(totalItems / limit)),
    currentPage: page,
    limit,
  };
}
