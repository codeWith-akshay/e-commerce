"use client";

import { useRouter, usePathname } from "next/navigation";
import { useRef } from "react";

interface Props {
  search: string;
  role: string;
  limit: number;
}

const ROLE_OPTIONS: { label: string; value: string }[] = [
  { label: "All Roles", value: "" },
  { label: "USER",       value: "USER" },
  { label: "ADMIN",      value: "ADMIN" },
];

// ─────────────────────────────────────────────────────────────────────────────
// UsersFilterForm
//
// Controlled search + role filter bar.
// On submit / change it rebuilds the URL preserving other query params and
// resets to page 1 (a new filter always starts at the first page).
// ─────────────────────────────────────────────────────────────────────────────

export default function UsersFilterForm({ search, role, limit }: Props) {
  const router   = useRouter();
  const pathname = usePathname();
  const formRef  = useRef<HTMLFormElement>(null);

  function buildUrl(overrides: Partial<{ search: string; role: string }>) {
    const params = new URLSearchParams();

    const newSearch = overrides.search ?? search;
    const newRole   = overrides.role   ?? role;

    if (newSearch) params.set("search", newSearch);
    if (newRole)   params.set("role",   newRole);
    if (limit !== 10) params.set("limit", String(limit));
    // page intentionally reset to 1 on every filter change

    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data   = new FormData(e.currentTarget);
    const search = (data.get("search") as string).trim();
    router.push(buildUrl({ search }));
  }

  function handleRoleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    router.push(buildUrl({ role: e.target.value }));
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 sm:flex-row sm:items-center"
    >
      {/* Search input ─────────────────────────────────────────────────────── */}
      <div className="relative flex-1">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
            />
          </svg>
        </span>
        <input
          type="search"
          name="search"
          defaultValue={search}
          placeholder="Search by email…"
          autoComplete="off"
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm text-gray-800 placeholder-gray-400 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
      </div>

      {/* Role filter ──────────────────────────────────────────────────────── */}
      <select
        name="role"
        value={role}
        onChange={handleRoleChange}
        className="rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-8 text-sm text-gray-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
      >
        {ROLE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Submit ───────────────────────────────────────────────────────────── */}
      <button
        type="submit"
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1"
      >
        Search
      </button>
    </form>
  );
}
