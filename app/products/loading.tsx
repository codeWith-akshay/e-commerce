// Route-level loading skeleton for /products.
// Shown by Next.js while the Server Component tree resolves on first load
// (before client-side navigation, which uses the Suspense boundary instead).

export default function ProductsLoading() {
  return (
    <div className="py-8 sm:py-10 animate-pulse">
      {/* Page header */}
      <div className="mb-8 space-y-2">
        <div className="h-9 w-44 rounded-xl bg-gray-200" />
        <div className="h-4 w-72 rounded-full bg-gray-100" />
      </div>

      {/* Filter bar */}
      <div className="mb-8 flex flex-wrap gap-3">
        <div className="h-10 w-64 rounded-full bg-gray-100" />
        <div className="h-10 w-40 rounded-full bg-gray-100" />
        <div className="h-10 w-40 rounded-full bg-gray-100" />
        <div className="ml-auto h-10 w-28 rounded-full bg-gray-100" />
      </div>

      {/* Count */}
      <div className="mb-6 h-4 w-40 rounded-full bg-gray-100" />

      {/* Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
          >
            <div className="h-52 w-full bg-gray-100" />
            <div className="space-y-3 p-4">
              <div className="h-3 w-16 rounded-full bg-gray-100" />
              <div className="h-4 w-4/5 rounded-lg bg-gray-200" />
              <div className="h-3 w-24 rounded-full bg-gray-100" />
              <div className="flex items-center justify-between pt-1">
                <div className="h-5 w-20 rounded-lg bg-gray-200" />
                <div className="h-8 w-24 rounded-full bg-indigo-100" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
