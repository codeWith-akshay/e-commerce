"use client";

import { useActionState, useState, useEffect } from "react";
import { OrderStatus } from "@prisma/client";
import { updateOrderStatusAction, type UpdateOrderStatusState } from "@/lib/actions/order";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";

// ── Derive statuses from the Prisma enum — stays in sync automatically ────────
const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING:    "Pending",
  PROCESSING: "Processing",
  SHIPPED:    "Shipped",
  DELIVERED:  "Delivered",
  CANCELLED:  "Cancelled",
};

const STATUSES = (Object.values(OrderStatus) as OrderStatus[]).map((v) => ({
  value: v,
  label: STATUS_LABELS[v],
}));

interface Props {
  orderId:       string;
  currentStatus: OrderStatus;
}

export default function AdminOrderStatusUpdate({ orderId, currentStatus }: Props) {
  const bound = updateOrderStatusAction.bind(null, orderId);
  const [state, action, pending] = useActionState<UpdateOrderStatusState, FormData>(bound, {});

  // Controlled select — stays in sync with the server-revalidated prop.
  // When the parent RSC re-renders after revalidatePath(), currentStatus updates
  // and the effect syncs local state so the select reflects the true DB value.
  const [selected, setSelected] = useState<OrderStatus>(currentStatus);
  useEffect(() => { setSelected(currentStatus); }, [currentStatus]);

  return (
    <form action={action} className="space-y-3">
      {/* Status select */}
      <div>
        <label
          htmlFor="status"
          className="block text-xs font-medium uppercase tracking-wider text-slate-400"
        >
          Update Status
        </label>
        <select
          id="status"
          name="status"
          value={selected}
          onChange={(e) => setSelected(e.target.value as OrderStatus)}
          disabled={pending}
          className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-60"
        >
          {STATUSES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Feedback */}
      {state.error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
          <CheckCircle className="h-3.5 w-3.5 shrink-0" />
          Status updated successfully.
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
      >
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {pending ? "Saving…" : "Save Status"}
      </button>
    </form>
  );
}
