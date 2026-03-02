"use client";

/**
 * MovementFiltersClient
 *
 * Client component with filter controls for the inventory movement log:
 *  - Product selector (hydrated with productList from server)
 *  - Reason filter
 *  - Date range (from / to)
 *  - All filters update URL search params → server component re-fetches
 */

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Filter, Loader2, RotateCcw } from "lucide-react";
import type { ProductFilterItem } from "@/lib/actions/inventory";

const REASONS = [
  { value: "",             label: "All Reasons"   },
  { value: "RESTOCK",      label: "Restock"       },
  { value: "ADJUSTMENT",   label: "Adjustment"    },
  { value: "RETURN",       label: "Return"        },
  { value: "DAMAGE",       label: "Damage"        },
  { value: "SALE",         label: "Sale"          },
  { value: "PAYMENT_ROLLBACK", label: "Payment Rollback" },
];

interface Props {
  products:      ProductFilterItem[];
  currentProductId: string;
  currentReason:    string;
  currentFrom:      string;
  currentTo:        string;
}

export default function MovementFiltersClient({
  products,
  currentProductId,
  currentReason,
  currentFrom,
  currentTo,
}: Props) {
  const router   = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [productId, setProductId] = useState(currentProductId);
  const [reason,    setReason]    = useState(currentReason);
  const [from,      setFrom]      = useState(currentFrom);
  const [to,        setTo]        = useState(currentTo);

  function pushURL(overrides?: {
    productId?: string;
    reason?:    string;
    from?:      string;
    to?:        string;
  }) {
    const pid = overrides?.productId ?? productId;
    const r   = overrides?.reason    ?? reason;
    const f   = overrides?.from      ?? from;
    const t   = overrides?.to        ?? to;

    const qs = new URLSearchParams();
    if (pid) qs.set("productId", pid);
    if (r)   qs.set("reason",    r);
    if (f)   qs.set("from",      f);
    if (t)   qs.set("to",        t);

    startTransition(() => {
      router.push(`${pathname}${qs.toString() ? `?${qs}` : ""}`);
    });
  }

  function handleProductChange(v: string) {
    setProductId(v);
    pushURL({ productId: v });
  }

  function handleReasonChange(v: string) {
    setReason(v);
    pushURL({ reason: v });
  }

  function applyDateRange() {
    pushURL({ from, to });
  }

  function resetAll() {
    setProductId("");
    setReason("");
    setFrom("");
    setTo("");
    startTransition(() => { router.push(pathname); });
  }

  const hasFilters = productId || reason || from || to;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-4">
        {/* Product selector */}
        <div className="flex flex-col gap-1.5 min-w-55 flex-1">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1">
            <Filter className="h-3 w-3" /> Product
          </label>
          <select
            value={productId}
            onChange={(e) => handleProductChange(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="">All products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.sku})
              </option>
            ))}
          </select>
        </div>

        {/* Reason filter */}
        <div className="flex flex-col gap-1.5 min-w-45">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Reason
          </label>
          <select
            value={reason}
            onChange={(e) => handleReasonChange(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        {/* Date range */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Date From
          </label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            onBlur={applyDateRange}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Date To
          </label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            onBlur={applyDateRange}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        {/* Indicators */}
        <div className="flex items-center gap-2 pb-0.5">
          {isPending && <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />}
          {hasFilters && !isPending && (
            <button
              onClick={resetAll}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 hover:text-gray-800 shadow-sm"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Clear filters
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
