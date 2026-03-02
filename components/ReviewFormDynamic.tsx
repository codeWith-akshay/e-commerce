"use client";

/**
 * Thin client-component wrapper that lazy-loads ReviewForm with ssr:false.
 * `ssr: false` is only allowed inside Client Components — NOT in Server
 * Components — so this file owns the dynamic() call.
 */

import dynamic from "next/dynamic";

function ReviewFormSkeleton() {
  return (
    <div className="animate-pulse space-y-4 rounded-2xl border border-gray-100 bg-white p-5">
      <div className="h-4 w-32 rounded-md bg-gray-200" />
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((s) => (
          <div key={s} className="h-7 w-7 rounded-md bg-gray-200" />
        ))}
      </div>
      <div className="h-24 w-full rounded-xl bg-gray-100" />
      <div className="h-10 w-full rounded-xl bg-indigo-100" />
    </div>
  );
}

const ReviewFormDynamic = dynamic(
  () => import("@/components/ReviewForm"),
  {
    ssr: false,
    loading: () => <ReviewFormSkeleton />,
  }
);

export default ReviewFormDynamic;
