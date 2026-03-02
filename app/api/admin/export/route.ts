/**
 * GET /api/admin/export
 *
 * Streams a CSV or Excel file for one of three analytics reports:
 *   • orders  — row-level order list with customer + payment columns
 *   • revenue — aggregated daily/weekly/monthly revenue breakdown
 *   • users   — customer list sorted by lifetime value
 *
 * Query parameters
 * ────────────────
 *   report      "orders" | "revenue" | "users"           required
 *   format      "csv" | "xlsx"                            default: "csv"
 *   from        YYYY-MM-DD start of date range            default: 30 days ago
 *   to          YYYY-MM-DD end   of date range            default: today
 *   granularity "day" | "week" | "month"                  default: "day" (revenue only)
 *
 * Security
 * ────────
 *   1. Session must be ADMIN or SUPERADMIN (hard 401/403).
 *   2. Rate-limited to 10 requests / hour per user+IP pair.
 *   3. Max date range: 365 days (prevents unbounded queries).
 *   4. Response headers include Cache-Control: no-store and
 *      X-Content-Type-Options: nosniff.
 *
 * Example
 * ───────
 *   GET /api/admin/export?report=orders&format=xlsx&from=2026-01-01&to=2026-01-31
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser }            from "@/lib/session";
import { exportRatelimit, getClientIp } from "@/lib/ratelimit";
import {
  fetchOrdersReport,
  fetchRevenueReport,
  fetchUsersReport,
  buildCsv,
  buildExcel,
  REPORT_HEADERS,
  type ReportType,
  type RevenueGranularity,
} from "@/lib/exports/reports";

// ─────────────────────────────────────────────────────────────────────────────
// Input validation
// ─────────────────────────────────────────────────────────────────────────────

const querySchema = z.object({
  report: z.enum(["orders", "revenue", "users"]),
  format: z.enum(["csv", "xlsx"]).default("csv"),

  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "from must be YYYY-MM-DD")
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "to must be YYYY-MM-DD")
    .optional(),

  granularity: z.enum(["day", "week", "month"]).default("day"),
});

/** Maximum query range to prevent runaway DB scans. */
const MAX_RANGE_DAYS = 365;

// ─────────────────────────────────────────────────────────────────────────────
// MIME types + file extensions
// ─────────────────────────────────────────────────────────────────────────────

const MIME = {
  csv:  "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<Response> {
  // ── 1. Authentication ────────────────────────────────────────────────────────
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (user.role !== "ADMIN" && user.role !== "SUPERADMIN") {
    return NextResponse.json(
      { error: "Forbidden. Admin access required." },
      { status: 403 },
    );
  }

  // ── 2. Rate limiting (keyed by userId + IP) ──────────────────────────────────
  const ip = getClientIp(req);
  const { success: rlOk } = await exportRatelimit.check(`${user.id}:${ip}`);

  if (!rlOk) {
    return NextResponse.json(
      { error: "Too many export requests. Please wait before retrying." },
      { status: 429 },
    );
  }

  // ── 3. Parse + validate query parameters ─────────────────────────────────────
  const rawParams = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed    = querySchema.safeParse(rawParams);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { report, format, granularity } = parsed.data;

  // Resolve dates (default: last 30 days)
  const now  = new Date();
  const from = parsed.data.from
    ? new Date(`${parsed.data.from}T00:00:00.000Z`)
    : new Date(now.getTime() - 30 * 86_400_000);
  const to = parsed.data.to
    ? new Date(`${parsed.data.to}T23:59:59.999Z`)
    : now;

  if (to < from) {
    return NextResponse.json(
      { error: "'from' must be before 'to'." },
      { status: 400 },
    );
  }

  const rangeDays = (to.getTime() - from.getTime()) / 86_400_000;
  if (rangeDays > MAX_RANGE_DAYS) {
    return NextResponse.json(
      { error: `Date range cannot exceed ${MAX_RANGE_DAYS} days.` },
      { status: 400 },
    );
  }

  // ── 4. Fetch report data ──────────────────────────────────────────────────────
  try {
    const headers = REPORT_HEADERS[report as ReportType];
    let rows: string[][];

    switch (report) {
      case "orders":
        rows = await fetchOrdersReport(from, to);
        break;
      case "revenue":
        rows = await fetchRevenueReport(from, to, granularity as RevenueGranularity);
        break;
      case "users":
        rows = await fetchUsersReport(from, to);
        break;
    }

    // ── 5. Serialise ─────────────────────────────────────────────────────────────
    const dateTag  = `${fmtDate(from)}_${fmtDate(to)}`;
    const filename = `${report}-report_${dateTag}.${format}`;

    const securityHeaders = {
      "Cache-Control":          "no-store, no-cache, must-revalidate",
      "Pragma":                 "no-cache",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options":        "DENY",
      "Content-Disposition":    `attachment; filename="${filename}"`,
    };

    if (format === "csv") {
      const csv = buildCsv(headers, rows);
      return new Response(csv, {
        headers: { "Content-Type": MIME.csv, ...securityHeaders },
      });
    }

    // xlsx
    const sheetTitle = `${report[0].toUpperCase() + report.slice(1)} (${fmtDate(from)} – ${fmtDate(to)})`;
    const uint8 = await buildExcel(report as ReportType, headers, rows, sheetTitle);
    // Blob is valid BodyInit regardless of Uint8Array generic variance
    const blob  = new Blob([uint8], { type: MIME.xlsx });

    return new Response(blob, {
      headers: { "Content-Type": MIME.xlsx, ...securityHeaders },
    });
  } catch (err) {
    console.error("[admin/export]", { report, format, from, to, err });
    return NextResponse.json(
      { error: "Failed to generate report. Please try again." },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
