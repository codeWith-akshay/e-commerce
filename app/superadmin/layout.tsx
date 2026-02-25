import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import AdminSidebarToggle from "@/components/AdminSidebarToggle";

/**
 * SuperAdmin Layout — Server Component
 *
 * Only users with the SUPERADMIN role may enter this subtree.
 * Middleware already blocks unauthenticated requests; this is an
 * additional defence-in-depth guard.
 */
export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user || session.user.role !== "SUPERADMIN") {
    redirect("/login");
  }

  const adminName = session.user.name ?? session.user.email ?? "SuperAdmin";

  return (
    <AdminSidebarToggle adminName={adminName}>
      {children}
    </AdminSidebarToggle>
  );
}
