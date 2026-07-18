import { OrdersBoard } from "@/components/admin/orders-board";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Order } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const db = supabaseAdmin();
  const since = new Date();
  since.setHours(0, 0, 0, 0);

  // comenzile de azi + orice comandă încă activă din zilele trecute
  const { data } = await db
    .from("orders")
    .select("*, items:order_items(id,name,qty,unit_price,options,total,notes)")
    .or(
      `created_at.gte.${since.toISOString()},status.in.(new,accepted,preparing,ready,out_for_delivery)`
    )
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div>
      <h1 className="mb-5 font-display text-2xl font-extrabold">Comenzi live</h1>
      <OrdersBoard orders={(data as Order[]) ?? []} />
    </div>
  );
}
