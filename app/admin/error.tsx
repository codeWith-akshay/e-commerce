"use client";

// Admin-segment error boundary.
//
// Because this file lives at app/admin/error.tsx, Next.js renders it
// INSIDE app/admin/layout.tsx — the admin sidebar stays intact and the
// user can navigate to other admin pages without a full reload.
// The root app/error.tsx would lose the admin shell entirely.

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, LayoutDashboard } from "lucide-react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AdminError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Replace with Sentry.captureException(error) or similar in production
    console.error("[Admin error boundary]", error);
  }, [error]);

  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-20 text-center">
      {/* Icon */}
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
        <AlertTriangle className="h-8 w-8" aria-hidden="true" />
      </div>

      {/* Heading */}
      <h2 className="mb-2 text-xl font-bold text-slate-800">
        Something went wrong
      </h2>

      {/* Safe message — Next.js strips server error details in production */}
      <p className="mb-6 max-w-sm text-sm text-slate-500">
        An unexpected error occurred while loading this page. You can try
        again or return to the dashboard.
      </p>

      {/* Digest — dev only, helps correlate with server logs */}
      {process.env.NODE_ENV === "development" && error.digest && (
        <p className="mb-6 rounded-lg bg-slate-100 px-4 py-2 font-mono text-xs text-slate-500">
          digest: {error.digest}
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Try again
        </button>

        <Link
          href="/admin"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
          Back to dashboard
        </Link>
      </div>
    </section>
  );
}
