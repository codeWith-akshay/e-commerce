// Route-level loading skeleton for /products/[id]
// Shown instantly while the async Server Component resolves.

export default function ProductDetailLoading() {
  return (
    <div className="animate-pulse">
      {/* Breadcrumb skeleton */}
      <div className="mb-6 flex items-center gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-3 w-16 rounded-md bg-gray-100" />
            {i < 3 && <div className="h-3 w-3 rounded bg-gray-100" />}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
        {/* Image skeleton */}
        <div className="flex flex-col gap-4">
          <div className="aspect-square w-full rounded-2xl bg-gray-100" />
          <div className="flex gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 w-20 shrink-0 rounded-xl bg-gray-100" />
            ))}
          </div>
        </div>

        {/* Info skeleton */}
        <div className="flex flex-col gap-5">
          {/* Badges */}
          <div className="flex gap-2">
            <div className="h-6 w-24 rounded-full bg-gray-100" />
            <div className="h-6 w-28 rounded-full bg-gray-100" />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <div className="h-7 w-4/5 rounded-xl bg-gray-200" />
            <div className="h-7 w-3/5 rounded-xl bg-gray-200" />
          </div>

          {/* Rating */}
          <div className="h-5 w-36 rounded-md bg-gray-100" />

          {/* Price */}
          <div className="h-9 w-28 rounded-xl bg-gray-200" />

          <hr className="border-gray-100" />

          {/* Description */}
          <div className="space-y-2">
            <div className="h-3 w-20 rounded bg-gray-100" />
            <div className="h-4 w-full rounded bg-gray-100" />
            <div className="h-4 w-11/12 rounded bg-gray-100" />
            <div className="h-4 w-4/6 rounded bg-gray-100" />
          </div>

          {/* Specs row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="h-16 rounded-xl bg-gray-100" />
            <div className="h-16 rounded-xl bg-gray-100" />
          </div>

          <hr className="border-gray-100" />

          {/* Qty + CTA */}
          <div className="h-12 w-36 rounded-xl bg-gray-100" />
          <div className="h-14 w-full rounded-2xl bg-gray-200" />

          {/* Trust badges */}
          <div className="flex gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-4 w-24 rounded bg-gray-100" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
