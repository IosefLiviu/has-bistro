import { createOrder, OrderError, type OrderPayload } from "@/lib/orders";
import { stripe, stripeEnabled } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let payload: OrderPayload;
  try {
    payload = (await req.json()) as OrderPayload;
  } catch {
    return NextResponse.json({ error: "Payload invalid." }, { status: 400 });
  }

  // legăm comanda de contul autentificat, dacă există
  try {
    const supa = await supabaseServer();
    const {
      data: { user },
    } = await supa.auth.getUser();
    payload.auth_user_id = user?.id ?? null;
  } catch {
    payload.auth_user_id = null;
  }

  if (payload.payment_method === "card_online" && !stripeEnabled()) {
    return NextResponse.json(
      { error: "Plata online cu cardul nu este activă momentan." },
      { status: 400 }
    );
  }

  try {
    const order = await createOrder(payload);

    if (payload.payment_method === "card_online") {
      const intent = await stripe().paymentIntents.create({
        amount: Math.round(Number(order.total) * 100),
        currency: "ron",
        automatic_payment_methods: { enabled: true },
        description: `HASH Bistro — comanda #${order.order_number}`,
        metadata: { order_id: order.id, order_number: String(order.order_number) },
      });
      await supabaseAdmin()
        .from("orders")
        .update({ stripe_payment_intent: intent.id })
        .eq("id", order.id);
      return NextResponse.json({
        id: order.id,
        order_number: order.order_number,
        client_secret: intent.client_secret,
      });
    }

    return NextResponse.json({ id: order.id, order_number: order.order_number });
  } catch (err) {
    if (err instanceof OrderError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error("order create failed:", err);
    return NextResponse.json(
      { error: "A apărut o eroare neașteptată. Încearcă din nou sau sună-ne." },
      { status: 500 }
    );
  }
}
