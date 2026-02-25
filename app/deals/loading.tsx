// Route-level loading skeleton for /deals.

export default function DealsLoading() {
  return (
    <div className="py-8 sm:py-10 animate-pulse">
      {/* Hero banner skeleton */}
      <div className="mb-10 h-36 rounded-2xl bg-rose-100" />

      {/* Filter bar */}
      <div className="mb-6 flex flex-wrap gap-3">
        <div className="h-10 w-44 rounded-full bg-gray-100" />
        <div className="h-10 w-44 rounded-full bg-gray-100" />
        <div className="ml-auto h-4 w-28 rounded-full bg-gray-100 self-center" />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
          >
            {/* Image area */}
            <div className="relative h-52 w-full bg-gray-100">
              {/* Discount ribbon placeholder */}
              <div className="absolute left-0 top-4 h-7 w-24 rounded-r-full bg-rose-100" />
              {/* Badge placeholder */}
              <div className="absolute right-2.5 top-2.5 h-5 w-16 rounded-full bg-gray-200" />
            </div>
            <div className="space-y-3 p-4">
              <div className="h-3 w-20 rounded-full bg-gray-100" />
              <div className="h-4 w-4/5 rounded-lg bg-gray-200" />
              <div className="h-3 w-24 rounded-full bg-gray-100" />
              {/* Prices */}
              <div className="flex items-center gap-2 pt-1">
                <div className="h-5 w-16 rounded-lg bg-rose-100" />
                <div className="h-4 w-12 rounded-lg bg-gray-100" />
                <div className="ml-auto h-3.5 w-16 rounded-full bg-emerald-100" />
              </div>
              {/* Countdown */}
              <div className="h-8 rounded-lg bg-gray-50" />
              {/* CTA */}
              <div className="h-9 rounded-full bg-indigo-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
