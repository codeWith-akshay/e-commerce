/**
 * lib/validations/product.ts
 *
 * Zod schemas for product-related inputs (admin CRUD, search, filters).
 */

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Converts a string to a URL-friendly slug. */
function toSlug(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ─────────────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const createProductSchema = z.object({
  title:        z.string().min(1, "Title is required.").max(255).trim(),
  slug:         z
    .string()
    .max(255)
    .optional()
    .transform((v, ctx) => {
      const parent = ctx as unknown as { title?: string };
      const base   = v ?? (parent?.title as string | undefined) ?? "";
      return toSlug(base);
    }),
  description:  z.string().min(1, "Description is required.").max(10_000).trim(),
  price:        z.number({ error: "Price must be a number." })
    .positive("Price must be greater than 0.")
    .max(1_000_000),
  comparePrice: z.number().positive().max(1_000_000).optional().nullable(),
  sku:          z.string().max(100).trim().optional().nullable(),
  stock:        z.number({ error: "Stock must be a number." })
    .int("Stock must be a whole number.")
    .min(0, "Stock cannot be negative."),
  weight:       z.number().positive().optional().nullable(),
  categoryId:   z.string().cuid("Invalid category."),
  images:       z.array(z.string().url("Each image must be a valid URL.")).default([]),
  isFeatured:   z.boolean().default(false),
  isActive:     z.boolean().default(true),
});

export const updateProductSchema = createProductSchema.partial().extend({
  id: z.string().cuid("Invalid product ID."),
});

export const productFiltersSchema = z.object({
  category:  z.string().optional(),
  minPrice:  z.coerce.number().min(0).optional(),
  maxPrice:  z.coerce.number().min(0).optional(),
  sortBy:    z.enum(["price_asc", "price_desc", "rating", "newest"]).optional(),
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(100).default(12),
  search:    z.string().max(200).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Inferred types
// ─────────────────────────────────────────────────────────────────────────────

export type CreateProductInput  = z.infer<typeof createProductSchema>;
export type UpdateProductInput  = z.infer<typeof updateProductSchema>;
export type ProductFiltersInput = z.infer<typeof productFiltersSchema>;
