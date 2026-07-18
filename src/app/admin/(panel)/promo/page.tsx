import { PromoManager } from "@/components/admin/promo-manager";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PromoCode } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPromoPage() {
  const db = supabaseAdmin();
  const { data } = await db
    .from("promo_codes")
    .select("*")
    .order("created_at", { ascending: false });
  const codes = ((data ?? []) as PromoCode[]).map((c) => ({
    ...c,
    value: Number(c.value),
    min_order: Number(c.min_order),
  }));
  return <PromoManager codes={codes} />;
}
