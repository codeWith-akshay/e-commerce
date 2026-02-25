import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

// ─────────────────────────────────────────────────────────────────────────────
// Bundle analyzer
//
// Enabled only when the ANALYZE env var is set to "true".
// Usage:  pnpm analyze
// This builds the app and opens two interactive treemap reports:
//   .next/analyze/client.html  — browser bundle
//   .next/analyze/server.html  — server / edge bundle
// ─────────────────────────────────────────────────────────────────────────────

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  // Write HTML reports into .next/analyze/ so they're gitignored
  // alongside the rest of the build artefacts.
  openAnalyzer: true,
});

const nextConfig: NextConfig = {
  // ── Tree-shaking for large barrel packages ─────────────────────────────────
  // Instructs the compiler to only include the named exports actually used,
  // rather than loading the full barrel entry-point.  Critical for:
  //   • lucide-react  — 1 500 + icons; only ~30 are used here
  //   • recharts      — many chart types; only AreaChart is used
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
  },

  images: {
    // ── Allowed external image origins ──────────────────────────────────────
    // Add every CDN / storage domain that serves product images here.
    // Never use a bare wildcard (*) in production — list domains explicitly.
    remotePatterns: [
      {
        // Unsplash CDN — used by seed data and demo product images
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        // Unsplash source (non-CDN variant some URLs use)
        protocol: "https",
        hostname: "unsplash.com",
        pathname: "/photos/**",
      },
      {
        // Lorem Picsum — used by generated seed product images
        protocol: "https",
        hostname: "picsum.photos",
        pathname: "/**",
      },
    ],

    // ── Format negotiation ───────────────────────────────────────────────────
    // Prefer AVIF (smallest), fall back to WebP, then original format.
    // Both are supported by all modern browsers (96 %+ global share).
    formats: ["image/avif", "image/webp"],

    // ── CDN cache TTL (seconds) ──────────────────────────────────────────────
    // Optimised images are cached at the edge for 7 days (604 800 s).
    // Increase to 2 592 000 (30 days) once images are immutable by URL.
    minimumCacheTTL: 604_800,

    // ── Device size breakpoints ──────────────────────────────────────────────
    // Matches Tailwind's sm/md/lg/xl/2xl breakpoints so the closest
    // srcset entry is selected without wasting bandwidth.
    deviceSizes: [375, 640, 768, 1024, 1280, 1536],
    imageSizes:  [16, 32, 40, 56, 80, 96, 112, 128, 256],
  },
};

export default withBundleAnalyzer(nextConfig);
