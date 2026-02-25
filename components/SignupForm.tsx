"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { registerAction } from "@/lib/actions/auth";

// ─────────────────────────────────────────────────────────────────────────────
// Shared input component
// ─────────────────────────────────────────────────────────────────────────────

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  icon: React.ReactNode;
  error?: boolean;
  rightSlot?: React.ReactNode;
}

function InputField({ id, label, icon, error, rightSlot, className, ...rest }: InputProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
          {icon}
        </span>
        <input
          id={id}
          className={[
            "w-full rounded-xl border py-3 pl-10 text-sm text-gray-900 outline-none transition",
            "placeholder:text-gray-400",
            "focus:ring-2 focus:border-indigo-500 focus:ring-indigo-500",
            "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400",
            rightSlot ? "pr-11" : "pr-4",
            error
              ? "border-red-400 bg-red-50 focus:border-red-400 focus:ring-red-400"
              : "border-gray-200 bg-white hover:border-gray-300",
            className ?? "",
          ].join(" ")}
          {...rest}
        />
        {rightSlot && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">{rightSlot}</span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline field error
// ─────────────────────────────────────────────────────────────────────────────

function FieldError({ message }: { message: string }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-red-600">
      <AlertCircle className="h-3 w-3 shrink-0" />
      {message}
    </p>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SignupForm — delegates all validation and persistence to registerAction
// ─────────────────────────────────────────────────────────────────────────────

export default function SignupForm() {
  const [state, formAction, isPending] = useActionState(registerAction, null);
  const [showPassword, setShowPassword] = useState(false);

  // Narrow the discriminated union to extract error details
  const errorField   = state && !state.success ? state.field   : undefined;
  const errorMessage = state && !state.success ? state.error   : undefined;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {/* ── Global error banner (no specific field) ───────────────────────── */}
      {errorMessage && !errorField && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <p className="text-sm text-red-700">{errorMessage}</p>
        </div>
      )}

      {/* ── Name ─────────────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <InputField
          id="name"
          name="name"
          label="Full name"
          type="text"
          autoComplete="name"
          placeholder="Jane Doe"
          icon={<User className="h-4 w-4" />}
          error={errorField === "name"}
          disabled={isPending}
          required
        />
        {errorField === "name" && <FieldError message={errorMessage!} />}
      </div>

      {/* ── Email ────────────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <InputField
          id="email"
          name="email"
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          icon={<Mail className="h-4 w-4" />}
          error={errorField === "email"}
          disabled={isPending}
          required
        />
        {errorField === "email" && <FieldError message={errorMessage!} />}
      </div>

      {/* ── Password ─────────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <InputField
          id="password"
          name="password"
          label="Password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          icon={<Lock className="h-4 w-4" />}
          error={errorField === "password"}
          disabled={isPending}
          required
          rightSlot={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="text-gray-400 transition hover:text-gray-600 focus:outline-none"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />
        {errorField === "password" && <FieldError message={errorMessage!} />}
      </div>

      {/* ── Submit ───────────────────────────────────────────────────────── */}
      <button
        type="submit"
        disabled={isPending}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Creating account…
          </>
        ) : (
          "Create account"
        )}
      </button>

      {/* ── Toggle link ──────────────────────────────────────────────────── */}
      <p className="text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-indigo-600 hover:text-indigo-500"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
