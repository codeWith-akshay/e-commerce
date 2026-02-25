import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import prisma from "@/lib/prisma";
import AdminProductForm, { type ProductDefaults } from "@/components/AdminProductForm";

export const revalidate = 0; // always fresh — we need the latest product data

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getProduct(id: string) {
  return prisma.product.findUnique({
    where: { id },
    select: {
      id:          true,
      title:       true,
      description: true,
      price:       true,
      stock:       true,
      categoryId:  true,
      rating:      true,
      images:      true,
    },
  });
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const product = await getProduct(id);
  return { title: product ? `Edit "${product.title}" — Admin` : "Product Not Found — Admin" };
}

export default async function AdminEditProductPage({ params }: PageProps) {
  const { id } = await params;
  const [product, categories] = await Promise.all([
    getProduct(id),
    prisma.category.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  if (!product) notFound();

  const defaults: ProductDefaults = {
    title:       product.title,
    description: product.description,
    price:       product.price,
    stock:       product.stock,
    categoryId:  product.categoryId,
    rating:      product.rating,
    images:      product.images,
  };

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
        <h2 className="mt-2 text-2xl font-bold text-slate-800">Edit Product</h2>
        <p className="mt-0.5 truncate text-sm text-slate-500">
          Editing: <span className="font-medium text-slate-700">{product.title}</span>
        </p>
      </div>

      {/* Form card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <AdminProductForm productId={product.id} defaults={defaults} categories={categories} />
      </div>
    </div>
  );
}
