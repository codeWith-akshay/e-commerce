import { NextRequest, NextResponse } from "next/server";
import { expireStaleReservations } from "@/lib/actions/stock-reservation";

/**
 * GET /api/cron/expire-reservations
 *
 * Releases every StockReservation whose TTL has elapsed (PENDING + expiresAt < now).
 *
 * Security: callers must supply the CRON_SECRET header to prevent public abuse.
 *
 * Deployment options:
 *   • Vercel Cron Jobs  — set crons[].path = "/api/cron/expire-reservations"
 *                         and schedule = "* * * * *" (every minute) in vercel.json
 *   • External cron     — curl -H "Authorization: Bearer $CRON_SECRET" \
 *                              https://your-domain.com/api/cron/expire-reservations
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;

  // CRON_SECRET must always be set — an unguarded cron endpoint is a DoS vector.
  if (!secret) {
    console.error("[cron/expire-reservations] CRON_SECRET env var is not set. "
      + "Configure it in your deployment to secure this endpoint.");
    return NextResponse.json({ error: "Server misconfigured: CRON_SECRET is not set." }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const expired = await expireStaleReservations();
    return NextResponse.json({ ok: true, expiredCount: expired });
  } catch (err) {
    console.error("[cron/expire-reservations]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
