import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import type { Role } from "@prisma/client";
import authConfig from "@/auth.config";

// ─────────────────────────────────────────────────────────────────────────────
// Full server-side Auth.js configuration
//
// Extends the edge-safe authConfig (session strategy, callbacks, pages) and
// adds the Credentials provider with its Prisma + bcrypt authorize callback.
// This file must only be imported in server-side code (Server Components,
// Server Actions, Route Handlers) — never in middleware.ts.
// ─────────────────────────────────────────────────────────────────────────────

// Re-export type augmentation so it applies project-wide from this module too
export type { Role };

// ─────────────────────────────────────────────────────────────────────────────
// How long a JWT role is trusted before we re-check it against the DB.
// Middleware uses the stale value (edge can't hit Prisma), but all server-side
// auth() calls will refresh within this window.
// ─────────────────────────────────────────────────────────────────────────────
const ROLE_REFRESH_INTERVAL_MS = 60 * 60 * 1_000; // 1 hour

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  // Trust the host derived from the incoming request (required in production
  // and on self-hosted / containerised deployments where AUTH_URL may not
  // exactly match every reverse-proxy header). Auth.js still validates the
  // SECRET, so forged tokens are still rejected.
  trustHost: true,

  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        const email    = (credentials?.email    as string | undefined)?.trim().toLowerCase() ?? "";
        const password = (credentials?.password as string | undefined) ?? "";

        if (!email || !password) return null;

        // ── Wrap everything in try/catch ──────────────────────────────────
        // Auth.js v5 silently converts *any* uncaught exception from
        // authorize() into a generic CredentialsSignin error, making the
        // true cause invisible. We catch here, log the real error server-side
        // (without exposing credentials), and return null so Auth.js gets a
        // clean "invalid credentials" signal.
        try {
          const user = await prisma.user.findUnique({
            where:  { email },
            select: { id: true, name: true, email: true, password: true, role: true },
          });

          if (!user) return null;

          // Guard: bcrypt.compare throws (not returns false) when the second
          // argument is empty or not a valid bcrypt hash string.  Return null
          // explicitly rather than letting the throw bubble up to Auth.js.
          if (!user.password) {
            console.error("[authorize] User account has no password hash — id:", user.id);
            return null;
          }

          const valid = await bcrypt.compare(password, user.password);
          if (!valid) return null;

          // Return only safe fields — never the hashed password
          return {
            id:    user.id,
            name:  user.name,
            email: user.email,
            role:  user.role,
          };
        } catch (err) {
          // Surface the real error in server logs so the actual cause
          // (DB connection failure, malformed hash, bcrypt library issue, …)
          // is always visible — without leaking any credential data.
          console.error(
            "[authorize] Unexpected error during authentication:",
            err instanceof Error ? err.message : err,
          );
          return null;
        }
      },
    }),
  ],

  // ─── Server-side callback overrides ────────────────────────────────────────
  // These run only via lib/auth.ts (Node.js runtime, Prisma available).
  // middleware.ts uses NextAuth(authConfig) separately — it gets the lean
  // edge-safe callbacks from auth.config.ts with no DB access.
  callbacks: {
    async jwt({ token, user }) {
      // ── Initial sign-in: populate token from the freshly-authorized user ──
      if (user) {
        token.id          = user.id as string;
        token.role        = user.role;
        token.refreshedAt = Date.now();
        return token;
      }

      // ── Periodic DB role refresh ──────────────────────────────────────────
      // Re-fetch the user's role if the cached value is older than the refresh
      // interval. This ensures that role changes (promote / demote / deletion)
      // propagate to all server-side auth() calls within at most one hour.
      const lastRefresh = typeof token.refreshedAt === "number" ? token.refreshedAt : 0;
      if (Date.now() - lastRefresh > ROLE_REFRESH_INTERVAL_MS) {
        const dbUser = await prisma.user.findUnique({
          where:  { id: token.id as string },
          select: { role: true },
        });

        if (!dbUser) {
          // User was deleted — returning null forces an immediate sign-out.
          // Auth.js v5 treats a null return from jwt() as an invalid session.
          return null as never;
        }

        token.role        = dbUser.role;
        token.refreshedAt = Date.now();
      }

      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id   = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
});
