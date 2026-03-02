/**
 * POST /api/admin/search/reindex
 *
 * Triggers a full Typesense index rebuild from Postgres.
 *
 * When to use
 * ───────────
 *   • First deployment — bootstrap an empty Typesense instance
 *   • After a schema change to the Typesense collection definition
 *   • After a bulk Postgres import that bypassed the product actions
 *   • As a recovery step when the index drifts from the database
 *
 * What it does
 * ────────────
 *   1. Drops the existing `products` collection (all documents wiped)
 *   2. Recreates the collection with the current schema
 *   3. Streams all active, non-deleted products from Postgres in batches of 250
 *   4. Returns { ok, indexed, failed, durationMs }
 *
 * Security
 * ────────
 *   SUPERADMIN-only.  Rate-limited to 2 calls per hour to prevent
 *   accidental hammering of the Typesense node.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser }              from "@/lib/session";
import { reindexRatelimit, getClientIp } from "@/lib/ratelimit";
import { reindexAll }                  from "@/lib/search/sync";
import { getTypesenseClient }          from "@/lib/search/typesense";

// 2 full reindex calls per hour per admin (very conservative — each is heavy)
const reindexLimiter = reindexRatelimit;

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (user.role !== "SUPERADMIN") {
    return NextResponse.json(
      { error: "Forbidden. SUPERADMIN access required." },
      { status: 403 },
    );
  }

  // ── 2. Rate limit ──────────────────────────────────────────────────────────
  const ip = getClientIp(req);
  const { success: rlOk } = await reindexLimiter.check(`${user.id}:${ip}`);
  if (!rlOk) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Wait before triggering another reindex." },
      { status: 429 },
    );
  }

  // ── 3. Guard: Typesense must be configured ─────────────────────────────────
  if (!getTypesenseClient()) {
    return NextResponse.json(
      { error: "Typesense is not configured. Set TYPESENSE_HOST, TYPESENSE_PORT, and TYPESENSE_API_KEY." },
      { status: 503 },
    );
  }

  // ── 4. Run reindex ─────────────────────────────────────────────────────────
  console.info(`[reindex] Triggered by user ${user.id} (${user.email})`);
  const result = await reindexAll();

  const status = result.ok ? 200 : 500;
  return NextResponse.json(result, { status });
}
