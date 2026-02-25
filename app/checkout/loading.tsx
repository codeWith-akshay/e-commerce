export default function CheckoutLoading() {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="mb-8 space-y-2">
        <div className="h-7 w-28 rounded-xl bg-gray-200" />
        <div className="h-4 w-48 rounded-md bg-gray-100" />
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-start">

        {/* Left — address form skeleton */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-xs space-y-6">
          <div className="h-5 w-36 rounded-lg bg-gray-200" />
          <div className="grid grid-cols-2 gap-4">
            {/* Full-width fields */}
            {[1, 2, 3].map((i) => (
              <div key={i} className="col-span-2 space-y-2">
                <div className="h-3.5 w-24 rounded-md bg-gray-100" />
                <div className="h-10 w-full rounded-xl bg-gray-100" />
              </div>
            ))}
            {/* Half-width fields */}
            {[1, 2].map((i) => (
              <div key={i} className="col-span-1 space-y-2">
                <div className="h-3.5 w-20 rounded-md bg-gray-100" />
                <div className="h-10 w-full rounded-xl bg-gray-100" />
              </div>
            ))}
          </div>
          {/* Submit button */}
          <div className="h-13 w-full rounded-2xl bg-gray-200" />
        </div>

        {/* Right — order summary skeleton */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-xs space-y-6">
          <div className="h-5 w-32 rounded-lg bg-gray-200" />
          {/* Items */}
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="h-16 w-16 shrink-0 rounded-xl bg-gray-100" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3.5 w-3/4 rounded-md bg-gray-200" />
                  <div className="h-3 w-16 rounded-md bg-gray-100" />
                  <div className="h-3.5 w-12 rounded-md bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
          {/* Totals */}
          <div className="border-t border-gray-100 pt-4 space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="flex justify-between">
                <div className="h-4 w-20 rounded-md bg-gray-100" />
                <div className="h-4 w-16 rounded-md bg-gray-100" />
              </div>
            ))}
            <div className="flex justify-between pt-1">
              <div className="h-5 w-12 rounded-md bg-gray-200" />
              <div className="h-5 w-20 rounded-md bg-gray-200" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
