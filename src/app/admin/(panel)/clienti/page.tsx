import { CustomersManager } from "@/components/admin/customers-manager";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { CustomerStats } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  const db = supabaseAdmin();
  const { data } = await db
    .from("customer_stats")
    .select("*")
    .order("total_spent", { ascending: false })
    .limit(500);

  const customers = ((data ?? []) as CustomerStats[]).map((x) => ({
    ...x,
    total_spent: Number(x.total_spent),
    orders_count: Number(x.orders_count),
  }));

  return <CustomersManager customers={customers} initialOpenId={c ?? null} />;
}
