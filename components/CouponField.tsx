"use client";

/**
 * CouponField — inline coupon code input inside the checkout form.
 *
 * Usage: drop inside <form> — the validated coupon code is stored in a
 * hidden <input name="couponCode"> so the parent form action can pick it up.
 * The discount breakdown is shown inline so the user sees savings before
 * submitting the order.
 */

import { useState, useTransition } from "react";
import { Tag, Check, X, Loader2 } from "lucide-react";
import { applyCoupon } from "@/lib/actions/coupon";
import type { CouponValidationResult } from "@/lib/actions/coupon";

interface CouponFieldProps {
  /** Cart subtotal (before shipping) used to compute percentage discounts. */
  subtotal: number;
}

export default function CouponField({ subtotal }: CouponFieldProps) {
  const [code, setCode]           = useState("");
  const [applied, setApplied]     = useState<CouponValidationResult | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRemove() {
    setApplied(null);
    setError(null);
    setCode("");
  }

  function handleApply() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    setError(null);
    startTransition(async () => {
      const result = await applyCoupon(trimmed, subtotal);
      if (result.success && result.data) {
        setApplied(result.data);
        setError(null);
      } else {
        setApplied(null);
        setError(!result.success ? result.error : "Invalid coupon code.");
      }
    });
  }

  // ── Applied state ─────────────────────────────────────────────────────────
  if (applied) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        {/* Hidden input so the parent form submits the code */}
        <input type="hidden" name="couponCode" value={applied.code} />

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
            <Check className="h-4 w-4 shrink-0" />
            <span>
              <span className="font-bold">{applied.code}</span> applied — you save{" "}
              <span className="font-bold">${applied.discountAmount.toFixed(2)}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="rounded-full p-1 text-emerald-600 transition hover:bg-emerald-100"
            aria-label="Remove coupon"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // ── Input state ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
        <Tag className="h-3.5 w-3.5 text-gray-400" />
        Coupon code
        <span className="text-xs font-normal text-gray-400">(optional)</span>
      </label>

      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleApply())}
          placeholder="SAVE20"
          aria-label="Coupon code"
          aria-invalid={error ? "true" : undefined}
          className={[
            "min-w-0 flex-1 rounded-xl border px-4 py-2.5 text-sm font-mono text-gray-900",
            "placeholder-gray-400 outline-none transition focus:ring-2 focus:ring-indigo-500",
            error
              ? "border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-300"
              : "border-gray-200 bg-white focus:border-indigo-400",
          ].join(" ")}
        />
        <button
          type="button"
          onClick={handleApply}
          disabled={isPending || !code.trim()}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Apply"
          )}
        </button>
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-1 text-xs text-red-600">
          <X className="h-3 w-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
