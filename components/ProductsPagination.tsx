// ProductsPagination — thin wrapper around the generic <Pagination> component.
// Converts the typed ProductsSearchParams record into the plain
// Record<string, string | undefined> that Pagination expects, so call sites
// in the products page don't have to do the conversion themselves.

import Pagination from "@/components/Pagination";
import type { ProductsSearchParams } from "@/types";

interface ProductsPaginationProps {
  currentPage: number;
  totalPages: number;
  searchParams: ProductsSearchParams;
}

export default function ProductsPagination({
  currentPage,
  totalPages,
  searchParams,
}: ProductsPaginationProps) {
  return (
    <Pagination
      currentPage={currentPage}
      totalPages={totalPages}
      basePath="/products"
      searchParams={searchParams as Record<string, string | undefined>}
      className="mt-12"
    />
  );
}
