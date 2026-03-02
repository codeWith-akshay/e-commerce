/**
 * lib/flags.ts
 *
 * Central registry for every feature flag in the app.
 *
 * Adding a new flag
 * ──────────────────
 *   1. Add an entry to FLAGS              (machine key — never rename in production)
 *   2. Add a default value to FLAG_DEFAULTS (false = safe off by default)
 *   3. Add a human label  to FLAG_LABELS
 *   4. Add a description  to FLAG_DESCRIPTIONS
 *   5. Run: pnpm prisma db push  (the FeatureFlag row is created on first toggle)
 *
 * Consuming a flag (server component / server action / route handler)
 * ───────────────────────────────────────────────────────────────────
 *   import { isEnabled }  from "@/lib/actions/feature-flags";
 *   import { FLAGS }      from "@/lib/flags";
 *
 *   const newCheckout = await isEnabled(FLAGS.CHECKOUT_V2);
 *   if (!newCheckout) redirect("/checkout/legacy");
 */

// ─────────────────────────────────────────────────────────────────────────────
// Flag name registry
// ─────────────────────────────────────────────────────────────────────────────

export const FLAGS = {
  /** Enable the redesigned multi-step checkout flow. */
  CHECKOUT_V2:         "checkout_v2",

  /** Show the Typesense-powered instant search overlay. */
  NEW_SEARCH_UI:       "new_search_ui",

  /** Apply free shipping automatically on all orders above ₹999. */
  FREE_SHIPPING_PROMO: "free_shipping_promo",

  /** Put the storefront in read-only maintenance mode (shows a banner). */
  MAINTENANCE_MODE:    "maintenance_mode",

  /** Show product review section on product detail pages. */
  REVIEWS_ENABLED:     "reviews_enabled",

  /** Enable wishlist feature for logged-in customers. */
  WISHLIST_ENABLED:    "wishlist_enabled",
} as const;

/** The union of all valid flag name strings. */
export type FlagName = (typeof FLAGS)[keyof typeof FLAGS];

// ─────────────────────────────────────────────────────────────────────────────
// Per-flag metadata (used by the admin UI and the safe-default fallback)
// ─────────────────────────────────────────────────────────────────────────────

export interface FlagMeta {
  /** Default value used when no DB row exists for this flag. */
  defaultValue: boolean;
  /** Short human-readable label shown in the admin toggle list. */
  label:        string;
  /** Longer description explaining what enabling this flag does. */
  description:  string;
}

export const FLAG_META: Record<FlagName, FlagMeta> = {
  checkout_v2: {
    defaultValue: false,
    label:        "New Checkout (v2)",
    description:  "Enables the redesigned multi-step checkout flow with address selection and order summary.",
  },
  new_search_ui: {
    defaultValue: false,
    label:        "Typesense Search UI",
    description:  "Replaces the basic ILIKE search with the Typesense-powered instant search overlay.",
  },
  free_shipping_promo: {
    defaultValue: false,
    label:        "Free Shipping Promo",
    description:  "Automatically waives shipping on all orders above ₹999.",
  },
  maintenance_mode: {
    defaultValue: false,
    label:        "Maintenance Mode",
    description:  "Puts the storefront in read-only mode and displays a maintenance banner to visitors.",
  },
  reviews_enabled: {
    defaultValue: true,
    label:        "Product Reviews",
    description:  "Shows the review section and star ratings on product detail pages.",
  },
  wishlist_enabled: {
    defaultValue: true,
    label:        "Wishlist",
    description:  "Allows logged-in customers to save products to a personal wishlist.",
  },
};

/** All flag names defined in the registry, sorted alphabetically. */
export const ALL_FLAG_NAMES = Object.values(FLAGS).sort() as FlagName[];
