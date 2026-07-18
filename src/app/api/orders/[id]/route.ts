import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Urmărire comandă (link privat prin UUID — nu expunem date sensibile ale altor comenzi). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const db = supabaseAdmin();
  const { data: order } = await db
    .from("orders")
    .select(
      "id,order_number,type,status,payment_method,payment_status,customer_name,address,requested_time,subtotal,delivery_fee,discount,total,created_at,accepted_at,completed_at,items:order_items(id,name,qty,unit_price,options,total,notes)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(order);
}
