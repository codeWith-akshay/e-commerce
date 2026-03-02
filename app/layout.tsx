import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ConditionalShell from "@/components/ConditionalShell";
import { isEnabled } from "@/lib/actions/feature-flags";
import { FLAGS }     from "@/lib/flags";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "ShopNest — Your One-Stop Shop",
    template: "%s | ShopNest",
  },
  description:
    "Discover thousands of products across electronics, fashion, home décor, fitness, and more at ShopNest.",
  keywords: ["ecommerce", "online shopping", "electronics", "fashion", "deals"],
  authors: [{ name: "ShopNest" }],
  robots: { index: true, follow: true },
  openGraph: {
    siteName: "ShopNest",
    type: "website",
    locale: "en_US",
    title: "ShopNest — Your One-Stop Shop",
    description:
      "Discover thousands of products across electronics, fashion, home décor, fitness, and more.",
  },
  twitter: {
    card: "summary_large_image",
    title: "ShopNest — Your One-Stop Shop",
    description: "Quality products at honest prices. Shop electronics, fashion, home décor, and more.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4f46e5", // indigo-600
};

// ── Navbar loading skeleton (shown while Navbar server component streams) ────
function NavbarSkeleton() {
  return (
    <div className="sticky top-0 z-50 w-full bg-white border-b border-gray-100">
      {/* Announcement bar */}
      <div className="bg-indigo-600 py-1.5" />
      {/* Nav row */}
      <div className="mx-auto flex h-16 max-w-7xl animate-pulse items-center justify-between gap-4 px-4 sm:px-6">
        <div className="h-7 w-32 rounded-lg bg-gray-200" />
        <div className="hidden h-10 flex-1 max-w-xl rounded-full bg-gray-100 lg:block" />
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-full bg-gray-100" />
          <div className="h-9 w-9 rounded-full bg-gray-100" />
          <div className="hidden h-9 w-24 rounded-full bg-indigo-100 sm:block" />
        </div>
      </div>
    </div>
  );
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const maintenanceMode = await isEnabled(FLAGS.MAINTENANCE_MODE);
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${
          geistSans.variable
        } ${geistMono.variable} w-full antialiased bg-gray-50 text-gray-900`}
      >
        {/* Skip to main content link for screen-reader / keyboard users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-100 focus:rounded-lg focus:bg-indigo-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:outline-none"
        >
          Skip to main content
        </a>

        {/*
          ConditionalShell is a client component that reads usePathname() on
          every navigation. It renders admin/superadmin pages bare (their own
          full-screen layout) and wraps all other pages with Navbar + Footer.
          Navbar and Footer are passed as server-rendered slots so they still
          benefit from server-side session reads.
        */}
        <ConditionalShell
          navbar={
            <Suspense fallback={<NavbarSkeleton />}>
              <Navbar />
            </Suspense>
          }
          footer={<Footer />}
        >
          {maintenanceMode && (
            <div
              role="alert"
              className="w-full bg-amber-500 px-4 py-2.5 text-center text-xs font-semibold text-white shadow-sm"
            >
              🚧 ShopNest is currently undergoing scheduled maintenance. Some features may be temporarily unavailable.
            </div>
          )}
          {children}
        </ConditionalShell>
      </body>
    </html>
  );
}
