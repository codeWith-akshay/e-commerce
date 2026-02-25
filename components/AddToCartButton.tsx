"use client";

// AddToCartButton — compact cart CTA for ProductCard.
//
// Uses addToCart directly via useTransition (not a <form>) so it works
// cleanly inside the <Link> wrapper of ProductCard without navigating.
// Shows a fixed toast on success/error, auto-dismissed after 4 s.

import { useTransition, useState, useEffect, useRef } from "react";
import { ShoppingCart, Check } from "lucide-react";
import { addToCart } from "@/lib/actions/cart";
import { Toast } from "@/components/Toast";

// ─────────────────────────────────────────────────────────────────────────────
// AddToCartButton
// ─────────────────────────────────────────────────────────────────────────────

interface AddToCartButtonProps {
  productId: string;
  productTitle: string;
  stock: number;
  className?: string;
}

export default function AddToCartButton({
  productId,
  productTitle,
  stock,
  className,
}: AddToCartButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isOutOfStock = stock === 0;

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (addedTimer.current) clearTimeout(addedTimer.current);
    };
  }, []);

  function showToast(type: "success" | "error", message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, message });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (isOutOfStock || isPending || added) return;

    startTransition(async () => {
      const result = await addToCart(productId, 1);
      if (result.success) {
        setAdded(true);
        showToast("success", `"${productTitle}" added to your cart!`);
        addedTimer.current = setTimeout(() => setAdded(false), 2000);
      } else {
        showToast("error", result.error);
      }
    });
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isOutOfStock || isPending}
        aria-label={
          isOutOfStock ? "Out of stock" : added ? "Added to cart" : `Add ${productTitle} to cart`
        }
        className={[
          "flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition active:scale-95",
          isOutOfStock
            ? "cursor-not-allowed bg-gray-100 text-gray-400"
            : added
              ? "bg-green-500 text-white"
              : isPending
                ? "cursor-wait bg-indigo-400 text-white"
                : "bg-indigo-600 text-white hover:bg-indigo-700",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {isPending ? (
          <>
            <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Adding…
          </>
        ) : added ? (
          <>
            <Check className="h-3.5 w-3.5" />
            Added!
          </>
        ) : (
          <>
            <ShoppingCart className="h-3.5 w-3.5" />
            Add to Cart
          </>
        )}
      </button>

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

