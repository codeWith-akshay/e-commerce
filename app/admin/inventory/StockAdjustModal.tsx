"use client";

/**
 * StockAdjustModal — slide-in modal for inventory stock adjustments.
 *
 * Props:
 *  inventoryId   — Inventory row ID
 *  productTitle  — Shown in the modal header
 *  currentStock  — Current stockQuantity shown for context
 *  defaultMode   — Pre-select "add" or "remove" (default: "add")
 *  compact       — Render a smaller trigger button (for low-stock alert rows)
 */

import { useState, useTransition, useEffect, useRef, useCallback } from "react";
import {
  Plus,
  Minus,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowUpCircle,
  ArrowDownCircle,
  Package,
} from "lucide-react";
import { adjustStock } from "@/lib/actions/inventory";

type Reason = "RESTOCK" | "ADJUSTMENT" | "DAMAGE" | "RETURN" | "SALE";

const REASONS: { value: Reason; label: string; description: string }[] = [
  { value: "RESTOCK",    label: "Restock",    description: "Supplier delivery / replenishment" },
  { value: "ADJUSTMENT", label: "Adjustment", description: "Manual admin correction" },
  { value: "RETURN",     label: "Return",     description: "Customer return received" },
  { value: "DAMAGE",     label: "Damage",     description: "Write-off for damaged / expired goods" },
  { value: "SALE",       label: "Sale",       description: "Manual sale / order fulfillment" },
];

interface Props {
  inventoryId:   string;
  productTitle:  string;
  currentStock:  number;
  defaultMode?:  "add" | "remove";
  compact?:      boolean;
}

export default function StockAdjustModal({
  inventoryId,
  productTitle,
  currentStock,
  defaultMode = "add",
  compact     = false,
}: Props) {
  const [open, setOpen]             = useState(false);
  const [mode, setMode]             = useState<"add" | "remove">(defaultMode);
  const [qty, setQty]               = useState(1);
  const [reason, setReason]         = useState<Reason>("ADJUSTMENT");
  const [reference, setReference]   = useState("");
  const [note, setNote]             = useState("");
  const [error, setError]           = useState<string | null>(null);
  const [success, setSuccess]       = useState(false);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleClose = useCallback(() => {
    if (isPending) return;
    setOpen(false);
    // Reset after close animation
    setTimeout(() => {
      setError(null);
      setSuccess(false);
      setQty(1);
      setNote("");
      setReference("");
      setReason("ADJUSTMENT");
      setMode(defaultMode);
    }, 200);
  }, [isPending, defaultMode]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) handleClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, handleClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (qty < 1) return;
    setError(null);

    const delta = mode === "add" ? qty : -qty;

    startTransition(async () => {
      const result = await adjustStock({
        inventoryId,
        delta,
        reason,
        reference: reference.trim() || null,
        note:      note.trim()      || null,
      });

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          handleClose();
        }, 1200);
      } else {
        setError(result.error ?? "Failed to adjust stock.");
      }
    });
  }

  const afterStock = mode === "add"
    ? currentStock + qty
    : Math.max(0, currentStock - qty);

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className={
          compact
            ? "inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600 shadow-sm"
            : "inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 shadow-sm"
        }
      >
        <ArrowUpCircle className="h-3.5 w-3.5" />
        Adjust
      </button>

      {/* Modal backdrop + panel */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-gray-900/10">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
                  <Package className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Adjust Stock</h2>
                  <p className="text-xs text-gray-500 mt-0.5 max-w-55 truncate">{productTitle}</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                disabled={isPending}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Success state */}
            {success ? (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-12">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                </div>
                <p className="text-base font-semibold text-gray-900">Stock updated!</p>
                <p className="text-sm text-gray-500">The inventory has been adjusted successfully.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
                {/* Current stock indicator */}
                <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3 text-sm">
                  <span className="text-gray-500 font-medium">Current stock</span>
                  <span className="text-xl font-bold tabular-nums text-gray-900">{currentStock}</span>
                </div>

                {/* Add / Remove toggle */}
                <div>
                  <label className="mb-2 block text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    Adjustment Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setMode("add")}
                      className={`flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-semibold transition ${
                        mode === "add"
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                          : "border-gray-200 bg-white text-gray-600 hover:border-emerald-200 hover:bg-emerald-50/40"
                      }`}
                    >
                      <Plus className="h-4 w-4" />
                      Increase
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("remove")}
                      className={`flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-semibold transition ${
                        mode === "remove"
                          ? "border-red-500 bg-red-50 text-red-700"
                          : "border-gray-200 bg-white text-gray-600 hover:border-red-200 hover:bg-red-50/40"
                      }`}
                    >
                      <Minus className="h-4 w-4" />
                      Decrease
                    </button>
                  </div>
                </div>

                {/* Quantity */}
                <div>
                  <label className="mb-2 block text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    Quantity
                  </label>
                  <input
                    ref={inputRef}
                    type="number"
                    min={1}
                    max={mode === "remove" ? currentStock : undefined}
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  {/* After-adjustment preview */}
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-gray-500">After adjustment:</span>
                    <div className="flex items-center gap-1.5">
                      {mode === "add" ? (
                        <ArrowUpCircle className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <ArrowDownCircle className="h-3.5 w-3.5 text-red-500" />
                      )}
                      <span className={`font-bold tabular-nums ${
                        mode === "add" ? "text-emerald-600" : "text-red-600"
                      }`}>
                        {afterStock}
                      </span>
                      <span className="text-gray-400">units</span>
                    </div>
                  </div>
                </div>

                {/* Reason */}
                <div>
                  <label className="mb-2 block text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    Reason <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value as Reason)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                  >
                    {REASONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label} — {r.description}</option>
                    ))}
                  </select>
                </div>

                {/* Reference */}
                <div>
                  <label className="mb-2 block text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    Reference <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Order ID, invoice number, etc."
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    maxLength={200}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                {/* Note */}
                <div>
                  <label className="mb-2 block text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    Note <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    placeholder="Internal comment visible in the movement log…"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={500}
                    rows={2}
                    className="w-full resize-none rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                {/* Error */}
                {error && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    {error}
                  </div>
                )}

                {/* Warning for remove exceeding current stock */}
                {mode === "remove" && qty > currentStock && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    Quantity exceeds current stock ({currentStock} units). This will be rejected.
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isPending}
                    className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPending || qty < 1 || (mode === "remove" && qty > currentStock)}
                    className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                      mode === "add"
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : "bg-red-600 hover:bg-red-700"
                    }`}
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      <>
                        {mode === "add" ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                        {mode === "add" ? `Add ${qty}` : `Remove ${qty}`}
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
