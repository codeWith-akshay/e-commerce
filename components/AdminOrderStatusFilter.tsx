"use client";

// AdminOrderStatusFilter — client island.
//
// Receives the base path and current search params from the parent Server
// Component so this component does NOT need usePathname / useSearchParams.
// Those hooks required a <Suspense> boundary and opted the whole subtree into
// dynamic rendering; passing props instead keeps things simpler and lighter.

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { OrderStatus } from "@prisma/client";

// ── Derive statuses from the Prisma enum — stays in sync automatically ────────
const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING:    "Pending",
  PROCESSING: "Processing",
  SHIPPED:    "Shipped",
  DELIVERED:  "Delivered",
  CANCELLED:  "Cancelled",
};

const STATUSES: { value: OrderStatus | ""; label: string }[] = [
  { value: "", label: "All Statuses" },
  ...(Object.values(OrderStatus) as OrderStatus[]).map((v) => ({
    value: v,
    label: STATUS_LABELS[v],
  })),
];

export default function AdminOrderStatusFilter({
  current = "",
  basePath,
  currentParams = {},
}: {
  current?: OrderStatus | "";
  /** Pathname to push to, e.g. "/admin/orders". */
  basePath: string;
  /** All current search params from the parent page (excluding status & page). */
  currentParams?: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = new URLSearchParams();
    // Preserve all current params except status and page.
    for (const [k, v] of Object.entries(currentParams)) {
      if (k !== "status" && k !== "page" && v) next.set(k, v);
    }
    if (e.target.value) next.set("status", e.target.value);
    // page intentionally omitted — resets to 1 on filter change.
    const qs = next.toString();
    startTransition(() => router.push(qs ? `${basePath}?${qs}` : basePath));
  }

  return (
    <select
      value={current}
      onChange={handleChange}
      disabled={pending}
      aria-label="Filter by status"
      className="rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm text-slate-700 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-60"
    >
      {STATUSES.map(({ value, label }) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}
