"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  Search,
  Menu,
  X,
  User,
  ShoppingCart,
  ChevronDown,
  Package,
  Heart,
  LogIn,
  LogOut,
} from "lucide-react";
import type { NavLink, Role } from "@/types";
import type { CategoryItem } from "@/lib/queries/category";
import { logoutAction } from "@/lib/actions/auth";
import SearchBar from "@/components/SearchBar";

// ─────────────────────────────────────────────────────────────────────────────
// Static nav structure — children for "Products" are populated dynamically
// from the `categories` prop (fetched server-side via Prisma).
// ─────────────────────────────────────────────────────────────────────────────

const BASE_NAV_LINKS: Omit<NavLink, "children">[] = [
  { label: "Products", href: "/products" },
  { label: "Deals",    href: "/deals" },
  { label: "New Arrivals", href: "/new-arrivals" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface NavbarClientProps {
  /** Pre-rendered server badge for the desktop cart icon (absolute-positioned circle). */
  cartCountBadge?: React.ReactNode;
  /** Pre-rendered server badge for the mobile cart link (inline pill). */
  cartCountPill?: React.ReactNode;
  /** Whether a user session exists (set by the server component). */
  isLoggedIn?: boolean;
  /** Role from the JWT session — drives conditional link visibility. */
  role?: Role;
  /** Promotional announcement text */
  announcement?: string;
  /**
   * Categories fetched server-side by the Navbar Server Component.
   * Populates the Products dropdown — no hardcoded list, always in sync with the DB.
   */
  categories?: CategoryItem[];
}

// ─────────────────────────────────────────────────────────────────────────────
// NavbarClient
// ─────────────────────────────────────────────────────────────────────────────

export default function NavbarClient({
  cartCountBadge,
  cartCountPill,
  isLoggedIn = false,
  role,
  announcement = "🎉 Free shipping on orders over $50 · Use code WELCOME10 for 10% off",
  categories = [],
}: NavbarClientProps) {
  const isAdmin      = role === "ADMIN" || role === "SUPERADMIN";
  const isSuperAdmin = role === "SUPERADMIN";

  // Build nav links dynamically — Products dropdown children come from the DB.
  const navLinks = useMemo<NavLink[]>(
    () =>
      BASE_NAV_LINKS.map((link) => {
        if (link.label === "Products") {
          return {
            ...link,
            children:
              categories.length > 0
                ? categories.map((cat) => ({
                    label: cat.name,
                    href:  `/products?category=${encodeURIComponent(cat.name)}`,
                  }))
                : undefined, // no children → plain link (no dropdown)
          };
        }
        return link;
      }),
    [categories],
  );
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const dropdownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Scroll shadow ──────────────────────────────────────────────────────────
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── Close mobile menu on viewport resize (lg+) ────────────────────────────
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── Auto-focus mobile search ───────────────────────────────────────────────
  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  // ── Lock body scroll when drawer open ─────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // ── Dropdown hover helpers ─────────────────────────────────────────────────
  const handleDropdownEnter = useCallback((label: string) => {
    if (dropdownTimer.current) clearTimeout(dropdownTimer.current);
    setActiveDropdown(label);
  }, []);

  const handleDropdownLeave = useCallback(() => {
    dropdownTimer.current = setTimeout(() => setActiveDropdown(null), 150);
  }, []);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Sticky header ── */}
      <header
        className={`sticky top-0 z-50 w-full bg-white transition-shadow duration-300 ${
          scrolled ? "shadow-md" : "border-b border-gray-100"
        }`}
      >
        {/* Announcement bar */}
        <div className="bg-indigo-600 py-1.5 text-center text-xs font-medium text-white tracking-wide">
          {announcement}
        </div>

        {/* Main nav row */}
        <nav
          aria-label="Primary navigation"
          className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6"
        >
          {/* ── Logo ── */}
          <Link
            href="/"
            onClick={closeMobile}
            className="flex shrink-0 items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded-md"
            aria-label="ShopNest — home"
          >
            <ShoppingBag
              className="h-7 w-7 text-indigo-600"
              strokeWidth={2}
              aria-hidden="true"
            />
            <span className="text-xl font-extrabold tracking-tight text-gray-900 select-none">
              Shop<span className="text-indigo-600">Nest</span>
            </span>
          </Link>

          {/* ── Desktop search ── */}
          <div className="hidden flex-1 max-w-xl lg:block">
            <SearchBar
              inputId="desktop-search"
              className="w-full"
            />
          </div>

          {/* ── Desktop nav links ── */}
          <ul className="hidden items-center gap-0.5 lg:flex" role="menubar">
            {navLinks.map((link) =>
              link.children ? (
                <li
                  key={link.label}
                  className="relative"
                  role="none"
                  onMouseEnter={() => handleDropdownEnter(link.label)}
                  onMouseLeave={handleDropdownLeave}
                >
                  <button
                    role="menuitem"
                    aria-haspopup="true"
                    aria-expanded={activeDropdown === link.label}
                    className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    {link.label}
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform duration-200 ${
                        activeDropdown === link.label ? "rotate-180" : ""
                      }`}
                      aria-hidden="true"
                    />
                  </button>

                  {/* Dropdown */}
                  {activeDropdown === link.label && (
                    <div
                      role="menu"
                      className="absolute left-0 top-full mt-1 w-52 rounded-xl border border-gray-100 bg-white py-2 shadow-lg ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-150"
                      onMouseEnter={() => handleDropdownEnter(link.label)}
                      onMouseLeave={handleDropdownLeave}
                    >
                      {link.children?.map((child) => (
                        <Link
                          key={child.label}
                          href={child.href}
                          role="menuitem"
                          className="block px-4 py-2 text-sm text-gray-700 transition hover:bg-indigo-50 hover:text-indigo-600 focus-visible:outline-none focus-visible:bg-indigo-50"
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </li>
              ) : (
                <li key={link.label} role="none">
                  <Link
                    href={link.href}
                    role="menuitem"
                    className="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    {link.label}
                  </Link>
                </li>
              )
            )}

            {/* ── Role-gated desktop nav links ── */}
            {isAdmin && (
              <li role="none">
                <Link
                  href="/admin"
                  role="menuitem"
                  className="block rounded-md px-3 py-2 text-sm font-medium text-amber-600 transition hover:bg-amber-50 hover:text-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  Admin
                </Link>
              </li>
            )}
            {isSuperAdmin && (
              <li role="none">
                <Link
                  href="/superadmin"
                  role="menuitem"
                  className="block rounded-md px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                >
                  SuperAdmin
                </Link>
              </li>
            )}
          </ul>

          {/* ── Right action group ── */}
          <div className="flex items-center gap-0.5">
            {/* Mobile search toggle */}
            <button
              aria-label="Toggle search"
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((p) => !p)}
              className="rounded-full p-2 text-gray-600 transition hover:bg-gray-100 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 lg:hidden"
            >
              <Search className="h-5 w-5" aria-hidden="true" />
            </button>

            {/* Wishlist */}
           

            {/* Cart — only shown when authenticated */}
            {isLoggedIn && (
              <Link
                href="/cart"
                aria-label="Shopping cart"
                className="relative rounded-full p-2 text-gray-600 transition hover:bg-gray-100 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <ShoppingCart className="h-5 w-5" aria-hidden="true" />
                {cartCountBadge}
              </Link>
            )}

            {/* Auth — desktop */}
            {isLoggedIn ? (
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="hidden items-center gap-1.5 rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 sm:inline-flex"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Logout
                </button>
              </form>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 sm:inline-flex"
                >
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                  Login
                </Link>
                {/* Mobile icon */}
                <Link
                  href="/login"
                  aria-label="Login"
                  className="rounded-full p-2 text-gray-600 transition hover:bg-gray-100 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 sm:hidden"
                >
                  <User className="h-5 w-5" aria-hidden="true" />
                </Link>
              </>
            )}

            {/* Hamburger */}
            <button
              aria-label={mobileOpen ? "Close menu" : "Open navigation menu"}
              aria-expanded={mobileOpen}
              aria-controls="mobile-drawer"
              onClick={() => setMobileOpen((p) => !p)}
              className="rounded-full p-2 text-gray-600 transition hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 lg:hidden"
            >
              {mobileOpen ? (
                <X className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Menu className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </nav>

        {/* ── Mobile expandable search ── */}
        <div
          className={`overflow-hidden border-t border-gray-100 bg-white transition-all duration-300 ease-in-out lg:hidden ${
            searchOpen ? "max-h-24 py-2.5 opacity-100" : "max-h-0 py-0 opacity-0"
          }`}
        >
          <div className="mx-4">
            <SearchBar
              inputId="mobile-search"
              inputRef={searchRef}
              className="w-full"
              placeholder="Search products…"
            />
          </div>
        </div>
      </header>

      {/* ── Mobile drawer backdrop ── */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={closeMobile}
      />

      {/* ── Mobile slide-in drawer ── */}
      <aside
        id="mobile-drawer"
        aria-label="Mobile navigation"
        aria-hidden={!mobileOpen}
        className={`fixed inset-y-0 right-0 z-50 flex w-80 max-w-[calc(100vw-3rem)] flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out lg:hidden ${
          mobileOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <Link href="/" className="flex items-center gap-2" onClick={closeMobile}>
            <ShoppingBag className="h-6 w-6 text-indigo-600" aria-hidden="true" />
            <span className="text-lg font-extrabold text-gray-900 select-none">
              Shop<span className="text-indigo-600">Nest</span>
            </span>
          </Link>
          <button
            onClick={closeMobile}
            aria-label="Close navigation menu"
            className="rounded-full p-1.5 text-gray-500 transition hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Drawer nav links */}
        <nav
          className="flex-1 overflow-y-auto px-4 py-4"
          aria-label="Mobile navigation links"
        >
          <ul className="space-y-0.5">
            {navLinks.map((link) =>
              link.children ? (
                <li key={link.label}>
                  <p className="mb-1 mt-4 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    {link.label}
                  </p>
                  {link.children.map((child) => (
                    <Link
                      key={child.label}
                      href={child.href}
                      onClick={closeMobile}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-gray-700 transition hover:bg-indigo-50 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    >
                      <Package
                        className="h-4 w-4 shrink-0 text-gray-400"
                        aria-hidden="true"
                      />
                      {child.label}
                    </Link>
                  ))}
                </li>
              ) : (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    onClick={closeMobile}
                    className="flex items-center rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-indigo-50 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    {link.label}
                  </Link>
                </li>
              )
            )}
          </ul>
        </nav>

        {/* Drawer footer CTAs */}
        <div className="border-t border-gray-100 px-4 py-4 space-y-2">
          {/* Cart — only shown when authenticated */}
          {isLoggedIn && (
            <Link
              href="/cart"
              onClick={closeMobile}
              className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-indigo-50 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <span className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                My Cart
              </span>
              {cartCountPill}
            </Link>
          )}

          <Link
            href="/wishlist"
            onClick={closeMobile}
            className="flex items-center gap-2 rounded-xl bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-indigo-50 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <Heart className="h-4 w-4" aria-hidden="true" />
            Wishlist
          </Link>

          {/* Role-gated mobile links */}
          {isAdmin && (
            <Link
              href="/admin"
              onClick={closeMobile}
              className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              Admin Panel
            </Link>
          )}
          {isSuperAdmin && (
            <Link
              href="/superadmin"
              onClick={closeMobile}
              className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
            >
              SuperAdmin Panel
            </Link>
          )}

          {isLoggedIn ? (
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Logout
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              onClick={closeMobile}
              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Login / Sign Up
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
