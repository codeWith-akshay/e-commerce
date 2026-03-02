"use server";

/**
 * lib/actions/feature-flags.ts
 *
 * Server actions for the feature flag system.
 *
 * Public API
 * ──────────
 *   isEnabled(name)     → boolean   primary consumer call — cached, safe default fallback
 *   getAllFlags()        → FlagRow[] merged DB + registry list for admin UI
 *   setFlag(name, bool) → void      admin toggle — requires ADMIN role
 *   deleteFlag(name)    → void      remove custom flag — requires SUPERADMIN
 *
 * Caching strategy
 * ────────────────
 *   Each flag is cached individually under "flag:<name>" with a 5-minute TTL.
 *   The admin "getAllFlags" list is NOT cached to ensure the admin UI always
 *   shows the current state immediately after a toggle.
 *   On every setFlag call we invalidate "flag:<name>" so the next check starts fresh.
 */

import { revalidatePath }       from "next/cache";
import { redirect }             from "next/navigation";
import prisma                   from "@/lib/prisma";
import { cache, invalidate, CacheKeys, TTL } from "@/lib/redis";
import { getSessionRole, getSessionUser }    from "@/lib/session";
import { writeAuditLog }        from "@/lib/audit";
import {
  FLAG_META,
  ALL_FLAG_NAMES,
  type FlagName,
}                               from "@/lib/flags";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface FlagRow {
  /** Flag machine key, e.g. "checkout_v2" */
  name:        FlagName;
  /** Current enabled state */
  enabled:     boolean;
  /** Human-readable label from the registry */
  label:       string;
  /** Human-readable description from the registry */
  description: string;
  /** Whether this flag has a row in the database yet */
  persisted:   boolean;
  updatedAt:   Date | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth guard
// ─────────────────────────────────────────────────────────────────────────────

async function requireAdmin() {
  const role = await getSessionRole();
  if (!role) redirect("/login");
  if (role !== "ADMIN" && role !== "SUPERADMIN") redirect("/");
}

// ─────────────────────────────────────────────────────────────────────────────
// isEnabled  — primary consumer API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true when the flag is enabled.
 *
 * Resolution order:
 *   1. Redis cache (5-minute TTL)
 *   2. Postgres row
 *   3. Registry default (FLAG_META[name].defaultValue)
 *
 * Never throws — any error returns the safe default for that flag.
 *
 * Usage (Server Component or Server Action):
 *   const v2 = await isEnabled(FLAGS.CHECKOUT_V2);
 *   if (v2) { ... }
 */
export async function isEnabled(name: FlagName): Promise<boolean> {
  try {
    return await cache(CacheKeys.flag(name), TTL.medium, async () => {
      const row = await prisma.featureFlag.findUnique({
        where:  { name },
        select: { enabled: true },
      });
      // Fall back to the registry default when no DB row exists yet
      return row?.enabled ?? FLAG_META[name]?.defaultValue ?? false;
    });
  } catch (err) {
    console.error(`[feature-flags] isEnabled("${name}") failed, using default`, err);
    return FLAG_META[name]?.defaultValue ?? false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getAllFlags  — admin list
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns every flag defined in the registry, merged with live DB state.
 * Flags not yet persisted in the DB show their registry default value.
 * Sorted alphabetically by name.
 */
export async function getAllFlags(): Promise<FlagRow[]> {
  const rows = await prisma.featureFlag.findMany({
    select: { name: true, enabled: true, updatedAt: true },
  });

  const dbMap = new Map(rows.map((r) => [r.name, r]));

  return ALL_FLAG_NAMES.map((name) => {
    const meta    = FLAG_META[name];
    const dbRow   = dbMap.get(name);
    return {
      name,
      enabled:     dbRow?.enabled   ?? meta.defaultValue,
      label:       meta.label,
      description: meta.description,
      persisted:   !!dbRow,
      updatedAt:   dbRow?.updatedAt ?? null,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// setFlag  — toggle a flag (admin action)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upserts the flag row and invalidates its Redis cache.
 * Writes an audit log entry so changes are traceable.
 *
 * Called by the toggle form action in the admin UI.
 */
export async function setFlagAction(
  name:    FlagName,
  enabled: boolean,
): Promise<{ error?: string }> {
  await requireAdmin();

  const user = await getSessionUser();
  if (!user) return { error: "Session expired." };

  // Validate name is a known flag
  if (!(name in FLAG_META)) {
    return { error: `Unknown flag: "${name}".` };
  }

  try {
    const previous = await prisma.featureFlag.findUnique({
      where:  { name },
      select: { enabled: true },
    });

    const meta = FLAG_META[name];

    await prisma.featureFlag.upsert({
      where:  { name },
      create: {
        name,
        enabled,
        description: meta.description,
        updatedById: user.id,
      },
      update: {
        enabled,
        updatedById: user.id,
      },
    });

    // Bust the individual flag cache immediately
    await invalidate(CacheKeys.flag(name));

    // Audit trail
    writeAuditLog({
      performedById: user.id,
      action:        "UPDATE",
      entity:        "FeatureFlag",
      entityId:      name,
      oldValue:      { enabled: previous?.enabled ?? FLAG_META[name].defaultValue },
      newValue:      { enabled },
    }).catch((e) => console.error("[feature-flags] audit write failed", e));

    revalidatePath("/admin/feature-flags");
    // Bust ISR caches for pages whose content is gated on this specific flag.
    // "layout" granularity propagates the invalidation to all nested pages.
    const FLAG_REVALIDATION_PATHS: Partial<Record<FlagName, string[]>> = {
      reviews_enabled:  ["/products"],  // all /products/[id] ISR pages
      maintenance_mode: ["/"],          // root layout banner
    };
    for (const path of FLAG_REVALIDATION_PATHS[name] ?? []) {
      revalidatePath(path, "layout");
    }
    return {};
  } catch (err) {
    console.error(`[feature-flags] setFlag("${name}", ${enabled}) failed`, err);
    return { error: "Failed to update flag. Please try again." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// deleteFlag  — remove a custom flag row  (SUPERADMIN only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deletes the DB row for a flag, reverting it to its registry default.
 * Only SUPERADMIN can delete flags to prevent accidental data loss.
 */
export async function deleteFlagAction(name: FlagName): Promise<{ error?: string }> {
  const role = await getSessionRole();
  if (!role) redirect("/login");
  if (role !== "SUPERADMIN") return { error: "SUPERADMIN access required." };

  try {
    await prisma.featureFlag.delete({ where: { name } }).catch(() => {
      /* row may not exist — treat as success */
    });

    await invalidate(CacheKeys.flag(name));
    revalidatePath("/admin/feature-flags");
    return {};
  } catch (err) {
    console.error(`[feature-flags] deleteFlag("${name}") failed`, err);
    return { error: "Failed to delete flag." };
  }
}

// Re-export FLAGS removed — "use server" files can only export async functions.
// Import FLAGS directly from "@/lib/flags" instead.
