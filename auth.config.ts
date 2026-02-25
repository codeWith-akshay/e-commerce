import Credentials from "next-auth/providers/credentials";
import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// Edge-safe Auth.js configuration
//
// This file must NOT import Prisma, bcrypt, or any Node.js-only module.
// It is shared between:
//   • middleware.ts        — runs in the Edge runtime (Vercel / Cloudflare)
//   • lib/auth.ts          — full server config that extends this with Prisma
//
// The `authorize` callback (which needs Prisma + bcrypt) lives only in
// lib/auth.ts. Middleware only reads the JWT token — it never calls authorize.
// ─────────────────────────────────────────────────────────────────────────────

declare module "next-auth" {
  interface User {
    role: Role;
  }
  interface Session {
    user: {
      id:    string;
      name:  string;
      email: string;
      role:  Role;
    };
  }
}

// Extend the JWT payload with our custom claims.
// `refreshedAt` is only written by the server-side config (lib/auth.ts);
// the edge-safe middleware reads it but never needs to write it.

const authConfig: NextAuthConfig = {
  // Credentials provider stub — authorize is intentionally absent here.
  // It is only needed during sign-in (lib/auth.ts), not during JWT reads.
  providers: [Credentials({})],

  session: {
    strategy: "jwt",
    maxAge:   30 * 24 * 60 * 60, // 30 days
  },

  callbacks: {
    // Persist id + role into the JWT on sign-in (populated in lib/auth.ts)
    async jwt({ token, user }) {
      if (user) {
        token.id   = user.id as string;
        token.role = user.role;
      }
      return token;
    },

    // Surface id + role on the session object
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id   = token.id   as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error:  "/login",
  },
};

export default authConfig;
