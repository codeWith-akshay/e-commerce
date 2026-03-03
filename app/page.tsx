import Link from "next/link";
import Image from "next/image";
import { unstable_cache } from "next/cache";
import {
  ArrowRight,
  Star,
  TrendingUp,
  Shield,
  ShoppingBag,
  Package,
  BadgeCheck,
  Flame,
  Award,
  Truck,
  RefreshCw,
  HeadphonesIcon,
  ChevronRight,
  Tag,
  Clock,
  Hash,
  Percent,
  Sparkles,
} from "lucide-react";
import ProductCard, { type ProductCardData } from "@/components/ProductCard";
import NewsletterForm from "@/components/NewsletterForm";
import prisma from "@/lib/prisma";
import { getWishlistProductIds } from "@/lib/actions/wishlist";
import { isEnabled } from "@/lib/actions/feature-flags";
import { FLAGS } from "@/lib/flags";

// ── Rendering strategy ────────────────────────────────────────────────────────
// The page is rendered per-request so the currently logged-in user's wishlist
// state can be server-rendered.  All heavy DB queries are wrapped in
// unstable_cache so they are ISR-cached at the query level (avoids cold DB
// hits on every request while still serving personalized wishlist data).

// ── Types ─────────────────────────────────────────────────────────────────────

interface CategoryItem {
  id:       string;
  name:     string;
  slug:     string;
  imageUrl: string | null;
}

interface HeroProduct {
  id:           string;
  title:        string;
  price:        number;
  comparePrice: number | null;
  rating:       number;
  images:       string[];
  category:     { name: string };
}

interface DealItem {
  id:              string;
  discountPercent: number;
  badgeLabel:      string;
  endsAt:          Date;
  timeRemaining:   string;   // pre-formatted at fetch time — no impure Date.now() in render
  product: {
    id:           string;
    title:        string;
    price:        number;
    comparePrice: number | null;
    rating:       number;
    ratingCount:  number;
    images:       string[];
    stock:        number;
    slug:         string | null;
    category:     { name: string };
  };
}

interface NewArrivalItem {
  id:         string;
  featuredAt: Date;
  product: {
    id:           string;
    title:        string;
    price:        number;
    comparePrice: number | null;
    rating:       number;
    ratingCount:  number;
    images:       string[];
    stock:        number;
    slug:         string | null;
    description:  string;
    category:     { name: string };
  };
}

interface ReviewItem {
  id:         string;
  rating:     number;
  title:      string | null;
  body:       string;
  isVerified: boolean;
  createdAt:  Date;
  user:       { name: string | null };
  product:    { title: string };
}

interface TagItem {
  id:     string;
  name:   string;
  slug:   string;
  _count: { products: number };
}

// ── Static / UI data ─────────────────────────────────────────────────────────

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

const CATEGORY_GRADIENTS: Record<string, string> = {
  Electronics:              "from-blue-600 to-cyan-500",
  Clothing:                 "from-pink-500 to-rose-400",
  "Home & Kitchen":         "from-orange-500 to-amber-400",
  "Sports & Fitness":       "from-green-500 to-emerald-400",
  Books:                    "from-violet-600 to-purple-400",
  "Beauty & Personal Care": "from-fuchsia-500 to-pink-400",
  "Toys & Games":           "from-yellow-500 to-orange-400",
  Furniture:                "from-stone-500 to-amber-600",
};

const TICKER_ITEMS = [
  { icon: "🚀", text: "Free shipping on orders over $50" },
  { icon: "🔥", text: "New arrivals added every week" },
  { icon: "🛡️", text: "30-day hassle-free returns" },
  { icon: "⭐", text: "Over 10,000 five-star reviews" },
  { icon: "💳", text: "Secure checkout with SSL encryption" },
  { icon: "🎁", text: "Gift wrapping available at checkout" },
  { icon: "⚡", text: "Same-day delivery in select cities" },
  { icon: "🏆", text: "Trusted by 50,000+ customers" },
];

const features = [
  {
    Icon: Truck,
    title: "Lightning Fast Delivery",
    desc: "Same-day delivery available in select cities. Track your order in real-time.",
    gradient: "from-amber-400 to-orange-500",
    glow: "shadow-amber-200",
  },
  {
    Icon: Shield,
    title: "Buyer Protection",
    desc: "Your money is safe until you confirm delivery. Full refund guarantee.",
    gradient: "from-emerald-400 to-green-500",
    glow: "shadow-green-200",
  },
  {
    Icon: Award,
    title: "Verified Reviews",
    desc: "Real reviews from real verified shoppers. No fake ratings ever.",
    gradient: "from-blue-400 to-indigo-500",
    glow: "shadow-blue-200",
  },
  {
    Icon: TrendingUp,
    title: "Best Price Guarantee",
    desc: "Found it cheaper? We'll match the price instantly. No questions asked.",
    gradient: "from-violet-400 to-purple-500",
    glow: "shadow-purple-200",
  },
];

const HERO_CARD_STYLES = [
  {
    bg: "from-blue-500/20 to-indigo-600/20",
    border: "border-blue-400/30",
    animClass: "animate-float-a",
    pos: "top-2 right-2",
  },
  {
    bg: "from-orange-500/20 to-amber-600/20",
    border: "border-orange-400/30",
    animClass: "animate-float-b",
    pos: "top-36 -left-4 sm:left-0",
  },
  {
    bg: "from-emerald-500/20 to-green-600/20",
    border: "border-emerald-400/30",
    animClass: "animate-float-c",
    pos: "bottom-4 right-10",
  },
];

// ── ISR-cached data fetchers ──────────────────────────────────────────────────

/** Top 8 active products by rating — revalidates every hour */
const getFeaturedProducts = unstable_cache(
  async (): Promise<ProductCardData[]> => {
    try {
      const raw = await prisma.product.findMany({
        take: 8,
        where: { isActive: true },
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
  },
  ["featured-products"],
  { revalidate: 3600 },
);

/** All active categories ordered by sortOrder — revalidates every 2 hours */
const getCategoriesWithImages = unstable_cache(
  async (): Promise<CategoryItem[]> => {
    try {
      return await prisma.category.findMany({
        where:   { isActive: true },
        select:  { id: true, name: true, slug: true, imageUrl: true },
        orderBy: { sortOrder: "asc" },
      });
    } catch {
      return [];
    }
  },
  ["categories"],
  { revalidate: 7200 },
);

interface SiteStats {
  productCount:  number;
  userCount:     number;
  deliveryRate:  string;
  averageRating: string;
}

/** Aggregate site stats — revalidates every 5 minutes */
const getSiteStats = unstable_cache(
  async (): Promise<SiteStats> => {
    try {
      const [productCount, userCount, orderStats, ratingAgg] = await Promise.all([
        prisma.product.count({ where: { isActive: true } }),
        prisma.user.count(),
        prisma.order.groupBy({
          by: ["status"],
          _count: { id: true },
          where: { status: { in: ["DELIVERED", "SHIPPED", "PROCESSING", "CANCELLED"] } },
        }),
        prisma.product.aggregate({ _avg: { rating: true } }),
      ]);

      const statusMap = Object.fromEntries(orderStats.map((r) => [r.status, r._count.id]));
      const delivered    = statusMap["DELIVERED"] ?? 0;
      const cancelled    = statusMap["CANCELLED"]  ?? 0;
      const totalTracked = Object.values(statusMap).reduce((a, b) => a + b, 0);
      const completable  = totalTracked - cancelled;
      const deliveryRate =
        completable > 0 ? `${Math.round((delivered / completable) * 100)}%` : "100%";

      const avg = ratingAgg._avg.rating ?? 0;
      return {
        productCount,
        userCount,
        deliveryRate,
        averageRating: avg > 0 ? `${avg.toFixed(1)}★` : "4.8★",
      };
    } catch {
      return { productCount: 0, userCount: 0, deliveryRate: "100%", averageRating: "4.8★" };
    }
  },
  ["site-stats"],
  { revalidate: 300 },
);

/** Top 3 products for hero floating cards — revalidates every hour */
const getHeroProducts = unstable_cache(
  async (): Promise<HeroProduct[]> => {
    try {
      return await prisma.product.findMany({
        take: 3,
        where: { isActive: true, stock: { gt: 0 } },
        orderBy: { rating: "desc" },
        select: {
          id:           true,
          title:        true,
          price:        true,
          comparePrice: true,
          rating:       true,
          images:       true,
          category:     { select: { name: true } },
        },
      });
    } catch {
      return [];
    }
  },
  ["hero-products"],
  { revalidate: 3600 },
);

/** Active deals ordered by highest discount — revalidates every 15 minutes */
const getActiveDeals = unstable_cache(
  async (): Promise<DealItem[]> => {
    try {
      const now = new Date();
      const rows = await prisma.deal.findMany({
        take: 6,
        where: {
          isActive: true,
          endsAt:   { gt: now },
          product:  { isActive: true },
        },
        orderBy: { discountPercent: "desc" },
        select: {
          id:              true,
          discountPercent: true,
          badgeLabel:      true,
          endsAt:          true,
          product: {
            select: {
              id:           true,
              title:        true,
              price:        true,
              comparePrice: true,
              rating:       true,
              ratingCount:  true,
              images:       true,
              stock:        true,
              slug:         true,
              category:     { select: { name: true } },
            },
          },
        },
      });
      // Pre-format the countdown string at fetch time so render stays pure
      return rows.map((row) => {
        const diff = Math.max(0, row.endsAt.getTime() - now.getTime());
        const h = Math.floor(diff / 3_600_000);
        const m = Math.floor((diff % 3_600_000) / 60_000);
        const timeRemaining = diff === 0
          ? "Expired"
          : `${h > 0 ? `${h}h ` : ""}${String(m).padStart(2, "0")}m left`;
        return { ...row, timeRemaining };
      });
    } catch {
      return [];
    }
  },
  ["active-deals"],
  { revalidate: 900 },
);

/** Latest active new arrivals — revalidates every hour */
const getNewArrivals = unstable_cache(
  async (): Promise<NewArrivalItem[]> => {
    try {
      return await prisma.newArrival.findMany({
        take: 8,
        where: { isActive: true, product: { isActive: true } },
        orderBy: { featuredAt: "desc" },
        select: {
          id:         true,
          featuredAt: true,
          product: {
            select: {
              id:           true,
              title:        true,
              price:        true,
              comparePrice: true,
              rating:       true,
              ratingCount:  true,
              images:       true,
              stock:        true,
              slug:         true,
              description:  true,
              category:     { select: { name: true } },
            },
          },
        },
      });
    } catch {
      return [];
    }
  },
  ["new-arrivals-home"],
  { revalidate: 3600 },
);

/** Top approved reviews (4★+) for testimonials — revalidates every 30 minutes */
const getRealTestimonials = unstable_cache(
  async (): Promise<ReviewItem[]> => {
    try {
      return await prisma.review.findMany({
        take: 6,
        where: {
          isApproved: true,
          rating:     { gte: 4 },
          body:       { not: "" },
        },
        orderBy: [{ helpfulCount: "desc" }, { createdAt: "desc" }],
        select: {
          id:         true,
          rating:     true,
          title:      true,
          body:       true,
          isVerified: true,
          createdAt:  true,
          user:       { select: { name: true } },
          product:    { select: { title: true } },
        },
      });
    } catch {
      return [];
    }
  },
  ["homepage-testimonials"],
  { revalidate: 1800 },
);

/** Top 16 tags by product count — revalidates every 2 hours */
const getTopTags = unstable_cache(
  async (): Promise<TagItem[]> => {
    try {
      return await prisma.tag.findMany({
        take: 16,
        orderBy: { products: { _count: "desc" } },
        select: {
          id:     true,
          name:   true,
          slug:   true,
          _count: { select: { products: true } },
        },
      });
    } catch {
      return [];
    }
  },
  ["top-tags"],
  { revalidate: 7200 },
);

// ── Hero right-column — real product floating cards ───────────────────────────

function HeroVisual({
  userCount,
  heroProducts,
}: {
  userCount:    number;
  heroProducts: HeroProduct[];
}) {
  const cards = heroProducts.slice(0, 3).map((p, i) => {
    const style = HERO_CARD_STYLES[i % HERO_CARD_STYLES.length];
    const discountPct =
      p.comparePrice && p.comparePrice > p.price
        ? `-${Math.round(((p.comparePrice - p.price) / p.comparePrice) * 100)}%`
        : null;
    return {
      ...style,
      id:       p.id,
      name:     p.title.length > 22 ? p.title.slice(0, 22) + "…" : p.title,
      price:    `$${p.price.toFixed(0)}`,
      rating:   Math.round(p.rating),
      discount: discountPct,
      emoji:    CATEGORY_EMOJIS[p.category.name] ?? "🛍️",
    };
  });

  return (
    <div className="relative hidden h-105 w-full lg:flex lg:items-center lg:justify-center">
      {/* Ambient glow blobs */}
      <div className="absolute left-1/4 top-1/4 h-56 w-56 animate-blob rounded-full bg-indigo-400/15 blur-3xl" />
      <div
        className="absolute right-1/4 bottom-1/4 h-44 w-44 animate-blob rounded-full bg-violet-400/10 blur-3xl"
        style={{ animationDelay: "3s" }}
      />

      {/* Central orb with spinning ring */}
      <div className="relative z-10 flex h-40 w-40 flex-col items-center justify-center text-center">
        <div
          className="absolute inset-0 rounded-full animate-spin-slow"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0%, #818cf8 25%, transparent 50%, #a78bfa 75%, transparent 100%)",
            padding: "2px",
          }}
        >
          <div className="h-full w-full rounded-full bg-indigo-700/90 backdrop-blur-sm" />
        </div>
        <div className="relative z-10 flex flex-col items-center">
          <ShoppingBag className="h-9 w-9 text-white" strokeWidth={1.5} />
          <p className="mt-1.5 text-[11px] font-black uppercase tracking-widest text-white/90">ShopNest</p>
          <div className="mt-1 h-px w-10 bg-indigo-300/40" />
          <p className="mt-1 text-[9px] font-medium text-indigo-300">Premium Store</p>
        </div>
      </div>

      {/* Floating real product cards */}
      {cards.map((c) => (
        <div
          key={c.id}
          className={`absolute ${c.pos} ${c.animClass} w-52 rounded-2xl backdrop-blur-xl border ${c.border} bg-white/[0.07] p-3.5 shadow-2xl`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-linear-to-br ${c.bg} border ${c.border} text-2xl`}
            >
              {c.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white/90">{c.name}</p>
              <div className="mt-0.5 flex items-center justify-between gap-1">
                <p className="text-sm font-black text-white">{c.price}</p>
                {c.discount && (
                  <span className="rounded-full bg-green-400/20 px-1.5 py-0.5 text-[9px] font-bold text-green-300 border border-green-400/30">
                    {c.discount}
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-2.5 w-2.5 ${i < c.rating ? "fill-amber-400 text-amber-400" : "fill-white/10 text-white/20"}`}
                    strokeWidth={0}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Live customers pill */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex items-center gap-2.5 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 backdrop-blur-md shadow-xl whitespace-nowrap">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-400" />
        </span>
        <span className="text-xs font-semibold text-white">
          {userCount > 0 ? `${userCount.toLocaleString()}+` : "50,000+"} happy customers
        </span>
      </div>
    </div>
  );
}

// ── Empty-state ──────────────────────────────────────────────────────────────

function NoProducts() {
  return (
    <div className="col-span-full flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
        <Package className="h-7 w-7 text-gray-400" strokeWidth={1.5} />
      </div>
      <div>
        <p className="font-semibold text-gray-600">No products yet</p>
        <p className="mt-1 text-sm text-gray-400">
          Run{" "}
          <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">pnpm db:seed</code>{" "}
          to populate the database.
        </p>
      </div>
    </div>
  );
}

// ── Section heading ───────────────────────────────────────────────────────────

function SectionHeading({
  eyebrow,
  title,
  subtitle,
  center = false,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: string;
  center?: boolean;
}) {
  return (
    <div className={center ? "text-center" : ""}>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3.5 py-1 text-[11px] font-bold uppercase tracking-widest text-indigo-600">
        {eyebrow}
      </span>
      <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl lg:text-4xl">
        {title}
      </h2>
      {subtitle && (
        <p className={`mt-2 text-sm leading-relaxed text-gray-500 ${center ? "mx-auto max-w-lg" : "max-w-lg"}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const [
    featuredProducts,
    siteStats,
    wishlistedIds,
    dbCategories,
    wishlistEnabled,
    heroProducts,
    activeDeals,
    newArrivals,
    realTestimonials,
    topTags,
  ] = await Promise.all([
    getFeaturedProducts(),
    getSiteStats(),
    getWishlistProductIds(),
    getCategoriesWithImages(),
    isEnabled(FLAGS.WISHLIST_ENABLED),
    getHeroProducts(),
    getActiveDeals(),
    getNewArrivals(),
    getRealTestimonials(),
    getTopTags(),
  ]);

  const statsData = [
    {
      icon: "🛍️",
      value: siteStats.productCount > 0 ? `${siteStats.productCount.toLocaleString()}+` : "1,200+",
      label: "Products",
      gradient: "from-blue-500 to-indigo-600",
    },
    {
      icon: "😊",
      value: siteStats.userCount > 0 ? `${siteStats.userCount.toLocaleString()}+` : "50K+",
      label: "Happy Customers",
      gradient: "from-violet-500 to-purple-600",
    },
    {
      icon: "📦",
      value: siteStats.deliveryRate,
      label: "On-time Delivery",
      gradient: "from-emerald-500 to-green-600",
    },
    {
      icon: "⭐",
      value: siteStats.averageRating,
      label: "Avg. Rating",
      gradient: "from-amber-400 to-orange-500",
    },
  ];

  // Convert new arrivals to ProductCardData for reuse with ProductCard
  const newArrivalProducts: ProductCardData[] = newArrivals.map((n) => ({
    id:          n.product.id,
    title:       n.product.title,
    description: n.product.description,
    price:       n.product.price,
    stock:       n.product.stock,
    category:    n.product.category.name,
    rating:      n.product.rating,
    images:      n.product.images,
  }));

  // Duplicate ticker items for seamless infinite scroll
  const tickerItems = [...TICKER_ITEMS, ...TICKER_ITEMS];

  // Avatar colour palette for testimonials
  const AVATAR_COLOURS = [
    "bg-indigo-500", "bg-violet-500", "bg-pink-500",
    "bg-emerald-500", "bg-amber-500", "bg-blue-500",
  ];

  return (
    <div className="overflow-x-hidden">

      {/* ══════════════════════════════════════════════════════════
          HERO — dark mesh gradient, animated blobs, real product cards
      ══════════════════════════════════════════════════════════ */}
      <section
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0f0c29 0%, #1a1040 35%, #24243e 65%, #0d1b3e 100%)" }}
      >
        {/* Animated ambient blobs */}
        <div className="pointer-events-none absolute -top-40 -left-40 h-150 w-150 animate-blob rounded-full bg-indigo-600/20 blur-[120px]" />
        <div className="pointer-events-none absolute top-1/3 left-1/3 h-100 w-100 animate-blob rounded-full bg-violet-600/15 blur-[90px]" style={{ animationDelay: "4s" }} />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-100 w-100 animate-blob rounded-full bg-indigo-400/20 blur-[90px]" style={{ animationDelay: "2s" }} />

        {/* Dot-grid texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.4) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid min-h-160 grid-cols-1 items-center gap-8 py-20 lg:grid-cols-2 lg:py-28">

            {/* ── Left: headline + CTA ── */}
            <div className="max-w-xl">
              {/* Live badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-4 py-2 backdrop-blur-sm">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                <span className="text-xs font-semibold uppercase tracking-widest text-indigo-300">
                  New Season · Spring 2026
                </span>
              </div>

              {/* Headline */}
              <h1 className="mt-6 text-5xl font-black leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl">
                Shop the
                <span
                  className="block animate-shimmer-text bg-clip-text text-transparent"
                  style={{
                    backgroundImage: "linear-gradient(90deg, #a5b4fc, #c4b5fd, #f9a8d4, #a5b4fc)",
                    backgroundSize: "200% auto",
                  }}
                >
                  Future of
                </span>
                Retail.
              </h1>

              <p className="mt-6 text-lg leading-relaxed text-slate-400 sm:text-xl">
                Thousands of curated products across every category — delivered to your door at unbeatable prices.
              </p>

              {/* CTAs */}
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link
                  href="/products"
                  className="group relative inline-flex items-center gap-2 overflow-hidden rounded-2xl bg-linear-to-r from-indigo-500 to-violet-600 px-8 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition-all duration-300 hover:shadow-indigo-500/50 hover:scale-[1.02] active:scale-95"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4" />
                    Shop Now
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                  <div className="absolute inset-0 translate-y-full bg-linear-to-r from-violet-600 to-indigo-500 transition-transform duration-300 group-hover:translate-y-0" />
                </Link>

                <Link
                  href="/deals"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/8 px-8 py-4 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15 hover:border-white/25 active:scale-95"
                >
                  <Flame className="h-4 w-4 text-orange-400" />
                  View Hot Deals
                </Link>
              </div>

              {/* Mini stats grid */}
              <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                {statsData.map(({ icon, value, label }) => (
                  <div key={label} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/5 px-3.5 py-3 backdrop-blur-sm">
                    <span className="text-xl">{icon}</span>
                    <div>
                      <p className="text-sm font-extrabold leading-tight text-white">{value}</p>
                      <p className="text-[10px] leading-tight text-slate-400">{label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Right: real product cards ── */}
            <HeroVisual userCount={siteStats.userCount} heroProducts={heroProducts} />
          </div>
        </div>

        {/* Bottom page-fade */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-20 bg-linear-to-t from-gray-50 to-transparent" />
      </section>

      {/* ══════════════════════════════════════════════════════════
          INFINITE MARQUEE TICKER
      ══════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden border-y border-indigo-100 bg-linear-to-r from-indigo-600 via-violet-600 to-indigo-700 py-3.5">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-linear-to-r from-indigo-600 to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-linear-to-l from-indigo-700 to-transparent z-10" />
        <div className="animate-marquee">
          {tickerItems.map((item, idx) => (
            <span key={idx} className="mx-8 inline-flex items-center gap-2 text-sm font-semibold text-indigo-100">
              <span className="text-base">{item.icon}</span>
              <span>{item.text}</span>
              <span className="mx-2 h-1 w-1 rounded-full bg-indigo-300/50" />
            </span>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          STATS BAR
      ══════════════════════════════════════════════════════════ */}
      <section className="border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 divide-x divide-gray-100 lg:grid-cols-4">
            {statsData.map(({ icon, value, label, gradient }) => (
              <div
                key={label}
                className="group flex flex-col items-center gap-2 px-6 py-8 text-center transition hover:bg-gray-50/70 sm:flex-row sm:text-left sm:gap-5"
              >
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br ${gradient} text-2xl shadow-md group-hover:scale-110 transition-transform`}>
                  {icon}
                </div>
                <div>
                  <p className="text-2xl font-black tracking-tight text-gray-900">{value}</p>
                  <p className="text-xs font-medium text-gray-500">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          CATEGORIES — real data from DB
      ══════════════════════════════════════════════════════════ */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-12 flex items-end justify-between">
          <SectionHeading
            eyebrow="✦ Browse by Category"
            title={
              <>
                Shop{" "}
                <span className="bg-linear-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                  All Categories
                </span>
              </>
            }
            subtitle="Find exactly what you're looking for across our curated collection."
          />
          <Link
            href="/products"
            className="hidden items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-5 py-2.5 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 sm:inline-flex"
          >
            View all <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {dbCategories.map((cat) => {
            const gradient = CATEGORY_GRADIENTS[cat.name] ?? "from-indigo-500 to-violet-600";
            return (
              <Link
                key={cat.id}
                href={`/products?category=${encodeURIComponent(cat.name)}`}
                className="group relative overflow-hidden rounded-3xl shadow-sm transition duration-300 hover:-translate-y-1.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                {cat.imageUrl ? (
                  <div className="relative h-40 w-full overflow-hidden sm:h-48">
                    <Image
                      src={cat.imageUrl}
                      alt={cat.name}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className="object-cover transition duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/75 via-black/20 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-4">
                      <p className="text-sm font-bold text-white drop-shadow">{cat.name}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-white/70">
                        Shop now <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className={`relative flex h-40 w-full flex-col items-center justify-center gap-3 bg-linear-to-br ${gradient} p-4 sm:h-48`}>
                    <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
                    <div className="absolute -bottom-4 -left-4 h-16 w-16 rounded-full bg-white/10" />
                    <span className="relative text-5xl drop-shadow-lg">{CATEGORY_EMOJIS[cat.name] ?? "🛍️"}</span>
                    <div className="relative text-center">
                      <p className="text-sm font-bold text-white">{cat.name}</p>
                      <p className="mt-0.5 flex items-center justify-center gap-1 text-[11px] font-medium text-white/70">
                        Explore <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                      </p>
                    </div>
                  </div>
                )}
              </Link>
            );
          })}
        </div>

        <div className="mt-8 flex justify-center sm:hidden">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-7 py-3 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100"
          >
            View all categories <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          ACTIVE DEALS — live data from DB (revalidates every 15 min)
      ══════════════════════════════════════════════════════════ */}
      {activeDeals.length > 0 && (
        <section className="border-y border-orange-100 bg-linear-to-br from-amber-50 via-orange-50/80 to-red-50 py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-12 flex items-end justify-between">
              <SectionHeading
                eyebrow="🔥 Limited Time"
                title={
                  <>
                    Today&apos;s{" "}
                    <span className="bg-linear-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
                      Hot Deals
                    </span>
                  </>
                }
                subtitle="Handpicked discounts — real prices, real savings. Updated every 15 minutes."
              />
              <Link
                href="/deals"
                className="hidden items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-5 py-2.5 text-sm font-semibold text-orange-600 transition hover:bg-orange-100 sm:inline-flex"
              >
                All Deals <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {activeDeals.map((deal) => (
                <Link
                  key={deal.id}
                  href={`/products/${deal.product.slug}`}
                  className="group relative overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-orange-100/60"
                >
                  {/* Discount badge */}
                  <div className="absolute left-4 top-4 z-10 flex items-center gap-1.5 rounded-full bg-linear-to-r from-orange-500 to-red-500 px-3 py-1 shadow-lg">
                    <Percent className="h-3 w-3 text-white" />
                    <span className="text-xs font-black text-white">
                      {Math.round(deal.discountPercent)}% OFF
                    </span>
                  </div>

                  {/* Badge label */}
                  {deal.badgeLabel && deal.badgeLabel !== "Deal" && (
                    <div className="absolute right-4 top-4 z-10 rounded-full bg-indigo-600/90 px-2.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                      {deal.badgeLabel}
                    </div>
                  )}

                  {/* Product image */}
                  {deal.product.images[0] ? (
                    <div className="relative h-52 w-full overflow-hidden bg-gray-50">
                      <Image
                        src={deal.product.images[0]}
                        alt={deal.product.title}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition duration-500 group-hover:scale-105"
                      />
                    </div>
                  ) : (
                    <div className="flex h-52 items-center justify-center bg-linear-to-br from-orange-50 to-amber-50">
                      <Flame className="h-16 w-16 text-orange-300" strokeWidth={1} />
                    </div>
                  )}

                  <div className="p-5">
                    <p className="line-clamp-2 text-sm font-semibold text-gray-900 group-hover:text-orange-600 transition-colors">
                      {deal.product.title}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">{deal.product.category.name}</p>

                    <div className="mt-3 flex items-center justify-between">
                      <div>
                        <p className="text-lg font-black text-gray-900">${deal.product.price.toFixed(0)}</p>
                        {deal.product.comparePrice && (
                          <p className="text-xs text-gray-400 line-through">${deal.product.comparePrice.toFixed(0)}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-orange-400" />
                        <span className="font-mono text-xs font-bold text-orange-600">{deal.timeRemaining}</span>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3 w-3 ${i < Math.round(deal.product.rating) ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"}`}
                          strokeWidth={0}
                        />
                      ))}
                      {deal.product.ratingCount > 0 && (
                        <span className="ml-1 text-[11px] text-gray-400">({deal.product.ratingCount})</span>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
                      <span>{deal.product.stock > 0 ? `${deal.product.stock} in stock` : "Low stock"}</span>
                      <span className="font-semibold text-orange-500 group-hover:underline">View Deal →</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-10 flex justify-center">
              <Link
                href="/deals"
                className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-orange-500 to-red-500 px-8 py-4 text-sm font-bold text-white shadow-lg shadow-orange-200 transition hover:shadow-orange-300 hover:scale-[1.02] active:scale-95"
              >
                <Flame className="h-4 w-4" />
                Browse All Deals
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════
          FLASH SALE BANNER — reflects live deal data
      ══════════════════════════════════════════════════════════ */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-orange-500 via-red-500 to-pink-600 shadow-xl shadow-orange-200/60">
          <div className="pointer-events-none absolute -left-12 top-0 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -right-12 bottom-0 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="relative flex flex-col items-center justify-between gap-5 px-8 py-7 sm:flex-row">
            <div className="flex items-center gap-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 text-3xl shadow-lg backdrop-blur-sm">🔥</div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-white">
                    Flash Sale
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-orange-100">
                    <Clock className="h-3 w-3" /> Limited time
                  </span>
                </div>
                <p className="mt-1 text-xl font-black text-white sm:text-2xl">
                  Up to{" "}
                  {activeDeals.length > 0
                    ? <span className="text-yellow-300">{Math.round(activeDeals[0].discountPercent)}% OFF</span>
                    : <span className="text-yellow-300">50% OFF</span>
                  }{" "}
                  — Today Only
                </p>
                <p className="text-sm text-orange-100">
                  {activeDeals.length > 0
                    ? `${activeDeals.length} active deal${activeDeals.length > 1 ? "s" : ""} across electronics, fashion & more`
                    : "Exclusive savings across electronics, fashion & more"
                  }
                </p>
              </div>
            </div>
            <Link
              href="/deals"
              className="shrink-0 inline-flex items-center gap-2 rounded-2xl bg-white px-7 py-3.5 text-sm font-black text-orange-600 shadow-lg transition hover:bg-orange-50 hover:shadow-xl active:scale-95"
            >
              <Tag className="h-4 w-4" /> Shop Deals <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          FEATURED PRODUCTS — ISR-cached, top-rated active products
      ══════════════════════════════════════════════════════════ */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-12 flex items-end justify-between">
          <SectionHeading
            eyebrow="✦ Handpicked for You"
            title={
              <>
                Featured{" "}
                <span className="bg-linear-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                  Products
                </span>
              </>
            }
            subtitle="Top-rated products selected for quality, value, and customer satisfaction."
          />
          <Link
            href="/products"
            className="hidden items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-5 py-2.5 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 sm:inline-flex"
          >
            View All <ChevronRight className="h-4 w-4" />
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

        <div className="mt-10 flex justify-center sm:hidden">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-7 py-3 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100"
          >
            View All Products <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          NEW ARRIVALS — real data from new_arrivals table
      ══════════════════════════════════════════════════════════ */}
      {newArrivals.length > 0 && (
        <section className="border-y border-indigo-100 bg-linear-to-br from-indigo-50 via-violet-50/60 to-purple-50 py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-12 flex items-end justify-between">
              <SectionHeading
                eyebrow="✨ Just Dropped"
                title={
                  <>
                    New{" "}
                    <span className="bg-linear-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                      Arrivals
                    </span>
                  </>
                }
                subtitle="Fresh products added to our catalogue — be the first to discover them."
              />
              <Link
                href="/new-arrivals"
                className="hidden items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-5 py-2.5 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 sm:inline-flex"
              >
                All New Arrivals <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {newArrivalProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  isWishlisted={wishlistedIds.has(product.id)}
                  showWishlist={wishlistEnabled}
                />
              ))}
            </div>

            <div className="mt-10 flex justify-center">
              <Link
                href="/new-arrivals"
                className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-indigo-500 to-violet-600 px-8 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition hover:shadow-indigo-300 hover:scale-[1.02] active:scale-95"
              >
                <Sparkles className="h-4 w-4" />
                Explore All New Arrivals
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════
          PROMO PAIR — Deals + New Arrivals (real counts)
      ══════════════════════════════════════════════════════════ */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {/* Hot Deals */}
          <Link
            href="/deals"
            className="group relative overflow-hidden rounded-3xl shadow-lg shadow-orange-100 transition duration-300 hover:-translate-y-1 hover:shadow-orange-200"
          >
            <div className="absolute inset-0 bg-linear-to-br from-amber-400 via-orange-500 to-red-500" />
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute -left-8 bottom-0 h-36 w-36 rounded-full bg-orange-700/20 blur-2xl" />
            <div className="relative p-8 sm:p-10">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 text-3xl shadow-lg backdrop-blur-sm">🔥</div>
              <h3 className="mt-5 text-2xl font-black leading-tight text-white sm:text-3xl">
                Today&apos;s<br />Hot Deals
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-orange-100">
                {activeDeals.length > 0
                  ? `${activeDeals.length} active deal${activeDeals.length > 1 ? "s" : ""} — up to ${Math.round(activeDeals[0].discountPercent)}% off selected items.`
                  : "Up to 40% off — limited time only. Don't miss top brand savings."}
              </p>
              <div className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-black text-orange-600 shadow-md transition group-hover:bg-orange-50 group-hover:shadow-lg">
                Shop Deals <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </Link>

          {/* New Arrivals */}
          <Link
            href="/new-arrivals"
            className="group relative overflow-hidden rounded-3xl shadow-lg shadow-indigo-100 transition duration-300 hover:-translate-y-1 hover:shadow-indigo-200"
          >
            <div className="absolute inset-0 bg-linear-to-br from-indigo-500 via-violet-600 to-purple-700" />
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute -left-8 bottom-0 h-36 w-36 rounded-full bg-violet-900/20 blur-2xl" />
            <div className="relative p-8 sm:p-10">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 text-3xl shadow-lg backdrop-blur-sm">✨</div>
              <h3 className="mt-5 text-2xl font-black leading-tight text-white sm:text-3xl">
                Just<br />Arrived
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-indigo-100">
                {newArrivals.length > 0
                  ? `${newArrivals.length} new product${newArrivals.length > 1 ? "s" : ""} added recently — fresh drops every week.`
                  : "Fresh drops every week — be first to shop the latest styles & tech."}
              </p>
              <div className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-black text-indigo-600 shadow-md transition group-hover:bg-indigo-50 group-hover:shadow-lg">
                What&apos;s New <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          BROWSE BY TAGS — real tag data from DB
      ══════════════════════════════════════════════════════════ */}
      {topTags.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-8">
            <SectionHeading
              eyebrow="# Trending Tags"
              title={
                <>
                  Browse by{" "}
                  <span className="bg-linear-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                    Interest
                  </span>
                </>
              }
              subtitle="Explore products grouped by trending tags and popular themes."
            />
          </div>
          <div className="flex flex-wrap gap-3">
            {topTags.map((tag) => (
              <Link
                key={tag.id}
                href={`/products?tag=${encodeURIComponent(tag.slug)}`}
                className="group flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 hover:shadow-md"
              >
                <Hash className="h-3.5 w-3.5 text-gray-400 group-hover:text-indigo-500" />
                {tag.name}
                {tag._count.products > 0 && (
                  <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 group-hover:bg-indigo-100 group-hover:text-indigo-600">
                    {tag._count.products}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════
          WHY SHOPNEST
      ══════════════════════════════════════════════════════════ */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <SectionHeading
            eyebrow="✦ Why ShopNest"
            title={
              <>
                Shopping Made{" "}
                <span className="bg-linear-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                  Better
                </span>
              </>
            }
            subtitle="Every detail of ShopNest is crafted around you — from checkout to your door."
            center
          />
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ Icon, title, desc, gradient, glow }) => (
            <div
              key={title}
              className="group relative overflow-hidden rounded-3xl border border-gray-100 bg-white p-7 shadow-sm transition duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-gray-100/80"
            >
              <div className={`absolute left-6 right-6 top-0 h-0.5 rounded-b-full bg-linear-to-r ${gradient} opacity-0 transition-opacity group-hover:opacity-100`} />
              <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br ${gradient} shadow-lg ${glow} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                <Icon className="h-6 w-6 text-white" strokeWidth={1.8} />
              </div>
              <h3 className="mt-5 text-base font-bold text-gray-900">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">{desc}</p>
              <div className="mt-5 inline-flex translate-y-1 items-center gap-1 text-xs font-semibold text-indigo-600 opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
                Learn more <ChevronRight className="h-3.5 w-3.5" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          TESTIMONIALS — real approved reviews from DB
      ══════════════════════════════════════════════════════════ */}
      <section className="border-y border-gray-100 bg-linear-to-br from-slate-50 to-indigo-50/60 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <SectionHeading
              eyebrow="✦ Loved by Customers"
              title={
                <>
                  What Our{" "}
                  <span className="bg-linear-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                    Shoppers
                  </span>{" "}
                  Say
                </>
              }
              subtitle="Real verified reviews from customers who purchased on ShopNest."
              center
            />
          </div>

          {realTestimonials.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {realTestimonials.map((review) => {
                const initials = (review.user.name ?? "A")
                  .split(" ")
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase();
                const colourIdx = review.id.charCodeAt(0) % AVATAR_COLOURS.length;
                return (
                  <div
                    key={review.id}
                    className="relative rounded-3xl border border-white bg-white p-7 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg"
                  >
                    <div className="absolute right-6 top-4 text-6xl font-black leading-none text-indigo-100 select-none">&ldquo;</div>

                    <div className="flex gap-0.5">
                      {Array.from({ length: review.rating }).map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" strokeWidth={0} />
                      ))}
                    </div>

                    {review.title && (
                      <p className="mt-3 text-[13px] font-bold text-gray-800">{review.title}</p>
                    )}

                    <p className="relative mt-2 line-clamp-4 text-sm leading-relaxed text-gray-600">
                      {review.body}
                    </p>

                    <p className="mt-2 text-[11px] font-medium text-indigo-500">
                      on{" "}
                      {review.product.title.length > 35
                        ? review.product.title.slice(0, 35) + "…"
                        : review.product.title}
                    </p>

                    <div className="mt-5 flex items-center gap-3 border-t border-gray-100 pt-5">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${AVATAR_COLOURS[colourIdx]} text-xs font-black text-white shadow`}>
                        {initials}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {review.user.name ?? "Anonymous"}
                        </p>
                        <p className="flex items-center gap-1 text-[11px] text-gray-400">
                          {review.isVerified && (
                            <BadgeCheck className="h-3 w-3 text-indigo-500" />
                          )}
                          {review.isVerified ? "Verified Purchase" : "Shopper"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-sm text-gray-400 py-12">
              Customer reviews coming soon — be the first to share your experience!
            </p>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          SERVICE / TRUST BAR
      ══════════════════════════════════════════════════════════ */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { Icon: Truck,          label: "Free Shipping",   sub: "On orders over $50",     color: "bg-blue-50   text-blue-600"   },
            { Icon: RefreshCw,      label: "Easy Returns",    sub: "30-day return policy",   color: "bg-green-50  text-green-600"  },
            { Icon: Shield,         label: "Secure Checkout", sub: "SSL encrypted payments", color: "bg-violet-50 text-violet-600" },
            { Icon: HeadphonesIcon, label: "24/7 Support",    sub: "Always here to help",    color: "bg-amber-50  text-amber-600"  },
          ].map(({ Icon, label, sub, color }) => (
            <div
              key={label}
              className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md hover:-translate-y-0.5"
            >
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{label}</p>
                <p className="text-xs text-gray-400">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          NEWSLETTER — full-bleed dark section
      ══════════════════════════════════════════════════════════ */}
      <section
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4c1d95 100%)" }}
      >
        {/* Blobs */}
        <div className="pointer-events-none absolute -left-24 top-0 h-80 w-80 animate-blob rounded-full bg-indigo-500/20 blur-3xl" />
        <div
          className="pointer-events-none absolute -right-24 bottom-0 h-64 w-64 animate-blob rounded-full bg-violet-500/20 blur-3xl"
          style={{ animationDelay: "3s" }}
        />
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-100 w-100 rounded-full bg-purple-600/10 blur-[100px]" />

        {/* Grid texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        <div className="relative mx-auto max-w-3xl px-4 py-28 text-center sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-400/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-indigo-300">
            📬 Join the Inner Circle
          </span>

          <h2 className="mt-6 text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            Exclusive Deals &amp;
            <span
              className="block animate-shimmer-text bg-clip-text text-transparent"
              style={{
                backgroundImage: "linear-gradient(90deg, #a5b4fc, #c4b5fd, #f9a8d4, #a5b4fc)",
                backgroundSize: "200% auto",
              }}
            >
              Early Access
            </span>
          </h2>

          <p className="mx-auto mt-5 max-w-lg text-lg leading-relaxed text-slate-400">
            Join{" "}
            <span className="font-semibold text-white">
              {siteStats.userCount > 0 ? `${siteStats.userCount.toLocaleString()}+` : "50,000+"} shoppers
            </span>{" "}
            who get first access to sales, new arrivals, and members-only discounts.
          </p>

          <div className="mt-10">
            <NewsletterForm />
          </div>

          <p className="mt-5 text-xs text-slate-500">
            No spam, ever. Unsubscribe at any time. We respect your privacy.
          </p>
        </div>
      </section>

    </div>
  );
}
