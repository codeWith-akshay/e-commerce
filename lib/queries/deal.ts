import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

// ─────────────────────────────────────────────────────────────────────────────
// Shared deal query utilities
//
// Used by both the /api/deals route handler AND the /deals Server Component to
// avoid the HTTP round-trip and keep filtering logic in one place.
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_PAGE  = 1;
export const DEFAULT_LIMIT = 12;
export const MAX_LIMIT     = 100;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DealsQuery {
  category?: string | null;
  page?:     number;
  limit?:    number;
  /** "discount" (default) | "price:asc" | "price:desc" | "endingSoon" */
  sortBy?:   string;
}

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

export interface DealListItem {
  id:              string;
  discountPercent: number;
  badgeLabel:      string;
  startsAt:        Date;
  endsAt:          Date;
  product:         DealProduct;
}

export interface DealsResult {
  deals:       DealListItem[];
  totalDeals:  number;
  totalPages:  number;
  currentPage: number;
  limit:       number;
}

// ── Select shape ──────────────────────────────────────────────────────────────

// Raw DB row returned by the JOIN query
interface RawDealRow {
  id:              string;
  discountPercent: number;
  badgeLabel:      string;
  startsAt:        Date;
  endsAt:          Date;
  productId:       string;
  title:           string;
  description:     string;
  price:           number;
  stock:           number;
  rating:          number;
  images:          string[];
  category:        string;
}

function rowToDealListItem(row: RawDealRow): DealListItem {
  return {
    id:              row.id,
    discountPercent: Number(row.discountPercent),
    badgeLabel:      row.badgeLabel,
    startsAt:        row.startsAt,
    endsAt:          row.endsAt,
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

// ── queryDeals ────────────────────────────────────────────────────────────────

/**
 * Execute a paginated deal query using a single JOIN across deals, products,
 * and categories. Only returns deals whose `isActive` flag is true AND whose
 * date window includes the current moment (i.e. startsAt ≤ now < endsAt).
 *
 * Fires exactly 2 DB queries (data + count) regardless of result size,
 * instead of the 4 queries Prisma’s ORM generates via its
 * “select-in” relation-loading strategy.
 */
export async function queryDeals(params: DealsQuery = {}): Promise<DealsResult> {
  const { category } = params;
  const now = new Date();

  const page  = Math.max(1, params.page  ?? DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit ?? DEFAULT_LIMIT));
  const skip  = (page - 1) * limit;

  // ORDER BY — built from a controlled set; Prisma.raw is safe here because
  // the value never comes directly from raw user input.
  let orderClause: Prisma.Sql;
  switch (params.sortBy) {
    case "price:asc":  orderClause = Prisma.raw(`p.price ASC`);             break;
    case "price:desc": orderClause = Prisma.raw(`p.price DESC`);            break;
    case "endingSoon": orderClause = Prisma.raw(`d."endsAt" ASC`);           break;
    default:           orderClause = Prisma.raw(`d."discountPercent" DESC`); break;
  }

  // Optional category filter — value is parameterised, never interpolated raw.
  const categoryFilter = category
    ? Prisma.sql`AND LOWER(c.name) = LOWER(${category})`
    : Prisma.empty;

  const [rawDeals, countResult] = await Promise.all([
    prisma.$queryRaw<RawDealRow[]>(Prisma.sql`
      SELECT
        d.id,
        d."discountPercent",
        d."badgeLabel",
        d."startsAt",
        d."endsAt",
        p.id                AS "productId",
        p.title,
        p.description,
        p.price,
        p.stock,
        p.rating,
        p.images,
        c.name              AS category
      FROM deals d
      JOIN products    p ON p.id = d."productId"
      JOIN categories  c ON c.id = p."categoryId"
      WHERE d."isActive" = true
        AND d."startsAt" <= ${now}
        AND d."endsAt"   >  ${now}
        ${categoryFilter}
      ORDER BY ${orderClause}
      LIMIT  ${limit}
      OFFSET ${skip}
    `),

    prisma.$queryRaw<[{ count: bigint }]>(Prisma.sql`
      SELECT COUNT(*) AS count
      FROM deals d
      JOIN products    p ON p.id = d."productId"
      JOIN categories  c ON c.id = p."categoryId"
      WHERE d."isActive" = true
        AND d."startsAt" <= ${now}
        AND d."endsAt"   >  ${now}
        ${categoryFilter}
    `),
  ]);

  const totalDeals = Number(countResult[0].count);

  return {
    deals:       rawDeals.map(rowToDealListItem),
    totalDeals,
    totalPages:  Math.max(1, Math.ceil(totalDeals / limit)),
    currentPage: page,
    limit,
  };
}
