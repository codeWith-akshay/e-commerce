// Loading skeleton for the homepage (and any other page without its own loading.tsx)
// Matches the visual structure of page.tsx: Hero → Categories → Product Grid

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading page content" className="animate-pulse">
      {/* ── Hero skeleton ── */}
      <section className="bg-linear-to-br from-indigo-50 via-white to-purple-50 py-16 sm:py-24">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
          {/* Left text column */}
          <div className="space-y-6">
            <div className="h-5 w-32 rounded-full bg-indigo-100" />
            <div className="space-y-3">
              <div className="h-12 w-4/5 rounded-xl bg-gray-200" />
              <div className="h-12 w-3/5 rounded-xl bg-gray-200" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-full rounded-full bg-gray-100" />
              <div className="h-4 w-5/6 rounded-full bg-gray-100" />
            </div>
            <div className="flex gap-3">
              <div className="h-12 w-36 rounded-full bg-indigo-200" />
              <div className="h-12 w-36 rounded-full bg-gray-200" />
            </div>
          </div>

          {/* Right visual column */}
          <div className="hidden h-96 rounded-3xl bg-linear-to-br from-indigo-100 to-purple-100 lg:block" />
        </div>
      </section>

      {/* ── Categories skeleton ── */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <div className="mb-2 h-8 w-48 rounded-xl bg-gray-200" />
              <div className="h-4 w-72 rounded-full bg-gray-100" />
            </div>
            <div className="h-4 w-24 rounded-full bg-gray-100" />
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-3 rounded-2xl bg-gray-50 p-6"
              >
                <div className="h-12 w-12 rounded-2xl bg-gray-200" />
                <div className="h-4 w-16 rounded-full bg-gray-200" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured Products skeleton ── */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <div className="mb-2 h-8 w-56 rounded-xl bg-gray-200" />
              <div className="h-4 w-64 rounded-full bg-gray-100" />
            </div>
            <div className="h-4 w-20 rounded-full bg-gray-100" />
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-2xl bg-white shadow-sm"
              >
                {/* Image placeholder */}
                <div className="aspect-square w-full bg-gray-100" />
                {/* Content placeholder */}
                <div className="p-4 space-y-3">
                  <div className="h-3 w-16 rounded-full bg-gray-100" />
                  <div className="h-5 w-4/5 rounded-lg bg-gray-200" />
                  <div className="h-4 w-full rounded-full bg-gray-100" />
                  <div className="flex items-center justify-between">
                    <div className="h-6 w-20 rounded-lg bg-gray-200" />
                    <div className="h-8 w-8 rounded-full bg-gray-100" />
                  </div>
                  <div className="h-10 w-full rounded-xl bg-indigo-100" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust bar skeleton ── */}
      <section className="py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-gray-100" />
                <div className="h-4 w-24 rounded-full bg-gray-200" />
                <div className="h-3 w-32 rounded-full bg-gray-100" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
