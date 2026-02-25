"use client";

// Toast — shared notification overlay.
//
// Extracted from AddToCartButton and AddToCartForm to eliminate copy-pasted
// code and ensure a single module appears in the shared webpack chunk.
//
// Usage:
//   {toast && (
//     <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />
//   )}

import { Check, AlertCircle, X } from "lucide-react";

export interface ToastProps {
  type: "success" | "error";
  message: string;
  onClose: () => void;
}

export function Toast({ type, message, onClose }: ToastProps) {
  const isSuccess = type === "success";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 right-6 z-50 flex items-start gap-3 rounded-2xl px-5 py-4 shadow-xl ring-1 backdrop-blur-sm
        transition-all duration-300 ease-out
        ${
          isSuccess
            ? "bg-green-600 text-white ring-green-500/30 shadow-green-200"
            : "bg-red-600 text-white ring-red-500/30 shadow-red-200"
        }`}
    >
      <div className="mt-0.5 shrink-0">
        {isSuccess ? (
          <Check className="h-4 w-4" />
        ) : (
          <AlertCircle className="h-4 w-4" />
        )}
      </div>
      <p className="max-w-xs text-sm font-medium leading-snug">{message}</p>
      <button
        onClick={onClose}
        aria-label="Dismiss notification"
        className="ml-2 mt-0.5 shrink-0 rounded-full p-0.5 opacity-70 transition hover:opacity-100 active:scale-95"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
