import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import LoginForm from "@/components/LoginForm";

export const metadata: Metadata = {
  title: "Sign In | ShopNest",
  description: "Sign in to your ShopNest account.",
};

// ── Cache strategy ────────────────────────────────────────────────────────────
// Reads searchParams (error, callbackUrl) — must be dynamic.
export const dynamic = "force-dynamic";

// Auth.js maps certain error codes to human-readable messages
const AUTH_ERRORS: Record<string, string> = {
  CredentialsSignin:   "Invalid email or password.",
  SessionRequired:     "Please sign in to continue.",
  Default:             "Something went wrong. Please try again.",
};

interface Props {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const { error } = await searchParams;
  const initialError = error ? (AUTH_ERRORS[error] ?? AUTH_ERRORS.Default) : undefined;

  return (
    <div className="flex min-h-[80vh] items-center justify-center bg-linear-to-b from-indigo-50/60 to-white px-4 py-12">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex flex-col items-center gap-2">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-200">
              <ShoppingBag className="h-6 w-6 text-white" />
            </span>
            <span className="text-xl font-bold text-gray-900">ShopNest</span>
          </Link>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Sign in to continue shopping
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
          {/* Suspense needed because LoginForm reads useSearchParams internally via useActionState */}
          <Suspense>
            <LoginForm initialError={initialError} />
          </Suspense>
        </div>

        {/* Role redirect info */}
        <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-center">
          <p className="text-xs text-indigo-700">
            <strong>Role-based redirect:</strong>{" "}
            USER → Home &nbsp;&bull;&nbsp; ADMIN → /admin &nbsp;&bull;&nbsp; SUPERADMIN → /superadmin
          </p>
        </div>

        {/* Demo hint */}
        <div className="mt-2 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-center text-xs text-amber-700">
          <strong>Demo:</strong> jane@example.com / password123
        </div>
      </div>
    </div>
  );
}
