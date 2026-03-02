"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useTransition } from "react";
import { Search, X, Loader2 } from "lucide-react";
import type { OrderStatus } from "@prisma/client";

export default function OrderSearchInput({
  defaultValue = "",
  basePath,
  currentStatus,
}: {
  defaultValue?: string;
  basePath: string;
  currentStatus?: OrderStatus | "";
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const timer = setTimeout(() => {
      const qs = new URLSearchParams();
      if (value.trim()) qs.set("search", value.trim());
      if (currentStatus) qs.set("status", currentStatus);
      startTransition(() =>
        router.push(qs.toString() ? `${basePath}?${qs}` : basePath),
      );
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative flex-1 min-w-52 max-w-sm">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        type="text"
        placeholder="Search by name or email…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-8 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
      />
      {value ? (
        <button
          onClick={() => setValue("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : pending ? (
        <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-indigo-400" />
      ) : null}
    </div>
  );
}
