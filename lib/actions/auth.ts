"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { signIn, signOut } from "@/lib/auth";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AuthResult =
  | { success: true }
  | { success: false; error: string; field?: "email" | "password" | "name" };

// ─────────────────────────────────────────────────────────────────────────────
// Role → redirect mapping
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_REDIRECT: Record<string, string> = {
  SUPERADMIN: "/superadmin",
  ADMIN:      "/admin",
  USER:       "/",
};

// ─────────────────────────────────────────────────────────────────────────────
// loginAction — authenticates then redirects based on role
// ─────────────────────────────────────────────────────────────────────────────

export async function loginAction(
  _prevState: AuthResult | null,
  formData: FormData
): Promise<AuthResult> {
  const email    = (formData.get("email")    as string | null)?.trim().toLowerCase() ?? "";
  // Trim leading/trailing whitespace from the password to guard against
  // accidental spaces introduced by copy-paste from terminals or chat messages.
  const password = (formData.get("password") as string | null)?.trim() ?? "";

  // ── Validate ───────────────────────────────────────────────────────────────
  if (!email)    return { success: false, error: "Email is required.",    field: "email"    };
  if (!password) return { success: false, error: "Password is required.", field: "password" };

  try {
    // redirect: false — sets the JWT cookie without throwing NEXT_REDIRECT,
    // so we can read the session immediately after to determine the role.
    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: "Invalid email or password.", field: "email" };
    }
    throw error;
  }

  // ── Read role from DB — auth() cannot read the brand-new JWT cookie that
  //    signIn() just placed in the *response* while we're still inside the
  //    same Server Action *request*.  A direct Prisma lookup is reliable. ──
  const dbUser      = await prisma.user.findUnique({
    where:  { email },
    select: { role: true },
  });
  const role        = dbUser?.role ?? "USER";
  const destination = ROLE_REDIRECT[role] ?? "/";

  revalidatePath("/", "layout");
  redirect(destination);
}

// ─────────────────────────────────────────────────────────────────────────────
// registerAction
// ─────────────────────────────────────────────────────────────────────────────

export async function registerAction(
  _prevState: AuthResult | null,
  formData: FormData
): Promise<AuthResult> {
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const email = (formData.get("email") as string | null)?.trim().toLowerCase() ?? "";
  const password = (formData.get("password") as string | null) ?? "";

  // ── Validate ───────────────────────────────────────────────────────────────
  if (!name) return { success: false, error: "Name is required.", field: "name" };
  if (name.length < 2) return { success: false, error: "Name must be at least 2 characters.", field: "name" };

  if (!email) return { success: false, error: "Email is required.", field: "email" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: "Enter a valid email address.", field: "email" };
  }

  if (!password) return { success: false, error: "Password is required.", field: "password" };
  if (password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters.", field: "password" };
  }

  try {
    const hashed = await bcrypt.hash(password, 12);

    await prisma.user.create({
      data: { name, email, password: hashed },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { success: false, error: "An account with this email already exists.", field: "email" };
    }
    if (err instanceof Prisma.PrismaClientInitializationError) {
      return { success: false, error: "Service temporarily unavailable. Please try again." };
    }
    console.error("[registerAction]", err);
    return { success: false, error: "An unexpected error occurred." };
  }

  // User created — sign them in immediately via Auth.js (sets JWT cookie)
  // signIn throws NEXT_REDIRECT on success, which must be re-thrown
  await signIn("credentials", { email, password, redirectTo: "/" });

  // Never reached — signIn always redirects on success
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// logoutAction
// ─────────────────────────────────────────────────────────────────────────────

export async function logoutAction(): Promise<void> {
  // Auth.js clears the JWT cookie and redirects
  await signOut({ redirectTo: "/" });
}
