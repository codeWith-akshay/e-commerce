/**
 * lib/payment-gateway.ts
 *
 * Provider-agnostic payment gateway adapter.
 *
 * Supports:
 *   - Stripe   (PaymentIntent API)
 *   - Razorpay (Orders API → webhook captures payment_id)
 *
 * Both providers are lazily imported so the app boots without crashing if keys
 * are absent in non-payment environments (e.g. dev with COD only).
 */

import { env } from "@/config/env";

// ─────────────────────────────────────────────────────────────────────────────
// Shared types
// ─────────────────────────────────────────────────────────────────────────────

export type SupportedProvider = "STRIPE" | "RAZORPAY";

/** Returned to the client so it can complete the payment in the browser. */
export type GatewayIntent =
  | { provider: "STRIPE";   clientSecret: string; providerPaymentId: string }
  | { provider: "RAZORPAY"; razorpayOrderId: string; keyId: string };

/** Minimal shape returned from a gateway when we cancel an in-flight intent. */
export type CancelResult = { cancelled: boolean };

// ─────────────────────────────────────────────────────────────────────────────
// Stripe
// ─────────────────────────────────────────────────────────────────────────────

async function getStripe() {
  const key = env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured.");
  const { default: Stripe } = await import("stripe");
  return new Stripe(key, { apiVersion: "2026-02-25.clover" });
}

/**
 * Create (or re-create) a Stripe PaymentIntent for a given amount.
 *
 * @param amountMinor   Amount in smallest currency unit (e.g. paise / cents).
 * @param currency      ISO 4217 lowercase (e.g. "inr", "usd").
 * @param metadata      Key/value pairs attached to the intent for webhook lookup.
 * @param idempotencyKey Stable key so retrying this call never double-charges.
 */
export async function stripeCreateIntent(
  amountMinor: number,
  currency: string,
  metadata: Record<string, string>,
  idempotencyKey: string
): Promise<GatewayIntent & { provider: "STRIPE" }> {
  const stripe = await getStripe();

  const intent = await stripe.paymentIntents.create(
    {
      amount:               amountMinor,
      currency:             currency.toLowerCase(),
      metadata,
      automatic_payment_methods: { enabled: true },
    },
    { idempotencyKey }
  );

  if (!intent.client_secret) {
    throw new Error("Stripe did not return a client_secret.");
  }

  return {
    provider:          "STRIPE",
    clientSecret:      intent.client_secret,
    providerPaymentId: intent.id,           // pi_xxx — stored on Payment
  };
}

/**
 * Cancel an existing Stripe PaymentIntent (called when we create a fresh one
 * on retry so the old one does not auto-capture later).
 */
export async function stripeCancelIntent(paymentIntentId: string): Promise<CancelResult> {
  try {
    const stripe = await getStripe();
    await stripe.paymentIntents.cancel(paymentIntentId);
    return { cancelled: true };
  } catch {
    // Non-fatal — intent may already be cancelled or in a terminal state.
    return { cancelled: false };
  }
}

/**
 * Verify a Stripe webhook signature and return the parsed event.
 * Throws if the signature is invalid.
 */
export async function stripeVerifyWebhook(
  rawBody: Buffer,
  signature: string
): Promise<import("stripe").Stripe.Event> {
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  const stripe = await getStripe();
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

// ─────────────────────────────────────────────────────────────────────────────
// Razorpay
// ─────────────────────────────────────────────────────────────────────────────

async function getRazorpay() {
  const keyId     = env.RAZORPAY_KEY_ID;
  const keySecret = env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error("RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not configured.");
  const Razorpay = (await import("razorpay")).default;
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

/**
 * Create a Razorpay order — the equivalent of Stripe's PaymentIntent.
 *
 * @param amountMinor  Amount in smallest unit (paise).
 * @param currency     ISO 4217 uppercase (e.g. "INR").
 * @param receipt      Short idempotency token (max 40 chars) — use Payment.id.
 * @param notes        Key/value pairs visible in the Razorpay dashboard.
 */
export async function razorpayCreateOrder(
  amountMinor: number,
  currency: string,
  receipt: string,
  notes: Record<string, string>
): Promise<GatewayIntent & { provider: "RAZORPAY" }> {
  const rp = await getRazorpay();

  const order = await rp.orders.create({
    amount:   amountMinor,
    currency: currency.toUpperCase(),
    receipt:  receipt.slice(0, 40),  // Razorpay hard limit
    notes,
  });

  return {
    provider:        "RAZORPAY",
    razorpayOrderId: order.id,         // rzp_order_xxx — stored as providerOrderId
    keyId:           env.RAZORPAY_KEY_ID!,
  };
}

/**
 * Verify Razorpay webhook signature using raw body + X-Razorpay-Signature header.
 * Throws if the signature does not match.
 */
export async function razorpayVerifyWebhook(
  rawBody: string,
  signature: string
): Promise<void> {
  const secret = env.RAZORPAY_KEY_SECRET;
  if (!secret) throw new Error("RAZORPAY_KEY_SECRET is not configured.");
  const { validateWebhookSignature } = await import("razorpay/dist/utils/razorpay-utils.js");
  const valid = validateWebhookSignature(rawBody, signature, secret);
  if (!valid) throw new Error("Razorpay webhook signature mismatch.");
}
