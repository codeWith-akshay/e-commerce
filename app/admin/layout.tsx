import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import AdminSidebarToggle from "@/components/AdminSidebarToggle";

/**
 * Admin Layout — Server Component
 *
 * Reads the JWT session (no DB round-trip) to verify the user is
 * ADMIN or SUPERADMIN before rendering the shell. The middleware
 * already blocks unauthenticated requests; this is a defence-in-depth
 * guard that also makes the admin name available server-side.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Middleware handles the redirect in most cases; this covers any
  // edge case where the layout is rendered outside the middleware path.
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN")) {
    redirect("/login");
  }

  const adminName = session.user.name ?? session.user.email ?? "Admin";

  return (
    <AdminSidebarToggle adminName={adminName}>
      {children}
    </AdminSidebarToggle>
  );
}
