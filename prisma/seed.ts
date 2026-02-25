/**
 * Database seed — categories, products, deals, and new arrivals.
 *
 * All product images use the Unsplash CDN (images.unsplash.com), which is
 * already white-listed in next.config.ts → images.remotePatterns.
 *
 * Run:  pnpm db:seed
 *       — or —
 *       pnpm tsx prisma/seed.ts
 *
 * The script is fully idempotent: re-running it will upsert existing rows
 * rather than duplicating them.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";

dotenv.config();

// ─── Prisma client (driver-adapter mode, matches the rest of the app) ────────
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ─────────────────────────────────────────────────────────────────────────────
// 1. Categories
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  {
    name: "Electronics",
    slug: "electronics",
    description: "Smartphones, laptops, audio gear, cameras, and accessories.",
    imageUrl:
      "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800&q=80",
  },
  {
    name: "Clothing",
    slug: "clothing",
    description: "Everyday wear, activewear, outerwear, and footwear.",
    imageUrl:
      "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800&q=80",
  },
  {
    name: "Home & Kitchen",
    slug: "home-kitchen",
    description: "Cookware, appliances, storage, and home décor.",
    imageUrl:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80",
  },
  {
    name: "Sports & Fitness",
    slug: "sports-fitness",
    description: "Gym equipment, outdoor gear, and athletic accessories.",
    imageUrl:
      "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80",
  },
  {
    name: "Books",
    slug: "books",
    description: "Fiction, non-fiction, textbooks, and audiobooks.",
    imageUrl:
      "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=800&q=80",
  },
  {
    name: "Beauty & Personal Care",
    slug: "beauty-personal-care",
    description: "Skincare, haircare, fragrances, and wellness products.",
    imageUrl:
      "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80",
  },
  {
    name: "Toys & Games",
    slug: "toys-games",
    description: "Board games, puzzles, outdoor toys, and children's gifts.",
    imageUrl:
      "https://images.unsplash.com/photo-1558877385-81a1c7e67d72?w=800&q=80",
  },
  {
    name: "Furniture",
    slug: "furniture",
    description: "Desks, chairs, sofas, beds, and storage solutions.",
    imageUrl:
      "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80",
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// 2. Products  (keyed by categorySlug for easy FK linking)
// ─────────────────────────────────────────────────────────────────────────────

type ProductSeed = {
  title: string;
  description: string;
  price: number;
  stock: number;
  rating: number;
  images: string[];
  categorySlug: string;
};

const PRODUCTS: ProductSeed[] = [
  // ── Electronics ────────────────────────────────────────────────────────────
  {
    title: "MacBook Pro 14-inch M3",
    description:
      "Apple M3 chip with 8-core CPU and 10-core GPU, 16 GB unified memory, 512 GB SSD. Stunning Liquid Retina XDR display, up to 17 hours of battery life, and a full-size backlit keyboard. Perfect for creative professionals and developers.",
    price: 1999.99,
    stock: 45,
    rating: 4.9,
    images: [
      "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80",
      "https://images.unsplash.com/photo-1611186871525-56ac80bbd751?w=800&q=80",
    ],
    categorySlug: "electronics",
  },
  {
    title: "Sony WH-1000XM5 Headphones",
    description:
      "Industry-leading noise-cancelling wireless headphones with 30-hour battery life, multipoint Bluetooth connectivity, and crystal-clear hands-free calling. The ultra-comfortable design makes them ideal for long listening sessions.",
    price: 349.99,
    stock: 120,
    rating: 4.8,
    images: [
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80",
      "https://images.unsplash.com/photo-1484704849700-f032a568e944?w=800&q=80",
    ],
    categorySlug: "electronics",
  },
  {
    title: "iPhone 15 Pro 256 GB",
    description:
      "Titanium design with the A17 Pro chip, a 48 MP main camera with 5× Telephoto, and USB-C connectivity. Features Action Button customisation and Dynamic Island for immersive interactions.",
    price: 1099.99,
    stock: 80,
    rating: 4.7,
    images: [
      "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800&q=80",
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&q=80",
    ],
    categorySlug: "electronics",
  },
  {
    title: "Samsung 65\" 4K QLED TV",
    description:
      "Samsung QLED Quantum Dot technology delivers vivid, lifelike colors with up to 100% color volume. Includes Quantum HDR 32×, a 120 Hz refresh rate, and built-in Alexa & Google Assistant for a smart home experience.",
    price: 1297.99,
    stock: 30,
    rating: 4.6,
    images: [
      "https://images.unsplash.com/photo-1593784991095-a205069470b6?w=800&q=80",
      "https://images.unsplash.com/photo-1461151304267-38535e780c79?w=800&q=80",
    ],
    categorySlug: "electronics",
  },
  {
    title: "Sony Alpha a7 IV Mirrorless Camera",
    description:
      "Full-frame 33 MP BSI-CMOS sensor, real-time Eye AF, 10 fps continuous shooting, 4K 60p video recording with 10-bit color. The professional-grade autofocus system and weather-sealed body are built for demanding shooters.",
    price: 2499.99,
    stock: 22,
    rating: 4.9,
    images: [
      "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80",
      "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=800&q=80",
    ],
    categorySlug: "electronics",
  },
  {
    title: "Apple Watch Series 9 45mm",
    description:
      "The brightest Apple Watch display ever with the new S9 chip, double-tap gesture, on-device Siri, and advanced health sensors including blood-oxygen and ECG. All-day 18-hour battery and a durable aluminium case.",
    price: 429.99,
    stock: 95,
    rating: 4.7,
    images: [
      "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800&q=80",
      "https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=800&q=80",
    ],
    categorySlug: "electronics",
  },

  // ── Clothing ────────────────────────────────────────────────────────────────
  {
    title: "Premium Cotton Crew-Neck T-Shirt",
    description:
      "Crafted from 100 % ring-spun cotton for an ultra-soft, breathable feel. A classic slim fit that pairs effortlessly with jeans, chinos, or layered under a jacket. Pre-shrunk and machine-washable for lasting shape retention.",
    price: 29.99,
    stock: 350,
    rating: 4.5,
    images: [
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=80",
      "https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=800&q=80",
    ],
    categorySlug: "clothing",
  },
  {
    title: "Slim-Fit Stretch Denim Jeans",
    description:
      "Four-way stretch denim gives you freedom of movement without sacrificing a sharp silhouette. Mid-rise waist, tapered leg, and reinforced stitching at stress points for all-day comfort whether you're at the office or out with friends.",
    price: 69.99,
    stock: 200,
    rating: 4.6,
    images: [
      "https://images.unsplash.com/photo-1542272604-787c3835535d?w=800&q=80",
      "https://images.unsplash.com/photo-1555689502-c4b22d76c56f?w=800&q=80",
    ],
    categorySlug: "clothing",
  },
  {
    title: "Water-Resistant Puffer Jacket",
    description:
      "DWR-coated outer shell and 550-fill-power down insulation keep you warm and dry on cold days. Compressible to pack-away size, with a stand-up collar, interior zip pockets, and reflective logos for low-light visibility.",
    price: 149.99,
    stock: 110,
    rating: 4.7,
    images: [
      "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&q=80",
      "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&q=80",
    ],
    categorySlug: "clothing",
  },
  {
    title: "Nike Air Max 270 Sneakers",
    description:
      "Inspired by Air Max 93 and 180, the 270 features Nike's tallest Air unit yet beneath the heel for exaggerated cushioning. A lightweight mesh upper and foam midsole deliver all-day comfort for casual wear.",
    price: 149.99,
    stock: 175,
    rating: 4.8,
    images: [
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80",
      "https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?w=800&q=80",
    ],
    categorySlug: "clothing",
  },
  {
    title: "Merino Wool Crewneck Sweater",
    description:
      "Grade-A extra-fine Merino wool is naturally temperature-regulating, moisture-wicking, and odour-resistant. The ribbed hem and cuffs give a refined finish, making this sweater as suitable for office environments as it is for weekends.",
    price: 119.99,
    stock: 140,
    rating: 4.6,
    images: [
      "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800&q=80",
      "https://images.unsplash.com/photo-1585914924626-15adac1e6402?w=800&q=80",
    ],
    categorySlug: "clothing",
  },

  // ── Home & Kitchen ──────────────────────────────────────────────────────────
  {
    title: "Cast Iron Skillet 12\"",
    description:
      "Pre-seasoned with 100 % natural vegetable oil, this 12-inch cast-iron skillet is oven-safe to 500 °F and works on all stovetops including induction. Superior heat retention and distribution make it perfect for searing, sautéing, and baking. Builds better seasoning with every use.",
    price: 49.99,
    stock: 85,
    rating: 4.8,
    images: [
      "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800&q=80",
      "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=800&q=80",
    ],
    categorySlug: "home-kitchen",
  },
  {
    title: "Breville Barista Express Espresso Machine",
    description:
      "Integrated conical burr grinder grinds fresh before every shot. 15-bar Italian pump, digital temperature control (PID), and 67 oz removable water tank. Steaming wand and included accessories make it easy to craft café-quality lattes and cappuccinos at home.",
    price: 699.99,
    stock: 40,
    rating: 4.9,
    images: [
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80",
      "https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=800&q=80",
    ],
    categorySlug: "home-kitchen",
  },
  {
    title: "Vitamix 5200 Blender",
    description:
      "Aircraft-grade stainless-steel blades and a 2-HP motor crush frozen fruit, fibrous vegetables, and whole grains in seconds. Variable speed control and a pulse feature let you achieve any texture, from chunky salsa to silky-smooth soups.",
    price: 449.99,
    stock: 55,
    rating: 4.8,
    images: [
      "https://images.unsplash.com/photo-1570222094114-d054a817e56b?w=800&q=80",
      "https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=800&q=80",
    ],
    categorySlug: "home-kitchen",
  },
  {
    title: "KitchenAid Pro Chef's Knife 8\"",
    description:
      "Full-tang, high-carbon stainless-steel blade is precision-forged and hand-sharpened to a 15-degree edge for effortless slicing. Ergonomic triple-riveted handle provides balance and control. Ideal for professional chefs and home cooks alike.",
    price: 89.99,
    stock: 130,
    rating: 4.7,
    images: [
      "https://images.unsplash.com/photo-1593618998160-e34014e67546?w=800&q=80",
      "https://images.unsplash.com/photo-1566454419290-57a64afe30ac?w=800&q=80",
    ],
    categorySlug: "home-kitchen",
  },
  {
    title: "Instant Pot Duo 7-in-1 6 Qt",
    description:
      "Replaces 7 kitchen appliances: pressure cooker, slow cooker, rice cooker, steamer, sauté pan, yogurt maker, and warmer. 14 smart programs with one-touch ease. Stainless-steel inner pot and 3-ply bottom for even heat distribution.",
    price: 99.99,
    stock: 160,
    rating: 4.7,
    images: [
      "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=800&q=80",
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80",
    ],
    categorySlug: "home-kitchen",
  },

  // ── Sports & Fitness ────────────────────────────────────────────────────────
  {
    title: "Yoga Mat Premium 6mm",
    description:
      "Made from eco-friendly natural rubber with a cross-texture surface for superior grip in dry and wet conditions. 6 mm thick cushioning protects joints during lunges, planks, and floor poses. Includes a carry strap that doubles as a shoulder bag.",
    price: 79.99,
    stock: 200,
    rating: 4.8,
    images: [
      "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&q=80",
      "https://images.unsplash.com/photo-1588286840104-8957b019727f?w=800&q=80",
    ],
    categorySlug: "sports-fitness",
  },
  {
    title: "Adjustable Dumbbell Set 5–52.5 lbs",
    description:
      "Patent-pending dial system adjusts weight in 2.5 lb increments from 5 to 52.5 lbs, replacing 15 pairs of traditional dumbbells. Durable molded plastic over metal plates with ergonomic handles. Ideal for home gyms with limited space.",
    price: 429.99,
    stock: 60,
    rating: 4.9,
    images: [
      "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80",
      "https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=800&q=80",
    ],
    categorySlug: "sports-fitness",
  },
  {
    title: "Garmin Forerunner 265 GPS Watch",
    description:
      "AMOLED colour display with full GPS tracking, heart-rate monitoring, SpO2 sensor, and 13-day battery in smartwatch mode. Training Readiness and Morning Report provide science-based insights to help you train smarter every day.",
    price: 449.99,
    stock: 70,
    rating: 4.8,
    images: [
      "https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=800&q=80",
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80",
    ],
    categorySlug: "sports-fitness",
  },
  {
    title: "Resistance Bands Set (5-Pack)",
    description:
      "Five progressive resistance levels (10–50 lbs) crafted from 100 % natural latex. Loop design prevents rolling during squats, glute bridges, and lateral moves. Includes a mesh carry bag, door anchor, and illustrated exercise guide.",
    price: 29.99,
    stock: 300,
    rating: 4.6,
    images: [
      "https://images.unsplash.com/photo-1598289431512-b97b0917affc?w=800&q=80",
      "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80",
    ],
    categorySlug: "sports-fitness",
  },
  {
    title: "Peloton Bike+ Indoor Cycling Bike",
    description:
      "Auto-Follow resistance automatically adjusts to the instructor's coaching cues. Rotating 23.8\" HD touchscreen streams live and on-demand classes. Apple GymKit-enabled for seamless Apple Watch heart-rate sync. A full-body fitness solution at home.",
    price: 2495.0,
    stock: 15,
    rating: 4.7,
    images: [
      "https://images.unsplash.com/photo-1532384748853-8f54a8f476e2?w=800&q=80",
      "https://images.unsplash.com/photo-1521805492803-d4c4edaeb96f?w=800&q=80",
    ],
    categorySlug: "sports-fitness",
  },

  // ── Books ───────────────────────────────────────────────────────────────────
  {
    title: "Atomic Habits — James Clear",
    description:
      "A proven framework for improving 1 % every day. James Clear reveals practical strategies for forming good habits, breaking bad ones, and mastering the tiny behaviours that lead to remarkable results. Over 15 million copies sold worldwide.",
    price: 14.99,
    stock: 500,
    rating: 4.9,
    images: [
      "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&q=80",
      "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80",
    ],
    categorySlug: "books",
  },
  {
    title: "The Psychology of Money — Morgan Housel",
    description:
      "Timeless lessons on wealth, greed, and happiness. Through 19 short stories Morgan Housel explores the strange ways people think about money with insight that transcends personal finance into broader human behaviour.",
    price: 13.99,
    stock: 450,
    rating: 4.8,
    images: [
      "https://images.unsplash.com/photo-1603400521630-9f2de124b33b?w=800&q=80",
      "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=800&q=80",
    ],
    categorySlug: "books",
  },
  {
    title: "Deep Work — Cal Newport",
    description:
      "Rules for focused success in a distracted world. Cal Newport argues that the ability to perform deep, distraction-free work is becoming increasingly rare and valuable — and that cultivating this skill is the superpower of the 21st century.",
    price: 15.99,
    stock: 380,
    rating: 4.7,
    images: [
      "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&q=80",
      "https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=800&q=80",
    ],
    categorySlug: "books",
  },

  // ── Beauty & Personal Care ──────────────────────────────────────────────────
  {
    title: "CeraVe Moisturising Cream 19 oz",
    description:
      "Developed with dermatologists, this rich yet lightweight moisturiser delivers 24-hour hydration via three essential ceramides and hyaluronic acid. Fragrance-free, non-comedogenic, and suitable for normal to dry skin on the face and body.",
    price: 19.99,
    stock: 400,
    rating: 4.8,
    images: [
      "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&q=80",
      "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=800&q=80",
    ],
    categorySlug: "beauty-personal-care",
  },
  {
    title: "Dyson Supersonic Hair Dryer",
    description:
      "Engineered with intelligent heat control and a digital motor that spins at up to 110 000 rpm. Four heat settings, three speed settings, and magnetic attachments for precise styling. Leaves hair shiny and smooth without extreme heat damage.",
    price: 429.99,
    stock: 65,
    rating: 4.8,
    images: [
      "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80",
      "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=800&q=80",
    ],
    categorySlug: "beauty-personal-care",
  },
  {
    title: "La Mer Crème de la Mer 1 oz",
    description:
      "Powered by the legendary Miracle Broth™, this iconic moisturiser visibly lifts, firms, and renews the look of skin. Continuous moisture delivery technology ensures a fresh, dewy finish all day. Perfect for all skin types.",
    price: 195.0,
    stock: 50,
    rating: 4.7,
    images: [
      "https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=800&q=80",
      "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=800&q=80",
    ],
    categorySlug: "beauty-personal-care",
  },

  // ── Toys & Games ────────────────────────────────────────────────────────────
  {
    title: "LEGO Technic Land Rover Defender (2 573 pcs)",
    description:
      "An authentic 1 : 8 scale replica with working suspension, a 4-speed sequential gearbox, and an openable bonnet revealing a straight-six engine with moving pistons. A challenging build for ages 18+ and an impressive display model.",
    price: 249.99,
    stock: 75,
    rating: 4.9,
    images: [
      "https://images.unsplash.com/photo-1558877385-81a1c7e67d72?w=800&q=80",
      "https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=800&q=80",
    ],
    categorySlug: "toys-games",
  },
  {
    title: "Settlers of Catan Board Game",
    description:
      "The classic strategy game of resource management, trading, and settlement building for 3–4 players aged 10+. Each game creates a unique island board, rewarding different strategies every play. One of the best-selling board games of all time.",
    price: 44.99,
    stock: 180,
    rating: 4.7,
    images: [
      "https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?w=800&q=80",
      "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=80",
    ],
    categorySlug: "toys-games",
  },

  // ── Furniture ───────────────────────────────────────────────────────────────
  {
    title: "Ergonomic Office Chair",
    description:
      "High-back mesh back promotes airflow during long work sessions. Fully adjustable lumbar support, 4D armrests, headrest, and seat depth let you dial in the perfect fit. Rated for 8 hours of continuous use and a 300 lb capacity.",
    price: 449.99,
    stock: 50,
    rating: 4.7,
    images: [
      "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80",
      "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&q=80",
    ],
    categorySlug: "furniture",
  },
  {
    title: "Solid Oak Standing Desk 60×30\"",
    description:
      "Dual-motor electric height adjustment from 24\" to 50\" with memory presets for your favourite sitting and standing positions. 60 × 30-inch solid oak top rated for 355 lbs. Includes programmable LED handset and cable management tray.",
    price: 899.99,
    stock: 35,
    rating: 4.8,
    images: [
      "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=800&q=80",
      "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=800&q=80",
    ],
    categorySlug: "furniture",
  },
  {
    title: "3-Seater Linen Sofa",
    description:
      "Sustainably sourced hardwood frame with high-resilience foam cushions wrapped in a natural linen blend. Deep seating and wide armrests create a relaxed, inviting silhouette. Available in Ivory, Sage, and Slate. OEKO-TEX certified fabric.",
    price: 1249.99,
    stock: 20,
    rating: 4.6,
    images: [
      "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80",
      "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=800&q=80",
    ],
    categorySlug: "furniture",
  },

  // ── Electronics (continued) ────────────────────────────────────────────────
  {
    title: "iPad Pro 12.9-inch M2",
    description:
      "Apple M2 chip powers the most advanced iPad ever. Liquid Retina XDR display with ProMotion, 12 MP Wide + 10 MP Ultra Wide cameras, LiDAR scanner, and Thunderbolt connectivity. Transform your workflow with iPadOS 17.",
    price: 1099.99,
    stock: 60,
    rating: 4.8,
    images: [
      "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800&q=80",
      "https://images.unsplash.com/photo-1589739900243-4b52cd9b104e?w=800&q=80",
    ],
    categorySlug: "electronics",
  },
  {
    title: "Bose QuietComfort 45 Headphones",
    description:
      "Legendary noise cancellation meets lifelike audio. QuietComfort 45 balances world-class noise cancellation with an Aware Mode that lets in your environment. Up to 24 hours of battery and a comfortable over-ear fit.",
    price: 279.99,
    stock: 100,
    rating: 4.7,
    images: [
      "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&q=80",
      "https://images.unsplash.com/photo-1487215078519-e21cc028cb29?w=800&q=80",
    ],
    categorySlug: "electronics",
  },
  {
    title: "Dell XPS 15 Laptop",
    description:
      "Intel Core i9-13900H, NVIDIA GeForce RTX 4070, 32 GB DDR5 RAM, and a 15.6-inch OLED 3.5K display. Thin-bezel InfinityEdge design with a premium CNC-aluminium chassis — power and elegance in one package.",
    price: 2299.99,
    stock: 30,
    rating: 4.7,
    images: [
      "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=800&q=80",
      "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&q=80",
    ],
    categorySlug: "electronics",
  },
  {
    title: "GoPro HERO12 Black",
    description:
      "5.3K60 video, 27 MP photos, and HyperSmooth 6.0 stabilisation. Waterproof to 33 ft without a housing, a 2-hour battery, and the new GP2 processor enable professional action footage from any angle.",
    price: 399.99,
    stock: 85,
    rating: 4.8,
    images: [
      "https://images.unsplash.com/photo-1607462109225-6b64ae2dd3cb?w=800&q=80",
      "https://images.unsplash.com/photo-1516035645781-a1b0ee5b7a7d?w=800&q=80",
    ],
    categorySlug: "electronics",
  },
  {
    title: "Amazon Echo Show 10 (3rd Gen)",
    description:
      "Smart display with a 10.1-inch HD screen that automatically moves to stay in view during video calls. Built-in Zigbee hub, premium sound, and Alexa make it the centrepiece of your smart home.",
    price: 249.99,
    stock: 75,
    rating: 4.5,
    images: [
      "https://images.unsplash.com/photo-1518444065439-e933c06ce9cd?w=800&q=80",
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
    ],
    categorySlug: "electronics",
  },
  {
    title: "Logitech MX Master 3S Mouse",
    description:
      "8 000 DPI sensor works on glass. 70-day battery on a single charge. Quiet MagSpeed scroll wheel, ergonomic shape, and app-specific customisation profiles make this the gold-standard productivity mouse.",
    price: 99.99,
    stock: 150,
    rating: 4.8,
    images: [
      "https://images.unsplash.com/photo-1527814050087-3793815479db?w=800&q=80",
      "https://images.unsplash.com/photo-1563297007-0686b7370b68?w=800&q=80",
    ],
    categorySlug: "electronics",
  },

  // ── Clothing (continued) ───────────────────────────────────────────────────
  {
    title: "Levi's 501 Original Straight Jeans",
    description:
      "The original blue jean since 1873. Button fly, regular fit through seat and thigh with a straight leg. Made from 100 % cotton denim that softens and moulds to your body with every wear.",
    price: 79.99,
    stock: 220,
    rating: 4.7,
    images: [
      "https://images.unsplash.com/photo-1542272604-787c3835535d?w=800&q=80",
      "https://images.unsplash.com/photo-1475178626620-a4d074967452?w=800&q=80",
    ],
    categorySlug: "clothing",
  },
  {
    title: "Patagonia Down Sweater Jacket",
    description:
      "800-fill-power RDS-certified down, a 100 % recycled polyester shell, and a low-profile, compressible design. Serious warmth in a remarkably light package. Packs into its own chest pocket.",
    price: 229.99,
    stock: 90,
    rating: 4.8,
    images: [
      "https://images.unsplash.com/photo-1604644401890-0bd678c83788?w=800&q=80",
      "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&q=80",
    ],
    categorySlug: "clothing",
  },
  {
    title: "Adidas Ultraboost 23 Running Shoes",
    description:
      "Continental rubber outsole, BOOST midsole cushioning, and a Primeknit+ upper that wraps your foot like a sock. The energy-returning midsole makes every stride feel like a spring, from daily training runs to race day.",
    price: 189.99,
    stock: 160,
    rating: 4.7,
    images: [
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80",
      "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=800&q=80",
    ],
    categorySlug: "clothing",
  },
  {
    title: "Polo Ralph Lauren Oxford Shirt",
    description:
      "The timeless button-down Oxford. Woven from 100 % cotton with a soft hand, a classic fit through the chest and waist, and available in 10 versatile colours. A wardrobe staple for over 50 years.",
    price: 89.99,
    stock: 180,
    rating: 4.6,
    images: [
      "https://images.unsplash.com/photo-1620012253295-c15cc3e65df4?w=800&q=80",
      "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800&q=80",
    ],
    categorySlug: "clothing",
  },
  {
    title: "Under Armour HeatGear Compression Shorts",
    description:
      "HeatGear fabric wicks sweat and dries fast. 4-way stretch construction moves with you in every direction. Flat seams eliminate chafing, and the anti-odour technology keeps you fresh through the toughest sessions.",
    price: 34.99,
    stock: 250,
    rating: 4.6,
    images: [
      "https://images.unsplash.com/photo-1513956589380-bad6acb9b9d4?w=800&q=80",
      "https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=800&q=80",
    ],
    categorySlug: "clothing",
  },
  {
    title: "Lululemon Align High-Rise Leggings 25\"",
    description:
      "Made with Nulu™ fabric — buttery soft, four-way stretch, and barely-there feel. Sweat-wicking, squat-proof, and available in 20+ colours. Full length hits 25\" below the waistband for most.",
    price: 118.0,
    stock: 200,
    rating: 4.9,
    images: [
      "https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=800&q=80",
      "https://images.unsplash.com/photo-1538805060514-97d9cc17730c?w=800&q=80",
    ],
    categorySlug: "clothing",
  },
  {
    title: "The North Face Thermoball Eco Vest",
    description:
      "Lightweight synthetic insulation that retains warmth even when wet. Recycled materials throughout the shell and lining, a zip-off hood, and a packable design. Ideal as a mid-layer or standalone piece.",
    price: 129.99,
    stock: 120,
    rating: 4.7,
    images: [
      "https://images.unsplash.com/photo-1520639888713-7851133b1ed0?w=800&q=80",
      "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&q=80",
    ],
    categorySlug: "clothing",
  },

  // ── Home & Kitchen (continued) ─────────────────────────────────────────────
  {
    title: "Ninja Foodi 10-in-1 Smart XL Air Fryer",
    description:
      "Air fry, roast, bake, dehydrate, broil, toast, bagel, reheat, pizza, and keep warm — all in one smart countertop oven. 1800W, XL capacity fits a 13-inch pizza, and the built-in thermometer guarantees perfect doneness.",
    price: 229.99,
    stock: 95,
    rating: 4.7,
    images: [
      "https://images.unsplash.com/photo-1585515320310-259814833e62?w=800&q=80",
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80",
    ],
    categorySlug: "home-kitchen",
  },
  {
    title: "Dyson V15 Detect Cordless Vacuum",
    description:
      "Laser dust detection illuminates microscopic particles. Piezo sensor counts and measures dust particles in real time. 60-minute fade-free runtime and HEPA filtration that captures 99.99 % of particles. Transforms into a handheld in seconds.",
    price: 749.99,
    stock: 50,
    rating: 4.8,
    images: [
      "https://images.unsplash.com/photo-1558317374-067fb5f30001?w=800&q=80",
      "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&q=80",
    ],
    categorySlug: "home-kitchen",
  },
  {
    title: "Staub Cast Iron Dutch Oven 5.5 Qt",
    description:
      "Enamelled cast iron with Staub's iconic matte black interior — naturally non-stick and improves with use. The self-basting lid returns moisture to your dish continuously. Oven-safe to 900 °F, dishwasher-safe, and made in France.",
    price: 359.99,
    stock: 60,
    rating: 4.9,
    images: [
      "https://images.unsplash.com/photo-1612208695882-02f2322b7fee?w=800&q=80",
      "https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&q=80",
    ],
    categorySlug: "home-kitchen",
  },
  {
    title: "Philips Hue Smart Bulb Starter Kit",
    description:
      "Four A19 white and colour ambiance bulbs plus a Hue Bridge. Control 16 million colours and all shades of white light via app, voice, or schedule. Works with Amazon Alexa, Google Home, and Apple HomeKit.",
    price: 199.99,
    stock: 130,
    rating: 4.6,
    images: [
      "https://images.unsplash.com/photo-1565814636199-ae8133055c1c?w=800&q=80",
      "https://images.unsplash.com/photo-1558002038-1055907df827?w=800&q=80",
    ],
    categorySlug: "home-kitchen",
  },
  {
    title: "Cuisinart 12-Cup Programmable Coffee Maker",
    description:
      "Fully automatic with a 24-hour programmable timer, brew-strength selector (regular or bold), a self-clean function, and a 12-cup thermal carafe. Brew Pause™ lets you sneak a cup before brewing is finished.",
    price: 79.99,
    stock: 140,
    rating: 4.5,
    images: [
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80",
      "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&q=80",
    ],
    categorySlug: "home-kitchen",
  },
  {
    title: "Saatva Classic Innerspring Mattress Queen",
    description:
      "Dual steel coil system — individually wrapped coils over tempered steel for exceptional support and minimal motion transfer. Euro pillow top, organic cotton cover, and lumbar zone support. 365-night home trial and white-glove delivery.",
    price: 1795.0,
    stock: 18,
    rating: 4.9,
    images: [
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800&q=80",
      "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80",
    ],
    categorySlug: "home-kitchen",
  },
  {
    title: "OXO Good Grips 20-Piece Kitchen Tool Set",
    description:
      "Everything you need in one go: spatulas, ladle, pasta server, slotted spoon, whisk, tongs, and more — all with non-slip SoftGrip handles and BPA-free nylon heads safe up to 400 °F. Dishwasher-safe and built to last.",
    price: 69.99,
    stock: 175,
    rating: 4.7,
    images: [
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80",
      "https://images.unsplash.com/photo-1594228841690-6c3a31cfd3e4?w=800&q=80",
    ],
    categorySlug: "home-kitchen",
  },

  // ── Sports & Fitness (continued) ───────────────────────────────────────────
  {
    title: "TRX HOME2 Suspension Trainer",
    description:
      "Train anywhere with a single anchor point. The TRX HOME2 includes 14 ft of strapping, a door anchor, two rubber handles, and access to 100+ video workouts. Build strength, stability, and core power with bodyweight resistance.",
    price: 199.99,
    stock: 110,
    rating: 4.7,
    images: [
      "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80",
      "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=800&q=80",
    ],
    categorySlug: "sports-fitness",
  },
  {
    title: "Hydro Flask 32 oz Wide Mouth Water Bottle",
    description:
      "TempShield double-wall vacuum insulation keeps drinks cold for 24 hours and hot for 12. 18/8 pro-grade stainless steel, BPA-free, and durable powder coat exterior stands up to everyday adventures. Leak-proof Flex Cap included.",
    price: 44.95,
    stock: 400,
    rating: 4.8,
    images: [
      "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&q=80",
      "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&q=80",
    ],
    categorySlug: "sports-fitness",
  },
  {
    title: "Wilson Pro Staff 97 Tennis Racket",
    description:
      "Used by Roger Federer's foundation. Braided graphite construction, 97 sq-in head size, and a 290 g strung weight balance power and precision. Ships with a protective cover. Ideal for advanced intermediate to professional players.",
    price: 229.99,
    stock: 55,
    rating: 4.8,
    images: [
      "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&q=80",
      "https://images.unsplash.com/photo-1617083934555-ac68e76bc2e6?w=800&q=80",
    ],
    categorySlug: "sports-fitness",
  },
  {
    title: "Manduka PRO Yoga Mat 6mm",
    description:
      "Certified non-toxic, high-density cushioning with a moisture-wicking surface that gets more grippy over time. 6 mm thick, 71-inch long, and backed by a lifetime guarantee. The preferred mat of professional yoga teachers worldwide.",
    price: 128.0,
    stock: 145,
    rating: 4.9,
    images: [
      "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&q=80",
      "https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?w=800&q=80",
    ],
    categorySlug: "sports-fitness",
  },
  {
    title: "Concept2 RowErg Indoor Rowing Machine",
    description:
      "The rowing machine used in Olympic training facilities worldwide. PM5 performance monitor tracks distance, pace, calories, and watts. Air damper provides a smooth, consistent pull. Separates for easy storage.",
    price: 1040.0,
    stock: 20,
    rating: 4.9,
    images: [
      "https://images.unsplash.com/photo-1558611848-73f7eb4001a1?w=800&q=80",
      "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800&q=80",
    ],
    categorySlug: "sports-fitness",
  },
  {
    title: "Osprey Atmos AG 65 Hiking Backpack",
    description:
      "Anti-Gravity suspension with a continuous tensioned mesh back panel conforms to your back and eliminates hotspots on long days. 65-litre main compartment, integrated rain cover, and an Airspeed suspended mesh hip belt.",
    price: 330.0,
    stock: 45,
    rating: 4.8,
    images: [
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80",
      "https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=800&q=80",
    ],
    categorySlug: "sports-fitness",
  },
  {
    title: "NordicTrack T 6.5 Si Treadmill",
    description:
      "2.6 CHP DurX motor, 10-inch SmartHD touchscreen, iFit-enabled with automatic trainer control. 20 % incline and -3 % decline simulation, FlexSelect cushioning for joint protection, and a SpaceSaver design that folds vertically.",
    price: 999.99,
    stock: 25,
    rating: 4.6,
    images: [
      "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80",
      "https://images.unsplash.com/photo-1576678927484-cc907957088c?w=800&q=80",
    ],
    categorySlug: "sports-fitness",
  },

  // ── Books (continued) ──────────────────────────────────────────────────────
  {
    title: "The 48 Laws of Power — Robert Greene",
    description:
      "Drawing on three thousand years of the history of power, the book distils the fundamental laws of power and provides historical examples for each. Whether you want to conserve your power or depose those above you, this is the essential guide.",
    price: 16.99,
    stock: 420,
    rating: 4.7,
    images: [
      "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&q=80",
      "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80",
    ],
    categorySlug: "books",
  },
  {
    title: "Thinking, Fast and Slow — Daniel Kahneman",
    description:
      "Nobel laureate Kahneman takes us on a groundbreaking tour of the mind, explaining the two systems that drive the way we think — the fast, intuitive, emotional System 1 and the slower, more deliberate, logical System 2.",
    price: 17.99,
    stock: 390,
    rating: 4.8,
    images: [
      "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&q=80",
      "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=800&q=80",
    ],
    categorySlug: "books",
  },
  {
    title: "Zero to One — Peter Thiel",
    description:
      "Notes on startups and how to build the future. Thiel argues that doing what someone else already knows how to do takes the world from 1 to n, but when you do something new, you go from 0 to 1. Essential reading for every founder.",
    price: 14.99,
    stock: 350,
    rating: 4.7,
    images: [
      "https://images.unsplash.com/photo-1603400521630-9f2de124b33b?w=800&q=80",
      "https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=800&q=80",
    ],
    categorySlug: "books",
  },
  {
    title: "Sapiens: A Brief History of Humankind — Yuval Noah Harari",
    description:
      "A sweeping narrative of humanity's creation and evolution from the Stone Age to the twenty-first century. Harari covers the cognitive revolution, the agricultural revolution, the scientific revolution, and what the future may hold.",
    price: 18.99,
    stock: 460,
    rating: 4.8,
    images: [
      "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80",
      "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&q=80",
    ],
    categorySlug: "books",
  },
  {
    title: "The Lean Startup — Eric Ries",
    description:
      "The Lean Startup methodology teaches companies to use Build-Measure-Learn feedback loops to speed through the product development cycle. Applicable to startups and large enterprises alike, this has become the handbook for modern entrepreneurship.",
    price: 16.99,
    stock: 310,
    rating: 4.6,
    images: [
      "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=800&q=80",
      "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&q=80",
    ],
    categorySlug: "books",
  },
  {
    title: "Can't Hurt Me — David Goggins",
    description:
      "Master your mind and defy the odds. Goggins shares how he transformed himself from a depressed, overweight young man with no future into the only member of the US Armed Forces to complete SEAL training, Army Ranger School, and Air Force Tactical Air Controller training.",
    price: 15.99,
    stock: 480,
    rating: 4.9,
    images: [
      "https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=800&q=80",
      "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80",
    ],
    categorySlug: "books",
  },

  // ── Beauty & Personal Care (continued) ─────────────────────────────────────
  {
    title: "Olaplex No. 3 Hair Perfector 3.3 oz",
    description:
      "At-home treatment that reduces breakage and visibly strengthens hair. The patented bis-aminopropyl diglycol dimaleate technology repairs damaged bonds in all hair types. Use weekly as a pre-shampoo treatment for salon-quality results.",
    price: 28.0,
    stock: 320,
    rating: 4.7,
    images: [
      "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=800&q=80",
      "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80",
    ],
    categorySlug: "beauty-personal-care",
  },
  {
    title: "COSRX Advanced Snail 96 Mucin Power Essence",
    description:
      "96 % snail secretion filtrate delivers intense hydration, accelerates skin repair, and fades dark spots and blemishes with continued use. Lightweight, fragrance-free formula absorbs instantly without stickiness. Suitable for all skin types.",
    price: 25.0,
    stock: 280,
    rating: 4.8,
    images: [
      "https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=800&q=80",
      "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&q=80",
    ],
    categorySlug: "beauty-personal-care",
  },
  {
    title: "Fenty Beauty Pro Filt'r Soft Matte Foundation",
    description:
      "50 inclusive shades with a soft-matte, transfer-resistant finish that lasts 24 hours. Oil-free, water-resistant formula provides medium-to-full buildable coverage and blurs the look of pores. Suitable for all skin tones and types.",
    price: 38.0,
    stock: 350,
    rating: 4.7,
    images: [
      "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&q=80",
      "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=800&q=80",
    ],
    categorySlug: "beauty-personal-care",
  },
  {
    title: "Theragun Prime Percussive Therapy Device",
    description:
      "16 mm amplitude and 2400 percussions per minute reduce muscle soreness, stiffness, and tension in 30 seconds. 5 built-in speeds (1750–2400 rpm), Bluetooth-connected, 120-minute battery, and 4 attachments for full-body recovery.",
    price: 299.99,
    stock: 80,
    rating: 4.7,
    images: [
      "https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=800&q=80",
      "https://images.unsplash.com/photo-1594737625785-a6cbdabd333c?w=800&q=80",
    ],
    categorySlug: "beauty-personal-care",
  },
  {
    title: "Charlotte Tilbury Pillow Talk Lipstick",
    description:
      "The world's most universally flattering lipstick shade — a dreamy pinkish-nude with warm, peachy undertones that complement every skin tone. Satin-matte finish with a moisturising formula. Charlotte's iconic signature shade.",
    price: 34.0,
    stock: 300,
    rating: 4.8,
    images: [
      "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=800&q=80",
      "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&q=80",
    ],
    categorySlug: "beauty-personal-care",
  },
  {
    title: "Neutrogena Hydro Boost Water Gel SPF 30",
    description:
      "Oil-free daily moisturiser with SPF 30 and hyaluronic acid that quenches dry skin and keeps it looking smooth and supple. Lightweight gel formula absorbs instantly. Dermatologist-recommended and suitable for sensitive skin.",
    price: 21.99,
    stock: 400,
    rating: 4.6,
    images: [
      "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=800&q=80",
      "https://images.unsplash.com/photo-1631729371254-42c2892f0e6e?w=800&q=80",
    ],
    categorySlug: "beauty-personal-care",
  },

  // ── Toys & Games (continued) ───────────────────────────────────────────────
  {
    title: "Nintendo Switch OLED Model",
    description:
      "Vibrant 7-inch OLED screen, enhanced audio, a wide adjustable stand, a dock with a wired LAN port, and 64 GB of internal storage. Play at home on your TV or take it on the go — the most versatile gaming system ever made.",
    price: 349.99,
    stock: 95,
    rating: 4.9,
    images: [
      "https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?w=800&q=80",
      "https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?w=800&q=80",
    ],
    categorySlug: "toys-games",
  },
  {
    title: "LEGO Icons Botanical Collection Orchid",
    description:
      "Build a stunning artificial orchid with a mix of soft and hard plastic elements for lifelike petals and textures. 608 pieces. Display it anywhere without watering or sunlight. A perfect gift for adults who love plants and MINDFULNESS building.",
    price: 49.99,
    stock: 140,
    rating: 4.8,
    images: [
      "https://images.unsplash.com/photo-1558877385-81a1c7e67d72?w=800&q=80",
      "https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=800&q=80",
    ],
    categorySlug: "toys-games",
  },
  {
    title: "Monopoly Classic Board Game",
    description:
      "Buy, sell, and trade your way to fortune with the classic version of the world's favourite property trading game. Includes 28 title deed cards, 16 Community Chest and 16 Chance cards, 2 dice, and 8 iconic tokens. Ages 8+.",
    price: 24.99,
    stock: 300,
    rating: 4.5,
    images: [
      "https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?w=800&q=80",
      "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=80",
    ],
    categorySlug: "toys-games",
  },
  {
    title: "Ravensburger 1000-Piece Jigsaw Puzzle",
    description:
      "Premium quality puzzle with Softclick technology — each piece fits precisely, and the finished puzzle lies perfectly flat. Printed with fine-art quality inks on linen-structured paper to reduce glare. Great for ages 12 and up.",
    price: 19.99,
    stock: 220,
    rating: 4.6,
    images: [
      "https://images.unsplash.com/photo-1611996575749-79a3a250f948?w=800&q=80",
      "https://images.unsplash.com/photo-1596460107916-430662021049?w=800&q=80",
    ],
    categorySlug: "toys-games",
  },
  {
    title: "Hot Wheels 20-Car Gift Pack",
    description:
      "20 individually packaged die-cast 1 : 64 scale vehicles featuring a mix of original designs, exotic cars, and trucks. Each car sports its own authentic deco, real rubber tires, and chrome detailing. Ages 3+.",
    price: 29.99,
    stock: 350,
    rating: 4.7,
    images: [
      "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=800&q=80",
      "https://images.unsplash.com/photo-1558877385-81a1c7e67d72?w=800&q=80",
    ],
    categorySlug: "toys-games",
  },
  {
    title: "Barbie Dreamhouse (2023 Edition)",
    description:
      "3-story, 10-room house with a working elevator, pool with a slide, rooftop deck, and 75+ accessories — including furniture and a swing set. Compatible with most Barbie dolls. Over 2.9 feet tall and 5.8 feet wide when fully assembled.",
    price: 199.99,
    stock: 65,
    rating: 4.7,
    images: [
      "https://images.unsplash.com/photo-1558877385-81a1c7e67d72?w=800&q=80",
      "https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=800&q=80",
    ],
    categorySlug: "toys-games",
  },

  // ── Furniture (continued) ──────────────────────────────────────────────────
  {
    title: "Eames Style Lounge Chair & Ottoman",
    description:
      "Inspired by the 1956 Charles and Ray Eames original. Moulded plywood shell, genuine top-grain leather upholstery, and a 360-degree swivel base. Deep seat and angled back provide exceptional full-body support and timeless mid-century modern style.",
    price: 899.99,
    stock: 22,
    rating: 4.8,
    images: [
      "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&q=80",
      "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80",
    ],
    categorySlug: "furniture",
  },
  {
    title: "MALM 6-Drawer Dresser — White",
    description:
      "Smooth-running drawers with integrated stops keep contents secure. Tested and approved for wall-anchoring with the included tip-over tether for child safety. 63 × 30-inch footprint in crisp white works with any bedroom décor.",
    price: 279.99,
    stock: 40,
    rating: 4.5,
    images: [
      "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=800&q=80",
      "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80",
    ],
    categorySlug: "furniture",
  },
  {
    title: "Floating Wall Shelves Set of 3",
    description:
      "Minimalist MDF shelves with a piano-lacquer finish. Concealed mounting hardware gives a clean, floating look. Each shelf holds up to 22 lbs and measures 24 × 8 × 1.5 inches. Perfect for books, frames, and small décor items.",
    price: 59.99,
    stock: 200,
    rating: 4.6,
    images: [
      "https://images.unsplash.com/photo-1564540586988-aa4e53c3d799?w=800&q=80",
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80",
    ],
    categorySlug: "furniture",
  },
  {
    title: "West Elm Mid-Century Bed Frame Queen",
    description:
      "Solid-wood legs and a low-profile headboard in a walnut finish bring timeless mid-century style to any bedroom. Sturdy slat system eliminates the need for a box spring. Supports up to 1 000 lbs. Available in Full, Queen, and King.",
    price: 699.99,
    stock: 28,
    rating: 4.7,
    images: [
      "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80",
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800&q=80",
    ],
    categorySlug: "furniture",
  },
  {
    title: "Bookshelf 5-Tier Industrial Ladder Shelf",
    description:
      "Leaning ladder design with five sturdy MDF shelves and a black powder-coated steel frame. 71-inch tall footprint is space-efficient. Holds books, plants, picture frames, and décor. No-wobble, anti-topple straps included.",
    price: 129.99,
    stock: 75,
    rating: 4.6,
    images: [
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80",
      "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80",
    ],
    categorySlug: "furniture",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 3. Deals  (must reference products that already exist in PRODUCTS above)
// ─────────────────────────────────────────────────────────────────────────────

type DealSeed = {
  productTitle: string;
  discountPercent: number;
  badgeLabel: string;
  endsAt: Date;
};

const now = new Date();

const DEALS: DealSeed[] = [
  {
    productTitle: "Sony WH-1000XM5 Headphones",
    discountPercent: 20,
    badgeLabel: "Weekend Deal",
    endsAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days
  },
  {
    productTitle: "Slim-Fit Stretch Denim Jeans",
    discountPercent: 30,
    badgeLabel: "Flash Sale",
    endsAt: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000), // 1 day
  },
  {
    productTitle: "Instant Pot Duo 7-in-1 6 Qt",
    discountPercent: 25,
    badgeLabel: "Season Sale",
    endsAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days
  },
  {
    productTitle: "Resistance Bands Set (5-Pack)",
    discountPercent: 15,
    badgeLabel: "Member Deal",
    endsAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), // 5 days
  },
  {
    productTitle: "Atomic Habits — James Clear",
    discountPercent: 10,
    badgeLabel: "Book Club",
    endsAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), // 14 days
  },
  {
    productTitle: "CeraVe Moisturising Cream 19 oz",
    discountPercent: 18,
    badgeLabel: "Beauty Week",
    endsAt: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000), // 4 days
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 4. New Arrivals  (most recently added products to feature on homepage)
// ─────────────────────────────────────────────────────────────────────────────

const NEW_ARRIVAL_TITLES: string[] = [
  "MacBook Pro 14-inch M3",
  "Apple Watch Series 9 45mm",
  "Nike Air Max 270 Sneakers",
  "Garmin Forerunner 265 GPS Watch",
  "LEGO Technic Land Rover Defender (2 573 pcs)",
  "Solid Oak Standing Desk 60×30\"",
  "La Mer Crème de la Mer 1 oz",
  "Deep Work — Cal Newport",
];

// ─────────────────────────────────────────────────────────────────────────────
// Seed entry point
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱  Starting database seed…\n");

  // ── Step 0: Upsert superAdmin ──────────────────────────────────────────────
  console.log("👑  Seeding superAdmin…");

  const SUPERADMIN_EMAIL    = process.env.SUPERADMIN_EMAIL    ?? "superadmin@store.dev";
  const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD ?? "SuperAdmin@123";
  const SUPERADMIN_NAME     = process.env.SUPERADMIN_NAME     ?? "Super Admin";

  const hashedPassword = await bcrypt.hash(SUPERADMIN_PASSWORD, 12);

  const superAdmin = await prisma.user.upsert({
    where:  { email: SUPERADMIN_EMAIL },
    update: { name: SUPERADMIN_NAME, role: "SUPERADMIN" },
    create: {
      name:     SUPERADMIN_NAME,
      email:    SUPERADMIN_EMAIL,
      password: hashedPassword,
      role:     "SUPERADMIN",
    },
  });

  console.log(`   ✅  ${superAdmin.name}  <${superAdmin.email}>  (role: ${superAdmin.role})\n`);

  // ── Step 0b: Upsert admin ──────────────────────────────────────────────────
  console.log("🛡️   Seeding admin…");

  const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    ?? "admin@store.dev";
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "Admin@123";
  const ADMIN_NAME     = process.env.ADMIN_NAME     ?? "Store Admin";

  const adminHashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const admin = await prisma.user.upsert({
    where:  { email: ADMIN_EMAIL },
    update: { name: ADMIN_NAME, role: "ADMIN" },
    create: {
      name:     ADMIN_NAME,
      email:    ADMIN_EMAIL,
      password: adminHashedPassword,
      role:     "ADMIN",
    },
  });

  console.log(`   ✅  ${admin.name}  <${admin.email}>  (role: ${admin.role})\n`);

  // ── Step 1: Upsert categories ─────────────────────────────────────────────
  console.log("📂  Seeding categories…");
  const categoryMap = new Map<string, string>(); // slug → id

  for (const cat of CATEGORIES) {
    const record = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        description: cat.description,
        imageUrl: cat.imageUrl,
      },
      create: {
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        imageUrl: cat.imageUrl,
      },
    });
    categoryMap.set(cat.slug, record.id);
    console.log(`   ✅  ${cat.name}  (id: ${record.id})`);
  }

  // ── Step 2: Upsert products ───────────────────────────────────────────────
  console.log("\n📦  Seeding products…");

  for (const product of PRODUCTS) {
    const categoryId = categoryMap.get(product.categorySlug);
    if (!categoryId) {
      console.warn(
        `   ⚠️   No category found for slug "${product.categorySlug}" — skipping "${product.title}"`
      );
      continue;
    }

    const record = await prisma.product.upsert({
      where: { id: (await prisma.product.findFirst({ where: { title: product.title } }))?.id ?? "" },
      update: {
        description: product.description,
        price: product.price,
        stock: product.stock,
        rating: product.rating,
        images: product.images,
        categoryId,
      },
      create: {
        title: product.title,
        description: product.description,
        price: product.price,
        stock: product.stock,
        rating: product.rating,
        images: product.images,
        categoryId,
      },
    });
    console.log(`   ✅  ${record.title}`);
  }

  // Build a title → id lookup for deals and new arrivals
  const allProducts = await prisma.product.findMany({ select: { id: true, title: true } });
  const productMap = new Map(allProducts.map((p) => [p.title, p.id]));

  // ── Step 3: Upsert deals ──────────────────────────────────────────────────
  console.log("\n🏷️   Seeding deals…");

  for (const deal of DEALS) {
    const productId = productMap.get(deal.productTitle);
    if (!productId) {
      console.warn(
        `   ⚠️   Product not found: "${deal.productTitle}" — skipping deal`
      );
      continue;
    }

    await prisma.deal.upsert({
      where: { productId },
      update: {
        discountPercent: deal.discountPercent,
        badgeLabel: deal.badgeLabel,
        endsAt: deal.endsAt,
        isActive: true,
      },
      create: {
        productId,
        discountPercent: deal.discountPercent,
        badgeLabel: deal.badgeLabel,
        endsAt: deal.endsAt,
        isActive: true,
      },
    });
    console.log(
      `   ✅  ${deal.productTitle}  (${deal.discountPercent} % off — "${deal.badgeLabel}")`
    );
  }

  // ── Step 4: Upsert new arrivals ───────────────────────────────────────────
  console.log("\n🆕  Seeding new arrivals…");

  for (const title of NEW_ARRIVAL_TITLES) {
    const productId = productMap.get(title);
    if (!productId) {
      console.warn(`   ⚠️   Product not found: "${title}" — skipping new arrival`);
      continue;
    }

    await prisma.newArrival.upsert({
      where: { productId },
      update: { isActive: true },
      create: { productId, isActive: true },
    });
    console.log(`   ✅  ${title}`);
  }

  console.log("\n✅  Seed completed successfully.");
}

main()
  .catch((error) => {
    console.error("❌  Seed failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
