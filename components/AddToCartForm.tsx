"use client";

// AddToCartForm — minimal client island.
//
// Architecture:
//   • <form action={formAction}> — no JS needed for the submit itself
//   • useActionState (React 19) — reads server action result to drive UI
//   • Quantity picker updates a hidden <input name="quantity"> (no fetch)
//   • Toast is a fixed overlay rendered inside this island (zero extra JS)
//
// The parent product page remains a pure Server Component.

import { useActionState, useEffect, useRef, useState } from "react";
import { ShoppingCart, Loader2, Minus, Plus } from "lucide-react";
import { addToCartAction } from "@/lib/actions/cart";
import type { ActionResult } from "@/lib/actions/cart";
import { Toast } from "@/components/Toast";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface AddToCartFormProps {
  productId: string;
  productTitle: string;
  stock: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// AddToCartForm
// ─────────────────────────────────────────────────────────────────────────────

export default function AddToCartForm({
  productId,
  productTitle,
  stock,
}: AddToCartFormProps) {
  const [state, formAction, isPending] = useActionState<
    ActionResult<{ cartItemId: string; quantity: number }> | null,
    FormData
  >(addToCartAction, null);

  // Qty picker — controls the hidden <input name="quantity">
  const [qty, setQty] = useState(1);

  // Toast visibility
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isOutOfStock = stock === 0;

  // ── Watch action result and show toast ──────────────────────────────────────
  useEffect(() => {
    if (!state) return;

    if (toastTimer.current) clearTimeout(toastTimer.current);

    if (state.success) {
      setQty(1); // reset picker after success
      setToast({
        type: "success",
        message: `"${productTitle}" added to your cart!`,
      });
    } else {
      setToast({ type: "error", message: state.error });
    }

    // Auto-dismiss after 4 s
    toastTimer.current = setTimeout(() => setToast(null), 4000);
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <>
      {/* ── Form ── */}
      <form action={formAction} className="flex flex-col gap-4">
        {/* Hidden fields — read by addToCartAction via FormData */}
        <input type="hidden" name="productId" value={productId} />
        <input type="hidden" name="quantity" value={qty} />

        {/* Quantity picker — updates `qty` state which feeds the hidden input */}
        {!isOutOfStock && (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-600">Quantity</span>

            <div className="flex items-center rounded-xl border border-gray-200 bg-white shadow-xs">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={qty <= 1 || isPending}
                className="flex h-9 w-9 items-center justify-center rounded-l-xl text-gray-500 transition hover:bg-gray-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Decrease quantity"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>

              <span className="min-w-10 select-none text-center text-sm font-semibold text-gray-800">
                {qty}
              </span>

              <button
                type="button"
                onClick={() => setQty((q) => Math.min(stock, q + 1))}
                disabled={qty >= stock || isPending}
                className="flex h-9 w-9 items-center justify-center rounded-r-xl text-gray-500 transition hover:bg-gray-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Increase quantity"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            <span className="text-xs text-gray-400">{stock} available</span>
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={isOutOfStock || isPending}
          className={`flex w-full items-center justify-center gap-2.5 rounded-2xl px-8 py-4 text-sm font-bold tracking-wide transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60
            ${isOutOfStock
              ? "cursor-not-allowed bg-gray-100 text-gray-400"
              : "bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700"
            }`}
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Adding to Cart…
            </>
          ) : (
            <>
              <ShoppingCart className="h-4 w-4" />
              {isOutOfStock ? "Out of Stock" : "Add to Cart"}
            </>
          )}
        </button>
      </form>

      {/* ── Toast — renders inside this island, outside the form flow ── */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => {
            setToast(null);
            if (toastTimer.current) clearTimeout(toastTimer.current);
          }}
        />
      )}
    </>
  );
}
