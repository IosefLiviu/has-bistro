import { PrintReceipt } from "@/components/admin/print-receipt";
import { getSettings } from "@/lib/settings";
import { getCurrentStaff } from "@/lib/staff";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Order } from "@/lib/types";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = { title: "Bon comandă", robots: { index: false } };

export default async function PrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/admin/login");

  const { id } = await params;
  const db = supabaseAdmin();
  const { data: order } = await db
    .from("orders")
    .select("*, items:order_items(id,name,qty,unit_price,options,total,notes)")
    .eq("id", id)
    .maybeSingle();
  if (!order) notFound();

  const settings = await getSettings();

  return (
    <PrintReceipt
      order={order as Order}
      restaurant={settings.restaurant}
      printer={settings.printer}
    />
  );
}
