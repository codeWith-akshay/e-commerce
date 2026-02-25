// Order detail loading skeleton.
// Matches app/admin/orders/[id]/page.tsx layout:
//   breadcrumb → 2-col grid (items list left, meta + status right)
// revalidate = 0 on this page means it always fetches fresh data.

export default function AdminOrderDetailLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-pulse">
      {/* Breadcrumb + heading */}
      <div>
        <div className="h-4 w-28 rounded-md bg-slate-100" />
        <div className="mt-3 flex items-center gap-3">
          <div className="h-7 w-48 rounded-lg bg-slate-200" />
          <div className="h-5 w-20 rounded-full bg-slate-100" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Left col: order items ── */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            {/* Card header */}
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="h-4 w-32 rounded-md bg-slate-200" />
            </div>
            {/* Item rows */}
            <ul className="divide-y divide-slate-100">
              {Array.from({ length: 3 }).map((_, i) => (
                <li key={i} className="flex items-center gap-4 px-5 py-4">
                  <div className="h-14 w-14 shrink-0 rounded-lg bg-slate-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-2/3 rounded-md bg-slate-200" />
                    <div className="h-3 w-1/3 rounded-md bg-slate-100" />
                  </div>
                  <div className="shrink-0 space-y-1.5 text-right">
                    <div className="h-4 w-16 rounded-md bg-slate-200" />
                    <div className="h-3 w-20 rounded-md bg-slate-100" />
                  </div>
                </li>
              ))}
            </ul>
            {/* Totals footer */}
            <div className="rounded-b-xl border-t border-slate-100 bg-slate-50/60 px-5 py-4 space-y-2">
              <div className="flex justify-between">
                <div className="h-4 w-16 rounded-md bg-slate-100" />
                <div className="h-4 w-20 rounded-md bg-slate-100" />
              </div>
              <div className="flex justify-between">
                <div className="h-5 w-12 rounded-md bg-slate-200" />
                <div className="h-5 w-20 rounded-md bg-slate-200" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Right col: meta + status ── */}
        <div className="space-y-4">
          {/* Customer card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <div className="h-3 w-20 rounded-md bg-slate-100" />
            <div className="h-4 w-32 rounded-md bg-slate-200" />
            <div className="h-3 w-40 rounded-md bg-slate-100" />
            <div className="h-3 w-36 rounded-md bg-slate-100" />
          </div>
          {/* Order info card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <div className="h-3 w-20 rounded-md bg-slate-100" />
            <div className="h-3.5 w-full rounded-md bg-slate-100" />
            <div className="h-3.5 w-3/4 rounded-md bg-slate-100" />
            <div className="h-3.5 w-3/4 rounded-md bg-slate-100" />
          </div>
          {/* Status update card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <div className="h-3 w-28 rounded-md bg-slate-100" />
            <div className="h-9 w-full rounded-lg bg-slate-100" />
            <div className="h-10 w-full rounded-lg bg-slate-200" />
          </div>
        </div>
      </div>
    </div>
  );
}
