import { Suspense } from "react";
import { redirect }  from "next/navigation";
import { auth }      from "@/lib/auth";
import { Role as PrismaRole } from "@prisma/client";
import prisma        from "@/lib/prisma";
import Link          from "next/link";
import Pagination    from "@/components/Pagination";
import UsersFilterForm   from "@/components/superadmin/UsersFilterForm";
import UserActionButtons from "@/components/superadmin/UserActionButtons";
import type { Role } from "@/types/user";

interface RichUser {
  id:           string;
  name:         string | null;
  email:        string;
  role:         Role;
  isActive:     boolean;
  isBanned:     boolean;
  bannedReason: string | null;
  lastLoginAt:  Date | null;
  createdAt:    Date;
  updatedAt:    Date;
  _count:       { orders: number };
}

interface EnrichedPageResult {
  users:       RichUser[];
  currentPage: number;
  totalPages:  number;
  totalUsers:  number;
  stats:       { total: number; active: number; banned: number; admins: number };
}
import {
  Users, ShieldCheck, Ban, Crown, Activity, UserPlus,
  CheckCircle2, XCircle, Clock, ChevronLeft,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  USER:       { label: "User",       cls: "bg-slate-100  text-slate-600  ring-slate-300/40",  icon: <Users       className="h-3 w-3" /> },
  ADMIN:      { label: "Admin",      cls: "bg-indigo-100 text-indigo-700 ring-indigo-300/40", icon: <ShieldCheck className="h-3 w-3" /> },
  SUPERADMIN: { label: "SuperAdmin", cls: "bg-purple-100 text-purple-700 ring-purple-300/40", icon: <Crown       className="h-3 w-3" /> },
};

function fmtDate(date: string | Date) {
  return new Date(date).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

function fmtDateTime(date: string | Date | null) {
  if (!date) return null;
  return new Date(date).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
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
  status: string;
}): Promise<EnrichedPageResult> {
  const { page, limit, search, role, status } = params;
  const skip = (page - 1) * limit;

  const roleFilter: PrismaRole | undefined =
    role && VALID_ROLES.has(role) ? (role as PrismaRole) : undefined;

  const where = {
    ...(search && {
      OR: [
        { email: { contains: search, mode: "insensitive" as const } },
        { name:  { contains: search, mode: "insensitive" as const } },
      ],
    }),
    ...(roleFilter && { role: roleFilter }),
    ...(status === "banned"  && { isBanned: true }),
    ...(status === "active"  && { isBanned: false, isActive: true }),
    ...(status === "deleted" && { deletedAt: { not: null } }),
    ...(status !== "deleted" && { deletedAt: null }),
  };

  const [rawUsers, totalUsers, stats] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id:          true,
        name:        true,
        email:       true,
        role:        true,
        isActive:    true,
        isBanned:    true,
        bannedReason:true,
        lastLoginAt: true,
        createdAt:   true,
        updatedAt:   true,
        _count: { select: { orders: true } },
      },
    }),
    prisma.user.count({ where }),
    Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { isBanned: false, isActive: true, deletedAt: null } }),
      prisma.user.count({ where: { isBanned: true, deletedAt: null } }),
      prisma.user.count({ where: { role: { in: ["ADMIN", "SUPERADMIN"] }, deletedAt: null } }),
    ]),
  ]);

  const [total, active, banned, admins] = stats;

  return {
    users:       rawUsers.map((u) => ({ ...u, role: u.role as Role })),
    currentPage: page,
    totalPages:  Math.ceil(totalUsers / limit),
    totalUsers,
    stats:       { total, active, banned, admins },
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
  const status = (resolved.status ?? "").toLowerCase();

  // ── 3. Fetch data ──────────────────────────────────────────────────────────
  let data: EnrichedPageResult;
  let fetchError: string | null = null;

  try {
    data = await getUsers({ page, limit, search, role, status });
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Unexpected error.";
    data = { users: [], currentPage: 1, totalPages: 1, totalUsers: 0, stats: { total: 0, active: 0, banned: 0, admins: 0 } };
  }

  const { users, currentPage, totalPages, totalUsers } = data;
  const statsBar = data.stats;

  // ── 4. Preserved search params for pagination ──────────────────────────────
  const preservedParams: Record<string, string | undefined> = {
    ...(search && { search }),
    ...(role   && { role }),
    ...(status && { status }),
    ...(limit !== 10 && { limit: String(limit) }),
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/superadmin" className="mb-1 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-600 transition">
            <ChevronLeft className="h-3.5 w-3.5" />Dashboard
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">User Management</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {totalUsers > 0 ? `${totalUsers} user${totalUsers !== 1 ? "s" : ""} matching filters` : "No users found"}
          </p>
        </div>
      </div>

      {/* Stats pills ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([
          { label: "Total Users",   value: statsBar.total,  icon: <Users       className="h-4 w-4 text-indigo-500" />, cls: "border-indigo-100 bg-indigo-50/50" },
          { label: "Active",        value: statsBar.active, icon: <Activity    className="h-4 w-4 text-emerald-500" />, cls: "border-emerald-100 bg-emerald-50/50" },
          { label: "Banned",        value: statsBar.banned, icon: <Ban         className="h-4 w-4 text-red-500" />, cls: "border-red-100 bg-red-50/50" },
          { label: "Admins & SA",   value: statsBar.admins, icon: <ShieldCheck className="h-4 w-4 text-violet-500" />, cls: "border-violet-100 bg-violet-50/50" },
        ] as const).map((s) => (
          <div key={s.label} className={`flex items-center gap-3 rounded-2xl border p-3.5 ${s.cls}`}>
            {s.icon}
            <div>
              <p className="text-lg font-bold text-slate-800">{s.value.toLocaleString("en-IN")}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar ── */}
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <Suspense fallback={null}>
          <UsersFilterForm search={search} role={role} status={status} limit={limit} />
        </Suspense>
      </div>

      {/* Error banner ── */}
      {fetchError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {fetchError}
        </div>
      )}

      {/* Table ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3.5">User</th>
                <th className="px-5 py-3.5">Role</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Orders</th>
                <th className="px-5 py-3.5">Last Login</th>
                <th className="px-5 py-3.5">Joined</th>
                <th className="px-5 py-3.5">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-50">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <UserPlus className="mx-auto mb-2 h-8 w-8 text-slate-200" />
                    <p className="text-sm text-slate-400">No users match your filters.</p>
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const roleCfg    = ROLE_CONFIG[user.role] ?? ROLE_CONFIG.USER;
                  const isBanned   = user.isBanned;
                  const isActive   = user.isActive;
                  const lastLogin  = user.lastLoginAt;
                  const orderCount = user._count;
                  return (
                  <tr key={user.id} className={`transition-colors hover:bg-slate-50/60 ${
                    isBanned ? "bg-red-50/30" : ""
                  }`}>

                    {/* User col */}
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-indigo-400 to-violet-500 text-xs font-bold text-white">
                          {(user.name ?? user.email).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-800">{user.name ?? "—"}</p>
                          <p className="truncate text-xs text-slate-400">{user.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role badge */}
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${roleCfg.cls}`}>
                        {roleCfg.icon}
                        {roleCfg.label}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="whitespace-nowrap px-5 py-3.5">
                      {isBanned ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-inset ring-red-200">
                          <XCircle className="h-3 w-3" />Banned
                        </span>
                      ) : isActive ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                          <CheckCircle2 className="h-3 w-3" />Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-inset ring-slate-200">
                          Inactive
                        </span>
                      )}
                    </td>

                    {/* Orders */}
                    <td className="whitespace-nowrap px-5 py-3.5 text-center">
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                        {orderCount?.orders ?? 0}
                      </span>
                    </td>

                    {/* Last login */}
                    <td className="whitespace-nowrap px-5 py-3.5 text-xs text-slate-400">
                      {lastLogin ? (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {fmtDateTime(lastLogin)}
                        </span>
                      ) : (
                        <span className="text-slate-300">Never</span>
                      )}
                    </td>

                    {/* Joined */}
                    <td className="whitespace-nowrap px-5 py-3.5 text-xs text-slate-400">
                      {fmtDate(user.createdAt)}
                    </td>

                    {/* Actions */}
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <UserActionButtons
                        userId={user.id}
                        userRole={user.role as Role}
                        userName={user.name ?? user.email}
                        isBanned={isBanned ?? false}
                      />
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {users.length > 0 && (
          <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
            Showing {(currentPage - 1) * limit + 1}–{Math.min(currentPage * limit, totalUsers)} of {totalUsers} users
          </div>
        )}
      </div>

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

