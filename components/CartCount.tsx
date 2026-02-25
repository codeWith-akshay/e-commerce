// CartCount — async Server Component
//
// Queries the DB directly with Prisma (no HTTP round-trip, no client JS).
// Rendered server-side on every request; updates automatically whenever
// a cart action calls revalidatePath("/") or revalidatePath("/cart").
//
// Exports:
//   default CartCount          — renders the desktop icon badge (circle)
//   CartCountPill              — mobile drawer pill variant
//   getCartCount()             — raw async helper, re-usable by other server components

import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

// ─────────────────────────────────────────────────────────────────────────────
// Data helper — Prisma aggregate (no full row fetch)
// ─────────────────────────────────────────────────────────────────────────────

export async function getCartCount(): Promise<number> {
  try {
    const userId = await getSessionUserId();
    if (!userId) return 0;

    const { _sum } = await prisma.cart.aggregate({
      where: { userId },
      _sum: { quantity: true },
    });

    return _sum.quantity ?? 0;
  } catch {
    return 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Desktop badge  — tiny circle overlaid on the cart icon
// ─────────────────────────────────────────────────────────────────────────────

export default async function CartCount() {
  const count = await getCartCount();
  if (count === 0) return null;

  return (
    <span
      aria-hidden="true"
      className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold leading-none text-white"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile pill  — inline alongside "My Cart" label in the drawer
// ─────────────────────────────────────────────────────────────────────────────

export async function CartCountPill() {
  const count = await getCartCount();
  if (count === 0) return null;

  return (
    <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-bold text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}
