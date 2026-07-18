import { requireStaff } from "@/lib/admin-api";
import { getSettings } from "@/lib/settings";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Escaladare: trimite comanda nepreluată către webhook-ul configurat
 * (poate fi legat la WhatsApp/SMS/Slack printr-un serviciu extern, ex. Make/Zapier/Twilio).
 */
export async function POST(req: NextRequest) {
  const { fail } = await requireStaff();
  if (fail) return fail;

  const { order_id } = (await req.json()) as { order_id: string };
  const settings = await getSettings();
  const url = settings.notifications.escalation_webhook_url;
  if (!url) return NextResponse.json({ ok: false, reason: "no_webhook" });

  const db = supabaseAdmin();
  const { data: order } = await db
    .from("orders")
    .select("id,order_number,customer_name,customer_phone,total,type,created_at,acknowledged_at,status")
    .eq("id", order_id)
    .maybeSingle();
  if (!order || order.acknowledged_at || order.status !== "new") {
    return NextResponse.json({ ok: false, reason: "already_handled" });
  }

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "order_unacknowledged",
        message: `⚠️ Comanda #${order.order_number} (${order.customer_name}, ${order.total} lei) așteaptă de peste ${settings.notifications.escalate_after_minutes} minute!`,
        order,
      }),
      signal: AbortSignal.timeout(8000),
    });
    await db.from("order_events").insert({
      order_id,
      event_type: "escalated",
      note: "Alertă trimisă către webhook-ul de escaladare",
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, reason: "webhook_failed" });
  }
}
