import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/** GET /api/promo?code=X&subtotal=Y — verificare cod promoțional (informativ, re-validat la plasare). */
export async function GET(req: NextRequest) {
  const code = (req.nextUrl.searchParams.get("code") ?? "").trim();
  const subtotal = parseFloat(req.nextUrl.searchParams.get("subtotal") ?? "0") || 0;
  if (!code) return NextResponse.json({ valid: false });

  const db = supabaseAdmin();
  const { data: promo } = await db
    .from("promo_codes")
    .select("code,type,value,min_order,active,starts_at,ends_at,max_uses,used_count")
    .ilike("code", code)
    .eq("active", true)
    .maybeSingle();

  const now = new Date().toISOString();
  if (
    !promo ||
    (promo.starts_at && promo.starts_at > now) ||
    (promo.ends_at && promo.ends_at < now) ||
    (promo.max_uses != null && promo.used_count >= promo.max_uses)
  ) {
    return NextResponse.json({ valid: false, reason: "invalid" });
  }
  if (subtotal < Number(promo.min_order)) {
    return NextResponse.json({
      valid: false,
      reason: "min_order",
      min_order: Number(promo.min_order),
    });
  }
  const discount =
    promo.type === "percent"
      ? Math.round(subtotal * Number(promo.value)) / 100
      : Math.min(Number(promo.value), subtotal);
  return NextResponse.json({
    valid: true,
    code: promo.code,
    discount: Math.round(discount * 100) / 100,
  });
}
