import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  queryDeals,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  type DealsResult,
} from "@/lib/queries/deal";

// Re-export the result type for consumers
export type { DealsResult, DealListItem } from "@/lib/queries/deal";

// ISR-style caching: serve fresh for 60 s, stale-while-revalidate for 5 min.
const CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=300";

interface ErrorResponse {
  error:    string;
  details?: string;
}

function parsePositiveInt(value: string | null, fallback: number, max?: number): number {
  if (value === null) return fallback;
  const n = parseInt(value, 10);
  if (Number.isNaN(n) || n < 1) return fallback;
  return max !== undefined ? Math.min(n, max) : n;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/deals
//
// Query params:
//   category  – exact category name filter
//   sortBy    – "discount" (default) | "price:asc" | "price:desc" | "endingSoon"
//   page      – page number (default: 1)
//   limit     – items per page (default: 12, max: 100)
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
): Promise<NextResponse<DealsResult | ErrorResponse>> {
  try {
    const { searchParams } = req.nextUrl;

    const category = searchParams.get("category")?.trim() || null;
    const sortBy   = searchParams.get("sortBy")?.trim()   || "discount";
    const page     = parsePositiveInt(searchParams.get("page"),  DEFAULT_PAGE);
    const limit    = parsePositiveInt(searchParams.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);

    const result = await queryDeals({ category, sortBy, page, limit });

    return NextResponse.json(result, {
      headers: { "Cache-Control": CACHE_CONTROL },
    });
  } catch (err) {
    console.error("[GET /api/deals]", err);
    return NextResponse.json(
      { error: "Failed to fetch deals.", details: String(err) },
      { status: 500 },
    );
  }
}
