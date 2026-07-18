import { AdminShell } from "@/components/admin/admin-shell";
import { getSettings } from "@/lib/settings";
import { getCurrentStaff } from "@/lib/staff";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = { title: "HASH · Admin", robots: { index: false } };

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/admin/login");
  const settings = await getSettings();

  return (
    <AdminShell staff={staff} notifications={settings.notifications}>
      {children}
    </AdminShell>
  );
}
