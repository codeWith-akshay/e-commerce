// User management loading skeleton.
// Matches app/superadmin/users/page.tsx layout:
//   header → filter bar → table card → pagination

export default function SuperAdminUsersLoading() {
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 animate-pulse">
      {/* Header */}
      <div className="space-y-1.5">
        <div className="h-7 w-44 rounded-lg bg-gray-200" />
        <div className="h-4 w-40 rounded-md bg-gray-100" />
      </div>

      {/* Filter bar */}
      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="h-9 flex-1 rounded-lg bg-gray-100" />
          <div className="h-9 w-36 rounded-lg bg-gray-100" />
          <div className="h-9 w-24 rounded-lg bg-gray-200" />
        </div>
      </div>

      {/* Table card */}
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Name", "Email", "Role", "Joined", "Actions"].map((col) => (
                  <th key={col} className="px-5 py-3.5">
                    <div className="h-3 w-16 rounded-md bg-gray-200" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {Array.from({ length: 10 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-5 py-4">
                    <div className="h-4 w-28 rounded-md bg-gray-200" />
                  </td>
                  <td className="px-5 py-4">
                    <div className="h-4 w-40 rounded-md bg-gray-100" />
                  </td>
                  <td className="px-5 py-4">
                    <div className="h-5 w-16 rounded-full bg-gray-100" />
                  </td>
                  <td className="px-5 py-4">
                    <div className="h-4 w-24 rounded-md bg-gray-100" />
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      <div className="h-7 w-16 rounded-md bg-indigo-100" />
                      <div className="h-7 w-16 rounded-md bg-amber-100" />
                      <div className="h-7 w-16 rounded-md bg-red-100" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer count */}
        <div className="border-t border-gray-100 px-5 py-3">
          <div className="h-3.5 w-40 rounded-md bg-gray-100" />
        </div>
      </div>

      {/* Pagination */}
      <div className="flex justify-center gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 w-9 rounded-lg bg-gray-100" />
        ))}
      </div>
    </div>
  );
}
