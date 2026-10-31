
import { requireRole } from "@/lib/authorization";

export const instant = false;

export default async function AdminUsersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(["super_admin"]);

  return children;
}
