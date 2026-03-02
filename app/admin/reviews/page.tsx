import { Star, ShieldCheck, MessageSquare } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { getPendingReviews } from "@/lib/actions/review";
import AdminReviewModerationButtons from "@/components/AdminReviewModerationButtons";
import Pagination from "@/components/Pagination";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Review Moderation | Admin",
};

const PAGE_SIZE = 20;

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`h-3.5 w-3.5 ${
            s <= rating
              ? "fill-amber-400 text-amber-400"
              : "fill-gray-100 text-gray-300"
          }`}
          strokeWidth={1.5}
        />
      ))}
      <span className="ml-1.5 text-xs font-medium text-gray-600">{rating}/5</span>
    </div>
  );
}

export default async function AdminReviewsPage({ searchParams }: PageProps) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const result = await getPendingReviews(page, PAGE_SIZE);
  const reviews    = result.success ? result.data!.reviews    : [];
  const total      = result.success ? result.data!.total      : 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Review Moderation</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Approve or reject customer reviews before they appear on product pages.
          </p>
        </div>
        {total > 0 && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
            {total} pending
          </span>
        )}
      </div>

      {/* Empty state */}
      {reviews.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-20 text-center">
          <MessageSquare className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm font-semibold text-gray-600">No pending reviews</p>
          <p className="mt-1 text-xs text-gray-400">All caught up — nothing awaiting moderation.</p>
        </div>
      )}

      {/* Review cards */}
      {reviews.length > 0 && (
        <div className="space-y-4">
          {reviews.map((review) => {
            const date = new Intl.DateTimeFormat("en-US", {
              year:  "numeric",
              month: "short",
              day:   "numeric",
            }).format(new Date(review.createdAt));

            return (
              <div
                key={review.id}
                className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  {/* Left: meta */}
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StarRow rating={review.rating} />
                      {review.isVerified && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                          <ShieldCheck className="h-3 w-3" />
                          Verified purchase
                        </span>
                      )}
                    </div>

                    <Link
                      href={`/products/${review.product.id}`}
                      target="_blank"
                      className="text-sm font-semibold text-indigo-600 hover:underline"
                    >
                      {review.product.title}
                    </Link>

                    <p className="text-xs text-gray-500">
                      by <span className="font-medium text-gray-700">{review.user.name}</span>
                      {" "}·{" "}
                      <span className="text-gray-500">{review.user.email}</span>
                      {" "}·{" "}
                      {date}
                    </p>
                  </div>

                  {/* Right: actions */}
                  <AdminReviewModerationButtons reviewId={review.id} />
                </div>

                {/* Review body */}
                <div className="mt-4 space-y-1">
                  {review.title && (
                    <p className="text-sm font-semibold text-gray-900">{review.title}</p>
                  )}
                  <p className="text-sm leading-relaxed text-gray-700">{review.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination currentPage={page} totalPages={totalPages} basePath="/admin/reviews" />
      )}
    </div>
  );
}
