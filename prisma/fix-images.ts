/**
 * One-time patch: replace 4 dead Unsplash photo URLs in existing product rows.
 * Run with:  pnpm exec ts-node --compiler-options '{"module":"CommonJS"}' prisma/fix-images.ts
 * Or simply: pnpm tsx prisma/fix-images.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma  = new PrismaClient({ adapter });

const patches: { title: string; images: string[] }[] = [
  {
    title:  "Cast Iron Skillet 12\"",
    images: ["https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800"],
  },
  {
    title:  "Yoga Mat Premium 6mm",
    images: ["https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800"],
  },
  {
    title:  "Adjustable Dumbbell Set 5–52.5 lbs",
    images: ["https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800"],
  },
  {
    title:  "Ergonomic Office Chair",
    images: ["https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800"],
  },
  // 404s reported Feb 2026 — Unsplash deleted the originals
  {
    title:  "Ninja Foodi 10-in-1 Smart XL Air Fryer",
    images: [
      "https://images.unsplash.com/photo-1585515320310-259814833e62?w=800&q=80",
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80",
    ],
  },
  {
    title:  "Dyson V15 Detect Cordless Vacuum",
    images: [
      "https://images.unsplash.com/photo-1558317374-067fb5f30001?w=800&q=80",
      "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&q=80",
    ],
  },
  {
    title:  "Theragun Prime Percussive Therapy Device",
    images: [
      "https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=800&q=80",
      "https://images.unsplash.com/photo-1594737625785-a6cbdabd333c?w=800&q=80",
    ],
  },
  {
    title:  "Charlotte Tilbury Pillow Talk Lipstick",
    images: [
      "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=800&q=80",
      "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&q=80",
    ],
  },
  {
    title:  "CeraVe Moisturising Cream 19 oz",
    images: [
      "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&q=80",
      "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=800&q=80",
    ],
  },
  {
    title:  "Bose QuietComfort 45 Headphones",
    images: [
      "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&q=80",
      "https://images.unsplash.com/photo-1487215078519-e21cc028cb29?w=800&q=80",
    ],
  },
  {
    title:  "Ravensburger 1000-Piece Jigsaw Puzzle",
    images: [
      "https://images.unsplash.com/photo-1611996575749-79a3a250f948?w=800&q=80",
      "https://images.unsplash.com/photo-1596460107916-430662021049?w=800&q=80",
    ],
  },
  {
    title:  "Hot Wheels 20-Car Gift Pack",
    images: [
      "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=800&q=80",
      "https://images.unsplash.com/photo-1558877385-81a1c7e67d72?w=800&q=80",
    ],
  },
  {
    title:  "Bookshelf 5-Tier Industrial Ladder Shelf",
    images: [
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80",
      "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80",
    ],
  },
];

async function main() {
  console.log("🔧 Patching broken product images…\n");

  for (const { title, images } of patches) {
    const result = await prisma.product.updateMany({
      where:  { title },
      data:   { images },
    });
    console.log(`  ${result.count > 0 ? "✅" : "⚠️ not found"} ${title}`);
  }

  console.log("\n✅ Done.");
}

main()
  .catch((e) => { console.error("❌ Patch failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
