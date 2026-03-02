import Link from "next/link";
import Image from "next/image";
import { unstable_cache } from "next/cache";
import {
  ArrowRight,
  Star,
  TrendingUp,
  Zap,
  Shield,
  ShoppingBag,
  Users,
  Package,
  BadgeCheck,
  Flame,
  Sparkles,
} from "lucide-react";
import ProductCard, { type ProductCardData } from "@/components/ProductCard";
import NewsletterForm from "@/components/NewsletterForm";
import prisma from "@/lib/prisma";
import { getWishlistProductIds } from "@/lib/actions/wishlist";
import { isEnabled } from "@/lib/actions/feature-flags";
import { FLAGS } from "@/lib/flags";

// ── Always dynamic — homepage shows per-user wishlist state ──────────────────
export const dynamic = "force-dynamic";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CategoryItem {
  id:       string;
  name:     string;
  slug:     string;
  imageUrl: string | null;
}

// ── Static / UI data ─────────────────────────────────────────────────────────

/** Emoji fallbacks for categories that have no imageUrl in the DB. */
const CATEGORY_EMOJIS: Record<string, string> = {
  Electronics:              "💻",
  Clothing:                 "👗",
  "Home & Kitchen":         "🍳",
  "Sports & Fitness":       "🏋️",
  Books:                    "📚",
  "Beauty & Personal Care": "✨",
  "Toys & Games":           "🎮",
  Furniture:                "🪑",
};

/** Trust ticker shown beneath the hero. */
const TICKER_ITEMS = [
  "🚀 Free shipping on orders over $50",
  "🔥 New arrivals added every week",
  "🛡️ 30-day hassle-free returns",
  "⭐ Over 10,000 five-star reviews",
  "💳 Secure checkout with SSL encryption",
  "🎁 Gift wrapping available at checkout",
];

const features = [
  {
    Icon: Zap,
    title: "Lightning Fast Delivery",
    desc: "Same-day delivery available in select cities.",
    color: "bg-amber-50 text-amber-600",
  },
  {
    Icon: Shield,
    title: "Buyer Protection",
    desc: "Your money is safe until you confirm delivery.",
    color: "bg-green-50 text-green-600",
  },
  {
    Icon: Star,
    title: "Verified Reviews",
    desc: "Real reviews from real verified shoppers.",
    color: "bg-blue-50 text-blue-600",
  },
  {
    Icon: TrendingUp,
    title: "Best Price Guarantee",
    desc: "Found it cheaper? We'll match the price.",
    color: "bg-indigo-50 text-indigo-600",
  },
];

// ── Data fetching (Server Component) ─────────────────────────────────────────

async function getFeaturedProducts(): Promise<ProductCardData[]> {
  try {
    const raw = await prisma.product.findMany({
      take: 8,
      orderBy: { rating: "desc" },
      select: {
        id:          true,
        title:       true,
        description: true,
        price:       true,
        stock:       true,
        category:    { select: { name: true } },
        rating:      true,
        images:      true,
      },
    });
    return raw.map(({ category, ...p }) => ({ ...p, category: category.name }));
  } catch {
    return [];
  }
}

async function getCategoriesWithImages(): Promise<CategoryItem[]> {
  try {
    return await prisma.category.findMany({
      select:  { id: true, name: true, slug: true, imageUrl: true },
      orderBy: { name: "asc" },
    });
  } catch {
    return [];
  }
}

// ── Site stats (real counts + aggregates from DB) ────────────────────────────
//
// Cached for 60 s (ISR-style) so the four aggregate queries don't run on
// every single page render. Falls back to neutral defaults on DB error.

interface SiteStats {
  productCount:  number;
  userCount:     number;
  deliveryRate:  string; // e.g. "98%"
  averageRating: string; // e.g. "4.8★"
}

const getSiteStats = unstable_cache(
  async (): Promise<SiteStats> => {
  try {
    const [productCount, userCount, orderStats, ratingAgg] = await Promise.all([
      prisma.product.count(),
      prisma.user.count(),
      prisma.order.groupBy({
        by: ["status"],
        _count: { id: true },
        where: { status: { in: ["DELIVERED", "SHIPPED", "PROCESSING", "CANCELLED"] } },
      }),
      prisma.product.aggregate({ _avg: { rating: true } }),
    ]);

    const statusMap = Object.fromEntries(
      orderStats.map((r) => [r.status, r._count.id])
    );
    const delivered   = statusMap["DELIVERED"]  ?? 0;
    const cancelled   = statusMap["CANCELLED"]  ?? 0;
    const totalTracked = Object.values(statusMap).reduce((a, b) => a + b, 0);
    const completable  = totalTracked - cancelled;
    const deliveryRate =
      completable > 0
        ? `${Math.round((delivered / completable) * 100)}%`
        : "100%";

    const avg = ratingAgg._avg.rating ?? 0;
    const averageRating = avg > 0 ? `${avg.toFixed(1)}★` : "—";

    return { productCount, userCount, deliveryRate, averageRating };
  } catch {
    return { productCount: 0, userCount: 0, deliveryRate: "100%", averageRating: "—" };
  }
},
  ["site-stats"],
  { revalidate: 60 },
);

// ── Hero visual (right column) ────────────────────────────────────────────────

function HeroVisual({ userCount }: { userCount: number }) {
  const cards = [
    {
      emoji: "💻",
      name: "Wireless Headphones",
      price: "$299",
      rating: 4.8,
      bg: "from-blue-50 to-indigo-100",
      pos: "top-4 right-0",
    },
    {
      emoji: "👟",
      name: "Running Shoes Pro",
      price: "$119",
      rating: 4.5,
      bg: "from-orange-50 to-amber-100",
      pos: "top-32 left-0",
    },
    {
      emoji: "🏋️",
      name: "Adjustable Dumbbells",
      price: "$399",
      rating: 4.7,
      bg: "from-green-50 to-emerald-100",
      pos: "bottom-0 right-8",
    },
  ];

  return (
    <div className="relative hidden h-96 w-full lg:flex lg:items-center lg:justify-center">
      {/* Glow blobs */}
      <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute right-0 top-10 h-40 w-40 rounded-full bg-violet-400/20 blur-2xl" />

      {/* Central badge */}
      <div className="relative z-10 flex h-36 w-36 flex-col items-center justify-center rounded-3xl bg-white/20 backdrop-blur-md shadow-2xl border border-white/30 text-center">
        <ShoppingBag className="h-10 w-10 text-white" strokeWidth={1.5} />
        <p className="mt-2 text-xs font-bold uppercase tracking-widest text-white/90">
          ShopNest
        </p>
        <p className="text-[10px] text-white/60 mt-0.5">Est. 2024</p>
      </div>

      {/* Floating product cards */}
      {cards.map((c) => (
        <div
          key={c.name}
          className={`absolute ${c.pos} flex w-48 items-center gap-3 rounded-2xl bg-white/90 p-3.5 shadow-xl backdrop-blur-sm border border-white/60`}
        >
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br ${c.bg} text-2xl`}
          >
            {c.emoji}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-gray-800">{c.name}</p>
            <p className="text-xs font-bold text-indigo-600">{c.price}</p>
            <div className="mt-0.5 flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-2.5 w-2.5 ${i < Math.round(c.rating) ? "fill-amber-400 text-amber-400" : "fill-gray-100 text-gray-300"}`}
                  strokeWidth={1}
                />
              ))}
            </div>
          </div>
        </div>
      ))}

      {/* Stats pill */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 backdrop-blur-sm border border-white/30">
        <span className="h-2 w-2 animate-pulse rounded-full bg-green-400 shadow-[0_0_6px_#4ade80]" />
        <span className="text-xs font-semibold text-white">
          {userCount > 0 ? `${userCount.toLocaleString()}+` : "Growing"} happy customers
        </span>
      </div>
    </div>
  );
}

// ── Empty state for products ─────────────────────────────────────────────────

function NoProducts() {
  return (
    <div className="col-span-full flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-16 text-center">
      <Package className="h-12 w-12 text-gray-300" strokeWidth={1.5} />
      <div>
        <p className="text-sm font-semibold text-gray-500">No products yet</p>
        <p className="mt-1 text-xs text-gray-400">
          Run{" "}
          <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">
            pnpm db:seed
          </code>{" "}
          to populate the database.
        </p>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const [featuredProducts, siteStats, wishlistedIds, dbCategories, wishlistEnabled] = await Promise.all([
    getFeaturedProducts(),
    getSiteStats(),
    getWishlistProductIds(),
    getCategoriesWithImages(),
    isEnabled(FLAGS.WISHLIST_ENABLED),
  ]);

  const stats = [
    {
      Icon: ShoppingBag,
      value: siteStats.productCount > 0 ? `${siteStats.productCount.toLocaleString()}+` : "—",
      label: "Products",
    },
    {
      Icon: Users,
      value: siteStats.userCount > 0 ? `${siteStats.userCount.toLocaleString()}+` : "—",
      label: "Happy Customers",
    },
    { Icon: Package,    value: siteStats.deliveryRate,  label: "On-time Delivery" },
    { Icon: BadgeCheck, value: siteStats.averageRating, label: "Avg. Rating"       },
  ];

  return (
    <div className="space-y-20">

      {/* ════════════════════════════════════════
          HERO
      ════════════════════════════════════════ */}
      <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-indigo-600 via-indigo-700 to-violet-800 px-8 py-16 text-white shadow-2xl sm:px-12 sm:py-20 lg:px-16">
        {/* Background decoration */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-0 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="pointer-events-none absolute right-1/3 bottom-0 h-48 w-48 rounded-full bg-indigo-400/20 blur-2xl" />

        <div className="relative grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          {/* ── Left: Text ── */}
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-widest backdrop-blur-sm border border-white/20">
              <Sparkles className="h-3 w-3" />
              New season arrivals
            </span>

            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Discover
              <br />
              <span className="bg-linear-to-r from-indigo-200 to-violet-200 bg-clip-text text-transparent">
                Premium Products
              </span>
            </h1>

            <p className="mt-5 max-w-md text-base leading-relaxed text-indigo-100 sm:text-lg">
              Shop thousands of curated products across every category — from
              cutting-edge electronics to everyday essentials, all at unbeatable
              prices.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/products"
                className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-bold text-indigo-700 shadow-lg transition hover:bg-indigo-50 hover:shadow-xl active:scale-95"
              >
                Shop Now <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/deals"
                className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-7 py-3 text-sm font-semibold backdrop-blur-sm transition hover:bg-white/20 active:scale-95"
              >
                <Flame className="h-4 w-4 text-orange-300" />
                Hot Deals
              </Link>
            </div>

            {/* Mini stats */}
            <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              {stats.map(({ Icon, value, label }) => (
                <div key={label} className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                    <Icon className="h-4 w-4 text-indigo-200" />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold leading-none text-white">{value}</p>
                    <p className="mt-0.5 text-[11px] leading-none text-indigo-300">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: Floating visual ── */}
          <HeroVisual userCount={siteStats.userCount} />
        </div>
      </section>

      {/* ════════════════════════════════════════
          TRUST TICKER
      ════════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-2xl bg-indigo-600 py-3">
        <div className="flex gap-10 overflow-x-auto whitespace-nowrap px-6 scrollbar-none sm:flex-wrap sm:justify-center sm:overflow-visible sm:gap-8">
          {TICKER_ITEMS.map((item) => (
            <span key={item} className="shrink-0 text-xs font-semibold text-indigo-100">
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════
          CATEGORIES
      ════════════════════════════════════════ */}
      <section>
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
              Browse by Category
            </p>
            <h2 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">
              Shop All Categories
            </h2>
          </div>
          <Link
            href="/products"
            className="hidden items-center gap-1 text-sm font-medium text-indigo-600 transition hover:underline sm:flex"
          >
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {dbCategories.map((cat) => (
            <Link
              key={cat.id}
              href={`/products?category=${encodeURIComponent(cat.name)}`}
              className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              {cat.imageUrl ? (
                /* Image card */
                <div className="relative h-32 w-full overflow-hidden sm:h-36">
                  <Image
                    src={cat.imageUrl}
                    alt={cat.name}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                  {/* Dark gradient overlay */}
                  <div className="absolute inset-0 bg-linear-to-t from-black/65 via-black/15 to-transparent" />
                  {/* Name overlay */}
                  <p className="absolute bottom-3 left-0 right-0 px-3 text-center text-sm font-bold text-white drop-shadow">
                    {cat.name}
                  </p>
                </div>
              ) : (
                /* Emoji fallback */
                <div className="flex h-32 w-full flex-col items-center justify-center gap-2.5 bg-indigo-50 transition group-hover:bg-indigo-100 sm:h-36">
                  <span className="text-4xl">
                    {CATEGORY_EMOJIS[cat.name] ?? "🛍️"}
                  </span>
                  <p className="text-sm font-semibold text-gray-700 group-hover:text-indigo-600">
                    {cat.name}
                  </p>
                </div>
              )}
            </Link>
          ))}
        </div>

        {/* Mobile view-all */}
        <div className="mt-6 flex justify-center sm:hidden">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-6 py-2.5 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100"
          >
            View all categories <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ════════════════════════════════════════
          FEATURED PRODUCTS
      ════════════════════════════════════════ */}
      <section>
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
              Handpicked for You
            </p>
            <h2 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">
              Featured Products
            </h2>
          </div>
          <Link
            href="/products"
            className="hidden items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 sm:inline-flex"
          >
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featuredProducts.length > 0 ? (
            featuredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isWishlisted={wishlistedIds.has(product.id)}
                showWishlist={wishlistEnabled}
              />
            ))
          ) : (
            <NoProducts />
          )}
        </div>

        {/* Mobile view-all */}
        <div className="mt-8 flex justify-center sm:hidden">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-6 py-3 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100"
          >
            View All Products <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ════════════════════════════════════════
          TWO-COL PROMO STRIP: Deals + New Arrivals
      ════════════════════════════════════════ */}
      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {/* Deals */}
        <Link
          href="/deals"
          className="group relative overflow-hidden rounded-3xl bg-linear-to-br from-amber-400 to-orange-500 p-8 text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl sm:p-10"
        >
          <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
          <Flame className="h-9 w-9 text-white/80" strokeWidth={1.5} />
          <h3 className="mt-4 text-xl font-extrabold leading-tight sm:text-2xl">
            Today&apos;s Hot Deals
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-orange-100">
            Up to 40% off — limited time only. Don&apos;t miss the savings.
          </p>
          <span className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-orange-600 shadow transition group-hover:bg-orange-50">
            Shop Deals <ArrowRight className="h-4 w-4" />
          </span>
        </Link>

        {/* New Arrivals */}
        <Link
          href="/new-arrivals"
          className="group relative overflow-hidden rounded-3xl bg-linear-to-br from-indigo-500 to-violet-700 p-8 text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl sm:p-10"
        >
          <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
          <Sparkles className="h-9 w-9 text-white/80" strokeWidth={1.5} />
          <h3 className="mt-4 text-xl font-extrabold leading-tight sm:text-2xl">
            New Arrivals
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-indigo-100">
            Fresh drops every week — be the first to shop the latest.
          </p>
          <span className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-indigo-600 shadow transition group-hover:bg-indigo-50">
            What&apos;s New <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      </section>

      {/* ════════════════════════════════════════
          WHY SHOPNEST
      ════════════════════════════════════════ */}
      <section className="rounded-3xl border border-gray-100 bg-white px-8 py-12 shadow-sm sm:px-10 lg:px-14">
        <div className="mb-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
            Why ShopNest
          </p>
          <h2 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">
            Shopping Made Better
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-gray-500">
            Every detail of ShopNest is built around you — from checkout to your door.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ Icon, title, desc, color }) => (
            <div
              key={title}
              className="group flex flex-col gap-4 rounded-2xl border border-gray-100 bg-gray-50/60 p-6 transition hover:border-gray-200 hover:bg-white hover:shadow-md"
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{title}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-gray-500">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════
          NEWSLETTER CTA
      ════════════════════════════════════════ */}
      <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-indigo-600 via-indigo-700 to-violet-800 px-8 py-14 text-white shadow-2xl sm:px-14">
        <div className="pointer-events-none absolute -left-16 top-0 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
        <div className="pointer-events-none absolute -right-10 bottom-0 h-48 w-48 rounded-full bg-violet-400/20 blur-2xl" />
        <div className="relative mx-auto max-w-xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-widest backdrop-blur-sm border border-white/20">
            📬 Stay in the loop
          </span>
          <h2 className="mt-4 text-2xl font-extrabold leading-tight sm:text-3xl lg:text-4xl">
            Get Exclusive Deals &amp;
            <br />
            <span className="text-indigo-200">Early Access</span>
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-indigo-100">
            Join thousands of shoppers who get first access to sales, new arrivals, and
            members-only offers.
          </p>
          <div className="mt-8">
            <NewsletterForm />
          </div>
        </div>
      </section>

    </div>
  );
}
