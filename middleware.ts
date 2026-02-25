import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import authConfig from "@/auth.config";
import type { Role } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// Auth.js middleware instance — uses the edge-safe config (no Prisma/bcrypt).
// The JWT is read directly from the request cookie; no database calls happen.
// ─────────────────────────────────────────────────────────────────────────────

const { auth } = NextAuth(authConfig);

// ─────────────────────────────────────────────────────────────────────────────
// Route protection rules
// ─────────────────────────────────────────────────────────────────────────────

/** Routes that require the user to be authenticated (any role). */
const AUTH_ROUTES = ["/cart", "/checkout"];

/** Routes that require ADMIN or SUPERADMIN. */
const ADMIN_ROUTES = ["/admin"];

/** Routes that require SUPERADMIN only. */
const SUPERADMIN_ROUTES = ["/superadmin"];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function matchesAny(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function redirectTo(destination: string, req: NextRequest): NextResponse {
  return NextResponse.redirect(new URL(destination, req.url));
}

// ─────────────────────────────────────────────────────────────────────────────
// Middleware handler
// ─────────────────────────────────────────────────────────────────────────────

/** Passthrough — lets the request continue unmodified. */
function passthrough(): NextResponse {
  return NextResponse.next();
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const role = req.auth?.user?.role as Role | undefined;
  const isAuthenticated = !!req.auth;

  // ── 1. SUPERADMIN-only routes ─────────────────────────────────────────────
  if (matchesAny(pathname, SUPERADMIN_ROUTES)) {
    if (!isAuthenticated) {
      return redirectTo(`/login?callbackUrl=${encodeURIComponent(pathname)}`, req);
    }
    if (role !== "SUPERADMIN") {
      return redirectTo("/", req);
    }
    return passthrough();
  }

  // ── 2. Admin routes (ADMIN or SUPERADMIN) ─────────────────────────────────
  if (matchesAny(pathname, ADMIN_ROUTES)) {
    if (!isAuthenticated) {
      return redirectTo(`/login?callbackUrl=${encodeURIComponent(pathname)}`, req);
    }
    if (role !== "ADMIN" && role !== "SUPERADMIN") {
      return redirectTo("/", req);
    }
    return passthrough();
  }

  // ── 3. Authenticated-only routes ──────────────────────────────────────────
  if (matchesAny(pathname, AUTH_ROUTES)) {
    if (!isAuthenticated) {
      return redirectTo(`/login?callbackUrl=${encodeURIComponent(pathname)}`, req);
    }
    return passthrough();
  }

  // ── 4. All other routes — no restriction ──────────────────────────────────
  return passthrough();
});

// ─────────────────────────────────────────────────────────────────────────────
// Matcher — runs middleware only on relevant paths.
// Excludes static assets, Next.js internals, and the auth API routes so they
// are never blocked by the middleware guard.
// ─────────────────────────────────────────────────────────────────────────────

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT the following:
     *  - _next/static  (static files)
     *  - _next/image   (image optimisation)
     *  - favicon.ico
     *  - public folder files (images, fonts, etc.)
     *  - api/auth/**   (Auth.js route handler — must never be blocked)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|api/auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
