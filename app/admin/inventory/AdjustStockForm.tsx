"use client";

/**
 * AdjustStockForm — inline client form for quick stock adjustments.
 * Used inside the admin inventory table rows.
 */

import { useState, useTransition } from "react";
import { Loader2, Plus, Minus, Check } from "lucide-react";
import { adjustStock } from "@/lib/actions/inventory";

type AdjustReason = "RESTOCK" | "ADJUSTMENT" | "DAMAGE" | "RETURN" | "SALE";

interface AdjustStockFormProps {
  inventoryId:   string;
  productTitle:  string;
  currentStock:  number;
}

export default function AdjustStockForm({
  inventoryId,
  productTitle,
  currentStock,
}: AdjustStockFormProps) {
  const [qty, setQty]           = useState(1);
  const [type, setType]         = useState<"add" | "remove">("add");
  const [reason, setReason]     = useState<AdjustReason>("ADJUSTMENT");
  const [note, setNote]         = useState("");
  const [done, setDone]         = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const delta = type === "add" ? qty : -qty;

    startTransition(async () => {
      const result = await adjustStock({
        inventoryId,
        delta,
        reason,
        note: note.trim() || null,
      });
      if (result.success) {
        setDone(true);
        setNote("");
        setTimeout(() => setDone(false), 2500);
      } else {
        setError(result.error ?? "Failed to adjust stock.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
      {/* +/- toggle */}
      <div className="flex overflow-hidden rounded-lg border border-gray-200 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setType("add")}
          className={`flex items-center gap-1 px-2.5 py-1.5 transition ${
            type === "add"
              ? "bg-emerald-500 text-white"
              : "bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          <Plus className="h-3 w-3" /> Add
        </button>
        <button
          type="button"
          onClick={() => setType("remove")}
          className={`flex items-center gap-1 border-l border-gray-200 px-2.5 py-1.5 transition ${
            type === "remove"
              ? "bg-red-500 text-white"
              : "bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          <Minus className="h-3 w-3" /> Remove
        </button>
      </div>

      {/* Qty input */}
      <input
        type="number"
        min={1}
        max={type === "remove" ? currentStock : 9999}
        value={qty}
        onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
        className="w-16 rounded-lg border border-gray-200 px-2 py-1.5 text-center text-xs outline-none focus:ring-2 focus:ring-indigo-500"
      />

      {/* Reason */}
      <select
        value={reason}
        onChange={(e) => setReason(e.target.value as AdjustReason)}
        className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500"
      >
        {(["RESTOCK", "ADJUSTMENT", "DAMAGE", "RETURN", "SALE"] as AdjustReason[]).map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>

      {/* Note (optional) */}
      <input
        type="text"
        placeholder="Note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={200}
        className="w-40 rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500"
      />

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending || done}
        className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
      >
        {isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : done ? (
          <><Check className="h-3 w-3" /> Done</>
        ) : (
          "Apply"
        )}
      </button>

      {error && (
        <p className="w-full text-xs text-red-600">{error}</p>
      )}
    </form>
  );
}
