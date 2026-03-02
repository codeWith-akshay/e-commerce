"use client";

/**
 * Thin client-component wrapper that lazy-loads CheckoutForm with ssr:false.
 * `ssr: false` is only allowed inside Client Components — NOT in Server
 * Components — so this file owns the dynamic() call.
 */

import dynamic from "next/dynamic";

function CheckoutFormSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <div className="h-4 w-28 rounded-md bg-gray-200" />
          <div className="h-11 w-full rounded-xl bg-gray-100" />
        </div>
      ))}
      <div className="mt-2 h-14 w-full rounded-2xl bg-indigo-100" />
    </div>
  );
}

interface CheckoutFormProps {
  subtotal: number;
  shipping: number;
}

const CheckoutFormLoaded = dynamic(
  () => import("@/components/CheckoutForm"),
  {
    ssr: false,
    loading: () => <CheckoutFormSkeleton />,
  }
);

export default function CheckoutFormDynamic(props: CheckoutFormProps) {
  return <CheckoutFormLoaded {...props} />;
}

