/**
 * ProductReviews — server component that renders approved reviews for a product
 * plus a client ReviewForm for logged-in users to submit new ones.
 */

import { Star, ShieldCheck } from "lucide-react";
import prisma from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import ReviewFormDynamic from "@/components/ReviewFormDynamic";

// ─────────────────────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────────────────────

async function getReviews(productId: string) {
  return prisma.review.findMany({
    where:   { productId, isApproved: true },
    orderBy: { createdAt: "desc" },
    take:    20,
    select: {
      id:         true,
      rating:     true,
      title:      true,
      body:       true,
      isVerified: true,
      createdAt:  true,
      user: { select: { name: true } },
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function ReviewStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`h-3.5 w-3.5 ${
            s <= rating ? "fill-amber-400 text-amber-400" : "fill-gray-100 text-gray-300"
          }`}
          strokeWidth={1.5}
        />
      ))}
    </div>
  );
}

function ReviewCard({
  review,
}: {
  review: Awaited<ReturnType<typeof getReviews>>[number];
}) {
  const date = new Intl.DateTimeFormat("en-US", {
    year:  "numeric",
    month: "long",
    day:   "numeric",
  }).format(new Date(review.createdAt));

  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <ReviewStars rating={review.rating} />
          {review.title && (
            <p className="text-sm font-semibold text-gray-900">{review.title}</p>
          )}
        </div>
        <div className="text-right text-xs text-gray-400">
          <p className="font-medium text-gray-600">{review.user.name ?? "Anonymous"}</p>
          <p>{date}</p>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-gray-700">{review.body}</p>
      {review.isVerified && (
        <p className="mt-3 flex items-center gap-1 text-xs font-medium text-emerald-600">
          <ShieldCheck className="h-3.5 w-3.5" />
          Verified purchase
        </p>
      )}
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default async function ProductReviews({
  productId,
}: {
  productId: string;
}) {
  const [reviews, userId] = await Promise.all([
    getReviews(productId),
    getSessionUserId(),
  ]);

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : null;

  return (
    <section className="mt-16">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Customer Reviews</h2>
          {avgRating !== null && (
            <div className="mt-1.5 flex items-center gap-2">
              <ReviewStars rating={Math.round(avgRating)} />
              <span className="text-sm text-gray-600">
                {avgRating.toFixed(1)} out of 5 ({reviews.length}{" "}
                {reviews.length === 1 ? "review" : "reviews"})
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-start">
        {/* ── Review list ── */}
        <div className="space-y-4">
          {reviews.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-12 text-center">
              <Star className="mx-auto mb-3 h-8 w-8 text-gray-300" />
              <p className="text-sm font-medium text-gray-500">No reviews yet</p>
              <p className="mt-1 text-xs text-gray-400">
                Be the first to share your experience.
              </p>
            </div>
          ) : (
            reviews.map((r) => <ReviewCard key={r.id} review={r} />)
          )}
        </div>

        {/* ── Write a review ── */}
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-6">
          <h3 className="mb-5 text-base font-semibold text-gray-900">
            Write a review
          </h3>
          {userId ? (
            <ReviewFormDynamic productId={productId} />
          ) : (
            <p className="text-sm text-gray-500">
              <a href="/login" className="font-medium text-indigo-600 underline hover:text-indigo-500">
                Sign in
              </a>{" "}
              to leave a review.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
