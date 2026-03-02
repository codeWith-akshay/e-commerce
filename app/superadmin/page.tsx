import Link from "next/link";
import prisma from "@/lib/prisma";
import {
  Users,
  ShieldCheck,
  ShieldAlert,
  Ban,
  TrendingUp,
  ShoppingCart,
  DollarSign,
  UserPlus,
  Activity,
  Crown,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dashboard | SuperAdmin" };

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);

const fmtDate = (d: Date) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

// ── Data ──────────────────────────────────────────────────────────────────────

async function getDashboardStats() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    usersByRole,
    bannedCount,
    deletedCount,
    newUsersThisMonth,
    newUsersLastMonth,
    totalOrders,
    ordersThisMonth,
    revenueAgg,
    revenueLastMonth,
    ordersByStatus,
    recentUsers,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], where: { deletedAt: null }, _count: true }),
    prisma.user.count({ where: { isBanned: true, deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: { not: null } } }),
    prisma.user.count({ where: { createdAt: { gte: startOfMonth }, deletedAt: null } }),
    prisma.user.count({ where: { createdAt: { gte: startOfLastMonth, lt: startOfMonth }, deletedAt: null } }),
    prisma.order.count(),
    prisma.order.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.order.aggregate({ _sum: { totalAmount: true } }),
    prisma.order.aggregate({ _sum: { totalAmount: true }, where: { createdAt: { gte: startOfLastMonth, lt: startOfMonth } } }),
    prisma.order.groupBy({ by: ["status"], _count: true }),
    prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, name: true, email: true, role: true, isBanned: true, createdAt: true, image: true },
    }),
  ]);

  const roleMap = Object.fromEntries(usersByRole.map((r) => [r.role, r._count]));
  const totalUsers  = (roleMap.USER ?? 0) + (roleMap.ADMIN ?? 0) + (roleMap.SUPERADMIN ?? 0);
  const totalRevenue = revenueAgg._sum.totalAmount ?? 0;
  const lastMonthRevenue = revenueLastMonth._sum.totalAmount ?? 0;
  const revenueGrowth = lastMonthRevenue > 0 ? ((totalRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : null;
  const userGrowth = newUsersLastMonth > 0 ? ((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100 : null;

  return {
    totalUsers, bannedCount, deletedCount,
    adminCount: roleMap.ADMIN ?? 0,
    superAdminCount: roleMap.SUPERADMIN ?? 0,
    newUsersThisMonth, userGrowth,
    totalOrders, ordersThisMonth,
    totalRevenue, revenueGrowth,
    ordersByStatus,
    recentUsers,
  };
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon, iconBg, trend,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; iconBg: string; trend?: number | null;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
          {icon}
        </div>
        {trend != null && (
          <span className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            trend >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
          }`}>
            <TrendingUp className={`h-3 w-3 ${trend < 0 ? "rotate-180" : ""}`} />
            {Math.abs(trend).toFixed(0)}%
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-800">{value}</p>
      <p className="mt-0.5 text-xs font-semibold text-slate-500">{label}</p>
      {sub && <p className="mt-1 text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}

const ORDER_STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  PENDING:        { label: "Pending",        cls: "bg-amber-50  text-amber-700" },
  PROCESSING:     { label: "Processing",     cls: "bg-blue-50   text-blue-700" },
  SHIPPED:        { label: "Shipped",        cls: "bg-violet-50 text-violet-700" },
  DELIVERED:      { label: "Delivered",      cls: "bg-emerald-50 text-emerald-700" },
  CANCELLED:      { label: "Cancelled",      cls: "bg-red-50    text-red-700" },
  PAYMENT_FAILED: { label: "Pay. Failed",    cls: "bg-orange-50 text-orange-700" },
  PAYMENT_LOCKED: { label: "Pay. Locked",    cls: "bg-gray-100  text-gray-600" },
};

const ROLE_CONFIG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  USER:       { label: "User",       cls: "bg-slate-100  text-slate-600",  icon: <Users     className="h-3 w-3" /> },
  ADMIN:      { label: "Admin",      cls: "bg-indigo-100 text-indigo-700", icon: <ShieldCheck className="h-3 w-3" /> },
  SUPERADMIN: { label: "SuperAdmin", cls: "bg-purple-100 text-purple-700", icon: <Crown     className="h-3 w-3" /> },
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function SuperAdminDashboard() {
  const stats = await getDashboardStats();

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 sm:p-6 lg:p-8">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">SuperAdmin Dashboard</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            System-wide overview · {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <Link
          href="/superadmin/users"
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <Users className="h-4 w-4" />
          Manage Users
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* ── KPI Grid ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <KpiCard
          label="Total Users"
          value={stats.totalUsers.toLocaleString("en-IN")}
          sub={`${stats.adminCount} admin · ${stats.superAdminCount} superadmin`}
          icon={<Users className="h-5 w-5 text-indigo-600" />}
          iconBg="bg-indigo-50"
        />
        <KpiCard
          label="New Users This Month"
          value={stats.newUsersThisMonth}
          sub="vs last month"
          icon={<UserPlus className="h-5 w-5 text-emerald-600" />}
          iconBg="bg-emerald-50"
          trend={stats.userGrowth}
        />
        <KpiCard
          label="Banned Accounts"
          value={stats.bannedCount}
          sub={`${stats.deletedCount} soft-deleted`}
          icon={<Ban className="h-5 w-5 text-red-500" />}
          iconBg="bg-red-50"
        />
        <KpiCard
          label="Total Orders"
          value={stats.totalOrders.toLocaleString("en-IN")}
          sub={`${stats.ordersThisMonth} this month`}
          icon={<ShoppingCart className="h-5 w-5 text-violet-600" />}
          iconBg="bg-violet-50"
        />
        <KpiCard
          label="Total Revenue"
          value={fmt(stats.totalRevenue)}
          sub="all time"
          icon={<DollarSign className="h-5 w-5 text-amber-600" />}
          iconBg="bg-amber-50"
          trend={stats.revenueGrowth}
        />
        <KpiCard
          label="Admins"
          value={stats.adminCount}
          sub={`${stats.superAdminCount} superadmin`}
          icon={<ShieldCheck className="h-5 w-5 text-blue-600" />}
          iconBg="bg-blue-50"
        />
        <KpiCard
          label="Active Users"
          value={(stats.totalUsers - stats.bannedCount).toLocaleString("en-IN")}
          sub="not banned"
          icon={<Activity className="h-5 w-5 text-teal-600" />}
          iconBg="bg-teal-50"
        />
        <KpiCard
          label="Deleted Accounts"
          value={stats.deletedCount}
          sub="soft-deleted"
          icon={<ShieldAlert className="h-5 w-5 text-orange-500" />}
          iconBg="bg-orange-50"
        />
      </div>

      {/* ── Bottom grid: orders breakdown + recent users ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Orders by status */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <ShoppingCart className="h-4 w-4 text-violet-500" />
            Orders by Status
          </h2>
          <div className="space-y-2.5">
            {stats.ordersByStatus.length === 0 ? (
              <p className="text-xs text-slate-400">No orders yet.</p>
            ) : (
              stats.ordersByStatus.map((row) => {
                const cfg = ORDER_STATUS_CONFIG[row.status] ?? { label: row.status, cls: "bg-gray-100 text-gray-600" };
                const pct = stats.totalOrders > 0 ? (row._count / stats.totalOrders) * 100 : 0;
                return (
                  <div key={row.status} className="flex items-center gap-3">
                    <span className={`w-24 shrink-0 rounded-full px-2 py-0.5 text-center text-[11px] font-semibold ${cfg.cls}`}>
                      {cfg.label}
                    </span>
                    <div className="flex-1 overflow-hidden rounded-full bg-slate-100 h-2">
                      <div
                        className="h-full rounded-full bg-indigo-400 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-xs font-semibold text-slate-600">{row._count}</span>
                  </div>
                );
              })
            )}
          </div>
          <div className="mt-4 border-t border-slate-100 pt-3 flex justify-between text-xs text-slate-400">
            <span>Total orders</span>
            <span className="font-semibold text-slate-600">{stats.totalOrders.toLocaleString("en-IN")}</span>
          </div>
        </div>

        {/* Recent signups */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <UserPlus className="h-4 w-4 text-emerald-500" />
              Recent Signups
            </h2>
            <Link
              href="/superadmin/users"
              className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <ul className="space-y-3">
            {stats.recentUsers.map((u) => {
              const roleCfg = ROLE_CONFIG[u.role] ?? ROLE_CONFIG.USER;
              return (
                <li key={u.id} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-indigo-400 to-violet-500 text-xs font-bold text-white">
                    {(u.name ?? u.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-700">{u.name ?? "—"}</p>
                    <p className="truncate text-xs text-slate-400">{u.email}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${roleCfg.cls}`}>
                      {roleCfg.icon}
                      {roleCfg.label}
                    </span>
                    {u.isBanned ? (
                      <span className="flex items-center gap-0.5 text-[10px] text-red-500">
                        <XCircle className="h-3 w-3" />Banned
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5 text-[10px] text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" />Active
                      </span>
                    )}
                  </div>
                  <div className="shrink-0 text-right text-[10px] text-slate-400">
                    <Clock className="mb-0.5 inline h-3 w-3" />
                    <br />
                    {fmtDate(u.createdAt)}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

