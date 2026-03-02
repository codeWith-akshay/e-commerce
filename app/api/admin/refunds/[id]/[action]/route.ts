/**
 * POST /api/admin/refunds/[id]/approve
 *
 * Admin approves a PENDING_REVIEW refund, optionally overriding the amount
 * downward, then immediately dispatches the gateway API call.
 *
 * The gateway call sets status → PROCESSING; a webhook later sets → PROCESSED.
 *
 * Body (all optional):
 * {
 *   approvedAmount?: number;   // ≤ requestedAmount; omit = approve full amount
 *   adminNote?:      string;   // internal note stored on the refund row
 * }
 *
 * POST /api/admin/refunds/[id]/reject
 *
 * Admin rejects a PENDING_REVIEW refund. No gateway action.
 *
 * Body:
 * { adminNote: string }   // reason for rejection — required
 *
 * POST /api/admin/refunds/[id]/retry
 *
 * Re-dispatches a FAILED refund to the gateway after resetting it to APPROVED.
 * No body required.
 *
 * Auth: ADMIN or SUPERADMIN only.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionRole } from "@/lib/session";
import { approveRefund, rejectRefund, retryRefund } from "@/lib/actions/refund";

type Ctx = { params: Promise<{ id: string; action: string }> };

// Single handler covering approve | reject | retry under /[id]/[action]
export async function POST(req: NextRequest, { params }: Ctx) {
  // ── Auth guard ─────────────────────────────────────────────────────────────
  const role = await getSessionRole();
  if (role !== "ADMIN" && role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: refundId, action } = await params;

  if (!refundId?.trim()) {
    return NextResponse.json({ error: "Refund ID is required." }, { status: 400 });
  }

  // ── Approve ────────────────────────────────────────────────────────────────
  if (action === "approve") {
    let approvedAmount: number | undefined;
    let adminNote: string | undefined;

    try {
      const raw = (await req.json()) as Record<string, unknown>;
      if (typeof raw.approvedAmount === "number") approvedAmount = raw.approvedAmount;
      if (typeof raw.adminNote      === "string") adminNote      = raw.adminNote;
    } catch {
      // body is optional for approve — proceed without it
    }

    const result = await approveRefund({ refundId, approvedAmount, adminNote });

    if (!result.success) {
      const status =
        result.code === "NOT_FOUND"       ? 404 :
        result.code === "WRONG_STATUS"    ? 422 :
        result.code === "AMOUNT_INVALID"  ? 422 :
        result.code === "EXCEEDS_BALANCE" ? 422 : 400;
      return NextResponse.json({ error: result.error, code: result.code }, { status });
    }

    return NextResponse.json({ dispatchedAmount: result.data?.dispatchedAmount });
  }

  // ── Reject ─────────────────────────────────────────────────────────────────
  if (action === "reject") {
    let body: { adminNote?: string } = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    if (!body.adminNote?.trim()) {
      return NextResponse.json(
        { error: "adminNote is required when rejecting a refund.", code: "MISSING_NOTE" },
        { status: 422 }
      );
    }

    const result = await rejectRefund({ refundId, adminNote: body.adminNote });

    if (!result.success) {
      const status =
        result.code === "NOT_FOUND"    ? 404 :
        result.code === "WRONG_STATUS" ? 422 : 400;
      return NextResponse.json({ error: result.error, code: result.code }, { status });
    }

    return NextResponse.json({ success: true });
  }

  // ── Retry ──────────────────────────────────────────────────────────────────
  if (action === "retry") {
    const result = await retryRefund(refundId);

    if (!result.success) {
      const status =
        result.code === "NOT_FOUND"    ? 404 :
        result.code === "WRONG_STATUS" ? 422 : 400;
      return NextResponse.json({ error: result.error, code: result.code }, { status });
    }

    return NextResponse.json({ dispatchedAmount: result.data?.dispatchedAmount });
  }

  return NextResponse.json(
    { error: `Unknown action "${action}". Use approve, reject, or retry.` },
    { status: 400 }
  );
}
