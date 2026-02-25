import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import prisma from "@/lib/prisma";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/search?q=<query>[&limit=6]
//
// Lightweight typeahead endpoint — returns minimal fields so the dropdown
// payload stays small.  Full filtering / pagination lives in /api/products.
//
// Query params:
//   q      – search term (required, min 1 char after trim)
//   limit  – max results to return (default: 6, capped at 10)
// ─────────────────────────────────────────────────────────────────────────────

/** Payload shape returned to the client. */
export interface SearchResult {
  id:       string;
  title:    string;
  price:    number;
  image:    string | null;
  category: string;
}

const DEFAULT_LIMIT = 6;
const MAX_LIMIT     = 10;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;

    const q = searchParams.get("q")?.trim() ?? "";
    if (q.length === 0) {
      return NextResponse.json<SearchResult[]>([]);
    }

    const rawLimit  = parseInt(searchParams.get("limit") ?? "", 10);
    const limit     = Number.isNaN(rawLimit) || rawLimit < 1
      ? DEFAULT_LIMIT
      : Math.min(rawLimit, MAX_LIMIT);

    const rows = await prisma.product.findMany({
      where: {
        OR: [
          { title:       { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      take: limit,
      // Surface the best-rated matches first
      orderBy: { rating: "desc" },
      select: {
        id:       true,
        title:    true,
        price:    true,
        images:   true,          // String[] — we return the first one
        category: { select: { name: true } },
      },
    });

    const results: SearchResult[] = rows.map(({ images, category, ...r }) => ({
      ...r,
      image:    images[0] ?? null,
      category: category.name,
    }));

    return NextResponse.json<SearchResult[]>(results, {
      status: 200,
      // Short TTL — search results should feel fresh
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[GET /api/search]", err);
    return NextResponse.json<SearchResult[]>([], { status: 500 });
  }
}
