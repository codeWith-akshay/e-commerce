"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { signIn, signOut } from "@/lib/auth";
import { loginSchema, registerSchema } from "@/lib/validations/auth";

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
  // ── Validate with Zod ──────────────────────────────────────────────────────
  const parsed = loginSchema.safeParse({
    email:    formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const field = first?.path[0] as "email" | "password" | undefined;
    return { success: false, error: first?.message ?? "Invalid input.", field };
  }

  const { email, password } = parsed.data;

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
    select: { role: true, isActive: true, isBanned: true },
  });

  if (dbUser?.isBanned) {
    return { success: false, error: "Your account has been suspended. Please contact support." };
  }

  if (dbUser?.isActive === false) {
    return { success: false, error: "Your account is inactive. Please contact support." };
  }

  // Update lastLoginAt in the background (non-blocking)
  prisma.user.update({
    where:  { email },
    data:   { lastLoginAt: new Date() },
  }).catch(() => { /* non-critical */ });

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
  // ── Validate with Zod ──────────────────────────────────────────────────────
  const parsed = registerSchema.safeParse({
    name:            formData.get("name"),
    email:           formData.get("email"),
    password:        formData.get("password"),
    confirmPassword: formData.get("confirmPassword") ?? formData.get("password"),
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const field = first?.path[0] as "email" | "password" | "name" | undefined;
    return { success: false, error: first?.message ?? "Invalid input.", field };
  }

  const { name, email, password } = parsed.data;

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
