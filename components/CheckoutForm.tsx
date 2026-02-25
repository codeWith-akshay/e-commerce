"use client";

// CheckoutForm — minimal client island.
//
// Responsibilities:
//   - Wire <form> to placeOrderAction via useActionState
//   - Show per-field validation errors returned from the action (VALIDATION code)
//   - Show a business-rule error banner (empty cart, stock issues)
//   - Disable all inputs and show a spinner while the submission is pending
//
// The order summary beside this form is server-rendered — this island only
// owns the address fields and the submit button.

import { useActionState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { placeOrderAction } from "@/lib/actions/order";
import type { ActionResult, PlacedOrder } from "@/lib/actions/order";

// ─────────────────────────────────────────────────────────────────────────────
// Field config — drives rendering to avoid repetition
// ─────────────────────────────────────────────────────────────────────────────

type FieldDef = {
  name: string;
  label: string;
  type?: string;
  placeholder: string;
  autoComplete: string;
  colSpan?: "full";
};

const FIELDS: FieldDef[] = [
  {
    name: "fullName",
    label: "Full name",
    placeholder: "Jane Doe",
    autoComplete: "name",
    colSpan: "full",
  },
  {
    name: "phone",
    label: "Phone number",
    type: "tel",
    placeholder: "+1 234 567 8901",
    autoComplete: "tel",
    colSpan: "full",
  },
  {
    name: "address",
    label: "Street address",
    placeholder: "123 Main Street, Apt 4B",
    autoComplete: "street-address",
    colSpan: "full",
  },
  {
    name: "city",
    label: "City",
    placeholder: "New York",
    autoComplete: "address-level2",
  },
  {
    name: "pincode",
    label: "Pincode / ZIP",
    placeholder: "10001",
    autoComplete: "postal-code",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function parseFieldErrors(state: ActionResult<PlacedOrder> | null): Record<string, string> {
  if (!state || state.success || state.code !== "VALIDATION") return {};
  try {
    return JSON.parse(state.error) as Record<string, string>;
  } catch {
    return {};
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function CheckoutForm() {
  const [state, formAction, isPending] = useActionState<
    ActionResult<PlacedOrder> | null,
    FormData
  >(placeOrderAction, null);

  const fieldErrors = parseFieldErrors(state);

  // Non-validation errors (empty cart, stock, DB)
  const globalError =
    state && !state.success && state.code !== "VALIDATION" ? state.error : null;

  return (
    <form action={formAction} noValidate>
      <fieldset disabled={isPending} className="min-w-0 space-y-6">
        <legend className="sr-only">Shipping address</legend>

        {/* Global error banner */}
        {globalError && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{globalError}</span>
          </div>
        )}

        {/* Address fields */}
        <div className="grid grid-cols-2 gap-4">
          {FIELDS.map((field) => {
            const err = fieldErrors[field.name];
            const inputId = `checkout-${field.name}`;
            const errId = `${inputId}-err`;

            return (
              <div
                key={field.name}
                className={field.colSpan === "full" ? "col-span-2" : "col-span-1"}
              >
                <label
                  htmlFor={inputId}
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  {field.label}
                  <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>
                </label>

                <input
                  id={inputId}
                  name={field.name}
                  type={field.type ?? "text"}
                  placeholder={field.placeholder}
                  autoComplete={field.autoComplete}
                  aria-describedby={err ? errId : undefined}
                  aria-invalid={err ? "true" : undefined}
                  className={[
                    "w-full rounded-xl border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400",
                    "outline-none transition focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0",
                    "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400",
                    err
                      ? "border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-300"
                      : "border-gray-200 bg-white focus:border-indigo-400",
                  ].join(" ")}
                />

                {err && (
                  <p id={errId} role="alert" className="mt-1.5 text-xs text-red-600">
                    {err}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Placing order…
            </>
          ) : (
            "Place order"
          )}
        </button>

        <p className="text-center text-xs text-gray-400">
          By placing your order you agree to our{" "}
          <a href="/terms" className="underline hover:text-gray-600">Terms &amp; Conditions</a>
          {" "}and{" "}
          <a href="/privacy" className="underline hover:text-gray-600">Privacy Policy</a>.
        </p>
      </fieldset>
    </form>
  );
}
