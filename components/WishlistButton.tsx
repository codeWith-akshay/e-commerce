"use client";

// WishlistButton — client island with DB-backed persistence.
//
// Props:
//   productId    — product to toggle in/out of the wishlist
//   isWishlisted — initial state passed from the Server Component parent
//
// On click the button calls the toggleWishlist server action and updates
// local state optimistically. If the action fails the state is rolled back.

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { toggleWishlist } from "@/lib/actions/wishlist";

interface WishlistButtonProps {
  productId: string;
  isWishlisted?: boolean;
}

export default function WishlistButton({
  productId,
  isWishlisted = false,
}: WishlistButtonProps) {
  const [wishlisted, setWishlisted] = useState(isWishlisted);
  const [isPending, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault(); // prevent <Link> navigation when card is wrapped in one
    e.stopPropagation();

    const next = !wishlisted;
    setWishlisted(next); // optimistic

    startTransition(async () => {
      const result = await toggleWishlist(productId);

      if (!result.success) {
        setWishlisted(!next); // roll back
        console.error("[WishlistButton]", result.error);
      } else if (result.data !== undefined) {
        setWishlisted(result.data.wishlisted); // sync to DB truth
      }
    });
  }

  return (
    <button
      aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
      disabled={isPending}
      onClick={handleClick}
      className={[
        "absolute right-3 top-3 flex h-8 w-8 items-center justify-center",
        "rounded-full border bg-white/90 shadow-sm backdrop-blur-sm transition",
        "hover:scale-110 disabled:cursor-wait disabled:opacity-70",
        wishlisted
          ? "border-pink-200 text-pink-500"
          : "border-gray-200 text-gray-400 hover:text-pink-500",
      ].join(" ")}
    >
      <Heart
        className="h-4 w-4"
        fill={wishlisted ? "currentColor" : "none"}
        strokeWidth={2}
      />
    </button>
  );
}
