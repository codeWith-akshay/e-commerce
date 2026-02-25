"use client";

import { useActionState } from "react";
import { useState } from "react";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { loginAction } from "@/lib/actions/auth";
import type { AuthResult } from "@/lib/actions/auth";

// ─────────────────────────────────────────────────────────────────────────────
// Shared input component
// ─────────────────────────────────────────────────────────────────────────────

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  icon: React.ReactNode;
  error?: boolean;
  rightSlot?: React.ReactNode;
}

function InputField({ id, label, icon, error, rightSlot, ...rest }: InputFieldProps) {
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

function FieldError({ message }: { message: string }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-red-600">
      <AlertCircle className="h-3 w-3 shrink-0" />
      {message}
    </p>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LoginForm
// ─────────────────────────────────────────────────────────────────────────────

interface LoginFormProps {
  /** Pre-populated error from Auth.js ?error= search param */
  initialError?: string;
}

export default function LoginForm({ initialError }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState<AuthResult | null, FormData>(
    loginAction,
    null
  );
  const [showPassword, setShowPassword] = useState(false);

  // Merge server-action error with any URL-derived initial error
  const globalError =
    (state && !state.success && !state.field ? state.error : null) ??
    initialError ??
    null;

  const fieldErr = (f: string) =>
    !!(state && !state.success && "field" in state && state.field === f);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {/* Global error banner */}
      {globalError && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <p className="text-sm text-red-700">{globalError}</p>
        </div>
      )}

      {/* Email */}
      <div className="space-y-1.5">
        <InputField
          id="email"
          name="email"
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          icon={<Mail className="h-4 w-4" />}
          error={fieldErr("email")}
          disabled={isPending}
          required
        />
        {fieldErr("email") && (
          <FieldError message={(state as { error: string }).error} />
        )}
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          {/* Placeholder for forgot password */}
          <a
            href="#"
            className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
          >
            Forgot password?
          </a>
        </div>
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
            <Lock className="h-4 w-4" />
          </span>
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter your password"
            disabled={isPending}
            required
            className={[
              "w-full rounded-xl border py-3 pl-10 pr-11 text-sm text-gray-900 outline-none transition",
              "placeholder:text-gray-400",
              "focus:ring-2 focus:border-indigo-500 focus:ring-indigo-500",
              "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400",
              fieldErr("password")
                ? "border-red-400 bg-red-50 focus:border-red-400 focus:ring-red-400"
                : "border-gray-200 bg-white hover:border-gray-300",
            ].join(" ")}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="text-gray-400 transition hover:text-gray-600 focus:outline-none"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </span>
        </div>
        {fieldErr("password") && (
          <FieldError message={(state as { error: string }).error} />
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </button>

      {/* Toggle link */}
      <p className="text-center text-sm text-gray-500">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-semibold text-indigo-600 hover:text-indigo-500">
          Create one
        </Link>
      </p>
    </form>
  );
}
