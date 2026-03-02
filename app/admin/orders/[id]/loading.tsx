// Order detail loading skeleton — matches the PRO rewrite of page.tsx
// max-w-6xl | 3-col grid | status stepper in sidebar | financial breakdown

export default function AdminOrderDetailLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-pulse">

      {/* ── Top bar ── */}
      <div>
        <div className="h-4 w-28 rounded-md bg-slate-100" />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-7 w-52 rounded-lg bg-slate-200" />
            <div className="h-5 w-20 rounded-full bg-slate-100" />
            <div className="h-5 w-16 rounded-full bg-slate-100" />
          </div>
          <div className="h-3.5 w-36 rounded-md bg-slate-100" />
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* ══ LEFT (2 cols) ══ */}
        <div className="space-y-6 lg:col-span-2">

          {/* Order items card */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-md bg-slate-100" />
                <div className="h-4 w-28 rounded-md bg-slate-200" />
              </div>
              <div className="h-5 w-14 rounded-full bg-slate-100" />
            </div>

            <ul className="divide-y divide-slate-100">
              {Array.from({ length: 3 }).map((_, i) => (
                <li key={i} className="flex items-center gap-4 px-5 py-4">
                  <div className="h-14 w-14 shrink-0 rounded-xl bg-slate-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-2/3 rounded-md bg-slate-200" />
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-20 rounded-full bg-slate-100" />
                      <div className="h-3 w-14 rounded-md bg-slate-100" />
                    </div>
                  </div>
                  <div className="shrink-0 space-y-1.5 text-right">
                    <div className="h-4 w-16 rounded-md bg-slate-200" />
                    <div className="h-3 w-20 rounded-md bg-slate-100" />
                  </div>
                  <div className="h-7 w-7 rounded-lg bg-slate-100" />
                </li>
              ))}
            </ul>

            {/* Financial breakdown footer */}
            <div className="rounded-b-2xl border-t border-slate-100 bg-slate-50/60 px-5 py-4 space-y-2.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-4 w-16 rounded-md bg-slate-100" />
                  <div className="h-4 w-20 rounded-md bg-slate-100" />
                </div>
              ))}
              <div className="flex justify-between border-t border-slate-200 pt-2">
                <div className="h-5 w-12 rounded-md bg-slate-200" />
                <div className="h-5 w-24 rounded-md bg-slate-200" />
              </div>
            </div>
          </div>

          {/* Status history timeline card */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-md bg-slate-100" />
                <div className="h-4 w-32 rounded-md bg-slate-200" />
              </div>
            </div>
            <div className="px-5 py-4 space-y-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className="h-7 w-7 shrink-0 rounded-full bg-slate-100" />
                  <div className="flex-1 space-y-2 pb-2">
                    <div className="h-5 w-24 rounded-full bg-slate-100" />
                    <div className="h-3 w-32 rounded-md bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══ RIGHT (1 col) ══ */}
        <div className="space-y-4">

          {/* Customer card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 h-3 w-20 rounded-md bg-slate-100" />
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-full bg-slate-200" />
              <div className="space-y-2">
                <div className="h-4 w-32 rounded-md bg-slate-200" />
                <div className="h-3 w-40 rounded-md bg-slate-100" />
              </div>
            </div>
            <div className="mt-3 h-3 w-36 rounded-md bg-slate-100" />
            <div className="mt-2 h-3.5 w-24 rounded-md bg-slate-100" />
          </div>

          {/* Shipping address card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
            <div className="h-3 w-28 rounded-md bg-slate-100" />
            <div className="h-4 w-full rounded-md bg-slate-100" />
            <div className="h-4 w-4/5 rounded-md bg-slate-100" />
            <div className="h-4 w-3/5 rounded-md bg-slate-100" />
          </div>

          {/* Payment card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <div className="h-3 w-20 rounded-md bg-slate-100" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <div className="h-3.5 w-16 rounded-md bg-slate-100" />
                <div className="h-3.5 w-24 rounded-md bg-slate-200" />
              </div>
            ))}
          </div>

          {/* Order info card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <div className="h-3 w-20 rounded-md bg-slate-100" />
            <div className="h-3.5 w-full rounded-md bg-slate-100" />
            <div className="flex gap-6">
              <div className="h-3.5 w-24 rounded-md bg-slate-100" />
              <div className="h-3.5 w-24 rounded-md bg-slate-100" />
            </div>
          </div>

          {/* Status update card — stepper + buttons */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="h-3 w-28 rounded-md bg-slate-100" />
            {/* Stepper */}
            <div className="flex items-start justify-between">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <div className="h-8 w-8 rounded-full bg-slate-100" />
                  <div className="h-2.5 w-12 rounded-md bg-slate-100" />
                </div>
              ))}
            </div>
            {/* Status buttons */}
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 w-full rounded-xl bg-slate-100" />
            ))}
            <div className="h-10 w-full rounded-xl bg-slate-200" />
          </div>
        </div>
      </div>
    </div>
  );
}
