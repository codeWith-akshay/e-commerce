"use client";

import { useActionState, useState, useEffect } from "react";
import type { OrderStatus } from "@prisma/client";
import { updateOrderStatusAction, type UpdateOrderStatusState } from "@/lib/actions/order";
import {
  CheckCircle,
  AlertCircle,
  Loader2,
  Clock,
  Layers,
  Truck,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Check,
} from "lucide-react";
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/lib/order-statuses";

const STEP_ORDER: OrderStatus[] = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED"];

const STATUS_META: Record<
  string,
  { icon: React.ReactNode; color: string; ring: string; activeGrad: string; label: string }
> = {
  PENDING:    { icon: <Clock className="h-4 w-4" />,       label: "Pending",    color: "text-amber-600",  ring: "ring-amber-400",   activeGrad: "from-amber-400 to-amber-500" },
  PROCESSING: { icon: <Layers className="h-4 w-4" />,      label: "Processing", color: "text-blue-600",   ring: "ring-blue-400",    activeGrad: "from-blue-400 to-blue-500" },
  SHIPPED:    { icon: <Truck className="h-4 w-4" />,       label: "Shipped",    color: "text-violet-600", ring: "ring-violet-400",  activeGrad: "from-violet-400 to-violet-500" },
  DELIVERED:  { icon: <CheckCircle2 className="h-4 w-4" />,label: "Delivered",  color: "text-emerald-600",ring: "ring-emerald-400", activeGrad: "from-emerald-400 to-emerald-500" },
  CANCELLED:  { icon: <XCircle className="h-4 w-4" />,     label: "Cancelled",  color: "text-red-600",    ring: "ring-red-400",     activeGrad: "from-red-400 to-red-500" },
};

interface Props {
  orderId:       string;
  currentStatus: OrderStatus;
}

export default function AdminOrderStatusUpdate({ orderId, currentStatus }: Props) {
  const bound = updateOrderStatusAction.bind(null, orderId);
  const [state, action, pending] = useActionState<UpdateOrderStatusState, FormData>(bound, {});

  const [selected, setSelected] = useState<OrderStatus>(currentStatus);
  useEffect(() => { setSelected(currentStatus); }, [currentStatus]);

  const currentStepIdx = STEP_ORDER.indexOf(currentStatus);
  const isCancelled    = currentStatus === "CANCELLED";

  return (
    <form action={action} className="space-y-5">
      {/* ── Order progress stepper ── */}
      {!isCancelled && (
        <div className="relative flex items-start justify-between">
          {/* Connector line */}
          <div className="absolute left-4 right-4 top-4 h-0.5 bg-gray-100" />
          {/* Progress fill */}
          <div
            className="absolute left-4 top-4 h-0.5 bg-linear-to-r from-indigo-400 to-indigo-500 transition-all duration-500"
            style={{ right: `${100 - (currentStepIdx / (STEP_ORDER.length - 1)) * 100}%` }}
          />
          {STEP_ORDER.map((s, i) => {
            const meta    = STATUS_META[s];
            const done    = i < currentStepIdx;
            const current = i === currentStepIdx;
            return (
              <div key={s} className="relative z-10 flex flex-col items-center gap-1.5">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full ring-2 transition-all duration-300 ${
                  done
                    ? "bg-indigo-500 ring-indigo-300 text-white shadow-sm shadow-indigo-200"
                    : current
                    ? `bg-linear-to-br ${meta.activeGrad} ${meta.ring} text-white shadow-md`
                    : "bg-white ring-gray-200 text-gray-300"
                }`}>
                  {done ? <Check className="h-3.5 w-3.5" /> : meta.icon}
                </div>
                <p className={`text-[10px] font-semibold text-center leading-tight ${
                  current ? meta.color : done ? "text-indigo-600" : "text-gray-400"
                }`}>
                  {meta.label}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Fast-action buttons ── */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          Set Status
        </p>
        <div className="flex flex-col gap-1.5">
          {ORDER_STATUSES.map((s) => {
            const meta      = STATUS_META[s];
            const isActive  = selected === s;
            const isCurrent = currentStatus === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSelected(s as OrderStatus)}
                className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium ring-1 transition-all ${
                  isActive
                    ? `bg-linear-to-r ${meta.activeGrad} text-white ring-transparent shadow-sm`
                    : "bg-white text-gray-600 ring-gray-200 hover:bg-gray-50 hover:ring-gray-300"
                }`}
              >
                <span className={`shrink-0 transition-colors ${isActive ? "text-white" : meta.color}`}>
                  {meta.icon}
                </span>
                <span className="flex-1 text-left">{ORDER_STATUS_LABELS[s]}</span>
                {isCurrent && !isActive && (
                  <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
                    current
                  </span>
                )}
                {isActive && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hidden input carries the selected value */}
      <input type="hidden" name="status" value={selected} />

      {/* ── Feedback ── */}
      {state.error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700">
          <CheckCircle className="h-3.5 w-3.5 shrink-0" />
          Status updated successfully.
        </div>
      )}

      <button
        type="submit"
        disabled={pending || selected === currentStatus}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
      >
        {pending
          ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving…</>
          : <><ChevronRight className="h-3.5 w-3.5" />Update Status</>
        }
      </button>
    </form>
  );
}

