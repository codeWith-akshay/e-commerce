import { auth } from "@/lib/auth";
import type { Role } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// Session helpers — thin wrappers around Auth.js v5 `auth()`
//
// Swap the implementation here without touching any server actions or
// route handlers that call these helpers.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the authenticated user's id, or `null` when no valid session exists.
 */
export async function getSessionUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/**
 * Returns the full session user object, or `null` when unauthenticated.
 */
export async function getSessionUser(): Promise<{
  id:    string;
  name:  string;
  email: string;
  role:  Role;
} | null> {
  const session = await auth();
  return session?.user ?? null;
}

/**
 * Returns the authenticated user's role, or `null` when unauthenticated.
 * Useful for RBAC checks in Server Components and Route Handlers.
 */
export async function getSessionRole(): Promise<Role | null> {
  const session = await auth();
  return session?.user?.role ?? null;
}
