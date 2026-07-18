import { OrderTracker } from "@/components/track/order-tracker";
import { getSettings } from "@/lib/settings";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Order } from "@/lib/types";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Urmărește comanda",
  robots: { index: false },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function OrderTrackingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ noua?: string }>;
}) {
  const { id } = await params;
  const { noua } = await searchParams;
  if (!UUID_RE.test(id)) notFound();

  const db = supabaseAdmin();
  const { data: order } = await db
    .from("orders")
    .select("*, items:order_items(id,name,qty,unit_price,options,total,notes)")
    .eq("id", id)
    .maybeSingle();
  if (!order) notFound();

  const settings = await getSettings();

  return (
    <div className="pt-24 pb-16">
      <OrderTracker
        initial={order as Order}
        isNew={noua === "1"}
        phones={settings.restaurant.phones}
      />
    </div>
  );
}
