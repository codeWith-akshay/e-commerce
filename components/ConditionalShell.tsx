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
    return (
      <>
        {navbar}
        <main
          id="main-content"
          className="w-full"
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
        className="w-full min-h-[calc(100vh-4rem)] px-4 sm:px-6 lg:px-8 py-8"
      >
        {children}
      </main>

      {footer}
    </>
  );
}
