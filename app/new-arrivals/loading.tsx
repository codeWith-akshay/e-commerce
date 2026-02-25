// Route-level loading skeleton for /new-arrivals.

export default function NewArrivalsLoading() {
  return (
    <div className="py-8 sm:py-10 animate-pulse">
      {/* Hero banner skeleton */}
      <div className="mb-10 h-36 rounded-2xl bg-violet-100" />

      {/* Filter bar */}
      <div className="mb-6 flex flex-wrap gap-3">
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
              {/* NEW badge placeholder */}
              <div className="absolute left-2.5 top-2.5 h-6 w-16 rounded-full bg-violet-100" />
            </div>
            <div className="space-y-3 p-4">
              <div className="h-4 w-20 rounded-full bg-gray-100" />
              <div className="h-4 w-4/5 rounded-lg bg-gray-200" />
              <div className="h-3 w-24 rounded-full bg-gray-100" />
              {/* Price row */}
              <div className="flex items-center justify-between pt-1">
                <div className="h-5 w-20 rounded-lg bg-gray-200" />
                <div className="h-3 w-24 rounded-full bg-gray-100" />
              </div>
              {/* CTA */}
              <div className="h-9 rounded-full bg-indigo-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
