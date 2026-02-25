import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import SignupForm from "@/components/SignupForm";

export const metadata: Metadata = {
  title: "Create Account | ShopNest",
  description: "Create a new ShopNest account and start shopping today.",
};

export default function RegisterPage() {
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
            Create your account
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Start shopping in seconds — it&apos;s free
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
          <SignupForm />
        </div>

        {/* Terms note */}
        <p className="mt-5 text-center text-xs text-gray-400">
          By creating an account you agree to our{" "}
          <a href="#" className="underline underline-offset-2 hover:text-gray-600">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="#" className="underline underline-offset-2 hover:text-gray-600">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}
