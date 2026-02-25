"use client";

// CartItemControls — minimal client island for the cart page.
//
// Two isolated sub-components so each form has its own pending state:
//   <QuantityForm>  — + / − qty controls wired to updateCartQuantityAction
//   <RemoveForm>    — trash button wired to removeFromCartAction
//
// Exported as named exports so the server component can import them independently.

import { useActionState } from "react";
import { Minus, Plus, Trash2, Loader2 } from "lucide-react";
import {
  updateCartQuantityAction,
  removeFromCartAction,
} from "@/lib/actions/cart";
import type { ActionResult } from "@/lib/actions/cart";

// ─────────────────────────────────────────────────────────────────────────────
// QuantityForm
// ─────────────────────────────────────────────────────────────────────────────

interface QuantityFormProps {
  cartItemId: string;
  quantity: number;
  stock: number;
}

export function QuantityForm({ cartItemId, quantity, stock }: QuantityFormProps) {
  const [, formAction, isPending] = useActionState<
    ActionResult<{ quantity: number }> | null,
    FormData
  >(updateCartQuantityAction, null);

  return (
    <div className="flex items-center rounded-xl border border-gray-200 bg-white shadow-xs">
      {/* Decrement */}
      <form action={formAction}>
        <input type="hidden" name="cartItemId" value={cartItemId} />
        <input type="hidden" name="quantity" value={Math.max(0, quantity - 1)} />
        <button
          type="submit"
          disabled={isPending || quantity <= 1}
          aria-label="Decrease quantity"
          className="flex h-9 w-9 items-center justify-center rounded-l-xl text-gray-500 transition hover:bg-gray-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
          ) : (
            <Minus className="h-3.5 w-3.5" />
          )}
        </button>
      </form>

      {/* Current qty */}
      <span className="min-w-10 select-none text-center text-sm font-semibold text-gray-800">
        {quantity}
      </span>

      {/* Increment */}
      <form action={formAction}>
        <input type="hidden" name="cartItemId" value={cartItemId} />
        <input type="hidden" name="quantity" value={Math.min(stock, quantity + 1)} />
        <button
          type="submit"
          disabled={isPending || quantity >= stock}
          aria-label="Increase quantity"
          className="flex h-9 w-9 items-center justify-center rounded-r-xl text-gray-500 transition hover:bg-gray-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RemoveForm
// ─────────────────────────────────────────────────────────────────────────────

interface RemoveFormProps {
  cartItemId: string;
}

export function RemoveForm({ cartItemId }: RemoveFormProps) {
  const [, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    removeFromCartAction,
    null
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="cartItemId" value={cartItemId} />
      <button
        type="submit"
        disabled={isPending}
        aria-label="Remove item from cart"
        className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 transition hover:bg-red-50 hover:text-red-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ClearCartButton — full-width clear all button
// ─────────────────────────────────────────────────────────────────────────────

import { clearCartAction } from "@/lib/actions/cart";

export function ClearCartButton() {
  const [, formAction, isPending] = useActionState<
    ActionResult<{ deleted: number }> | null,
    FormData
  >(clearCartAction, null);

  return (
    <form action={formAction}>
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
        Clear cart
      </button>
    </form>
  );
}
