"use client";

/**
 * ReviewForm — star-rating + comment form.
 * Calls the createReview server action via useActionState.
 */

import { useActionState } from "react";
import { Star, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { createReviewFormAction } from "@/lib/actions/review";
import type { ActionResult } from "@/lib/actions/review";

interface ReviewFormProps {
  productId: string;
}

export default function ReviewForm({ productId }: ReviewFormProps) {
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(0);

  const [state, formAction, isPending] = useActionState<
    ActionResult<{ reviewId: string }> | null,
    FormData
  >(createReviewFormAction, null);

  // Once the review is submitted successfully, replace the form with a
  // persistent success message. One review per product per user anyway.
  if (state?.success) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">
        <CheckCircle2 className="h-5 w-5 shrink-0" />
        Review submitted — it will appear after moderation. Thank you!
      </div>
    );
  }

  const isError = state && !state.success;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="productId" value={productId} />
      {/* Hidden rating input — updated when user clicks a star */}
      <input type="hidden" name="rating" value={selected} />

      {/* Star picker */}
      <div>
        <p className="mb-1.5 text-sm font-medium text-gray-700">
          Your rating <span className="text-red-500">*</span>
        </p>
        <div
          className="flex gap-1"
          onMouseLeave={() => setHovered(0)}
          aria-label="Rate this product"
        >
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              aria-label={`${star} star${star > 1 ? "s" : ""}`}
              onClick={() => setSelected(star)}
              onMouseEnter={() => setHovered(star)}
              className="rounded p-0.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <Star
                className={`h-7 w-7 transition ${
                  (hovered || selected) >= star
                    ? "fill-amber-400 text-amber-400"
                    : "fill-gray-100 text-gray-300"
                }`}
                strokeWidth={1.5}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Comment */}
      <div>
        <label
          htmlFor="review-comment"
          className="mb-1.5 block text-sm font-medium text-gray-700"
        >
          Review <span className="text-red-500">*</span>
        </label>
        <textarea
          id="review-comment"
          name="body"
          rows={4}
          placeholder="Share your experience with this product…"
          className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50"
          disabled={isPending}
          minLength={10}
          maxLength={1000}
        />
      </div>

      {/* Feedback */}
      {isError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {(state as { error: string }).error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending || selected === 0}
        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Submitting…
          </>
        ) : (
          "Submit review"
        )}
      </button>

      <p className="text-xs text-gray-400">
        Reviews are moderated and will appear within 24 hours.
      </p>
    </form>
  );
}
