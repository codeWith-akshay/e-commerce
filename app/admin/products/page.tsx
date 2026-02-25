import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Pencil, Plus } from "lucide-react";
import prisma from "@/lib/prisma";
import Pagination from "@/components/Pagination";
import AdminProductSearch from "@/components/AdminProductSearch";
import AdminProductDeleteButton from "@/components/AdminProductDeleteButton";

export const revalidate = 60;

const PAGE_SIZE = 10;

interface PageProps {
  searchParams: Promise<{ page?: string; search?: string }>;
}

// ── Data fetching ─────────────────────────────────────────────────────────────
async function getProducts(page: number, search: string) {
  const where = search
    ? { title: { contains: search, mode: "insensitive" as const } }
    : undefined;

  const [raw, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      orderBy: { createdAt: "desc" },
      select: {
        id:       true,
        title:    true,
        price:    true,
        category: { select: { name: true } },
        stock:    true,
        rating:   true,
        images:   true,
      },
    }),
    prisma.product.count({ where }),
  ]);

  const products = raw.map(({ category, ...p }) => ({ ...p, category: category.name }));

  return { products, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

// ── Stock badge ───────────────────────────────────────────────────────────────
function StockBadge({ stock }: { stock: number }) {
  const style =
    stock === 0
      ? "bg-red-50 text-red-700 ring-red-600/20"
      : stock < 10
      ? "bg-yellow-50 text-yellow-700 ring-yellow-600/20"
      : "bg-green-50 text-green-700 ring-green-600/20";
  const label = stock === 0 ? "Out of stock" : stock < 10 ? `Low (${stock})` : stock;

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${style}`}>
      {label}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function AdminProductsPage({ searchParams }: PageProps) {
  const { page: pageParam, search = "" } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const { products, total, totalPages } = await getProducts(page, search);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Products</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {total.toLocaleString()} product{total !== 1 ? "s" : ""} total
          </p>
        </div>
        <Link
          href="/admin/products/create"
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          <Plus className="h-4 w-4" />
          Add Product
        </Link>
      </div>

      {/* Search */}
      <AdminProductSearch
        defaultValue={search}
        basePath="/admin/products"
        currentParams={{ search: search || undefined }}
      />

      {/* Table card */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Rating</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    {search ? `No products matching "${search}".` : "No products yet."}
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Image + title */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
                          {product.images[0] ? (
                            <Image
                              src={product.images[0]}
                              alt={product.title}
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-slate-300 text-xs">
                              N/A
                            </div>
                          )}
                        </div>
                        <span className="max-w-45 truncate font-medium text-slate-800">
                          {product.title}
                        </span>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3 text-slate-500">
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium">
                        {product.category}
                      </span>
                    </td>

                    {/* Price */}
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">
                      ${product.price.toFixed(2)}
                    </td>

                    {/* Stock */}
                    <td className="px-4 py-3">
                      <StockBadge stock={product.stock} />
                    </td>

                    {/* Rating */}
                    <td className="px-4 py-3 text-slate-600">
                      <span className="flex items-center gap-1">
                        <span className="text-amber-400">★</span>
                        {product.rating.toFixed(1)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/products/${product.id}/edit`}
                          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-indigo-600 ring-1 ring-inset ring-indigo-200 transition hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Link>
                        <Suspense fallback={<div className="h-7 w-16 animate-pulse rounded-md bg-slate-100" />}>
                          <AdminProductDeleteButton productId={product.id} />
                        </Suspense>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-slate-100 px-4 py-3">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              basePath="/admin/products"
              searchParams={{ search: search || undefined }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
