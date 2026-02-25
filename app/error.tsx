"use client";

// Error boundary for the root route segment.
// Next.js requires this to be a Client Component.

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

interface ErrorProps {
  /** The error that was thrown */
  error: Error & { digest?: string };
  /** Call this to re-render the segment (equivalent to a soft refresh) */
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log to your error reporting service (e.g. Sentry) here
    console.error("[Error boundary]", error);
  }, [error]);

  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-24 text-center">
      {/* Icon */}
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-50 text-red-500">
        <AlertTriangle className="h-10 w-10" aria-hidden="true" />
      </div>

      {/* Heading */}
      <h1 className="mb-3 text-2xl font-bold text-gray-900 sm:text-3xl">
        Something went wrong
      </h1>

      {/* Message */}
      <p className="mb-8 max-w-md text-base text-gray-500">
        {error.message && error.message !== "An unexpected error occurred"
          ? error.message
          : "We ran into an unexpected error. Our team has been notified. Please try again or head back home."}
      </p>

      {/* Internal error digest (helpful for support, shown only in dev) */}
      {process.env.NODE_ENV === "development" && error.digest && (
        <p className="mb-8 rounded-lg bg-gray-100 px-4 py-2 font-mono text-xs text-gray-500">
          Digest: {error.digest}
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Try again
        </button>

        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          <Home className="h-4 w-4" aria-hidden="true" />
          Back to home
        </Link>
      </div>
    </section>
  );
}
