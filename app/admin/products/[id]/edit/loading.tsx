// Edit product loading skeleton.
// Matches app/admin/products/[id]/edit/page.tsx layout:
//   breadcrumb → form card with labelled field rows
// revalidate = 0 on this page means it always fetches fresh product data.

export default function AdminEditProductLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-pulse">
      {/* Breadcrumb + heading */}
      <div>
        <div className="h-4 w-32 rounded-md bg-slate-100" />
        <div className="mt-2 h-7 w-36 rounded-lg bg-slate-200" />
        <div className="mt-1 h-4 w-64 rounded-md bg-slate-100" />
      </div>

      {/* Form card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        {/* Title field */}
        <div className="space-y-1.5">
          <div className="h-4 w-12 rounded-md bg-slate-100" />
          <div className="h-9 w-full rounded-lg bg-slate-100" />
        </div>

        {/* Description field */}
        <div className="space-y-1.5">
          <div className="h-4 w-24 rounded-md bg-slate-100" />
          <div className="h-24 w-full rounded-lg bg-slate-100" />
        </div>

        {/* Price + Stock row */}
        <div className="grid grid-cols-2 gap-4">
          {["Price", "Stock"].map((label) => (
            <div key={label} className="space-y-1.5">
              <div className="h-4 w-14 rounded-md bg-slate-100" />
              <div className="h-9 w-full rounded-lg bg-slate-100" />
            </div>
          ))}
        </div>

        {/* Category + Rating row */}
        <div className="grid grid-cols-2 gap-4">
          {["Category", "Rating"].map((label) => (
            <div key={label} className="space-y-1.5">
              <div className="h-4 w-16 rounded-md bg-slate-100" />
              <div className="h-9 w-full rounded-lg bg-slate-100" />
            </div>
          ))}
        </div>

        {/* Image URLs field */}
        <div className="space-y-1.5">
          <div className="h-4 w-24 rounded-md bg-slate-100" />
          <div className="h-20 w-full rounded-lg bg-slate-100" />
          <div className="h-3 w-64 rounded-md bg-slate-100" />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
          <div className="h-9 w-20 rounded-lg bg-slate-100" />
          <div className="h-9 w-32 rounded-lg bg-slate-200" />
        </div>
      </div>
    </div>
  );
}
