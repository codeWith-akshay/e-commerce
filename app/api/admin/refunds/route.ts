/**
 * GET /api/admin/refunds
 *
 * Admin queue — paginated list of all refund requests across all orders.
 *
 * Query params:
 *   status  — filter by RefundStatus value or "ALL" (default: ALL)
 *   page    — 1-based page number (default: 1)
 *   limit   — rows per page, max 50 (default: 20)
 *
 * Auth: ADMIN or SUPERADMIN only (enforced inside getAdminRefunds via session).
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionRole } from "@/lib/session";
import { getAdminRefunds } from "@/lib/actions/refund";

export async function GET(req: NextRequest) {
  // Role guard at route level — belt-and-suspenders on top of action-level check.
  const role = await getSessionRole();
  if (role !== "ADMIN" && role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status")  ?? "ALL";
  const page   = Number(searchParams.get("page")  ?? "1");
  const limit  = Number(searchParams.get("limit") ?? "20");

  if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1) {
    return NextResponse.json({ error: "Invalid pagination parameters." }, { status: 400 });
  }

  const data = await getAdminRefunds({ status, page, limit });
  return NextResponse.json(data);
}
