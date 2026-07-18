import { SettingsManager } from "@/components/admin/settings-manager";
import { getSettings } from "@/lib/settings";
import { getCurrentStaff } from "@/lib/staff";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Staff } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const [settings, staff] = await Promise.all([getSettings(), getCurrentStaff()]);
  const db = supabaseAdmin();
  const { data: staffList } = await db
    .from("staff")
    .select("id,name,role,active")
    .order("created_at");

  return (
    <SettingsManager
      settings={settings}
      staffList={(staffList ?? []) as Staff[]}
      currentStaff={staff!}
    />
  );
}
