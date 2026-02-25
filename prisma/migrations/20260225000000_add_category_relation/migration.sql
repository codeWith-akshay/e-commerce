-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: add_category_relation
-- Changes:
--   1. Add slug + imageUrl columns to categories
--   2. Replace products.category (String) with products.categoryId (FK)
--   3. Add FK constraint products → categories
--   4. Update all category-related indexes
-- Note: products + categories are cleared here because of NOT NULL FK —
--       data is repopulated by `prisma db seed` immediately after.
-- ─────────────────────────────────────────────────────────────────────────────

-- Safely clear data that depends on the columns being restructured
-- (wishlists/carts/orderItems/deals/newArrivals reference products via FK)
TRUNCATE TABLE "new_arrivals", "deals", "order_items", "wishlists", "carts" CASCADE;
TRUNCATE TABLE "orders" CASCADE;
TRUNCATE TABLE "products" CASCADE;
TRUNCATE TABLE "categories" CASCADE;

-- DropIndex: old string-based category indexes
DROP INDEX IF EXISTS "products_category_createdAt_idx";
DROP INDEX IF EXISTS "products_category_idx";
DROP INDEX IF EXISTS "products_category_rating_idx";

-- AlterTable categories: add slug (unique, not null) and optional imageUrl
ALTER TABLE "categories"
  ADD COLUMN "slug"      TEXT NOT NULL DEFAULT '',
  ADD COLUMN "imageUrl"  TEXT;

-- Remove the temporary default now that the column exists
ALTER TABLE "categories" ALTER COLUMN "slug" DROP DEFAULT;

-- AlterTable products: drop old string column, add FK column
ALTER TABLE "products"
  DROP COLUMN "category",
  ADD COLUMN  "categoryId" TEXT NOT NULL DEFAULT '';

ALTER TABLE "products" ALTER COLUMN "categoryId" DROP DEFAULT;

-- CreateIndex: unique slug on categories
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex: categories indexes
CREATE INDEX "categories_slug_idx" ON "categories"("slug");

-- CreateIndex: products categoryId indexes
CREATE INDEX "products_categoryId_idx"           ON "products"("categoryId");
CREATE INDEX "products_categoryId_rating_idx"    ON "products"("categoryId", "rating");
CREATE INDEX "products_categoryId_createdAt_idx" ON "products"("categoryId", "createdAt");
CREATE INDEX "products_categoryId_price_idx"     ON "products"("categoryId", "price");

-- AddForeignKey
ALTER TABLE "products"
  ADD CONSTRAINT "products_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "categories"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
