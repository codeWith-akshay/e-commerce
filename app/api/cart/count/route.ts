import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { CartCountResponse } from "@/types";
import prisma from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

// Force dynamic — cart count must never be cached at the edge
export const dynamic = "force-dynamic";

/**
 * GET /api/cart/count
 *
 * Returns the total number of cart items for the authenticated user.
 *
 * Auth strategy (swap in when auth is implemented):
 *   1. Read a signed session cookie / JWT from the request headers.
 *   2. Decode the userId from the token.
 *   3. Query `prisma.cart.aggregate` for that userId.
 *
 * Until auth is wired up the endpoint returns 0 so the UI is always
 * consistent and the infrastructure is ready to enable.
 */
export async function GET(_req: NextRequest): Promise<NextResponse<CartCountResponse>> {
  try {
    // ── Auth — resolve session via Auth.js ──────────────────────────────────
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json({ count: 0 });
    }

    // ── DB query ─────────────────────────────────────────────────────────────
    const result = await prisma.cart.aggregate({
      where: { userId },
      _sum: { quantity: true },
    });

    const count = result._sum.quantity ?? 0;

    return NextResponse.json(
      { count },
      {
        headers: {
          // No caching — cart count changes on every add/remove
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (err) {
    // Log server-side but never leak internal errors to the client
    console.error("[/api/cart/count] Error:", err);
    return NextResponse.json({ count: 0 });
  }
}
