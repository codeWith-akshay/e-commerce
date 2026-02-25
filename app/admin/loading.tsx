// Admin dashboard loading skeleton.
// Matches the visual structure of app/admin/page.tsx:
//   4 stat cards → revenue chart → recent-orders table

export default function AdminDashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Page heading */}
      <div className="space-y-2">
        <div className="h-7 w-36 rounded-lg bg-slate-200" />
        <div className="h-4 w-72 rounded-md bg-slate-100" />
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-28 rounded-md bg-slate-100" />
              <div className="h-9 w-9 rounded-lg bg-slate-100" />
            </div>
            <div className="mt-3 h-8 w-24 rounded-lg bg-slate-200" />
          </div>
        ))}
      </div>

      {/* ── Revenue chart ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 space-y-1.5">
          <div className="h-5 w-52 rounded-md bg-slate-200" />
          <div className="h-3.5 w-72 rounded-md bg-slate-100" />
        </div>
        {/* Chart placeholder */}
        <div className="flex h-64 items-end gap-3 px-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-sm bg-slate-100"
              style={{ height: `${30 + Math.sin(i * 0.8) * 20 + 20}%` }}
            />
          ))}
        </div>
      </div>

      {/* ── Recent orders table ── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Table header bar */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="h-5 w-32 rounded-md bg-slate-200" />
          <div className="h-4 w-24 rounded-md bg-slate-100" />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                {["Order ID", "Customer", "Amount", "Status", "Date"].map((col) => (
                  <th key={col} className="px-5 py-3">
                    <div className="h-3 w-16 rounded-md bg-slate-100" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-5 py-3.5">
                    <div className="h-3.5 w-24 rounded-md bg-slate-100" />
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="h-3.5 w-36 rounded-md bg-slate-100" />
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="ml-auto h-3.5 w-16 rounded-md bg-slate-100" />
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="h-5 w-20 rounded-full bg-slate-100" />
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="h-3.5 w-24 rounded-md bg-slate-100" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
