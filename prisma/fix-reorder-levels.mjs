/**
 * Fix-up script:
 *  1. Sets realistic reorderLevel values for low-quantity products so they
 *     correctly appear as LOW_STOCK in the inventory panel.
 *  2. Run once after initial backfill.
 *
 * Run: node --env-file=.env prisma/fix-reorder-levels.mjs
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma  = new PrismaClient({ adapter });

// Products whose reorderLevel should be elevated so they show as LOW_STOCK.
// Rule: if stockQuantity is between 1–30, set reorderLevel = stockQuantity + 10
// (so the item is genuinely low — you'd want to reorder before running out).
const rows = await prisma.inventory.findMany({
  where: {
    stockQuantity: { gt: 0, lte: 30 },
    product: { deletedAt: null },
  },
  select: { id: true, sku: true, stockQuantity: true, reorderLevel: true, product: { select: { title: true } } },
  orderBy: { stockQuantity: "asc" },
});

console.log(`Found ${rows.length} low-quantity rows to update.\n`);

let updated = 0;
for (const r of rows) {
  const newThreshold = r.stockQuantity + 10;
  if (newThreshold <= r.reorderLevel) {
    console.log(`  [SKIP] already has realistic threshold=${r.reorderLevel} | ${r.product.title.slice(0, 50)}`);
    continue;
  }
  await prisma.inventory.update({
    where: { id: r.id },
    data:  { reorderLevel: newThreshold },
  });
  console.log(`  [SET]  qty=${r.stockQuantity} → reorderLevel=${newThreshold} (was ${r.reorderLevel}) | ${r.product.title.slice(0, 50)}`);
  updated++;
}

console.log(`\n✅  Updated ${updated} reorderLevel values.`);

// Verify counts — Prisma can't do column-vs-column comparisons,
// so we fetch all rows and compute in JS.
const allRows = await prisma.inventory.findMany({
  where: { product: { deletedAt: null } },
  select: { stockQuantity: true, reorderLevel: true },
});
const genuineLow = allRows.filter(r => r.stockQuantity > 0 && r.stockQuantity <= r.reorderLevel).length;
const oos        = allRows.filter(r => r.stockQuantity === 0).length;
const inStock    = allRows.filter(r => r.stockQuantity > r.reorderLevel).length;

console.log(`\n📊  After update:`);
console.log(`   IN_STOCK    : ${inStock}`);
console.log(`   LOW_STOCK   : ${genuineLow}`);
console.log(`   OUT_OF_STOCK: ${oos}`);
console.log(`   Total       : ${allRows.length}`);

await prisma.$disconnect();
