// Server Component — intentionally no "use client" directive
import { Suspense } from "react";
import NavbarClient from "./NavbarClient";
import CartCount, { CartCountPill } from "./CartCount";
import { auth } from "@/lib/auth";
import { getCategories } from "@/lib/queries/category";
import type { Role } from "@/types";

/**
 * Navbar — Server Component
 *
 * Reads the Auth.js session server-side (JWT, no DB call) to determine
 * both auth state and role. Also fetches categories directly via Prisma
 * (no HTTP round-trip) so the Products dropdown is always up-to-date.
 * Both are fetched in parallel; a failed category fetch degrades gracefully
 * to an empty list rather than breaking the whole header.
 */
export default async function Navbar() {
  const [session, categories] = await Promise.all([
    auth(),
    getCategories().catch(() => []),
  ]);

  const isLoggedIn = !!session?.user;
  const role       = (session?.user?.role ?? "USER") as Role;

  return (
    <NavbarClient
      isLoggedIn={isLoggedIn}
      role={role}
      categories={categories}
      cartCountBadge={
        isLoggedIn ? (
          <Suspense fallback={null}>
            <CartCount />
          </Suspense>
        ) : null
      }
      cartCountPill={
        isLoggedIn ? (
          <Suspense fallback={null}>
            <CartCountPill />
          </Suspense>
        ) : null
      }
    />
  );
}
