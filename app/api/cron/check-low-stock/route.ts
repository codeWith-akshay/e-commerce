import { NextRequest, NextResponse } from "next/server";
import { runLowStockScan } from "@/lib/actions/inventory";

/**
 * GET /api/cron/check-low-stock
 *
 * Scans every active product whose inventory stock is below its per-product
 * lowStockThreshold and creates admin notifications for each one that does not
 * already have an unread alert.
 *
 * Security: callers must supply the CRON_SECRET bearer token.
 *
 * Deployment options:
 *   • Vercel Cron Jobs  — add to vercel.json:
 *       { "path": "/api/cron/check-low-stock", "schedule": "0 * * * *" }
 *   • External cron     — curl -H "Authorization: Bearer $CRON_SECRET" \
 *                              https://your-domain.com/api/cron/check-low-stock
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;

  // CRON_SECRET must always be set — an unguarded cron endpoint is a DoS vector.
  if (!secret) {
    console.error("[cron/check-low-stock] CRON_SECRET env var is not set. "
      + "Configure it in your deployment to secure this endpoint.");
    return NextResponse.json({ error: "Server misconfigured: CRON_SECRET is not set." }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { notifiedCount, scannedCount } = await runLowStockScan();
    return NextResponse.json({ ok: true, scannedCount, notifiedCount });
  } catch (err) {
    console.error("[cron/check-low-stock]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
