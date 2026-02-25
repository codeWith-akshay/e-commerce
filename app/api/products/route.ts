import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import {
  queryProducts,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  type ProductsResult,
} from "@/lib/queries/product";

// Re-export so any `import { ProductListItem } from "@/app/api/products/route"` keeps working.
export type { ProductListItem } from "@/lib/queries/product";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

// ISR-style revalidation: cache the response at the CDN layer for 60 s,
// then serve stale while revalidating in the background (stale-while-revalidate).
const CACHE_CONTROL =
  "public, s-maxage=60, stale-while-revalidate=300";

// ─────────────────────────────────────────────────────────────────────────────
// Response shapes
// ─────────────────────────────────────────────────────────────────────────────

interface ErrorResponse {
  error: string;
  details?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function parsePositiveInt(
  value: string | null,
  fallback: number,
  max?: number
): number {
  if (value === null) return fallback;
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) return fallback;
  return max !== undefined ? Math.min(parsed, max) : parsed;
}

function parseFloat_(value: string | null): number | undefined {
  if (value === null) return undefined;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/products
//
// Query params:
//   search    – full-text search on title + description (case-insensitive)
//   category  – exact category name
//   minPrice  – minimum price (inclusive)
//   maxPrice  – maximum price (inclusive)
//   minRating – minimum rating (inclusive, 0-5)
//   page      – page number (default: 1)
//   limit     – items per page (default: 12, max: 100)
//   sortBy    – field to sort by: "price" | "rating" | "createdAt" (default: "createdAt")
//   order     – sort direction: "asc" | "desc" (default: "desc")
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest
): Promise<NextResponse<ProductsResult | ErrorResponse>> {
  try {
    const { searchParams } = req.nextUrl;

    // ── Parse & validate query params ──────────────────────────────────────

    const search = searchParams.get("search")?.trim() ?? null;
    const category = searchParams.get("category")?.trim() ?? null;
    const minPrice = parseFloat_(searchParams.get("minPrice"));
    const maxPrice = parseFloat_(searchParams.get("maxPrice"));
    const minRating = parseFloat_(searchParams.get("minRating"));

    const page = parsePositiveInt(searchParams.get("page"), DEFAULT_PAGE);
    const limit = parsePositiveInt(
      searchParams.get("limit"),
      DEFAULT_LIMIT,
      MAX_LIMIT
    );

    const sortByParam = searchParams.get("sortBy") ?? undefined;
    const orderParam  = searchParams.get("order")  ?? undefined;

    // Validate price range
    if (
      minPrice !== undefined &&
      maxPrice !== undefined &&
      minPrice > maxPrice
    ) {
      return NextResponse.json(
        { error: "minPrice must be less than or equal to maxPrice" },
        { status: 400 }
      );
    }

    // Validate rating range (0-5)
    if (minRating !== undefined && (minRating < 0 || minRating > 5)) {
      return NextResponse.json(
        { error: "minRating must be between 0 and 5" },
        { status: 400 }
      );
    }

    // ── Execute query via shared lib (avoids duplicating where-clause logic) ─

    const result = await queryProducts({
      search,
      category,
      minPrice,
      maxPrice,
      minRating,
      page,
      limit,
      sortBy: sortByParam,
      order:  orderParam,
    });

    // ── Respond ────────────────────────────────────────────────────────────

    return NextResponse.json(result, {
      status: 200,
      headers: { "Cache-Control": CACHE_CONTROL },
    });
  } catch (err) {
    console.error("[GET /api/products]", err);

    // Surface Prisma-specific errors with more context in development
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json(
        {
          error: "Database query failed",
          ...(process.env.NODE_ENV === "development" && {
            details: `Prisma error ${err.code}: ${err.message}`,
          }),
        },
        { status: 500 }
      );
    }

    if (err instanceof Prisma.PrismaClientInitializationError) {
      return NextResponse.json(
        { error: "Database connection failed. Please try again later." },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
