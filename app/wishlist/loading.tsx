export default function WishlistLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-8 h-9 w-48 rounded-xl bg-gray-200" />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="h-52 w-full bg-gray-100" />
            <div className="space-y-3 p-4">
              <div className="h-3 w-20 rounded-full bg-gray-100" />
              <div className="h-4 w-full rounded-md bg-gray-200" />
              <div className="h-4 w-3/4 rounded-md bg-gray-200" />
              <div className="mt-4 flex items-center justify-between">
                <div className="h-6 w-16 rounded-md bg-gray-200" />
                <div className="h-9 w-28 rounded-xl bg-gray-100" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
