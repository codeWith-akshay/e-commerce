/**
 * lib/search/typesense.ts
 *
 * Typesense client singleton + collection schema.
 *
 * Typesense is a blazing-fast, typo-tolerant open-source search engine.
 * It can be:
 *   • Self-hosted  → run `docker run -p 8108:8108 typesense/typesense:27.1 \
 *                          --data-dir /tmp/typesense --api-key=your-key`
 *   • Cloud-hosted → https://cloud.typesense.org  (free tier available)
 *
 * Required .env variables
 * ───────────────────────
 *   TYPESENSE_HOST       e.g. "localhost" or "xxx.a1.typesense.net"
 *   TYPESENSE_PORT       e.g. 8108  (self-hosted) or 443 (cloud)
 *   TYPESENSE_PROTOCOL   "http" (self-hosted) or "https" (cloud)
 *   TYPESENSE_API_KEY    Admin API key — server-side only, never expose
 *   TYPESENSE_SEARCH_KEY Read-only search-only key (safe for NEXT_PUBLIC_*)
 *
 * Collection name
 * ───────────────
 *   "products"  — one document per active product
 *
 * Index strategy
 * ──────────────
 *   • `title`       — highest weight (3×) for query_by
 *   • `description` — lower weight (1×)
 *   • `category`    — facet field; exact filter  (category:=Electronics)
 *   • `price`       — numeric; range filter      (price:>=100 && price:<=500)
 *   • `rating`      — numeric; sort + floor filter
 *   • `stock`       — numeric; can filter out-of-stock items
 *   • `isActive`    — bool;   always filtered to true in public queries
 *   • `createdAt`   — int64 Unix-ms; default sort for "newest"
 *   • `images`      — string[]; NOT indexed (binary blob URLs, no search value)
 */

import { Client as TypesenseClient } from "typesense";
import type { CollectionCreateSchema } from "typesense/lib/Typesense/Collections.js";
import { env, isTypesenseConfigured } from "@/config/env";

// ─────────────────────────────────────────────────────────────────────────────
// Collection name
// ─────────────────────────────────────────────────────────────────────────────

export const PRODUCTS_COLLECTION = "products" as const;

// ─────────────────────────────────────────────────────────────────────────────
// Document shape stored in Typesense
// ─────────────────────────────────────────────────────────────────────────────

export interface ProductDocument {
  id:          string;  // Typesense requires "id" to be a string
  title:       string;
  description: string;
  slug:        string;
  price:       number;
  stock:       number;
  rating:      number;
  ratingCount: number;
  category:    string;
  categoryId:  string;
  images:      string[];  // not indexed — stored only for display
  isActive:    boolean;
  createdAt:   number;    // Unix epoch ms
}

// ─────────────────────────────────────────────────────────────────────────────
// Collection schema — defined once; used by ensureCollection()
// ─────────────────────────────────────────────────────────────────────────────

export const PRODUCTS_SCHEMA: CollectionCreateSchema = {
  name: PRODUCTS_COLLECTION,

  // Fields
  fields: [
    { name: "title",       type: "string"   },
    { name: "description", type: "string"   },
    { name: "slug",        type: "string",  optional: true },
    { name: "price",       type: "float"    },
    { name: "stock",       type: "int32"    },
    { name: "rating",      type: "float"    },
    { name: "ratingCount", type: "int32"    },
    // facet: true → Typesense can return aggregated bucket counts per value
    { name: "category",    type: "string",  facet: true },
    { name: "categoryId",  type: "string",  facet: true },
    // index: false → stored but never tokenised (saves RAM + index size)
    { name: "images",      type: "string[]", optional: true, index: false },
    { name: "isActive",    type: "bool"     },
    // int64 → supports sorting by date without string parsing overhead
    { name: "createdAt",   type: "int64"    },
  ],

  // Default sort: newest products first when no explicit sort_by is supplied
  default_sorting_field: "createdAt",
};

// ─────────────────────────────────────────────────────────────────────────────
// Client singleton (lazy — only built when Typesense is configured)
// ─────────────────────────────────────────────────────────────────────────────

let _client: TypesenseClient | null = null;

/** Returns the Typesense admin client, or null when not configured. */
export function getTypesenseClient(): TypesenseClient | null {
  if (!isTypesenseConfigured) return null;

  if (!_client) {
    _client = new TypesenseClient({
      nodes: [
        {
          host:     env.TYPESENSE_HOST!,
          port:     env.TYPESENSE_PORT!,
          protocol: (env.TYPESENSE_PROTOCOL ?? "https") as "http" | "https",
        },
      ],
      apiKey:           env.TYPESENSE_API_KEY!,
      connectionTimeoutSeconds: 5,
      retryIntervalSeconds:     0.1,
      numRetries:               3,
    });
  }

  return _client;
}

// ─────────────────────────────────────────────────────────────────────────────
// Collection bootstrap
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Idempotent — creates the `products` collection if it doesn't exist yet.
 * Call this from the reindex admin endpoint and the app startup health check.
 *
 * To drop and recreate (useful during schema changes):
 *   pass `{ recreate: true }` — this is destructive and should only be
 *   done during a full reindex operation.
 */
export async function ensureCollection(opts?: { recreate?: boolean }): Promise<void> {
  const client = getTypesenseClient();
  if (!client) {
    console.warn("[typesense] Not configured — skipping ensureCollection()");
    return;
  }

  if (opts?.recreate) {
    try {
      await client.collections(PRODUCTS_COLLECTION).delete();
      console.info("[typesense] Dropped existing collection for fresh reindex.");
    } catch {
      // Collection didn't exist — fine
    }
  }

  try {
    await client.collections(PRODUCTS_COLLECTION).retrieve();
    // Already exists
  } catch {
    // Does not exist yet — create it
    await client.collections().create(PRODUCTS_SCHEMA);
    console.info(`[typesense] Created collection '${PRODUCTS_COLLECTION}'.`);
  }
}
