import { requireStaff } from "@/lib/admin-api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { OrderStatus } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/types";
import { NEXT_STATUS } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type Body =
  | { action: "ack" }
  | { action: "status"; status: OrderStatus; note?: string }
  | { action: "printed" }
  | { action: "payment"; payment_status: "paid" | "pending" | "refunded" };

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { staff, fail } = await requireStaff();
  if (fail) return fail;

  const { id } = await params;
  const body = (await req.json()) as Body;
  const db = supabaseAdmin();

  const { data: order } = await db.from("orders").select("*").eq("id", id).maybeSingle();
  if (!order) return NextResponse.json({ error: "Comanda nu există." }, { status: 404 });

  const now = new Date().toISOString();

  if (body.action === "ack") {
    if (!order.acknowledged_at) {
      await db
        .from("orders")
        .update({ acknowledged_at: now, acknowledged_by: staff.id })
        .eq("id", id);
      await db.from("order_events").insert({
        order_id: id,
        staff_id: staff.id,
        staff_name: staff.name,
        event_type: "acknowledged",
        note: "Comandă văzută",
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "printed") {
    await db.from("order_events").insert({
      order_id: id,
      staff_id: staff.id,
      staff_name: staff.name,
      event_type: "printed",
      note: "Bon imprimat",
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "payment") {
    await db.from("orders").update({ payment_status: body.payment_status }).eq("id", id);
    await db.from("order_events").insert({
      order_id: id,
      staff_id: staff.id,
      staff_name: staff.name,
      event_type: "payment",
      note: `Status plată: ${body.payment_status}`,
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "status") {
    const allowed = NEXT_STATUS[order.status as OrderStatus] ?? [];
    if (!allowed.includes(body.status)) {
      return NextResponse.json(
        { error: `Nu se poate trece din „${STATUS_LABELS[order.status as OrderStatus]}” în „${STATUS_LABELS[body.status]}”.` },
        { status: 400 }
      );
    }
    const patch: Record<string, unknown> = { status: body.status };
    if (!order.acknowledged_at) {
      patch.acknowledged_at = now;
      patch.acknowledged_by = staff.id;
    }
    if (body.status === "accepted") {
      patch.accepted_at = now;
      patch.accepted_by = staff.id;
    }
    if (body.status === "completed") patch.completed_at = now;
    if (body.status === "cancelled") patch.cancelled_reason = body.note ?? null;
    if (body.status === "refunded") patch.payment_status = "refunded";
    // încasare la predare pentru plățile offline
    if (
      body.status === "completed" &&
      order.payment_status === "pending" &&
      order.payment_method !== "card_online"
    ) {
      patch.payment_status = "paid";
    }

    await db.from("orders").update(patch).eq("id", id);
    await db.from("order_events").insert({
      order_id: id,
      staff_id: staff.id,
      staff_name: staff.name,
      event_type: "status_changed",
      from_status: order.status,
      to_status: body.status,
      note: body.note ?? null,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Acțiune necunoscută." }, { status: 400 });
}
