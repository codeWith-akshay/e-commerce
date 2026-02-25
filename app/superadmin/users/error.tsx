"use client";

// Error boundary for the /superadmin/users page.
// Renders inside the root layout (Navbar visible) so the user can
// navigate away without a hard reload.

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SuperAdminUsersError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Replace with Sentry.captureException(error) or similar in production
    console.error("[SuperAdmin/users error boundary]", error);
  }, [error]);

  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-20 text-center">
      {/* Icon */}
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
        <AlertTriangle className="h-8 w-8" aria-hidden="true" />
      </div>

      <h2 className="mb-2 text-xl font-bold text-gray-900">
        Failed to load users
      </h2>

      <p className="mb-6 max-w-sm text-sm text-gray-500">
        An error occurred while fetching the user list. Please try again or
        return home.
      </p>

      {/* Digest — dev only */}
      {process.env.NODE_ENV === "development" && error.digest && (
        <p className="mb-6 rounded-lg bg-gray-100 px-4 py-2 font-mono text-xs text-gray-500">
          digest: {error.digest}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Try again
        </button>

        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          <Home className="h-4 w-4" aria-hidden="true" />
          Back to home
        </Link>
      </div>
    </section>
  );
}
