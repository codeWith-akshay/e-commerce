import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import authConfig from "@/auth.config";
import type { Role } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// Auth.js proxy instance — uses the edge-safe config (no Prisma/bcrypt).
// The JWT is read directly from the request cookie; no database calls happen.
// ─────────────────────────────────────────────────────────────────────────────

const { auth } = NextAuth(authConfig);

// ─────────────────────────────────────────────────────────────────────────────
// Security headers (applied to every response)
// ─────────────────────────────────────────────────────────────────────────────

const SECURITY_HEADERS: Record<string, string> = {
  // Prevent the page from being embedded in iframes (clickjacking protection)
  "X-Frame-Options": "DENY",
  // Prevent MIME-type sniffing
  "X-Content-Type-Options": "nosniff",
  // Control referrer information
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // Restrict browser features
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(self)",
  // Force HTTPS for 2 years (including subdomains)
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  // Basic XSS protection fallback for old browsers
  "X-XSS-Protection": "1; mode=block",
};

// ─────────────────────────────────────────────────────────────────────────────
// Route protection rules
// ─────────────────────────────────────────────────────────────────────────────

/** Routes that require the user to be authenticated (any role). */
const AUTH_ROUTES = ["/cart", "/checkout", "/orders", "/profile"];

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

function withSecurityHeaders(res: NextResponse): NextResponse {
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    res.headers.set(key, value);
  });
  return res;
}

function redirectTo(destination: string, req: NextRequest): NextResponse {
  return withSecurityHeaders(NextResponse.redirect(new URL(destination, req.url)));
}

/** Passthrough — lets the request continue, but always attaches security headers. */
function passthrough(): NextResponse {
  return withSecurityHeaders(NextResponse.next());
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

  // ── 4. All other routes — no restriction, but still add security headers ──
  return passthrough();
});

// ─────────────────────────────────────────────────────────────────────────────
// Matcher — runs only on relevant paths.
// Excludes static assets, Next.js internals, and auth API routes so they
// are never blocked by the proxy guard.
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
