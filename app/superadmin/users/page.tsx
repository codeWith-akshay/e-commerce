import { Suspense } from "react";
import { redirect }  from "next/navigation";
import { auth }      from "@/lib/auth";
import { Role as PrismaRole } from "@prisma/client";
import prisma        from "@/lib/prisma";
import Pagination    from "@/components/Pagination";
import UsersFilterForm   from "@/components/superadmin/UsersFilterForm";
import UserActionButtons from "@/components/superadmin/UserActionButtons";
import type { PaginatedUsersResponse, Role } from "@/types/user";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_BADGE: Record<Role, string> = {
  USER:       "bg-gray-100 text-gray-600",
  ADMIN:      "bg-indigo-100 text-indigo-700",
  SUPERADMIN: "bg-purple-100 text-purple-700",
};

function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("en-US", {
    year:  "numeric",
    month: "short",
    day:   "numeric",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Data fetcher — direct Prisma query, no HTTP round-trip
// ─────────────────────────────────────────────────────────────────────────────

const VALID_ROLES = new Set<string>(["USER", "ADMIN", "SUPERADMIN"]);

async function getUsers(params: {
  page:   number;
  limit:  number;
  search: string;
  role:   string;
}): Promise<PaginatedUsersResponse> {
  const { page, limit, search, role } = params;
  const skip = (page - 1) * limit;

  const roleFilter: PrismaRole | undefined =
    role && VALID_ROLES.has(role) ? (role as PrismaRole) : undefined;

  const where = {
    ...(search && { email: { contains: search, mode: "insensitive" as const } }),
    ...(roleFilter && { role: roleFilter }),
  };

  const [rawUsers, totalUsers] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id:        true,
        name:      true,
        email:     true,
        role:      true,
        createdAt: true,
        updatedAt: true,
        // password intentionally excluded
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users:       rawUsers.map((u) => ({ ...u, role: u.role as Role })),
    currentPage: page,
    totalPages:  Math.ceil(totalUsers / limit),
    totalUsers,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Page — Server Component
// ─────────────────────────────────────────────────────────────────────────────

type SearchParamsMap = Record<string, string | undefined>;

interface PageProps {
  searchParams?: Promise<SearchParamsMap>;
}

export const metadata = {
  title: "User Management | SuperAdmin",
};

// Maximum rows per page — prevents URL-crafted over-fetching (e.g. ?limit=9999)
const MAX_LIMIT = 50;

export default async function SuperAdminUsersPage({ searchParams }: PageProps) {
  // ── 1. Auth guard ──────────────────────────────────────────────────────────
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPERADMIN") {
    redirect("/login");
  }

  // ── 2. Parse search params ─────────────────────────────────────────────────
  const resolved: SearchParamsMap = await (searchParams ?? Promise.resolve({} as SearchParamsMap));
  const page   = Math.max(1, parseInt(resolved.page  ?? "1",  10) || 1);
  const limit  = Math.min(MAX_LIMIT, Math.max(1, parseInt(resolved.limit ?? "10", 10) || 10));
  const search = (resolved.search ?? "").trim();
  const role   = (resolved.role   ?? "").toUpperCase();

  // ── 3. Fetch data ──────────────────────────────────────────────────────────
  let data: PaginatedUsersResponse;
  let fetchError: string | null = null;

  try {
    data = await getUsers({ page, limit, search, role });
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Unexpected error.";
    data = { users: [], currentPage: 1, totalPages: 1, totalUsers: 0 };
  }

  const { users, currentPage, totalPages, totalUsers } = data;

  // ── 4. Preserved search params for pagination ──────────────────────────────
  const preservedParams: Record<string, string | undefined> = {
    ...(search && { search }),
    ...(role   && { role }),
    ...(limit !== 10 && { limit: String(limit) }),
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            User Management
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {totalUsers > 0
              ? `${totalUsers} user${totalUsers !== 1 ? "s" : ""} registered`
              : "No users found"}
          </p>
        </div>
      </div>

      {/* Filter bar ──────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <Suspense fallback={null}>
          <UsersFilterForm search={search} role={role} limit={limit} />
        </Suspense>
      </div>

      {/* Error banner ────────────────────────────────────────────────────── */}
      {fetchError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {fetchError}
        </div>
      )}

      {/* Table card ──────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-3.5">Name</th>
                <th className="px-5 py-3.5">Email</th>
                <th className="px-5 py-3.5">Role</th>
                <th className="px-5 py-3.5">Joined</th>
                <th className="px-5 py-3.5">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-50">
              {users.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-12 text-center text-gray-400"
                  >
                    No users match your filters.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-gray-50/60 transition-colors"
                  >
                    {/* Name */}
                    <td className="whitespace-nowrap px-5 py-4 font-medium text-gray-800">
                      {user.name}
                    </td>

                    {/* Email */}
                    <td className="whitespace-nowrap px-5 py-4 text-gray-500">
                      {user.email}
                    </td>

                    {/* Role badge */}
                    <td className="whitespace-nowrap px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          ROLE_BADGE[user.role] ?? ROLE_BADGE.USER
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>

                    {/* Created date */}
                    <td className="whitespace-nowrap px-5 py-4 text-gray-500">
                      {formatDate(user.createdAt)}
                    </td>

                    {/* Action buttons — Client Component island */}
                    <td className="whitespace-nowrap px-5 py-4">
                      <UserActionButtons
                        userId={user.id}
                        userRole={user.role as Role}
                        userName={user.name}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table footer — record count + per-page info */}
        {users.length > 0 && (
          <div className="border-t border-gray-100 px-5 py-3 text-xs text-gray-400">
            Showing {(currentPage - 1) * limit + 1}–
            {Math.min(currentPage * limit, totalUsers)} of {totalUsers} users
          </div>
        )}
      </div>

      {/* Pagination ──────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            basePath="/superadmin/users"
            searchParams={preservedParams}
          />
        </div>
      )}
    </div>
  );
}
