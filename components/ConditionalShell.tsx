"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

interface Props {
  navbar:   ReactNode;
  footer:   ReactNode;
  children: ReactNode;
}

const APP_SHELL_PREFIXES = ["/admin", "/superadmin"];

export default function ConditionalShell({ navbar, footer, children }: Props) {
  const pathname = usePathname();
  const isAppShell = APP_SHELL_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isAppShell) {
    // Admin / superadmin — constrain to the same max-w-7xl used by the
    // Navbar and Footer so all three align horizontally.
    return (
      <>
        {navbar}
        <main
          id="main-content"
          className="mx-auto w-full max-w-7xl px-4 sm:px-6"
        >
          {children}
        </main>
        {footer}
      </>
    );
  }

  return (
    <>
      {navbar}

      <main
        id="main-content"
        className="mx-auto min-h-[calc(100vh-4rem)] w-full max-w-7xl px-4 py-8 sm:px-6"
      >
        {children}
      </main>

      {footer}
    </>
  );
}
