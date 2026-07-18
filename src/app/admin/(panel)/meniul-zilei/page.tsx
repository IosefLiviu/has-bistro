import { DailyManager } from "@/components/admin/daily-manager";
import { bucharestToday } from "@/lib/catalog";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { DailyMenu } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminDailyPage() {
  const db = supabaseAdmin();
  const { data } = await db
    .from("daily_menus")
    .select("*")
    .order("menu_date", { ascending: false })
    .limit(60);

  const menus = ((data ?? []) as DailyMenu[]).map((m) => ({ ...m, price: Number(m.price) }));

  return <DailyManager menus={menus} today={bucharestToday()} />;
}
