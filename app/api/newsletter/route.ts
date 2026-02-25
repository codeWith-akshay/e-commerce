import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import type { NewsletterSubscribeResult } from "@/types/newsletter";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/newsletter
//
// Body: { email: string }
//
// Behaviour:
//   • Validates the email format server-side.
//   • If the email already has an active subscription → returns 200 with a
//     "already subscribed" message (idempotent, no error to the user).
//   • If the email was previously unsubscribed → reactivates it.
//   • Otherwise → creates a new NewsletterSubscription row.
//
// DELETE /api/newsletter
//
// Body: { email: string }
//   • Soft-deletes (sets isActive = false) the subscription for the email.
// ─────────────────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(
  req: NextRequest
): Promise<NextResponse<NewsletterSubscribeResult>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body." },
      { status: 400 }
    );
  }

  const email =
    typeof (body as Record<string, unknown>)?.email === "string"
      ? ((body as Record<string, unknown>).email as string).trim().toLowerCase()
      : "";

  if (!email) {
    return NextResponse.json(
      { success: false, error: "Email is required." },
      { status: 400 }
    );
  }

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { success: false, error: "Please enter a valid email address." },
      { status: 400 }
    );
  }

  try {
    const existing = await prisma.newsletterSubscription.findUnique({
      where: { email },
      select: { id: true, isActive: true },
    });

    if (existing) {
      if (existing.isActive) {
        // Already subscribed — idempotent success
        return NextResponse.json({
          success: true,
          message: "You're already subscribed. Thanks! 🎉",
        });
      }

      // Previously unsubscribed — reactivate
      await prisma.newsletterSubscription.update({
        where: { id: existing.id },
        data: { isActive: true, subscribedAt: new Date() },
      });

      return NextResponse.json({ success: true, message: "Welcome back! You're re-subscribed. 🎉" });
    }

    // New subscriber
    await prisma.newsletterSubscription.create({ data: { email } });

    return NextResponse.json({ success: true, message: "Subscribed successfully! 🎉" });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      // Race condition — concurrent duplicate insert; treat as success
      return NextResponse.json({ success: true, message: "You're already subscribed. Thanks! 🎉" });
    }

    console.error("[POST /api/newsletter]", err);
    return NextResponse.json(
      { success: false, error: "Service temporarily unavailable. Please try again." },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/newsletter — soft unsubscribe
// ─────────────────────────────────────────────────────────────────────────────

export async function DELETE(
  req: NextRequest
): Promise<NextResponse<NewsletterSubscribeResult>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body." },
      { status: 400 }
    );
  }

  const email =
    typeof (body as Record<string, unknown>)?.email === "string"
      ? ((body as Record<string, unknown>).email as string).trim().toLowerCase()
      : "";

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { success: false, error: "A valid email is required." },
      { status: 400 }
    );
  }

  try {
    await prisma.newsletterSubscription.updateMany({
      where: { email, isActive: true },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, message: "You have been unsubscribed." });
  } catch (err) {
    console.error("[DELETE /api/newsletter]", err);
    return NextResponse.json(
      { success: false, error: "Service temporarily unavailable. Please try again." },
      { status: 500 }
    );
  }
}
