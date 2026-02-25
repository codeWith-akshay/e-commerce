"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import type { NewsletterSubscribeResult } from "@/types/newsletter";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type SubscribeState = "idle" | "loading" | "success" | "error";

// ─────────────────────────────────────────────────────────────────────────────
// NewsletterForm — Client Component
//
// Extracted from Footer so the Footer can remain a pure Server Component.
// Subscribes/reactivates emails via POST /api/newsletter backed by the
// NewsletterSubscription Prisma model.
// ─────────────────────────────────────────────────────────────────────────────

export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<SubscribeState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const trimmed = email.trim();
    if (!trimmed) return;

    setState("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      const data: NewsletterSubscribeResult = await res.json();

      if (data.success) {
        setSuccessMsg(data.message);
        setState("success");
        setEmail("");
      } else {
        setState("error");
        setErrorMsg(data.error);
      }
    } catch {
      setState("error");
      setErrorMsg("Something went wrong. Please try again.");
    }
  }

  if (state === "success") {
    return (
      <div className="flex items-center gap-2.5 rounded-2xl bg-indigo-600/20 px-4 py-3 text-sm font-medium text-indigo-300">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-indigo-400" aria-hidden="true" />
        <span>{successMsg}</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Newsletter subscription">
      <div
        className={`flex overflow-hidden rounded-full border bg-gray-800 transition focus-within:ring-2 focus-within:ring-indigo-500/30 ${
          state === "error"
            ? "border-red-500"
            : "border-gray-700 focus-within:border-indigo-500"
        }`}
      >
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <input
          id="newsletter-email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (state === "error") setState("idle");
          }}
          placeholder="you@example.com"
          autoComplete="email"
          required
          disabled={state === "loading"}
          className="flex-1 bg-transparent px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={state === "loading" || !email.trim()}
          aria-label="Subscribe"
          className="flex items-center gap-1 rounded-r-full bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state === "loading" ? (
            <svg
              className="h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
          ) : (
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {state === "error" && (
        <p role="alert" className="mt-2 text-xs text-red-400">
          {errorMsg}
        </p>
      )}
    </form>
  );
}
