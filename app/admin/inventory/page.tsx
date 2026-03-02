/**
 * /admin/inventory — PRO Inventory Management Dashboard
 *
 * Architecture:
 *  - Server component reads searchParams for filtering (shareable URLs).
 *  - Stats + low-stock query run in parallel (Promise.all at page level).
 *  - InventorySearchFilters is a client component that pushes URL params.
 *  - StockAdjustModal is a client-side dialog triggered per row.
 *  - All heavy data fetching is server-side; no client-side data fetching.
 */

import Link from "next/link";
import type { Metadata } from "next";
import {
  Package,
  AlertTriangle,
  TrendingDown,
  ArrowUpDown,
  CheckCircle2,
  Warehouse,
  DollarSign,
  Activity,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import {
  getLowStockItems,
  getInventoryDashboardStats,
  getInventoryListFiltered,
  type InventoryListItem,
  type InventoryDashboardStats,
  type LowStockItem,
} from "@/lib/actions/inventory";
import InventorySearchFilters from "./InventorySearchFilters";
import StockAdjustModal from "./StockAdjustModal";

export const metadata: Metadata = { title: "Inventory Management | Admin" };
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

type SearchParams = Promise<{
  page?:   string;
  search?: string;
  status?: string;
}>;

export default async function InventoryPage({ searchParams }: { searchParams: SearchParams }) {
  const sp     = await searchParams;
  const page   = Math.max(1, parseInt(sp.page   ?? "1", 10));
  const search = sp.search ?? "";
  const status = (sp.status ?? "") as "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "";

  // Parallel data fetching — all independent queries run concurrently
  const [statsResult, lowStockResult, listResult] = await Promise.all([
    getInventoryDashboardStats(),
    getLowStockItems(),
    getInventoryListFiltered({ page, pageSize: 25, search, status }),
  ]);

  const stats    = statsResult.success    ? statsResult.data!                  : null;
  const lowStock = lowStockResult.success ? (lowStockResult.data ?? [])         : [];
  const items    = listResult.success     ? (listResult.data?.items   ?? [])    : [];
  const total    = listResult.success     ? (listResult.data?.total   ?? 0)     : 0;
  const totalPages = Math.ceil(total / 25);

  return (
    <div className="min-h-screen space-y-8 p-0">
      {/* ── Page Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
              <Warehouse className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Inventory Management</h1>
          </div>
          <p className="text-sm text-gray-500 ml-10">
            Monitor stock levels, adjust quantities, and track all movements.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/inventory/movements"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 hover:border-gray-300"
          >
            <ArrowUpDown className="h-4 w-4" />
            Movement Log
          </Link>
          <Link
            href="/admin/products"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Package className="h-4 w-4" />
            All Products
          </Link>
        </div>
      </div>

      {/* ── KPI Stats Cards ── */}
      <StatsCards stats={stats} />

      {/* ── Low Stock Alerts ── */}
      {lowStock.length > 0 && (
        <LowStockAlerts items={lowStock} />
      )}

      {/* ── Inventory Table ── */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-indigo-500" />
            <h2 className="text-base font-semibold text-gray-900">All Inventory</h2>
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-100 px-1.5 text-xs font-bold text-indigo-700">
              {total}
            </span>
          </div>
          <Link
            href="/admin/inventory/movements"
            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
          >
            View full movement log <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Search / filter controls — client component */}
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
                      <th className="px-4 py-3.5 text-right">Value</th>
                      <th className="px-4 py-3.5 text-right">Updated</th>
                      <th className="px-4 py-3.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {items.map((item) => (
                      <InventoryRow key={item.id} item={item} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <PaginationBar currentPage={page} totalPages={totalPages} search={search} status={status} />
            )}
          </>
        )}
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats Cards
// ─────────────────────────────────────────────────────────────────────────────

function StatsCards({ stats }: { stats: InventoryDashboardStats | null }) {
  const cards = [
    {
      label:    "Total SKUs",
      value:    stats?.totalProducts ?? 0,
      icon:     <Package className="h-5 w-5" />,
      color:    "bg-indigo-50 text-indigo-600",
      ring:     "ring-indigo-100",
      subtext:  "tracked products",
    },
    {
      label:    "In Stock",
      value:    stats?.inStockCount ?? 0,
      icon:     <CheckCircle2 className="h-5 w-5" />,
      color:    "bg-emerald-50 text-emerald-600",
      ring:     "ring-emerald-100",
      subtext:  "above reorder level",
    },
    {
      label:    "Low Stock",
      value:    stats?.lowStockCount ?? 0,
      icon:     <AlertTriangle className="h-5 w-5" />,
      color:    "bg-amber-50 text-amber-600",
      ring:     "ring-amber-100",
      subtext:  "need reordering",
    },
    {
      label:    "Out of Stock",
      value:    stats?.outOfStockCount ?? 0,
      icon:     <TrendingDown className="h-5 w-5" />,
      color:    "bg-red-50 text-red-600",
      ring:     "ring-red-100",
      subtext:  "zero units",
    },
    {
      label:    "Total Stock Value",
      value:    `₹${((stats?.totalStockValue ?? 0) / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
      icon:     <DollarSign className="h-5 w-5" />,
      color:    "bg-violet-50 text-violet-600",
      ring:     "ring-violet-100",
      subtext:  "sum price × qty",
      wide:     true,
    },
    {
      label:    "Adjustments (24h)",
      value:    stats?.recentAdjustmentsCount ?? 0,
      icon:     <Activity className="h-5 w-5" />,
      color:    "bg-sky-50 text-sky-600",
      ring:     "ring-sky-100",
      subtext:  "stock movements today",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm ring-1 ${c.ring} ${c.wide ? "lg:col-span-1" : ""}`}
        >
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.color}`}>
            {c.icon}
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-gray-900">
              {c.value}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{c.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{c.subtext}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Low Stock Alert Panel
// ─────────────────────────────────────────────────────────────────────────────

function LowStockAlerts({ items }: { items: LowStockItem[] }) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/40 p-1 shadow-sm">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
        </div>
        <h2 className="text-sm font-semibold text-amber-900">Low Stock Alerts</h2>
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-200 px-1.5 text-xs font-bold text-amber-800">
          {items.length}
        </span>
        <span className="ml-auto text-xs text-amber-700">
          {items.length > 10 ? `showing 10 of ${items.length}` : ""}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-amber-100 bg-white mx-1 mb-1">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-amber-100 bg-amber-50/60 text-left text-xs font-semibold uppercase tracking-wider text-amber-700">
                <th className="px-5 py-3">Product</th>
                <th className="px-4 py-3 text-right">In Stock</th>
                <th className="px-4 py-3 text-right">Reserved</th>
                <th className="px-4 py-3 text-right">Available</th>
                <th className="px-4 py-3 text-right">Reorder At</th>
                <th className="px-4 py-3">Warehouse</th>
                <th className="px-4 py-3 text-center">Quick Restock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-50">
              {items.slice(0, 10).map((item) => {
                const critical = item.stockQuantity <= Math.ceil(item.reorderLevel * 0.3);
                return (
                  <tr
                    key={item.id}
                    className={`transition hover:bg-amber-50/40 ${critical ? "bg-red-50/30" : ""}`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div
                          className={`flex h-2 w-2 rounded-full shrink-0 ${
                            critical ? "bg-red-500" : "bg-amber-400"
                          }`}
                        />
                        <div>
                          <p className="font-medium text-gray-900 leading-snug">{item.product.title}</p>
                          <p className="text-xs text-gray-400">SKU: {item.sku}</p>
                        </div>
                        {!item.product.isActive && (
                          <span className="ml-1 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                            Inactive
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                        critical ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        {critical && <AlertTriangle className="h-3 w-3" />}
                        {item.stockQuantity}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right text-sm font-medium text-orange-600">{item.reservedQty}</td>
                    <td className="px-4 py-3.5 text-right text-sm font-bold text-gray-900">{item.availableQty}</td>
                    <td className="px-4 py-3.5 text-right text-sm text-gray-500">{item.reorderLevel}</td>
                    <td className="px-4 py-3.5 text-sm text-gray-500">
                      {item.warehouseLocation ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <StockAdjustModal
                        inventoryId={item.id}
                        productTitle={item.product.title}
                        currentStock={item.stockQuantity}
                        defaultMode="add"
                        compact
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inventory Table Row
// ─────────────────────────────────────────────────────────────────────────────

function InventoryRow({ item }: { item: InventoryListItem }) {
  const stockValue = item.product.price * item.stockQuantity;

  const statusConfig = {
    IN_STOCK:     { label: "In Stock",    cls: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200" },
    LOW_STOCK:    { label: "Low Stock",   cls: "bg-amber-100   text-amber-700   ring-1 ring-amber-200" },
    OUT_OF_STOCK: { label: "Out of Stock",cls: "bg-red-100     text-red-700     ring-1 ring-red-200" },
  };
  const badge = statusConfig[item.stockStatus];

  const isLow  = item.stockStatus === "LOW_STOCK";
  const isOut  = item.stockStatus === "OUT_OF_STOCK";

  return (
    <tr className={`group transition-colors hover:bg-gray-50/60 ${isOut ? "bg-red-50/20" : isLow ? "bg-amber-50/20" : ""}`}>
      {/* Product */}
      <td className="px-5 py-4">
        <div className="flex items-start gap-2">
          <div className={`mt-1 flex h-2 w-2 rounded-full shrink-0 ${
            isOut ? "bg-red-400" : isLow ? "bg-amber-400" : "bg-emerald-400"
          }`} />
          <div>
            <p className="font-semibold text-gray-900 leading-snug">{item.product.title}</p>
            <p className="text-xs text-gray-400 mt-0.5">SKU: {item.sku}</p>
            {item.product.variants.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {item.product.variants.slice(0, 3).map((v) => (
                  <span key={v.id} className="inline-flex items-center rounded-md bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                    {v.name}: {v.value} ({v.stock})
                  </span>
                ))}
                {item.product.variants.length > 3 && (
                  <span className="text-xs text-gray-400">+{item.product.variants.length - 3} more</span>
                )}
              </div>
            )}
            {!item.product.isActive && (
              <span className="mt-1 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                Inactive
              </span>
            )}
          </div>
        </div>
      </td>

      {/* Category */}
      <td className="px-4 py-4">
        <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
          {item.product.category.name}
        </span>
      </td>

      {/* In Stock */}
      <td className="px-4 py-4 text-right">
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
          isOut ? "bg-red-100 text-red-700" : isLow ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
        }`}>
          {isOut && <TrendingDown className="h-3 w-3" />}
          {isLow && <AlertTriangle className="h-3 w-3" />}
          {item.stockQuantity}
        </span>
      </td>

      {/* Reserved */}
      <td className="px-4 py-4 text-right">
        <span className={`text-sm font-medium ${item.reservedQty > 0 ? "text-orange-600" : "text-gray-400"}`}>
          {item.reservedQty > 0 ? item.reservedQty : "—"}
        </span>
      </td>

      {/* Available */}
      <td className="px-4 py-4 text-right">
        <span className="text-sm font-bold text-gray-900">{item.availableQty}</span>
      </td>

      {/* Reorder Level */}
      <td className="px-4 py-4 text-right">
        <span className="text-sm text-gray-500">{item.reorderLevel}</span>
      </td>

      {/* Status Badge */}
      <td className="px-4 py-4">
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${badge.cls}`}>
          {badge.label}
        </span>
      </td>

      {/* Stock Value */}
      <td className="px-4 py-4 text-right">
        <span className="text-sm font-medium text-gray-700">
          ₹{(stockValue / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
        </span>
      </td>

      {/* Updated */}
      <td className="px-4 py-4 text-right">
        <span className="text-xs text-gray-400 tabular-nums">
          {new Date(item.updatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}
        </span>
      </td>

      {/* Actions */}
      <td className="px-4 py-4">
        <div className="flex items-center justify-center gap-2">
          <StockAdjustModal
            inventoryId={item.id}
            productTitle={item.product.title}
            currentStock={item.stockQuantity}
          />
          <Link
            href={`/admin/inventory/movements?productId=${item.product.id}`}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
            title="View movement log"
          >
            <ExternalLink className="h-3 w-3" />
            Log
          </Link>
        </div>
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
  search,
  status,
}: {
  currentPage: number;
  totalPages:  number;
  search:      string;
  status:      string;
}) {
  function href(p: number) {
    const qs = new URLSearchParams();
    if (p > 1)    qs.set("page",   String(p));
    if (search)   qs.set("search", search);
    if (status)   qs.set("status", status);
    const s = qs.toString();
    return `/admin/inventory${s ? `?${s}` : ""}`;
  }

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  const visible = pages.filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2
  );

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
