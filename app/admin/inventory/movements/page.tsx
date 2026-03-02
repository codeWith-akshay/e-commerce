/**
 * /admin/inventory/movements — Inventory Movement Log
 *
 * Displays all inventory transactions with full audit data:
 *  - Product / SKU
 *  - Change type derived from reason + delta
 *  - Quantity changed (delta)
 *  - Previous stock → New stock
 *  - Admin performer
 *  - Timestamp
 *
 * Filterable by: product, reason, date range.
 * Paginated server-side via URL search params.
 */

import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  ArrowLeft,
  Calendar,
  User,
  Minus,
} from "lucide-react";
import {
  getFilteredMovementLog,
  getProductsForFilter,
  type FullInventoryTx,
} from "@/lib/actions/inventory";
import MovementFiltersClient from "./MovementFiltersClient";

export const metadata: Metadata = { title: "Stock Movement Log | Admin" };
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// Reason → badge config
// ─────────────────────────────────────────────────────────────────────────────

const REASON_CONFIG: Record<string, { label: string; cls: string }> = {
  RESTOCK:          { label: "Restock",          cls: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200" },
  ADJUSTMENT:       { label: "Adjustment",       cls: "bg-slate-100 text-slate-700 ring-1 ring-slate-200"       },
  RETURN:           { label: "Return",           cls: "bg-sky-100    text-sky-700    ring-1 ring-sky-200"        },
  DAMAGE:           { label: "Damage",           cls: "bg-orange-100 text-orange-700 ring-1 ring-orange-200"    },
  SALE:             { label: "Sale",             cls: "bg-violet-100 text-violet-700 ring-1 ring-violet-200"    },
  PAYMENT_ROLLBACK: { label: "Payment Rollback", cls: "bg-red-100    text-red-700    ring-1 ring-red-200"       },
};

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

type SearchParams = Promise<{
  page?:      string;
  productId?: string;
  reason?:    string;
  from?:      string;
  to?:        string;
}>;

export default async function MovementsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;

  const page      = Math.max(1, parseInt(sp.page ?? "1", 10));
  const productId = sp.productId ?? "";
  const reason    = sp.reason    ?? "";
  const from      = sp.from      ?? "";
  const to        = sp.to        ?? "";

  const [logResult, productsResult] = await Promise.all([
    getFilteredMovementLog({ page, pageSize: 30, productId, reason, from, to }),
    getProductsForFilter(),
  ]);

  const transactions: FullInventoryTx[] = logResult.success   ? (logResult.data?.transactions ?? []) : [];
  const total                           = logResult.success   ? (logResult.data?.total         ?? 0) : 0;
  const products                        = productsResult.success ? (productsResult.data ?? [])       : [];
  const totalPages = Math.ceil(total / 30);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/admin/inventory"
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Inventory
            </Link>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
              <ArrowUpDown className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Stock Movement Log</h1>
          </div>
          <p className="text-sm text-gray-500 ml-10 mt-0.5">
            Complete audit trail of all inventory changes.
            <span className="ml-2 font-semibold text-gray-700">{total.toLocaleString()} total records</span>
          </p>
        </div>
      </div>

      {/* Filters */}
      <MovementFiltersClient
        products={products}
        currentProductId={productId}
        currentReason={reason}
        currentFrom={from}
        currentTo={to}
      />

      {/* Table */}
      {transactions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-16 text-center">
          <ArrowUpDown className="mx-auto h-8 w-8 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">No movements found for the selected filters.</p>
          <p className="text-xs text-gray-400 mt-1">Try adjusting the product, reason, or date range.</p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <th className="px-5 py-3.5 min-w-55">Product / SKU</th>
                    <th className="px-4 py-3.5">Reason</th>
                    <th className="px-4 py-3.5 text-right">Change</th>
                    <th className="px-4 py-3.5 text-center">Before → After</th>
                    <th className="px-4 py-3.5">Reference</th>
                    <th className="px-4 py-3.5">Note</th>
                    <th className="px-4 py-3.5">Performed By</th>
                    <th className="px-4 py-3.5 text-right min-w-35">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {transactions.map((tx) => (
                    <MovementRow key={tx.id} tx={tx} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <PaginationBar
              currentPage={page}
              totalPages={totalPages}
              params={{ productId, reason, from, to }}
            />
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Movement Row
// ─────────────────────────────────────────────────────────────────────────────

function MovementRow({ tx }: { tx: FullInventoryTx }) {
  const positive = tx.delta > 0;
  const badge    = REASON_CONFIG[tx.reason] ?? { label: tx.reason, cls: "bg-gray-100 text-gray-700" };

  return (
    <tr className="group transition-colors hover:bg-gray-50/60">
      {/* Product */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-2">
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg shrink-0 ${
            positive ? "bg-emerald-100" : "bg-red-100"
          }`}>
            {positive
              ? <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              : <TrendingDown className="h-3.5 w-3.5 text-red-600" />
            }
          </div>
          <div>
            <p className="font-semibold text-gray-900 leading-snug">{tx.inventory.product.title}</p>
            <p className="text-xs text-gray-400">SKU: {tx.inventory.sku}</p>
          </div>
        </div>
      </td>

      {/* Reason badge */}
      <td className="px-4 py-4">
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${badge.cls}`}>
          {badge.label}
        </span>
      </td>

      {/* Delta */}
      <td className="px-4 py-4 text-right">
        <span className={`text-base font-bold tabular-nums ${positive ? "text-emerald-600" : "text-red-600"}`}>
          {positive ? "+" : ""}{tx.delta}
        </span>
      </td>

      {/* Before → After */}
      <td className="px-4 py-4">
        <div className="flex items-center justify-center gap-1.5">
          {tx.previousStock !== null ? (
            <>
              <span className="inline-flex h-7 min-w-9 items-center justify-center rounded-lg bg-gray-100 px-2 text-xs font-bold tabular-nums text-gray-700">
                {tx.previousStock}
              </span>
              <span className="text-gray-400 text-xs">→</span>
              <span className={`inline-flex h-7 min-w-9 items-center justify-center rounded-lg px-2 text-xs font-bold tabular-nums ${
                positive
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-red-100 text-red-700"
              }`}>
                {tx.newStock ?? "—"}
              </span>
            </>
          ) : (
            <span className="text-gray-400 text-xs">No snapshot</span>
          )}
        </div>
      </td>

      {/* Reference */}
      <td className="px-4 py-4">
        {tx.reference ? (
          <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-mono font-medium text-slate-700 max-w-30 truncate">
            {tx.reference}
          </span>
        ) : (
          <Minus className="h-3 w-3 text-gray-300" />
        )}
      </td>

      {/* Note */}
      <td className="px-4 py-4">
        {tx.note ? (
          <p className="text-xs text-gray-600 max-w-40 truncate" title={tx.note}>
            {tx.note}
          </p>
        ) : (
          <span className="text-gray-300 text-xs">—</span>
        )}
      </td>

      {/* Performed by */}
      <td className="px-4 py-4">
        {tx.performedBy ? (
          <div className="flex items-center gap-1.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 shrink-0">
              <User className="h-3.5 w-3.5 text-indigo-600" />
            </div>
            <span className="text-xs font-medium text-gray-700 max-w-25 truncate">
              {tx.performedBy.name}
            </span>
          </div>
        ) : (
          <span className="text-xs text-gray-400 italic">System</span>
        )}
      </td>

      {/* Timestamp */}
      <td className="px-4 py-4 text-right">
        <div className="flex items-center justify-end gap-1 text-xs text-gray-400">
          <Calendar className="h-3 w-3" />
          <span className="tabular-nums">
            {new Date(tx.createdAt).toLocaleDateString("en-IN", {
              day:   "2-digit",
              month: "short",
              year:  "numeric",
            })}
          </span>
        </div>
        <p className="text-xs text-gray-400 text-right tabular-nums mt-0.5">
          {new Date(tx.createdAt).toLocaleTimeString("en-IN", {
            hour:   "2-digit",
            minute: "2-digit",
          })}
        </p>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pagination
// ─────────────────────────────────────────────────────────────────────────────

function PaginationBar({
  currentPage,
  totalPages,
  params,
}: {
  currentPage: number;
  totalPages:  number;
  params:      { productId: string; reason: string; from: string; to: string };
}) {
  function href(p: number) {
    const qs = new URLSearchParams();
    if (p > 1)             qs.set("page",      String(p));
    if (params.productId)  qs.set("productId", params.productId);
    if (params.reason)     qs.set("reason",    params.reason);
    if (params.from)       qs.set("from",      params.from);
    if (params.to)         qs.set("to",        params.to);
    const s = qs.toString();
    return `/admin/inventory/movements${s ? `?${s}` : ""}`;
  }

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  const visible = pages.filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2);

  return (
    <div className="flex items-center justify-between text-sm">
      <p className="text-gray-500">
        Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
      </p>
      <nav className="flex items-center gap-1">
        {currentPage > 1 && (
          <Link href={href(currentPage - 1)} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
            ← Prev
          </Link>
        )}
        {visible.map((p, idx) => {
          const prev = visible[idx - 1];
          const showEllipsis = prev !== undefined && p - prev > 1;
          return (
            <span key={p} className="flex items-center gap-1">
              {showEllipsis && <span className="px-1 text-gray-400">…</span>}
              <Link
                href={href(p)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  p === currentPage
                    ? "border-indigo-500 bg-indigo-600 text-white"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {p}
              </Link>
            </span>
          );
        })}
        {currentPage < totalPages && (
          <Link href={href(currentPage + 1)} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
            Next →
          </Link>
        )}
      </nav>
    </div>
  );
}
