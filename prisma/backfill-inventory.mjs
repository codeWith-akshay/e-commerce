/**
 * One-time backfill: Creates Inventory rows for every product that lacks one,
 * seeding stockQuantity from product.stock and reorderLevel from
 * product.lowStockThreshold (or default 10).
 *
 * Run: node --env-file=.env prisma/backfill-inventory.mjs
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) { console.error("❌  DATABASE_URL not set"); process.exit(1); }

const connectionString = rawUrl;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// Fetch every non-deleted product that has no inventory row yet
const products = await prisma.product.findMany({
  where: { deletedAt: null, inventory: null },
  select: {
    id: true,
    title: true,
    sku: true,
    stock: true,
    lowStockThreshold: true,
  },
  orderBy: { createdAt: "asc" },
});

console.log(`Found ${products.length} products without an Inventory row. Backfilling…\n`);

let created = 0;

for (const p of products) {
  const stockQty = p.stock ?? 0;
  const reorderLevel = p.lowStockThreshold ?? 10;

  // Auto-generate SKU from title + short ID suffix if missing
  let sku = p.sku;
  if (!sku) {
    const prefix = p.title
      .toUpperCase()
      .replace(/[^A-Z0-9 ]/g, "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 3)
      .map((w) => w.slice(0, 4))
      .join("-");
    const suffix = p.id.slice(-6).toUpperCase();
    sku = `${prefix}-${suffix}`;

    // Persist the generated SKU back to the product
    await prisma.product.update({
      where: { id: p.id },
      data: { sku },
    });
  }

  await prisma.inventory.create({
    data: {
      sku,
      stockQuantity: stockQty,
      reservedQty: 0,
      reorderLevel,
      productId: p.id,
    },
  });

  const status =
    stockQty === 0 ? "OUT_OF_STOCK" :
    stockQty <= reorderLevel ? "LOW_STOCK   " :
    "IN_STOCK    ";
  console.log(`  [${status}] qty=${String(stockQty).padStart(5)} thresh=${reorderLevel} | ${p.title.slice(0, 50)}`);
  created++;
}

console.log(`\n✅  Done — created ${created} inventory rows.`);

await prisma.$disconnect();
