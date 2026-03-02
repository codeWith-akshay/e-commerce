/**
 * GET /api/search
 *
 * Unified product search endpoint:
 *   • Full-text search over title (3×) and description (1×)
 *   • Typo-tolerant fuzzy matching (up to 2 typos)
 *   • Category and price-range facet filters
 *   • Rating floor + in-stock filter
 *   • Pagination + configurable sort
 *
 * Always falls back to Prisma ILIKE when Typesense is not configured so
 * local development works without a running Typesense instance.
 *
 * Query parameters
 * ────────────────
 *   q           search term (empty → returns all)
 *   category    exact category name filter
 *   minPrice    numeric price lower bound
 *   maxPrice    numeric price upper bound
 *   minRating   numeric rating lower bound (0–5)
 *   inStock     "true" → only stock > 0
 *   page        1-based page number           default: 1
 *   limit       results per page              default: 12, max: 48
 *   sortBy      price | rating | createdAt    default: createdAt
 *   order       asc | desc                    default: desc
 *
 * Response shape
 * ──────────────
 *   {
 *     hits:       SearchHit[],
 *     totalHits:  number,
 *     totalPages: number,
 *     page:       number,
 *     facets?: { categories: { value, count }[] },
 *     source: "typesense" | "prisma"
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTypesenseClient, PRODUCTS_COLLECTION, type ProductDocument } from "@/lib/search/typesense";
import { queryProducts } from "@/lib/queries/product";

// ─────────────────────────────────────────────────────────────────────────────
// Response types (exported so the frontend can import them)
// ─────────────────────────────────────────────────────────────────────────────

export interface SearchHit {
  id:          string;
  title:       string;
  description: string;
  slug:        string;
  price:       number;
  stock:       number;
  rating:      number;
  category:    string;
  images:      string[];
}

export interface FacetCount { value: string; count: number }

export interface SearchResponse {
  hits:       SearchHit[];
  totalHits:  number;
  totalPages: number;
  page:       number;
  facets?:    { categories: FacetCount[] };
  source:     "typesense" | "prisma";
}

// ─────────────────────────────────────────────────────────────────────────────
// Input validation
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 12;
const MAX_LIMIT     = 48;

const querySchema = z.object({
  q:         z.string().default(""),
  category:  z.string().optional(),
  minPrice:  z.coerce.number().nonnegative().optional(),
  maxPrice:  z.coerce.number().nonnegative().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  inStock:   z.enum(["true", "false"]).optional(),
  page:      z.coerce.number().int().positive().default(1),
  limit:     z.coerce.number().int().positive().max(MAX_LIMIT).default(DEFAULT_LIMIT),
  sortBy:    z.enum(["price", "rating", "createdAt"]).default("createdAt"),
  order:     z.enum(["asc", "desc"]).default("desc"),
});

type SearchParams = z.infer<typeof querySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const raw    = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = querySchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const params = parsed.data;
  const client = getTypesenseClient();

  try {
    // ── Branch: Typesense available ─────────────────────────────────────────
    if (client) {
      const data = await typesenseSearch(client, params);
      return NextResponse.json(data, {
        headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
      });
    }

    // ── Fallback: Prisma ILIKE ───────────────────────────────────────────────
    const data = await prismaFallback(params);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[GET /api/search]", err);
    return NextResponse.json({ error: "Search failed. Please try again." }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Typesense search
// ─────────────────────────────────────────────────────────────────────────────

async function typesenseSearch(
  client: NonNullable<ReturnType<typeof getTypesenseClient>>,
  p:      SearchParams,
): Promise<SearchResponse> {
  // ── filter_by expression ──────────────────────────────────────────────────
  const filters: string[] = ["isActive:=true"];
  if (p.category)               filters.push(`category:=\`${p.category}\``);
  if (p.minPrice  !== undefined) filters.push(`price:>=${p.minPrice}`);
  if (p.maxPrice  !== undefined) filters.push(`price:<=${p.maxPrice}`);
  if (p.minRating !== undefined) filters.push(`rating:>=${p.minRating}`);
  if (p.inStock === "true")      filters.push("stock:>0");

  // ── sort_by expression ────────────────────────────────────────────────────
  const sortMap: Record<string, string> = {
    price:     `price:${p.order}`,
    rating:    `rating:${p.order}`,
    createdAt: `createdAt:${p.order}`,
  };

  const result = await client
    .collections<ProductDocument>(PRODUCTS_COLLECTION)
    .documents()
    .search({
      // "*" returns all documents when no user query is supplied
      q:               p.q || "*",

      // Title is searched at 3× weight vs description
      query_by:         "title,description",
      query_by_weights: "3,1",

      // Fuzzy: allow up to 2 typos (Typesense auto-scales by token length)
      num_typos:        "2",

      // Prefix matching on last token for "as-you-type" UX
      prefix:           "true",

      filter_by:        filters.join(" && "),
      sort_by:          sortMap[p.sortBy] ?? `createdAt:${p.order}`,

      // Facets — bucket counts for the category filter UI
      facet_by:         "category",
      max_facet_values: 50,

      page:     p.page,
      per_page: p.limit,
    });

  const hits: SearchHit[] = (result.hits ?? []).map((h) => {
    const doc = h.document;
    return {
      id:          doc.id,
      title:       doc.title,
      description: doc.description,
      slug:        doc.slug,
      price:       doc.price,
      stock:       doc.stock,
      rating:      doc.rating,
      category:    doc.category,
      images:      doc.images ?? [],
    };
  });

  const catFacet  = result.facet_counts?.find((f) => f.field_name === "category");
  const totalHits = result.found ?? 0;

  return {
    hits,
    totalHits,
    totalPages: Math.ceil(totalHits / p.limit),
    page:       p.page,
    facets: catFacet
      ? { categories: (catFacet.counts ?? []).map((c) => ({ value: c.value, count: c.count })) }
      : undefined,
    source: "typesense",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Prisma fallback  (used when TYPESENSE_* env vars are absent)
// ─────────────────────────────────────────────────────────────────────────────

async function prismaFallback(p: SearchParams): Promise<SearchResponse> {
  const result = await queryProducts({
    search:    p.q || undefined,
    category:  p.category,
    minPrice:  p.minPrice,
    maxPrice:  p.maxPrice,
    minRating: p.minRating,
    page:      p.page,
    limit:     p.limit,
    sortBy:    p.sortBy,
    order:     p.order,
  });

  return {
    hits: result.products.map((prod) => ({
      id:          prod.id,
      title:       prod.title,
      description: prod.description,
      slug:        "",
      price:       prod.price,
      stock:       prod.stock,
      rating:      prod.rating,
      category:    prod.category,
      images:      prod.images,
    })),
    totalHits:  result.totalProducts,
    totalPages: result.totalPages,
    page:       result.currentPage,
    source:     "prisma",
  };
}
