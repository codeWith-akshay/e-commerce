/**
 * POST /api/refunds
 *
 * Customer submits a partial or full refund request for a paid order.
 *
 * Full validation (amount ceiling, per-item qty, no double-refund) happens
 * inside requestRefund() within a Serializable transaction.
 *
 * Body:
 * {
 *   orderId:         string;          // cuid
 *   reason:          string;          // min 10 chars
 *   items: [{
 *     orderItemId:   string;          // cuid
 *     quantity:      number;          // ≥ 1
 *     amount:        number;          // > 0, ≤ 2 dp, ≤ qty × unit price
 *   }];
 *   returnRequestId?: string;         // optional link to return request
 * }
 *
 * Response 201: { refundId: string }
 *
 * Idempotency:
 *   Each call creates a new Refund row with a unique idempotencyKey derived
 *   from paymentId + timestamp.  The per-item qty aggregation guards prevent
 *   a customer from submitting two requests covering the same units.
 */

import { NextRequest, NextResponse } from "next/server";
import { requestRefund } from "@/lib/actions/refund";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const result = await requestRefund(body as Parameters<typeof requestRefund>[0]);

  if (!result.success) {
    const status =
      result.code === "UNAUTHENTICATED"   ? 401 :
      result.code === "FORBIDDEN"         ? 403 :
      result.code === "ORDER_NOT_FOUND"   ? 404 :
      result.code === "INVALID_INPUT"     ? 422 :
      result.code === "EXCEEDS_PAID_AMOUNT"  ? 422 :
      result.code === "QTY_EXCEEDS_AVAILABLE" ? 422 : 400;

    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }

  return NextResponse.json({ refundId: result.data?.refundId }, { status: 201 });
}

/**
 * GET /api/refunds?orderId=xxx
 *
 * Returns all refund requests for a given order belonging to the current user.
 * Includes item-level breakdown and current status for refund history display.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("orderId")?.trim();

  if (!orderId) {
    return NextResponse.json({ error: "orderId query parameter is required." }, { status: 400 });
  }

  const { getRefundsForOrder } = await import("@/lib/actions/refund");
  const refunds = await getRefundsForOrder(orderId);

  return NextResponse.json({ refunds });
}
