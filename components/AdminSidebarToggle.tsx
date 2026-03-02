"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Menu,
  X,
  LogOut,
  ChevronRight,
  ChevronDown,
  Users,
  Shield,
  Archive,
  ClipboardList,
  ToggleLeft,
  MessageSquare,
  BarChart3,
  AlertTriangle,
  List,
  ArrowUpDown,
} from "lucide-react";
import LogoutButton from "@/components/LogoutButton";

type IconComponent = React.ComponentType<{ className?: string }>;

interface SidebarLink {
  kind: "link";
  label: string;
  href: string;
  icon: IconComponent;
}

interface SidebarGroup {
  kind: "group";
  label: string;
  icon: IconComponent;
  /** Base path — used to detect if ANY child is active. */
  basePath: string;
  children: { label: string; href: string; icon: IconComponent }[];
}

type SidebarItem = SidebarLink | SidebarGroup;

const adminLinks: SidebarItem[] = [
  { kind: "link",  label: "Dashboard",     href: "/admin",               icon: LayoutDashboard },
  { kind: "link",  label: "Products",      href: "/admin/products",      icon: Package },
  { kind: "link",  label: "Orders",        href: "/admin/orders",        icon: ShoppingCart },
  {
    kind: "group",
    label: "Inventory",
    icon: Archive,
    basePath: "/admin/inventory",
    children: [
      { label: "Overview",          href: "/admin/inventory",                  icon: BarChart3 },
      { label: "All Stock",         href: "/admin/inventory/all",              icon: List },
      { label: "Low Stock Alerts",  href: "/admin/inventory/low-stock-alerts", icon: AlertTriangle },
      { label: "Movement Log",      href: "/admin/inventory/movements",        icon: ArrowUpDown },
    ],
  },
  { kind: "link",  label: "Reviews",       href: "/admin/reviews",       icon: MessageSquare },
  { kind: "link",  label: "Audit Log",     href: "/admin/audit",         icon: ClipboardList },
  { kind: "link",  label: "Feature Flags", href: "/admin/feature-flags", icon: ToggleLeft },
];

const superAdminLinks: SidebarItem[] = [
  { kind: "link", label: "Users", href: "/superadmin/users", icon: Users },
];

const ADMIN_PAGE_TITLES: Record<string, string> = {
  "/admin":                                 "Dashboard",
  "/admin/products":                        "Products",
  "/admin/orders":                          "Orders",
  "/admin/inventory":                       "Inventory",
  "/admin/inventory/all":                   "All Stock",
  "/admin/inventory/low-stock-alerts":      "Low Stock Alerts",
  "/admin/inventory/movements":             "Movement Log",
  "/admin/reviews":                         "Reviews",
  "/admin/audit":                           "Audit Log",
  "/admin/feature-flags":                  "Feature Flags",
};

const SUPERADMIN_PAGE_TITLES: Record<string, string> = {
  "/superadmin/users": "Users",
};

const ADMIN_PAGE_SUBTITLES: Record<string, string> = {
  "/admin":                                 "Store overview & analytics",
  "/admin/products":                        "Manage your product catalogue",
  "/admin/orders":                          "Track and fulfil customer orders",
  "/admin/inventory":                       "Stock dashboard — KPIs, alerts & full table",
  "/admin/inventory/all":                   "Browse and filter all inventory records",
  "/admin/inventory/low-stock-alerts":      "Items at or below their reorder level",
  "/admin/inventory/movements":             "Full audit trail of every stock change",
  "/admin/reviews":                         "Approve or reject customer reviews",
  "/admin/audit":                           "View system-wide activity log",
  "/admin/feature-flags":                  "Toggle features without a re-deploy",
};

const SUPERADMIN_PAGE_SUBTITLES: Record<string, string> = {
  "/superadmin/users": "Manage platform users & roles",
};

/** Two-letter initials from a display name or email. */
function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ── Sidebar body ──────────────────────────────────────────────────────────────
function SidebarBody({
  adminName,
  pathname,
  onClose,
}: {
  adminName: string;
  pathname: string;
  onClose: () => void;
}) {
  const isSuperAdmin = pathname.startsWith("/superadmin");
  const links = isSuperAdmin ? superAdminLinks : adminLinks;
  const panelLabel = isSuperAdmin ? "Super Admin" : "Admin Panel";
  const roleLabel  = isSuperAdmin ? "Super Administrator" : "Administrator";

  // Track which groups are expanded.
  // Auto-open any group whose basePath matches the current URL.
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const item of adminLinks) {
      if (item.kind === "group" && pathname.startsWith(item.basePath)) {
        initial.add(item.label);
      }
    }
    return initial;
  });

  function toggleGroup(label: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  }

  return (
    <div className="flex h-full flex-col">
      {/* ── Brand ── */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-5">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg shadow-lg ${
          isSuperAdmin
            ? "bg-violet-500 shadow-violet-500/40"
            : "bg-indigo-500 shadow-indigo-500/40"
        }`}>
          {isSuperAdmin
            ? <Shield className="h-4 w-4 text-white" />
            : <ShoppingCart className="h-4 w-4 text-white" />}
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold tracking-tight text-white">
            Shop<span className={isSuperAdmin ? "text-violet-300" : "text-indigo-300"}>Nest</span>
          </p>
          <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400">
            {panelLabel}
          </p>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-5">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Navigation
        </p>

        {links.map((item) => {
          // ── Simple link ──────────────────────────────────────────────────
          if (item.kind === "link") {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                  active
                    ? "bg-indigo-500/20 text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-indigo-400" />
                )}
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  active
                    ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/30"
                    : "bg-white/5 text-slate-400 group-hover:bg-white/10 group-hover:text-slate-200"
                }`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="flex-1">{item.label}</span>
                {active && <ChevronRight className="h-3.5 w-3.5 text-indigo-400" />}
              </Link>
            );
          }

          // ── Accordion group ───────────────────────────────────────────────
          const groupActive = pathname.startsWith(item.basePath);
          const isOpen      = openGroups.has(item.label);
          const GroupIcon   = item.icon;

          return (
            <div key={item.label}>
              {/* Group toggle button */}
              <button
                type="button"
                onClick={() => toggleGroup(item.label)}
                className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                  groupActive
                    ? "bg-indigo-500/20 text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
                aria-expanded={isOpen}
              >
                {groupActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-indigo-400" />
                )}
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  groupActive
                    ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/30"
                    : "bg-white/5 text-slate-400 group-hover:bg-white/10 group-hover:text-slate-200"
                }`}>
                  <GroupIcon className="h-3.5 w-3.5" />
                </span>
                <span className="flex-1 text-left">{item.label}</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${
                  isOpen ? "rotate-180 text-indigo-400" : "text-slate-500"
                }`} />
              </button>

              {/* Children — animated expand/collapse */}
              <div className={`overflow-hidden transition-all duration-200 ease-in-out ${
                isOpen ? "max-h-64 opacity-100" : "max-h-0 opacity-0"
              }`}>
                <div className="ml-3 mt-0.5 flex flex-col gap-0.5 border-l border-white/10 pl-3 pb-1">
                  {item.children.map((child) => {
                    const childActive =
                      child.href === item.basePath
                        ? pathname === item.basePath
                        : pathname === child.href || pathname.startsWith(child.href + "/");
                    const ChildIcon = child.icon;
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={onClose}
                        className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                          childActive
                            ? "bg-indigo-500/25 text-white"
                            : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                        }`}
                        aria-current={childActive ? "page" : undefined}
                      >
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors ${
                          childActive
                            ? "bg-indigo-500 text-white shadow-sm shadow-indigo-500/30"
                            : "bg-white/5 text-slate-500 group-hover:bg-white/10 group-hover:text-slate-300"
                        }`}>
                          <ChildIcon className="h-3 w-3" />
                        </span>
                        <span className="flex-1">{child.label}</span>
                        {childActive && <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* ── User block ── */}
      <div className="shrink-0 border-t border-white/10 p-3">
        <div className="mb-2 flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5">
          {/* Avatar */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-indigo-400 to-violet-500 text-xs font-bold text-white shadow-md">
            {initials(adminName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-slate-200">{adminName}</p>
          <p className="text-[10px] text-slate-500">{roleLabel}</p>
          </div>
        </div>
        <LogoutButton className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-400 transition-all hover:bg-red-500/10 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400">
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </LogoutButton>
      </div>
    </div>
  );
}

interface Props {
  adminName: string;
  children: React.ReactNode;
}

export default function AdminSidebarToggle({ adminName, children }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const close = useCallback(() => setOpen(false), []);
  const isSuperAdmin = pathname.startsWith("/superadmin");
  const pageTitlesMap    = isSuperAdmin ? SUPERADMIN_PAGE_TITLES    : ADMIN_PAGE_TITLES;
  const pageSubtitlesMap = isSuperAdmin ? SUPERADMIN_PAGE_SUBTITLES : ADMIN_PAGE_SUBTITLES;
  const pageTitle    = pageTitlesMap[pathname]    ?? (isSuperAdmin ? "SuperAdmin" : "Admin");
  const pageSubtitle = pageSubtitlesMap[pathname] ?? "";

  // Breadcrumb segments (skip empty first element from leading slash)
  const breadcrumbs = pathname
    .split("/")
    .filter(Boolean)
    .map((seg, i, arr) => ({
      label: seg.charAt(0).toUpperCase() + seg.slice(1),
      href:  "/" + arr.slice(0, i + 1).join("/"),
    }));

  return (
    // Outer: standard flex row, min full viewport height so sidebar background
    // always fills to the bottom even on short-content pages.
    <div className="flex w-full min-h-screen bg-slate-100">

      {/* ════════ Desktop sidebar ════════
           sticky + h-screen: stays in view as the page body scrolls.
           overflow-y-auto: sidebar itself scrolls if links overflow. */}
      <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col sticky top-0 h-screen overflow-y-auto bg-linear-to-b from-slate-900 via-slate-900 to-slate-800 shadow-xl shadow-black/20">
        <SidebarBody adminName={adminName} pathname={pathname} onClose={close} />
      </aside>

      {/* ════════ Mobile backdrop ════════ */}
      <div
        className={`fixed inset-0 z-20 bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={close}
        aria-hidden="true"
      />

      {/* ════════ Mobile drawer ════════ */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col bg-linear-to-b from-slate-900 via-slate-900 to-slate-800 shadow-2xl transition-transform duration-300 ease-in-out lg:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Navigation sidebar"
      >
        {/* Close button */}
        <button
          onClick={close}
          className="absolute right-3 top-3.5 z-10 rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5" />
        </button>
        <SidebarBody adminName={adminName} pathname={pathname} onClose={close} />
      </aside>

      {/* ════════ Main column ════════ */}
      <div className="flex flex-1 flex-col min-w-0">

        {/* ── Top header ── */}
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-slate-200/80 bg-white px-4 sm:px-6 shadow-sm">

          {/* Left side */}
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {/* Hamburger */}
            <button
              onClick={() => setOpen(true)}
              className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 lg:hidden"
              aria-label="Open navigation sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Breadcrumbs (md+) / page title (sm) */}
            <div className="min-w-0">
              <div className="hidden items-center gap-1 text-sm md:flex">
                {breadcrumbs.map((crumb, i) => (
                  <span key={crumb.href} className="flex items-center gap-1">
                    {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />}
                    {i === breadcrumbs.length - 1 ? (
                      <span className="font-semibold text-slate-800">{crumb.label}</span>
                    ) : (
                      <Link
                        href={crumb.href}
                        className="text-slate-400 transition hover:text-slate-600"
                      >
                        {crumb.label}
                      </Link>
                    )}
                  </span>
                ))}
              </div>
              <p className="block truncate text-base font-semibold text-slate-800 md:hidden">
                {pageTitle}
              </p>
              {pageSubtitle && (
                <p className="hidden truncate text-xs text-slate-400 sm:block">
                  {pageSubtitle}
                </p>
              )}
            </div>
          </div>

          {/* Right side */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {/* Avatar + name */}
            <div className="hidden items-center gap-2.5 sm:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-indigo-400 to-violet-500 text-xs font-bold text-white shadow-sm">
                {initials(adminName)}
              </div>
              <div className="hidden leading-tight lg:block">
                <p className="text-xs font-semibold text-slate-700">{adminName}</p>
                <p className="text-[10px] text-slate-400">{isSuperAdmin ? "Super Administrator" : "Administrator"}</p>
              </div>
            </div>

            {/* Divider */}
            <div className="hidden h-6 w-px bg-slate-200 sm:block" />

            {/* Logout */}
            <LogoutButton className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400">
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </LogoutButton>
          </div>
        </header>

        {/* ── Page content ── */}
        <main className="flex-1">
          {/* Decorative top accent bar */}
          <div className="h-1 w-full bg-linear-to-r from-indigo-500 via-violet-500 to-pink-500" />
          <div className="p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
