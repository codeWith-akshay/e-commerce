import { NextResponse } from "next/server";
import { getCategories } from "@/lib/queries/category";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/categories
//
// Returns all categories (id, name, slug) ordered alphabetically.
// Served with ISR-style caching: fresh for 5 min, stale-while-revalidate 10 min.
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=600";

export async function GET() {
  try {
    const categories = await getCategories();
    return NextResponse.json(categories, {
      headers: { "Cache-Control": CACHE_CONTROL },
    });
  } catch (error) {
    console.error("[GET /api/categories]", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 },
    );
  }
}
