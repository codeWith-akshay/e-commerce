"use client";

import { useTransition } from "react";
import { promoteToAdmin, demoteToUser, deleteUser } from "@/lib/actions/user";
import type { Role } from "@/types/user";

interface Props {
  userId: string;
  userRole: Role;
  userName: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// UserActionButtons
//
// Renders Promote / Demote / Delete actions for a single user row.
// Uses React's useTransition so the UI shows a pending state without
// blocking navigation while the Server Action executes.
// SUPERADMIN rows always receive disabled buttons.
// ─────────────────────────────────────────────────────────────────────────────

export default function UserActionButtons({ userId, userRole, userName }: Props) {
  const [isPending, startTransition] = useTransition();

  const isSuperAdmin = userRole === "SUPERADMIN";
  const isAdmin = userRole === "ADMIN";

  function handleAction(action: () => Promise<{ success: boolean; message: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        // Surface errors without crashing — swap for a toast library if desired
        alert(result.message);
      }
    });
  }

  const btnBase =
    "rounded-md px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex items-center gap-2">
      {/* Promote — only meaningful for USER */}
      <button
        disabled={isSuperAdmin || isAdmin || isPending}
        title={
          isSuperAdmin
            ? "Cannot modify a SUPERADMIN"
            : isAdmin
            ? "Already an ADMIN"
            : `Promote ${userName} to ADMIN`
        }
        className={`${btnBase} bg-indigo-100 text-indigo-700 hover:bg-indigo-200 focus-visible:ring-indigo-500`}
        onClick={() =>
          handleAction(() => promoteToAdmin(userId))
        }
      >
        {isPending ? "..." : "Promote"}
      </button>

      {/* Demote — only meaningful for ADMIN */}
      <button
        disabled={isSuperAdmin || userRole === "USER" || isPending}
        title={
          isSuperAdmin
            ? "Cannot modify a SUPERADMIN"
            : userRole === "USER"
            ? "Already a USER"
            : `Demote ${userName} to USER`
        }
        className={`${btnBase} bg-amber-100 text-amber-700 hover:bg-amber-200 focus-visible:ring-amber-500`}
        onClick={() =>
          handleAction(() => demoteToUser(userId))
        }
      >
        {isPending ? "..." : "Demote"}
      </button>

      {/* Delete — blocked for SUPERADMIN */}
      <button
        disabled={isSuperAdmin || isPending}
        title={
          isSuperAdmin
            ? "Cannot delete a SUPERADMIN"
            : `Delete ${userName}`
        }
        className={`${btnBase} bg-red-100 text-red-700 hover:bg-red-200 focus-visible:ring-red-500`}
        onClick={() => {
          if (
            confirm(`Are you sure you want to permanently delete "${userName}"?`)
          ) {
            handleAction(() => deleteUser(userId));
          }
        }}
      >
        {isPending ? "..." : "Delete"}
      </button>
    </div>
  );
}
