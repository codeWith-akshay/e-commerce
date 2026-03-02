/**
 * /admin/audit — paginated audit log viewer with filters.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Shield, ChevronLeft, ChevronRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { getAuditLogs } from "@/lib/audit";
import type { AuditAction } from "@prisma/client";

export const metadata: Metadata = { title: "Audit Log | Admin" };
export const dynamic = "force-dynamic";

const ACTION_COLORS: Record<string, string> = {
  CREATE:      "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  UPDATE:      "bg-blue-50   text-blue-700   ring-blue-600/20",
  DELETE:      "bg-red-50    text-red-700    ring-red-600/20",
  LOGIN:       "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  LOGOUT:      "bg-gray-50   text-gray-600   ring-gray-600/20",
  ROLE_CHANGE: "bg-purple-50 text-purple-700 ring-purple-600/20",
  PAYMENT:     "bg-teal-50   text-teal-700   ring-teal-600/20",
  REFUND:      "bg-amber-50  text-amber-700  ring-amber-600/20",
};

const PAGE_SIZE = 30;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN")) {
    redirect("/login");
  }

  const sp      = await searchParams;
  const page    = Math.max(1, Number(sp.page ?? 1));
  const entity  = sp.entity  || undefined;
  const action  = (sp.action as AuditAction) || undefined;

  const { logs, total } = await getAuditLogs({
    entity,
    action,
    page,
    pageSize: PAGE_SIZE,
  });

  const totalPages = Math.ceil(total / PAGE_SIZE);

  function buildHref(p: number) {
    const params = new URLSearchParams({ page: String(p) });
    if (entity) params.set("entity", entity);
    if (action) params.set("action", action);
    return `/admin/audit?${params}`;
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100">
            <Shield className="h-5 w-5 text-indigo-600" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
            <p className="text-sm text-gray-500">
              {total.toLocaleString()} total entries
            </p>
          </div>
        </div>

        {/* Filters */}
        <form className="flex flex-wrap items-center gap-2" method="GET" action="/admin/audit">
          <select
            name="entity"
            defaultValue={entity ?? ""}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All entities</option>
            {["Order", "Product", "User", "Coupon", "Review", "Inventory"].map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>

          <select
            name="action"
            defaultValue={action ?? ""}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All actions</option>
            {["CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "ROLE_CHANGE", "PAYMENT", "REFUND"].map(
              (a) => <option key={a} value={a}>{a}</option>
            )}
          </select>

          <button
            type="submit"
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            Filter
          </button>
          {(entity || action) && (
            <Link
              href="/admin/audit"
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-50"
            >
              Clear
            </Link>
          )}
        </form>
      </div>

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xs">
        {logs.length === 0 ? (
          <div className="py-16 text-center">
            <Shield className="mx-auto mb-3 h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-500">No audit log entries found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">Entity</th>
                  <th className="px-5 py-3">Entity ID</th>
                  <th className="px-5 py-3">Performed By</th>
                  <th className="px-5 py-3">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map((log) => {
                  const pill =
                    ACTION_COLORS[log.action] ??
                    "bg-gray-50 text-gray-600 ring-gray-600/20";
                  const ts = new Intl.DateTimeFormat("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(log.createdAt));

                  return (
                    <tr key={log.id} className="transition hover:bg-gray-50/60">
                      <td className="whitespace-nowrap px-5 py-3 text-xs text-gray-500">
                        {ts}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${pill}`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-medium text-gray-900">
                        {log.entity}
                      </td>
                      <td className="max-w-[140px] truncate px-5 py-3 font-mono text-xs text-gray-500">
                        {log.entityId}
                      </td>
                      <td className="px-5 py-3">
                        <div className="text-xs">
                          <p className="font-medium text-gray-800">
                            {log.performedBy.name ?? "—"}
                          </p>
                          <p className="text-gray-400">{log.performedBy.email}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-gray-400">
                        {log.ipAddress ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <p>
            Page {page} of {totalPages} &middot;{" "}
            {total.toLocaleString()} entries
          </p>
          <nav className="flex items-center gap-1">
            {page > 1 && (
              <Link
                href={buildHref(page - 1)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white transition hover:bg-gray-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>
            )}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p =
                totalPages <= 5
                  ? i + 1
                  : page <= 3
                    ? i + 1
                    : page >= totalPages - 2
                      ? totalPages - 4 + i
                      : page - 2 + i;
              return (
                <Link
                  key={p}
                  href={buildHref(p)}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border text-xs font-semibold transition ${
                    p === page
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-gray-200 bg-white hover:bg-gray-50"
                  }`}
                >
                  {p}
                </Link>
              );
            })}
            {page < totalPages && (
              <Link
                href={buildHref(page + 1)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white transition hover:bg-gray-50"
              >
                <ChevronRight className="h-4 w-4" />
              </Link>
            )}
          </nav>
        </div>
      )}
    </div>
  );
}
