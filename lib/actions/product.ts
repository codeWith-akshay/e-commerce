"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getSessionRole } from "@/lib/session";
import { indexProduct, removeProduct } from "@/lib/search/sync";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Shape returned by every form-based mutating action. */
export interface ProductFormState {
  errors?: Partial<Record<ProductField | "_form", string>>;
  message?: string;
}

type ProductField =
  | "title"
  | "description"
  | "price"
  | "stock"
  | "lowStockThreshold"
  | "categoryId"
  | "rating"
  | "images";

interface ProductData {
  title:              string;
  description:        string;
  price:              number;
  stock:              number;
  lowStockThreshold:  number;
  categoryId:         string;
  rating:             number;
  images:             string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enforces ADMIN or SUPERADMIN access.
 * - No session   → redirect to /login
 * - Wrong role   → redirect to / (not /login — the user IS authenticated)
 * Both cases abort the server action before any Prisma work.
 */
async function requireAdmin(): Promise<void> {
  const role = await getSessionRole();
  if (!role) redirect("/login");
  if (role !== "ADMIN" && role !== "SUPERADMIN") redirect("/");
}

/**
 * Revalidates every cache entry that references product data —
 * both the admin panel and the customer-facing storefront.
 *
 * Pass `productId` to also bust the individual product detail
 * and edit pages.
 */
function revalidateProductCaches(productId?: string): void {
  // Admin panel
  revalidatePath("/admin");
  revalidatePath("/admin/products");

  // Public storefront
  revalidatePath("/");
  revalidatePath("/products");

  if (productId) {
    revalidatePath(`/products/${productId}`);
    revalidatePath(`/admin/products/${productId}/edit`);
  }
}

const URL_RE = /^https?:\/\/.+/i;

/**
 * Parses and validates a FormData payload for a product.
 *
 * Returns a discriminated union:
 *   { data: ProductData }  — valid; ready for Prisma
 *   { errors: ... }        — invalid; field-level error map
 */
function validateProductFields(
  formData: FormData,
): { data: ProductData } | { errors: ProductFormState["errors"] } {
  const title              = formData.get("title")?.toString().trim()              ?? "";
  const description        = formData.get("description")?.toString().trim()        ?? "";
  const priceRaw           = formData.get("price")?.toString().trim()              ?? "";
  const stockRaw           = formData.get("stock")?.toString().trim()              ?? "";
  const lowStockRaw        = formData.get("lowStockThreshold")?.toString().trim()  ?? "5";
  const categoryId         = formData.get("categoryId")?.toString().trim()          ?? "";
  const ratingRaw          = formData.get("rating")?.toString().trim()             ?? "0";
  const imagesRaw          = formData.get("images")?.toString().trim()             ?? "";

  const errors: ProductFormState["errors"] = {};

  // Title
  if (!title)                            errors.title       = "Title is required.";
  else if (title.length > 200)           errors.title       = "Title must be 200 characters or fewer.";

  // Description
  if (!description)                      errors.description = "Description is required.";

  // Price
  const price = parseFloat(priceRaw);
  if (!priceRaw || isNaN(price))         errors.price       = "Price must be a valid number.";
  else if (price < 0)                    errors.price       = "Price cannot be negative.";

  // Stock
  const stock = parseInt(stockRaw, 10);
  if (!stockRaw || isNaN(stock))         errors.stock       = "Stock must be a whole number.";
  else if (stock < 0)                    errors.stock       = "Stock cannot be negative.";

  // Low stock threshold
  const lowStockThreshold = parseInt(lowStockRaw || "5", 10);
  if (isNaN(lowStockThreshold) || lowStockThreshold < 0)
    errors.lowStockThreshold = "Low stock threshold must be a non-negative whole number.";

  // Category
  if (!categoryId)                       errors.categoryId  = "Category is required.";

  // Rating
  const rating = parseFloat(ratingRaw || "0");
  if (isNaN(rating))                     errors.rating      = "Rating must be a number.";
  else if (rating < 0 || rating > 5)     errors.rating      = "Rating must be between 0 and 5.";

  // Images — one URL per line, blank lines ignored
  const images = imagesRaw.split("\n").map((u) => u.trim()).filter(Boolean);
  const badUrl = images.find((u) => !URL_RE.test(u));
  if (badUrl) errors.images = `Invalid URL: "${badUrl}". Each line must start with http:// or https://`;

  if (Object.keys(errors).length) return { errors };
  return { data: { title, description, price, stock, lowStockThreshold, categoryId, rating, images } };
}

// ─────────────────────────────────────────────────────────────────────────────
// createProduct
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new product.
 *
 * Wire up with:
 *   const [state, action] = useActionState(createProductAction, {});
 *
 * On success → revalidates all product caches, redirects to /admin/products.
 */
export async function createProductAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  await requireAdmin();

  const result = validateProductFields(formData);
  if ("errors" in result) return { errors: result.errors };

  try {
    const { categoryId, ...rest } = result.data;
    const created = await prisma.product.create({ data: { ...rest, category: { connect: { id: categoryId } } } });
    // Fire-and-forget — search index failure must not block the admin
    indexProduct(created.id).catch((e) => console.error("[createProductAction] sync", e));
  } catch (err) {
    console.error("[createProductAction]", err);
    return { errors: { _form: "Failed to create product. Please try again." } };
  }

  revalidateProductCaches();
  redirect("/admin/products");
}

// ─────────────────────────────────────────────────────────────────────────────
// updateProduct
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Updates an existing product by ID.
 *
 * Bind the product ID before handing to useActionState:
 *   const bound = updateProductAction.bind(null, productId);
 *   const [state, action] = useActionState(bound, {});
 *
 * On success → revalidates all product caches, redirects to /admin/products.
 */
export async function updateProductAction(
  productId: string,
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  await requireAdmin();

  if (!productId) return { errors: { _form: "Missing product ID." } };

  const result = validateProductFields(formData);
  if ("errors" in result) return { errors: result.errors };

  try {
    const { categoryId, ...rest } = result.data;
    await prisma.product.update({ where: { id: productId }, data: { ...rest, category: { connect: { id: categoryId } } } });
    // Re-sync updated document — fire-and-forget
    indexProduct(productId).catch((e) => console.error("[updateProductAction] sync", e));
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return { errors: { _form: "Product not found. It may have already been deleted." } };
    }
    console.error("[updateProductAction]", err);
    return { errors: { _form: "Failed to update product. Please try again." } };
  }

  revalidateProductCaches(productId);
  redirect("/admin/products");
}

// ─────────────────────────────────────────────────────────────────────────────
// deleteProduct
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deletes a product by ID.
 *
 * Returns `{ error? }` so the inline delete button can surface failures
 * without a full-page reload.
 * Treating "record not found" (P2025) as a success keeps the UI consistent
 * when two admins delete the same product simultaneously.
 */
export async function deleteProductAction(
  productId: string,
): Promise<{ error?: string }> {
  await requireAdmin();

  if (!productId) return { error: "Missing product ID." };

  try {
    await prisma.product.delete({ where: { id: productId } });
    // Remove from search index — fire-and-forget
    removeProduct(productId).catch((e) => console.error("[deleteProductAction] sync", e));
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      // Already gone — revalidate so the stale row disappears from the table
      revalidateProductCaches(productId);
      return {};
    }
    console.error("[deleteProductAction]", err);
    return { error: "Could not delete product. Please try again." };
  }

  revalidateProductCaches(productId);
  return {};
}
