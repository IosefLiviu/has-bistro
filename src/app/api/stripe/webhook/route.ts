import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "webhook nesetat" }, { status: 400 });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "semnătură lipsă" }, { status: 400 });

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = stripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "semnătură invalidă" }, { status: 400 });
  }

  const db = supabaseAdmin();

  if (
    event.type === "payment_intent.succeeded" ||
    event.type === "payment_intent.payment_failed"
  ) {
    const intent = event.data.object as Stripe.PaymentIntent;
    const orderId = intent.metadata?.order_id;
    if (orderId) {
      const paid = event.type === "payment_intent.succeeded";
      await db
        .from("orders")
        .update({ payment_status: paid ? "paid" : "failed" })
        .eq("id", orderId);
      await db.from("order_events").insert({
        order_id: orderId,
        event_type: "payment",
        note: paid ? "Plată online confirmată (Stripe)" : "Plată online eșuată (Stripe)",
      });
    }
  }

  return NextResponse.json({ received: true });
}
