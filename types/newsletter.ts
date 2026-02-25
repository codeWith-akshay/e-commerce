// ─────────────────────────────────────────────────────────────────────────────
// Newsletter Types
// Mirrors the Prisma NewsletterSubscription model — decoupled for use in
// client components and API responses without importing Prisma directly.
// ─────────────────────────────────────────────────────────────────────────────

export interface NewsletterSubscription {
  id: string;
  email: string;
  subscribedAt: Date;
  isActive: boolean;
}

/** Response shape for POST /api/newsletter */
export type NewsletterSubscribeResult =
  | { success: true; message: string }
  | { success: false; error: string };
