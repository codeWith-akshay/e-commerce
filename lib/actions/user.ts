"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

// ─────────────────────────────────────────────────────────────────────────────
// Shared result type
// ─────────────────────────────────────────────────────────────────────────────

interface ActionResult {
  success: boolean;
  message: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal guard — resolves the caller and enforces SUPERADMIN access.
// Returns the caller's id on success, or throws an ActionResult-shaped Error.
// ─────────────────────────────────────────────────────────────────────────────

async function requireSuperAdmin(): Promise<string> {
  const caller = await getSessionUser();

  if (!caller) {
    throw new Error("Unauthorized: no active session.");
  }

  if (caller.role !== "SUPERADMIN") {
    throw new Error("Forbidden: SUPERADMIN access required.");
  }

  return caller.id;
}

// ─────────────────────────────────────────────────────────────────────────────
// Revalidate all affected routes after a successful mutation
// ─────────────────────────────────────────────────────────────────────────────

function revalidateUserRoutes(): void {
  revalidatePath("/superadmin/users");
  revalidatePath("/api/superadmin/users");
}

// ─────────────────────────────────────────────────────────────────────────────
// promoteToAdmin
//
// Promotes a USER to ADMIN.
// Guards: caller must be SUPERADMIN; target must currently be USER.
// ─────────────────────────────────────────────────────────────────────────────

export async function promoteToAdmin(userId: string): Promise<ActionResult> {
  try {
    await requireSuperAdmin();

    const target = await prisma.user.findUnique({
      where:  { id: userId },
      select: { id: true, role: true },
    });

    if (!target) {
      return { success: false, message: "User not found." };
    }

    if (target.role === "SUPERADMIN") {
      return { success: false, message: "Cannot modify a SUPERADMIN account." };
    }

    if (target.role === "ADMIN") {
      return { success: false, message: "User is already an ADMIN." };
    }

    await prisma.user.update({
      where: { id: userId },
      data:  { role: "ADMIN" },
    });

    revalidateUserRoutes();

    return { success: true, message: "User promoted to ADMIN successfully." };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    console.error("[promoteToAdmin]", error);
    return { success: false, message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// demoteToUser
//
// Demotes an ADMIN back to USER.
// Guards: caller must be SUPERADMIN; target must not be SUPERADMIN.
// ─────────────────────────────────────────────────────────────────────────────

export async function demoteToUser(userId: string): Promise<ActionResult> {
  try {
    await requireSuperAdmin();

    const target = await prisma.user.findUnique({
      where:  { id: userId },
      select: { id: true, role: true },
    });

    if (!target) {
      return { success: false, message: "User not found." };
    }

    if (target.role === "SUPERADMIN") {
      return { success: false, message: "Cannot demote a SUPERADMIN account." };
    }

    if (target.role === "USER") {
      return { success: false, message: "User is already a USER." };
    }

    await prisma.user.update({
      where: { id: userId },
      data:  { role: "USER" },
    });

    revalidateUserRoutes();

    return { success: true, message: "Admin demoted to USER successfully." };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    console.error("[demoteToUser]", error);
    return { success: false, message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// deleteUser
//
// Permanently deletes a user account.
// Guards: caller must be SUPERADMIN; cannot delete self; cannot delete
//         another SUPERADMIN.
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteUser(userId: string): Promise<ActionResult> {
  try {
    const callerId = await requireSuperAdmin();

    if (callerId === userId) {
      return { success: false, message: "You cannot delete your own account." };
    }

    const target = await prisma.user.findUnique({
      where:  { id: userId },
      select: { id: true, role: true },
    });

    if (!target) {
      return { success: false, message: "User not found." };
    }

    if (target.role === "SUPERADMIN") {
      return {
        success: false,
        message: "Cannot delete a SUPERADMIN account.",
      };
    }

    await prisma.user.delete({ where: { id: userId } });

    revalidateUserRoutes();

    return { success: true, message: "User deleted successfully." };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    console.error("[deleteUser]", error);
    return { success: false, message };
  }
}
