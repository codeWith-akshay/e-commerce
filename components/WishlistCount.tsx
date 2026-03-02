// WishlistCount — async Server Component
//
// Queries the DB directly with Prisma (no HTTP round-trip, no client JS).
// Rendered server-side on every request; updates whenever a wishlist action
// calls revalidatePath("/", "layout").
//
// Exports:
//   default WishlistCount      — desktop icon badge (absolute-positioned circle)
//   WishlistCountPill          — mobile drawer pill variant
//   getWishlistCount()         — raw async helper, re-usable by other server components

import prisma from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

// ─────────────────────────────────────────────────────────────────────────────
// Data helper
// ─────────────────────────────────────────────────────────────────────────────

export async function getWishlistCount(): Promise<number> {
  try {
    const userId = await getSessionUserId();
    if (!userId) return 0;

    return await prisma.wishlist.count({ where: { userId } });
  } catch {
    return 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Desktop badge — tiny circle overlaid on the heart icon
// ─────────────────────────────────────────────────────────────────────────────

export default async function WishlistCount() {
  const count = await getWishlistCount();
  if (count === 0) return null;

  return (
    <span
      aria-hidden="true"
      className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-pink-500 text-[10px] font-bold leading-none text-white"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile pill — inline alongside "Wishlist" label in the drawer
// ─────────────────────────────────────────────────────────────────────────────

export async function WishlistCountPill() {
  const count = await getWishlistCount();
  if (count === 0) return null;

  return (
    <span className="rounded-full bg-pink-500 px-2 py-0.5 text-xs font-bold text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}
