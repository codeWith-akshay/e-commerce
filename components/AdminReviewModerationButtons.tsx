"use client";

import { useTransition } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { moderateReview, deleteReview } from "@/lib/actions/review";

interface Props {
  reviewId: string;
}

export default function AdminReviewModerationButtons({ reviewId }: Props) {
  const [approving, startApprove] = useTransition();
  const [rejecting, startReject]  = useTransition();

  function handleApprove() {
    startApprove(async () => {
      await moderateReview(reviewId, true);
    });
  }

  function handleReject() {
    startReject(async () => {
      await deleteReview(reviewId);
    });
  }

  const busy = approving || rejecting;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleApprove}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-100 disabled:opacity-50"
      >
        {approving
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <CheckCircle2 className="h-3.5 w-3.5" />}
        Approve
      </button>
      <button
        onClick={handleReject}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 ring-1 ring-red-200 transition hover:bg-red-100 disabled:opacity-50"
      >
        {rejecting
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <XCircle className="h-3.5 w-3.5" />}
        Reject
      </button>
    </div>
  );
}
