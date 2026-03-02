/**
 * /admin/inventory/all
 * Full paginated, searchable, filterable inventory table — no stats noise.
 */

import Link from "next/link";
import type { Metadata } from "next";
import React from "react";
import {
  Package,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  TrendingDown,
  Warehouse,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import {
  getInventoryListFiltered,
  type InventoryListItem,
} from "@/lib/actions/inventory";
import InventorySearchFilters from "../InventorySearchFilters";
import StockAdjustModal from "../StockAdjustModal";

export const metadata: Metadata = { title: "All Stock | Inventory | Admin" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  page?:   string;
  search?: string;
  status?: string;
}>;

export default async function AllInventoryPage({ searchParams }: { searchParams: SearchParams }) {
  const sp     = await searchParams;
  const page   = Math.max(1, parseInt(sp.page   ?? "1", 10));
  const search = sp.search ?? "";
  const status = (sp.status ?? "") as "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "";

  const result = await getInventoryListFiltered({ page, pageSize: 25, search, status });

  const items      = result.success ? (result.data?.items ?? []) : [];
  const total      = result.success ? (result.data?.total  ?? 0) : 0;
  const totalPages = Math.ceil(total / 25);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/admin/inventory"
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-600 transition font-medium"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Inventory
            </Link>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
              <Package className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">All Stock</h1>
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-indigo-100 px-2 text-xs font-bold text-indigo-700">
              {total}
            </span>
          </div>
          <p className="text-sm text-gray-500 ml-10 mt-0.5">
            Browse, search, and adjust every inventory record.
          </p>
        </div>
      </div>

      {/* Search + filters */}
      <InventorySearchFilters currentSearch={search} currentStatus={status} />

      {/* Table */}
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-16 text-center">
          <Package className="mx-auto h-8 w-8 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">No inventory records match your filters.</p>
          <p className="text-xs text-gray-400 mt-1">Try adjusting the search or filter criteria.</p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <th className="px-5 py-3.5 min-w-55">Product</th>
                    <th className="px-4 py-3.5">Category</th>
                    <th className="px-4 py-3.5 text-right">In Stock</th>
                    <th className="px-4 py-3.5 text-right">Reserved</th>
                    <th className="px-4 py-3.5 text-right">Available</th>
                    <th className="px-4 py-3.5 text-right">Reorder At</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Warehouse</th>
                    <th className="px-4 py-3.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map((item) => (
                    <AllStockRow key={item.id} item={item} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <AllStockPagination
              currentPage={page}
              totalPages={totalPages}
              search={search}
              status={status}
            />
          )}
        </>
      )}
    </div>
  );
}

// ── Row ────────────────────────────────────────────────────────────────────────

function AllStockRow({ item }: { item: InventoryListItem }) {
  const isOut = item.stockStatus === "OUT_OF_STOCK";
  const isLow = item.stockStatus === "LOW_STOCK";

  const statusBadge = {
    IN_STOCK:     { label: "In Stock",     cls: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200" },
    LOW_STOCK:    { label: "Low Stock",    cls: "bg-amber-100   text-amber-700   ring-1 ring-amber-200" },
    OUT_OF_STOCK: { label: "Out of Stock", cls: "bg-red-100     text-red-700     ring-1 ring-red-200" },
  }[item.stockStatus];

  return (
    <tr className={`group transition-colors hover:bg-gray-50/60 ${isOut ? "bg-red-50/20" : isLow ? "bg-amber-50/10" : ""}`}>
      {/* Product */}
      <td className="px-5 py-4">
        <div className="flex items-start gap-2">
          <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
            isOut ? "bg-red-400" : isLow ? "bg-amber-400" : "bg-emerald-400"
          }`} />
          <div>
            <p className="font-semibold text-gray-900 leading-snug">{item.product.title}</p>
            <p className="text-xs text-gray-400 mt-0.5">SKU: {item.sku}</p>
          </div>
        </div>
      </td>

      {/* Category */}
      <td className="px-4 py-4 text-sm text-gray-500">{item.product.category.name}</td>

      {/* In Stock */}
      <td className="px-4 py-4 text-right">
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
          isOut ? "bg-red-100 text-red-700" : isLow ? "bg-amber-100 text-amber-700" : "bg-emerald-50 text-emerald-700"
        }`}>
          {isOut && <TrendingDown className="h-3 w-3" />}
          {isLow && <AlertTriangle className="h-3 w-3" />}
          {!isOut && !isLow && <CheckCircle2 className="h-3 w-3" />}
          {item.stockQuantity}
        </span>
      </td>

      {/* Reserved */}
      <td className="px-4 py-4 text-right text-sm text-orange-600 font-medium">{item.reservedQty}</td>

      {/* Available */}
      <td className="px-4 py-4 text-right text-sm font-bold text-gray-900">{item.availableQty}</td>

      {/* Reorder */}
      <td className="px-4 py-4 text-right text-sm text-gray-500">{item.reorderLevel}</td>

      {/* Status */}
      <td className="px-4 py-4">
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge.cls}`}>
          {statusBadge.label}
        </span>
      </td>

      {/* Warehouse */}
      <td className="px-4 py-4 text-sm text-gray-500">
        <span className="flex items-center gap-1">
          {item.warehouseLocation ? (
            <><Warehouse className="h-3.5 w-3.5 shrink-0 text-gray-400" />{item.warehouseLocation}</>
          ) : (
            <span className="text-gray-300">—</span>
          )}
        </span>
      </td>

      {/* Actions */}
      <td className="px-4 py-4 text-center">
        <div className="flex items-center justify-center gap-2">
          <StockAdjustModal
            inventoryId={item.id}
            productTitle={item.product.title}
            currentStock={item.stockQuantity}
            compact
          />
          {item.product.slug && (
            <Link
              href={`/products/${item.product.slug}`}
              target="_blank"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400 shadow-sm transition hover:border-indigo-300 hover:text-indigo-600"
              title="View product"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Pagination ─────────────────────────────────────────────────────────────────

function AllStockPagination({
  currentPage,
  totalPages,
  search,
  status,
}: {
  currentPage: number;
  totalPages: number;
  search: string;
  status: string;
}) {
  function pageHref(p: number) {
    const qs = new URLSearchParams();
    if (search) qs.set("search", search);
    if (status) qs.set("status", status);
    if (p > 1)  qs.set("page", String(p));
    return `/admin/inventory/all${qs.toString() ? `?${qs}` : ""}`;
  }

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1,
  );

  return (
    <div className="flex items-center justify-between text-sm">
      <p className="text-gray-500">
        Page <span className="font-semibold text-gray-800">{currentPage}</span> of{" "}
        <span className="font-semibold text-gray-800">{totalPages}</span>
      </p>
      <div className="flex items-center gap-1">
        {currentPage > 1 && (
          <Link
            href={pageHref(currentPage - 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
        )}
        {pages.map((p, i) => {
          const prev = pages[i - 1];
          return (
            <React.Fragment key={p}>
              {prev && p - prev > 1 && (
                <span className="px-1 text-gray-400">…</span>
              )}
              <Link
                href={pageHref(p)}
                className={`flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-semibold shadow-sm transition ${
                  p === currentPage
                    ? "border-indigo-500 bg-indigo-600 text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700"
                }`}
              >
                {p}
              </Link>
            </React.Fragment>
          );
        })}
        {currentPage < totalPages && (
          <Link
            href={pageHref(currentPage + 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  );
}
