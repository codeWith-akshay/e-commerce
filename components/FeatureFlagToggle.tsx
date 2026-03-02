"use client";

/**
 * components/FeatureFlagToggle.tsx
 *
 * Admin toggle card for a single feature flag.
 *
 * Uses useOptimistic so the switch flips instantly; the server action runs
 * in the background and reverts on error.
 */

import { useOptimistic, useTransition } from "react";
import { setFlagAction, type FlagRow }  from "@/lib/actions/feature-flags";
import type { FlagName }                from "@/lib/flags";

// ─── tiny helper ─────────────────────────────────────────────────────────────

function formatDate(d: Date | string | null): string {
  if (!d) return "never";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day:   "numeric",
    year:  "numeric",
    hour:  "2-digit",
    minute:"2-digit",
  }).format(new Date(d));
}

// ─── component ───────────────────────────────────────────────────────────────

interface Props {
  flag: FlagRow;
}

export default function FeatureFlagToggle({ flag }: Props) {
  const [pending, startTransition] = useTransition();

  // Optimistic state: optimistically flip the toggle before the server responds
  const [optimisticEnabled, setOptimisticEnabled] = useOptimistic(flag.enabled);

  function handleToggle() {
    const next = !optimisticEnabled;

    startTransition(async () => {
      setOptimisticEnabled(next);
      const result = await setFlagAction(flag.name as FlagName, next);
      if (result?.error) {
        // The optimistic update will revert automatically on next render since
        // the server-state prop hasn't changed.
        console.error("[FeatureFlagToggle]", result.error);
      }
    });
  }

  return (
    <div
      className={`group relative flex items-start gap-4 rounded-xl border bg-white p-5 shadow-sm transition hover:border-gray-300 hover:shadow-md${pending ? " opacity-70" : ""}`}
    >
      {/* left: text */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-gray-900">
            {flag.label}
          </h3>
          {!flag.persisted && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
              default
            </span>
          )}
        </div>

        <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">
          {flag.description}
        </p>

        <p className="mt-2 text-[11px] text-gray-400 font-mono">
          {flag.name}
          {flag.updatedAt && (
            <span className="ml-2 not-italic font-sans">
              · updated {formatDate(flag.updatedAt)}
            </span>
          )}
        </p>
      </div>

      {/* right: toggle switch */}
      <button
        role="switch"
        aria-checked={optimisticEnabled}
        aria-label={`Toggle ${flag.label}`}
        disabled={pending}
        onClick={handleToggle}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2${optimisticEnabled ? " bg-blue-600" : " bg-gray-200"}${pending ? " cursor-not-allowed" : " cursor-pointer"}`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200 ease-in-out${optimisticEnabled ? " translate-x-5" : " translate-x-0"}`}
        />
      </button>
    </div>
  );
}
