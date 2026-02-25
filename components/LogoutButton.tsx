// LogoutButton — Server Component.
//
// Uses a <form action={logoutAction}> so the sign-out works without any
// client-side JavaScript.  The server action clears the JWT cookie and
// redirects to "/" just as the previous signOut({ callbackUrl: "/" }) did.

import { logoutAction } from "@/lib/actions/auth";

export default function LogoutButton({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <form action={logoutAction} className="contents">
      <button type="submit" className={className}>
        {children ?? "Logout"}
      </button>
    </form>
  );
}
