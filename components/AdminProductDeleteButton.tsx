"use client";

import { useTransition, useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteProductAction } from "@/lib/actions/product";

export default function AdminProductDeleteButton({ productId }: { productId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (!confirm("Delete this product? This cannot be undone.")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteProductAction(productId);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div>
      <button
        onClick={handleDelete}
        disabled={pending}
        aria-label="Delete product"
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-red-600 ring-1 ring-inset ring-red-200 transition hover:bg-red-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
      >
        <Trash2 className="h-3.5 w-3.5" />
        {pending ? "Deleting…" : "Delete"}
      </button>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
