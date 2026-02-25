export default function CartLoading() {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-32 rounded-xl bg-gray-200" />
          <div className="h-4 w-24 rounded-md bg-gray-100" />
        </div>
        <div className="h-9 w-28 rounded-xl bg-gray-100" />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:items-start">
        {/* Items list */}
        <div className="space-y-4 lg:col-span-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-xs"
            >
              {/* Image */}
              <div className="h-24 w-24 shrink-0 rounded-xl bg-gray-100 sm:h-28 sm:w-28" />
              {/* Info */}
              <div className="flex flex-1 flex-col justify-between gap-3 py-1">
                <div className="space-y-2">
                  <div className="h-3 w-16 rounded-full bg-gray-100" />
                  <div className="h-4 w-3/4 rounded-lg bg-gray-200" />
                  <div className="h-4 w-20 rounded-lg bg-gray-200" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="h-9 w-28 rounded-xl bg-gray-100" />
                  <div className="h-9 w-9 rounded-xl bg-gray-100" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Order summary */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-xs">
          <div className="h-5 w-36 rounded-lg bg-gray-200" />
          <div className="mt-6 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <div className="h-4 w-24 rounded-md bg-gray-100" />
                <div className="h-4 w-16 rounded-md bg-gray-100" />
              </div>
            ))}
          </div>
          <div className="mt-6 h-px bg-gray-100" />
          <div className="mt-4 flex justify-between">
            <div className="h-5 w-16 rounded-md bg-gray-200" />
            <div className="h-5 w-20 rounded-md bg-gray-200" />
          </div>
          <div className="mt-6 h-13 w-full rounded-2xl bg-gray-200" />
        </div>
      </div>
    </div>
  );
}
