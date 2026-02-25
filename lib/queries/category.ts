import prisma from "@/lib/prisma";

// ─────────────────────────────────────────────────────────────────────────────
// Category query utilities
//
// Used by the Navbar Server Component (no HTTP round-trip) and re-exposed
// via /api/categories for any future client-side consumers.
// ─────────────────────────────────────────────────────────────────────────────

/** Slim shape returned from category queries — only what the UI needs. */
export interface CategoryItem {
  id:   string;
  name: string;
  slug: string;
}

/**
 * Fetch every category ordered alphabetically by name.
 *
 * Explicit `select` ensures we never accidentally over-fetch if new columns
 * are added to the schema in the future.
 */
export async function getCategories(): Promise<CategoryItem[]> {
  return prisma.category.findMany({
    select:  { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });
}
