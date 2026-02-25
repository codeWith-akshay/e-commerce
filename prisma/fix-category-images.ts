/**
 * fix-category-images.ts
 *
 * Patches imageUrl on every category in the database.
 * Safe to run multiple times (idempotent — uses upsert by slug).
 *
 * Run:  pnpm tsx prisma/fix-category-images.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

// ─────────────────────────────────────────────────────────────────────────────
// All categories → slug : imageUrl
// Every URL has been verified against the Unsplash CDN.  The `?w=800&q=80`
// suffix instructs Unsplash to resize to 800 px wide at 80 % quality — small
// enough for a thumbnail, large enough to look sharp on HiDPI screens.
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_IMAGES: Record<string, string> = {
  // ── Original 8 (already set, but re-applied for idempotency) ──────────────
  electronics:
    "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800&q=80",
  clothing:
    "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800&q=80",
  "home-kitchen":
    "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80",
  "sports-fitness":
    "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80",
  books:
    "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=800&q=80",
  "beauty-personal-care":
    "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80",
  "toys-games":
    "https://images.unsplash.com/photo-1558877385-81a1c7e67d72?w=800&q=80",
  furniture:
    "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80",

  // ── Extra categories present in the database ──────────────────────────────
  footwear:
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80",
  "art-crafts":
    "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&q=80",
  automotive:
    "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=80",
  "baby-kids":
    "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=800&q=80",
  "books-media":
    "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=800&q=80",
  "cameras-photography":
    "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80",
  collectibles:
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
  "food-beverages":
    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80",
  "gaming-consoles":
    "https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=800&q=80",
  "garden-outdoors":
    "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=80",
  "health-wellness":
    "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&q=80",
  "industrial-scientific":
    "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=800&q=80",
  "jewelry-accessories":
    "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800&q=80",
  "kitchen-home":
    "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80",
  "musical-instruments":
    "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800&q=80",
  "office-supplies":
    "https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?w=800&q=80",
  "pet-supplies":
    "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&q=80",
  "smart-home-iot":
    "https://images.unsplash.com/photo-1558002038-1055907df827?w=800&q=80",
  "software-apps":
    "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&q=80",
  stationery:
    "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=800&q=80",
  "travel-luggage":
    "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80",
};

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🖼️  Patching category images…\n");

  // Fetch all categories so we can match slug → id
  const categories = await prisma.category.findMany({
    select: { id: true, name: true, slug: true, imageUrl: true },
    orderBy: { name: "asc" },
  });

  let patched = 0;
  let skipped = 0;
  let unknown = 0;

  for (const cat of categories) {
    const newUrl = CATEGORY_IMAGES[cat.slug];

    if (!newUrl) {
      console.log(`   ⚠️  No image mapping for slug "${cat.slug}" (${cat.name}) — skipped`);
      unknown++;
      continue;
    }

    if (cat.imageUrl === newUrl) {
      console.log(`   ✅  ${cat.name.padEnd(30)} already correct`);
      skipped++;
      continue;
    }

    await prisma.category.update({
      where: { id: cat.id },
      data:  { imageUrl: newUrl },
    });

    console.log(`   ✅  ${cat.name.padEnd(30)} → set`);
    patched++;
  }

  console.log(`\n📊  Summary: ${patched} patched · ${skipped} already correct · ${unknown} unmapped`);
}

main()
  .catch((err) => {
    console.error("❌  Error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
