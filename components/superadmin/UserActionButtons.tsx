"use client";

import { useTransition, useState } from "react";
import { promoteToAdmin, demoteToUser, deleteUser, banUser, unbanUser } from "@/lib/actions/user";
import type { Role } from "@/types/user";
import {
  ShieldCheck, ShieldMinus, Trash2, Ban, ShieldOff,
  Loader2, ChevronDown, ChevronUp,
} from "lucide-react";

interface Props {
  userId:   string;
  userRole: Role;
  userName: string;
  isBanned: boolean;
}

type Toast = { type: "ok" | "err"; msg: string };

export default function UserActionButtons({ userId, userRole, userName, isBanned }: Props) {
  const [isPending, startTransition] = useTransition();
  const [toast, setToast]   = useState<Toast | null>(null);
  const [open,  setOpen]    = useState(false);

  const isSuperAdmin = userRole === "SUPERADMIN";
  const isAdmin      = userRole === "ADMIN";

  function run(action: () => Promise<{ success: boolean; message: string }>) {
    startTransition(async () => {
      setToast(null);
      const res = await action();
      setToast({ type: res.success ? "ok" : "err", msg: res.message });
      setTimeout(() => setToast(null), 3500);
    });
  }

  const btn = (cls: string) =>
    `flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40 ${cls}`;

  return (
    <div className="relative">
      {/* Collapsed trigger */}
      <button
        type="button"
        disabled={isSuperAdmin || isPending}
        onClick={() => setOpen((v) => !v)}
        className={btn(
          isSuperAdmin
            ? "bg-slate-50 text-slate-300 ring-1 ring-slate-200"
            : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300"
        )}
        title={isSuperAdmin ? "Cannot modify SUPERADMIN" : "Actions"}
      >
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Actions"}
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {/* Dropdown */}
      {open && !isSuperAdmin && (
        <div className="absolute right-0 z-50 mt-1 w-44 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">

          {/* Promote */}
          {!isAdmin && !isBanned && (
            <button
              className={`w-full ${btn("rounded-none text-indigo-700 hover:bg-indigo-50")}`}
              disabled={isPending}
              onClick={() => { setOpen(false); run(() => promoteToAdmin(userId)); }}
            >
              <ShieldCheck className="h-3.5 w-3.5" />Promote to Admin
            </button>
          )}

          {/* Demote */}
          {isAdmin && !isBanned && (
            <button
              className={`w-full ${btn("rounded-none text-amber-700 hover:bg-amber-50")}`}
              disabled={isPending}
              onClick={() => { setOpen(false); run(() => demoteToUser(userId)); }}
            >
              <ShieldMinus className="h-3.5 w-3.5" />Demote to User
            </button>
          )}

          {/* Ban / Unban */}
          {isBanned ? (
            <button
              className={`w-full ${btn("rounded-none text-emerald-700 hover:bg-emerald-50")}`}
              disabled={isPending}
              onClick={() => { setOpen(false); run(() => unbanUser(userId)); }}
            >
              <ShieldOff className="h-3.5 w-3.5" />Unban User
            </button>
          ) : (
            <button
              className={`w-full ${btn("rounded-none text-orange-700 hover:bg-orange-50")}`}
              disabled={isPending}
              onClick={() => {
                setOpen(false);
                if (confirm(`Ban "${userName}"? They will be locked out.`)) {
                  run(() => banUser(userId));
                }
              }}
            >
              <Ban className="h-3.5 w-3.5" />Ban User
            </button>
          )}

          <div className="my-1 border-t border-slate-100" />

          {/* Delete */}
          <button
            className={`w-full ${btn("rounded-none text-red-700 hover:bg-red-50")}`}
            disabled={isPending}
            onClick={() => {
              setOpen(false);
              if (confirm(`Permanently delete "${userName}"? This cannot be undone.`)) {
                run(() => deleteUser(userId));
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />Delete
          </button>
        </div>
      )}

      {/* Inline toast */}
      {toast && (
        <div className={`absolute right-0 top-9 z-50 w-52 rounded-xl border px-3 py-2 text-xs shadow-md ${
          toast.type === "ok"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-red-200 bg-red-50 text-red-700"
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

