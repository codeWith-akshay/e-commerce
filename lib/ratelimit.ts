/**
 * lib/ratelimit.ts
 *
 * Upstash rate-limiter presets for different surfaces.
 *
 * Gracefully returns { success: true } when Redis is not configured so local
 * development works without an Upstash account.
 *
 * Usage (Route Handler or Server Action):
 *
 *   import { authRatelimit, getClientIp } from "@/lib/ratelimit";
 *
 *   const ip = getClientIp(request);
 *   const { success } = await authRatelimit.check(ip);
 *   if (!success) {
 *     return NextResponse.json({ error: "Too many requests." }, { status: 429 });
 *   }
 */

import { isRedisConfigured } from "@/config/env";
import type { NextRequest } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// No-op stub used when Redis is not configured
// ─────────────────────────────────────────────────────────────────────────────

const allowAll = {
  check: async (_key: string) => ({ success: true, limit: Infinity, remaining: Infinity, reset: 0 }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Limiter factory
// ─────────────────────────────────────────────────────────────────────────────

interface LimiterConfig {
  /** Max requests allowed in the window. */
  requests: number;
  /** Window duration in seconds. */
  windowSeconds: number;
  /** Redis key prefix to namespace this limiter. */
  prefix: string;
}

function createLimiter(config: LimiterConfig) {
  if (!isRedisConfigured) return allowAll;

  // Lazy import to avoid loading Upstash SDK when Redis is absent
  let _limiter: ReturnType<typeof import("@upstash/ratelimit").Ratelimit.prototype.limit> extends Promise<infer R> ? { limit: (id: string) => Promise<R> } : never;

  return {
    check: async (identifier: string) => {
      if (!_limiter) {
        const { Ratelimit } = await import("@upstash/ratelimit");
        const { Redis }     = await import("@upstash/redis");
        const redis         = Redis.fromEnv();

        const rl  = new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(config.requests, `${config.windowSeconds} s`),
          prefix:  config.prefix,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        _limiter = rl as any;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (_limiter as any).limit(identifier);
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Presets
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Login / register — 5 attempts per 15 minutes per IP.
 * Tight to prevent credential stuffing.
 */
export const authRatelimit = createLimiter({
  requests:      5,
  windowSeconds: 15 * 60,
  prefix:        "rl:auth",
});

/**
 * General API — 60 requests per minute per IP.
 */
export const apiRatelimit = createLimiter({
  requests:      60,
  windowSeconds: 60,
  prefix:        "rl:api",
});

/**
 * Newsletter subscriptions — 3 per hour per IP.
 */
export const newsletterRatelimit = createLimiter({
  requests:      3,
  windowSeconds: 60 * 60,
  prefix:        "rl:newsletter",
});

/**
 * Review submissions — 5 per hour per user.
 */
export const reviewRatelimit = createLimiter({
  requests:      5,
  windowSeconds: 60 * 60,
  prefix:        "rl:review",
});

/**
 * Order placement — 10 per hour per user.
 * Guards against accidental double-submission loops.
 */
export const orderRatelimit = createLimiter({
  requests:      10,
  windowSeconds: 60 * 60,
  prefix:        "rl:order",
});

/**
 * Admin analytics export — 10 downloads per hour per admin.
 * Prevents accidental DoS from large report queries.
 */
export const exportRatelimit = createLimiter({
  requests:      10,
  windowSeconds: 60 * 60,
  prefix:        "rl:export",
});

/**
 * Full search reindex — 2 rebuilds per hour per superadmin.
 * Each rebuild streams the entire products table; keep the limit tight.
 */
export const reindexRatelimit = createLimiter({
  requests:      2,
  windowSeconds: 60 * 60,
  prefix:        "rl:reindex",
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract the real client IP from Next.js request headers.
 * Respects Vercel/CF proxy headers when present.
 */
export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "127.0.0.1"
  );
}
