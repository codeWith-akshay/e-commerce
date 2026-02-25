"use client";

/**
 * Thin client-component wrapper that lazy-loads AddToCartForm with ssr:false.
 * `ssr: false` is only allowed inside Client Components — NOT in Server
 * Components — so this file owns the dynamic() call.
 */

import dynamic from "next/dynamic";

function AddToCartFormSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-4 w-20 rounded-md bg-gray-200" />
        <div className="h-9 w-28 rounded-xl bg-gray-100" />
      </div>
      <div className="h-14 w-full rounded-2xl bg-indigo-100" />
    </div>
  );
}

const AddToCartFormDynamic = dynamic(
  () => import("@/components/AddToCartForm"),
  {
    ssr: false,
    loading: () => <AddToCartFormSkeleton />,
  }
);

export default AddToCartFormDynamic;
