import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import prisma from "@/lib/prisma";
import AdminProductForm from "@/components/AdminProductForm";

export const metadata = { title: "Add Product — Admin" };

export default async function AdminCreateProductPage() {
  const categories = await prisma.category.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Breadcrumb */}
      <div>
        <Link
          href="/admin/products"
          className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Products
        </Link>
        <h2 className="mt-2 text-2xl font-bold text-slate-800">Add Product</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Fill in the details below to add a new product to the store.
        </p>
      </div>

      {/* Form card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <AdminProductForm categories={categories} />
      </div>
    </div>
  );
}
