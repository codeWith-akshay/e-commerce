"use client";

import { useRouter, usePathname } from "next/navigation";
import { useRef, useTransition } from "react";
import { Search, X, Loader2, Users, ShieldCheck, Crown, Activity, Ban, Trash2 } from "lucide-react";

interface Props {
  search: string;
  role:   string;
  status: string;
  limit:  number;
}

const ROLE_PILLS = [
  { label: "All",        value: "",          icon: <Users       className="h-3.5 w-3.5" />, base: "border-slate-200 text-slate-500",   hot: "border-indigo-500 bg-indigo-600 text-white" },
  { label: "User",       value: "USER",       icon: <Users       className="h-3.5 w-3.5" />, base: "border-slate-200 text-slate-600",   hot: "border-slate-700  bg-slate-700  text-white" },
  { label: "Admin",      value: "ADMIN",      icon: <ShieldCheck className="h-3.5 w-3.5" />, base: "border-indigo-200 text-indigo-600", hot: "border-indigo-600 bg-indigo-600 text-white" },
  { label: "SuperAdmin", value: "SUPERADMIN", icon: <Crown       className="h-3.5 w-3.5" />, base: "border-purple-200 text-purple-600", hot: "border-purple-600 bg-purple-600 text-white" },
];

const STATUS_PILLS = [
  { label: "All",     value: "",        icon: <Activity className="h-3.5 w-3.5" />, base: "border-slate-200  text-slate-500",   hot: "border-slate-700  bg-slate-700  text-white" },
  { label: "Active",  value: "active",  icon: <Activity className="h-3.5 w-3.5" />, base: "border-emerald-200 text-emerald-600", hot: "border-emerald-600 bg-emerald-600 text-white" },
  { label: "Banned",  value: "banned",  icon: <Ban      className="h-3.5 w-3.5" />, base: "border-red-200    text-red-600",     hot: "border-red-600    bg-red-600    text-white" },
  { label: "Deleted", value: "deleted", icon: <Trash2   className="h-3.5 w-3.5" />, base: "border-orange-200 text-orange-600",  hot: "border-orange-600 bg-orange-600 text-white" },
];

export default function UsersFilterForm({ search, role, status, limit }: Props) {
  const router   = useRouter();
  const pathname = usePathname();
  const formRef  = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  function buildUrl(overrides: Partial<{ search: string; role: string; status: string }>) {
    const params = new URLSearchParams();
    const s  = overrides.search  !== undefined ? overrides.search  : search;
    const r  = overrides.role    !== undefined ? overrides.role    : role;
    const st = overrides.status  !== undefined ? overrides.status  : status;
    if (s)  params.set("search", s);
    if (r)  params.set("role",   r);
    if (st) params.set("status", st);
    if (limit !== 10) params.set("limit", String(limit));
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function navigate(url: string) {
    startTransition(() => router.push(url));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    navigate(buildUrl({ search: (data.get("search") as string).trim() }));
  }

  const hasFilters = !!(search || role || status);

  return (
    <div className="space-y-3">
      {/* Search row */}
      <form ref={formRef} onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative flex-1">
          {pending
            ? <Loader2 className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 animate-spin text-slate-400" />
            : <Search  className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 text-slate-400" />
          }
          <input
            type="search"
            name="search"
            defaultValue={search}
            placeholder="Search by name or email…"
            autoComplete="off"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-9 text-sm text-slate-800 placeholder-slate-400 transition focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          {search && (
            <button
              type="button"
              onClick={() => navigate(buildUrl({ search: "" }))}
              className="absolute inset-y-0 right-2.5 my-auto flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={() => navigate(pathname)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 transition hover:border-red-300 hover:text-red-600"
          >
            <X className="h-3.5 w-3.5" />Clear
          </button>
        )}
      </form>

      {/* Role pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Role</span>
        {ROLE_PILLS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => navigate(buildUrl({ role: p.value }))}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
              role === p.value ? p.hot : p.base + " bg-white hover:bg-slate-50"
            }`}
          >
            {p.icon}{p.label}
          </button>
        ))}
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Status</span>
        {STATUS_PILLS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => navigate(buildUrl({ status: p.value }))}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
              status === p.value ? p.hot : p.base + " bg-white hover:bg-slate-50"
            }`}
          >
            {p.icon}{p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

