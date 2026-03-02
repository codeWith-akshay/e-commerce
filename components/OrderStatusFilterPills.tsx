"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { OrderStatus } from "@prisma/client";
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/lib/order-statuses";
import {
  Clock,
  Layers,
  Truck,
  CheckCircle2,
  XCircle,
  LayoutGrid,
} from "lucide-react";

const ICONS: Record<string, React.ReactNode> = {
  "":          <LayoutGrid className="h-3 w-3" />,
  PENDING:     <Clock className="h-3 w-3" />,
  PROCESSING:  <Layers className="h-3 w-3" />,
  SHIPPED:     <Truck className="h-3 w-3" />,
  DELIVERED:   <CheckCircle2 className="h-3 w-3" />,
  CANCELLED:   <XCircle className="h-3 w-3" />,
};

const COLOR: Record<string, string> = {
  "":          "data-[active=true]:bg-indigo-600 data-[active=true]:text-white data-[active=true]:border-indigo-500",
  PENDING:     "data-[active=true]:bg-amber-500   data-[active=true]:text-white data-[active=true]:border-amber-400",
  PROCESSING:  "data-[active=true]:bg-blue-500    data-[active=true]:text-white data-[active=true]:border-blue-400",
  SHIPPED:     "data-[active=true]:bg-violet-500  data-[active=true]:text-white data-[active=true]:border-violet-400",
  DELIVERED:   "data-[active=true]:bg-emerald-500 data-[active=true]:text-white data-[active=true]:border-emerald-400",
  CANCELLED:   "data-[active=true]:bg-red-500     data-[active=true]:text-white data-[active=true]:border-red-400",
};

const OPTIONS: { value: OrderStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  ...ORDER_STATUSES.map((v) => ({ value: v as OrderStatus, label: ORDER_STATUS_LABELS[v] })),
];

export default function OrderStatusFilterPills({
  current = "",
  basePath,
  currentSearch,
}: {
  current?: OrderStatus | "";
  basePath: string;
  currentSearch?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function go(status: OrderStatus | "") {
    const qs = new URLSearchParams();
    if (currentSearch) qs.set("search", currentSearch);
    if (status) qs.set("status", status);
    startTransition(() =>
      router.push(qs.toString() ? `${basePath}?${qs}` : basePath),
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
      {OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          data-active={current === value}
          disabled={pending}
          onClick={() => go(value)}
          className={`inline-flex items-center gap-1.5 rounded-lg border border-transparent px-3 py-1.5 text-xs font-semibold text-gray-600 transition disabled:opacity-50 hover:bg-gray-50 ${COLOR[value]}`}
        >
          {ICONS[value]}
          {label}
        </button>
      ))}
    </div>
  );
}
