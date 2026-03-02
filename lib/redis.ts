/**
 * lib/redis.ts
 *
 * Upstash Redis singleton with cache-aside helpers.
 *
 * When UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are not set in the
 * environment the module exports a no-op stub so the app runs normally in
 * local dev without Redis — every cache call simply falls through to the DB.
 */

import { isRedisConfigured } from "@/config/env";

// ─────────────────────────────────────────────────────────────────────────────
// Client singleton
// ─────────────────────────────────────────────────────────────────────────────

// Dynamic import prevents the Upstash SDK from being loaded — and failing — in
// environments where Redis vars are absent (e.g. plain local dev).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _redis: any = null;

async function getRedis() {
  if (!isRedisConfigured) return null;
  if (_redis) return _redis;
  const { Redis } = await import("@upstash/redis");
  _redis = Redis.fromEnv();
  return _redis;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache keys  (centralised so typos are caught at compile time)
// ─────────────────────────────────────────────────────────────────────────────

export const CacheKeys = {
  categories:       () => "categories:all",
  category:         (slug: string) => `category:${slug}`,
  product:          (id: string)   => `product:${id}`,
  featuredProducts: ()             => "products:featured",
  newArrivals:      ()             => "products:new-arrivals",
  activeDeals:      ()             => "products:deals",
  cartCount:        (userId: string) => `cart:count:${userId}`,
  wishlistIds:      (userId: string) => `wishlist:ids:${userId}`,
  userProfile:      (userId: string) => `user:${userId}`,
  flag:             (name: string)   => `flag:${name}`,
  flags:            ()               => "flags:all",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// TTL constants  (seconds)
// ─────────────────────────────────────────────────────────────────────────────

export const TTL = {
  short:      60,          // 1 minute  — cart counts, volatile data
  medium:     300,         // 5 minutes — product pages
  long:       3_600,       // 1 hour    — categories, featured lists
  veryLong:   86_400,      // 24 hours  — rarely-changing reference data
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// cache()  — generic cache-aside helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cache-aside pattern:
 *   1. Return cached value if it exists.
 *   2. Otherwise call `fetcher`, store the result, then return it.
 *
 * Falls back to direct `fetcher` call if Redis is not configured.
 *
 * @param key     Cache key
 * @param ttl     Time-to-live in seconds
 * @param fetcher Async function that produces the canonical value
 */
export async function cache<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const redis = await getRedis();

  if (!redis) {
    // Redis not configured — pass through to the DB every time
    return fetcher();
  }

  try {
    const hit = await redis.get(key) as T | null;
    if (hit !== null && hit !== undefined) return hit;
  } catch (err) {
    // Cache miss on error — degrade gracefully
    console.warn("[cache] Redis GET error, falling through to DB:", err);
  }

  const data = await fetcher();

  try {
    await redis.setex(key, ttl, JSON.stringify(data));
  } catch (err) {
    // Non-fatal — data was fetched, just not cached
    console.warn("[cache] Redis SET error:", err);
  }

  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// invalidate()  — delete one or more cache keys
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Delete cache entries by key.
 * Silently no-ops when Redis is not configured.
 */
export async function invalidate(...keys: string[]): Promise<void> {
  const redis = await getRedis();
  if (!redis || keys.length === 0) return;

  try {
    await redis.del(...keys);
  } catch (err) {
    console.warn("[cache] Redis DEL error:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// invalidatePattern()  — delete all keys matching a pattern  (SCAN + DEL)
// Use sparingly — SCAN is O(N) across the keyspace.
// ─────────────────────────────────────────────────────────────────────────────

export async function invalidatePattern(pattern: string): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;

  try {
    let cursor = 0;
    do {
      const [nextCursor, keys]: [number, string[]] = await redis.scan(cursor, {
        match: pattern,
        count: 100,
      });
      cursor = nextCursor;
      if (keys.length > 0) await redis.del(...keys);
    } while (cursor !== 0);
  } catch (err) {
    console.warn("[cache] Redis SCAN error:", err);
  }
}
