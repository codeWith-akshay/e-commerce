import { redirect } from "next/navigation";

/**
 * /superadmin — redirects to the only superadmin section that exists.
 */
export default function SuperAdminRootPage() {
  redirect("/superadmin/users");
}
