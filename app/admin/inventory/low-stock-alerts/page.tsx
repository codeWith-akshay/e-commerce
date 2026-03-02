/**
 * /admin/inventory/low-stock-alerts
 * Dedicated page for all LOW_STOCK and OUT_OF_STOCK items.
 */

import Link from "next/link";
import type { Metadata } from "next";
import {
  AlertTriangle,
  Package,
  TrendingDown,
  ChevronLeft,
  Warehouse,
  ExternalLink,
} from "lucide-react";
import {
  getInventoryListFiltered,
  type InventoryListItem,
} from "@/lib/actions/inventory";
import StockAdjustModal from "../StockAdjustModal";

export const metadata: Metadata = { title: "Low Stock Alerts | Inventory | Admin" };
export const dynamic = "force-dynamic";

export default async function LowStockAlertsPage() {
  // Fetch both statuses in parallel — up to 200 items each (more than enough)
  const [lowResult, ooResult] = await Promise.all([
    getInventoryListFiltered({ pageSize: 200, status: "LOW_STOCK" }),
    getInventoryListFiltered({ pageSize: 200, status: "OUT_OF_STOCK" }),
  ]);

  const lowItems = lowResult.success ? (lowResult.data?.items ?? []) : [];
  const ooItems  = ooResult.success  ? (ooResult.data?.items  ?? []) : [];
  const allItems = [...ooItems, ...lowItems]; // OOS first (more urgent)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-6">
        <div className="flex items-start gap-3">
          <Link
            href="/admin/inventory"
            className="mt-0.5 flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-600 transition font-medium"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Inventory
          </Link>
        </div>
        <div className="w-full">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500">
              <AlertTriangle className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Low Stock Alerts</h1>
          </div>
          <p className="text-sm text-gray-500 ml-10">
            Products at or below their reorder level — action required.
          </p>
        </div>
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
          <TrendingDown className="h-4 w-4 text-red-600" />
          <div>
            <p className="text-lg font-bold text-red-700 leading-none">{ooItems.length}</p>
            <p className="text-xs text-red-600 font-medium mt-0.5">Out of Stock</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <div>
            <p className="text-lg font-bold text-amber-700 leading-none">{lowItems.length}</p>
            <p className="text-xs text-amber-600 font-medium mt-0.5">Low Stock</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-4 py-2.5">
          <Package className="h-4 w-4 text-gray-500" />
          <div>
            <p className="text-lg font-bold text-gray-800 leading-none">{allItems.length}</p>
            <p className="text-xs text-gray-500 font-medium mt-0.5">Total Alerts</p>
          </div>
        </div>
      </div>

      {/* Table */}
      {allItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-20 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <Package className="h-7 w-7 text-emerald-500" />
          </div>
          <p className="text-base font-semibold text-gray-700">All stock levels are healthy</p>
          <p className="mt-1 text-sm text-gray-400">No items are currently low or out of stock.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <th className="px-5 py-3.5">Product</th>
                  <th className="px-4 py-3.5">Category</th>
                  <th className="px-4 py-3.5 text-right">In Stock</th>
                  <th className="px-4 py-3.5 text-right">Available</th>
                  <th className="px-4 py-3.5 text-right">Reorder At</th>
                  <th className="px-4 py-3.5 text-right">Shortfall</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Warehouse</th>
                  <th className="px-4 py-3.5 text-center">Quick Restock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {allItems.map((item) => (
                  <AlertRow key={item.id} item={item} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function AlertRow({ item }: { item: InventoryListItem }) {
  const isOut  = item.stockStatus === "OUT_OF_STOCK";
  const shortfall = Math.max(0, item.reorderLevel - item.stockQuantity);

  return (
    <tr className={`group transition-colors hover:bg-gray-50/60 ${isOut ? "bg-red-50/25" : "bg-amber-50/20"}`}>
      {/* Product */}
      <td className="px-5 py-4">
        <div className="flex items-start gap-2">
          <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${isOut ? "bg-red-500" : "bg-amber-400"}`} />
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
          isOut ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
        }`}>
          {isOut && <TrendingDown className="h-3 w-3" />}
          {!isOut && <AlertTriangle className="h-3 w-3" />}
          {item.stockQuantity}
        </span>
      </td>

      {/* Available */}
      <td className="px-4 py-4 text-right text-sm font-semibold text-gray-800">{item.availableQty}</td>

      {/* Reorder level */}
      <td className="px-4 py-4 text-right text-sm text-gray-500">{item.reorderLevel}</td>

      {/* Shortfall */}
      <td className="px-4 py-4 text-right">
        {shortfall > 0 ? (
          <span className="text-sm font-semibold text-red-600">−{shortfall}</span>
        ) : (
          <span className="text-sm text-gray-300">—</span>
        )}
      </td>

      {/* Status badge */}
      <td className="px-4 py-4">
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
          isOut
            ? "bg-red-100 text-red-700 ring-red-200"
            : "bg-amber-100 text-amber-700 ring-amber-200"
        }`}>
          {isOut ? "Out of Stock" : "Low Stock"}
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
            defaultMode="add"
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
