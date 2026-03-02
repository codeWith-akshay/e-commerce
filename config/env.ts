/**
 * config/env.ts
 *
 * Validates all environment variables at startup using Zod.
 * The app will throw at build/boot time if any required variable is missing
 * or malformed — preventing silent runtime failures in production.
 *
 * Usage:
 *   import { env } from "@/config/env";
 *   const client = new Stripe(env.STRIPE_SECRET_KEY);
 */

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────

const envSchema = z.object({
  // ── Node ────────────────────────────────────────────────────────────────────
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // ── Database ─────────────────────────────────────────────────────────────────
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // ── Auth.js ───────────────────────────────────────────────────────────────────
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET must be at least 32 characters"),

  // ── Upstash Redis  (optional — graceful fallback when not configured) ─────────
  UPSTASH_REDIS_REST_URL:   z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().url().optional()
  ),
  UPSTASH_REDIS_REST_TOKEN: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().optional()
  ),

  // ── Stripe  (optional — only required when PAYMENT_PROVIDER=stripe) ──────────
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // ── Razorpay  (optional) ────────────────────────────────────────────────────
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),

  // ── Email  (optional — Resend) ───────────────────────────────────────────────
  RESEND_API_KEY: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().optional()
  ),
  EMAIL_FROM: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().email().optional()
  ),

  // ── Typesense  (optional — full-text / fuzzy search) ─────────────────────────
  // Self-hosted:  TYPESENSE_HOST=localhost, TYPESENSE_PORT=8108, TYPESENSE_PROTOCOL=http
  // Typesense Cloud: TYPESENSE_HOST=xxx.a1.typesense.net, PORT=443, PROTOCOL=https
  TYPESENSE_HOST:       z.string().optional(),
  TYPESENSE_PORT:       z.coerce.number().int().positive().optional(),
  TYPESENSE_PROTOCOL:   z.enum(["http", "https"]).optional(),
  TYPESENSE_API_KEY:    z.string().optional(),   // admin API key (server-side only)
  TYPESENSE_SEARCH_KEY: z.string().optional(),   // search-only key (safe to expose)

  // ── App ──────────────────────────────────────────────────────────────────────
  NEXT_PUBLIC_APP_URL: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().url().optional()
  ),
});

// ─────────────────────────────────────────────────────────────────────────────
// Parse — throws ZodError with a clear message on first startup if invalid
// ─────────────────────────────────────────────────────────────────────────────

function parseEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  ✗ ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `\n\n❌ Invalid environment variables:\n${formatted}\n\nFix the above in your .env file.\n`
    );
  }

  return result.data;
}

export const env = parseEnv();

// ─────────────────────────────────────────────────────────────────────────────
// Derived helpers
// ─────────────────────────────────────────────────────────────────────────────

export const isProd = env.NODE_ENV === "production";
export const isDev  = env.NODE_ENV === "development";

/** True when Upstash Redis credentials are fully configured. */
export const isRedisConfigured =
  !!env.UPSTASH_REDIS_REST_URL && !!env.UPSTASH_REDIS_REST_TOKEN;

/** True when Stripe credentials are configured. */
export const isStripeConfigured =
  !!env.STRIPE_SECRET_KEY && !!env.STRIPE_WEBHOOK_SECRET;

/** True when all four Typesense variables are present. */
export const isTypesenseConfigured =
  !!env.TYPESENSE_HOST &&
  !!env.TYPESENSE_PORT &&
  !!env.TYPESENSE_API_KEY;
