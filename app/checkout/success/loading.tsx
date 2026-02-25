// Checkout success loading skeleton.
// Matches app/checkout/success/page.tsx:
//   centred icon + heading → (optional) order summary card → tracking steps → CTAs
// The page is force-dynamic and fetches the order by ID on every load.

export default function CheckoutSuccessLoading() {
  return (
    <main className="min-h-[calc(100vh-5rem)] bg-linear-to-b from-indigo-50/70 via-white to-white px-4 py-16">
      <div className="mx-auto w-full max-w-lg animate-pulse">

        {/* Hero: icon + heading */}
        <div className="flex flex-col items-center text-center">
          {/* Icon rings */}
          <div className="relative mb-8">
            <span className="absolute inset-0 -m-4 rounded-full bg-emerald-100/60" />
            <span className="absolute inset-0 -m-2 rounded-full bg-emerald-100" />
            <div className="relative h-24 w-24 rounded-full bg-emerald-100" />
          </div>
          <div className="h-4 w-36 rounded-full bg-gray-200" />
          <div className="mt-3 h-9 w-72 rounded-xl bg-gray-200" />
          <div className="mt-3 space-y-2">
            <div className="h-4 w-80 rounded-md bg-gray-100" />
            <div className="h-4 w-64 rounded-md bg-gray-100" />
          </div>
        </div>

        {/* Order summary card */}
        <div className="mt-10 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          {/* Card header */}
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/60 px-6 py-4">
            <div className="h-4 w-32 rounded-md bg-gray-200" />
            <div className="h-5 w-20 rounded-full bg-gray-100" />
          </div>
          {/* Rows */}
          <div className="divide-y divide-dashed divide-gray-100 px-6 py-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-3">
                <div className="h-4 w-28 rounded-md bg-gray-100" />
                <div className="h-4 w-20 rounded-md bg-gray-100" />
              </div>
            ))}
          </div>
        </div>

        {/* Tracking steps */}
        <div className="mt-8 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="h-10 w-10 shrink-0 rounded-full bg-gray-100" />
              <div className="space-y-1.5 pt-1">
                <div className="h-4 w-32 rounded-md bg-gray-200" />
                <div className="h-3.5 w-56 rounded-md bg-gray-100" />
              </div>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <div className="h-12 flex-1 rounded-2xl bg-gray-200" />
          <div className="h-12 flex-1 rounded-2xl bg-gray-100" />
        </div>
      </div>
    </main>
  );
}
