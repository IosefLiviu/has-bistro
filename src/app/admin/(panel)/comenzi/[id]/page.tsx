import { OrderActions } from "@/components/admin/order-actions";
import { paymentBadge, STATUS_TONES } from "@/components/admin/order-card";
import { Badge } from "@/components/ui";
import { getSettings } from "@/lib/settings";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Order, OrderStatus } from "@/lib/types";
import { PAYMENT_LABELS, STATUS_LABELS } from "@/lib/types";
import { cn, formatDateTime, formatPhone, lei, optionsSummary, timeAgo } from "@/lib/utils";
import {
  Bike,
  Clock,
  History,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Store,
  User,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = supabaseAdmin();

  const { data: order } = await db
    .from("orders")
    .select(
      "*, items:order_items(id,name,qty,unit_price,options,total,notes), events:order_events(id,staff_name,event_type,from_status,to_status,note,created_at)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!order) notFound();
  const o = order as Order;

  const settings = await getSettings();

  /* istoricul clientului */
  let historyCount = 0;
  let historyTotal = 0;
  let topProducts: Array<{ name: string; qty: number }> = [];
  if (o.customer_id) {
    const { data: stats } = await db
      .from("customer_stats")
      .select("orders_count,total_spent")
      .eq("id", o.customer_id)
      .maybeSingle();
    historyCount = Number(stats?.orders_count ?? 0);
    historyTotal = Number(stats?.total_spent ?? 0);
    const { data: tops } = await db.rpc("customer_top_products", {
      cust_id: o.customer_id,
      lim: 3,
    });
    topProducts = (tops as typeof topProducts) ?? [];
  }

  const pay = paymentBadge(o);
  const events = (o.events ?? []).slice().sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-1 flex items-center gap-2 text-sm text-mute">
        <Link href="/admin" className="hover:text-gold">
          Comenzi
        </Link>
        <span>/</span>
        <span className="tabular-nums">#{o.order_number}</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-extrabold tabular-nums">
          Comanda #{o.order_number}
        </h1>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wide",
              STATUS_TONES[o.status as OrderStatus]
            )}
          >
            {STATUS_LABELS[o.status as OrderStatus]}
          </span>
          <Badge tone={pay.tone}>{pay.label}</Badge>
        </div>
      </div>
      <p className="mt-1 text-sm text-mute">
        plasată {timeAgo(o.created_at)} · {formatDateTime(o.created_at)} ·{" "}
        {o.requested_time === "asap" ? "cât mai repede" : `programată la ${o.requested_time}`}
      </p>

      <div className="mt-5">
        <OrderActions order={o} autoPrint={settings.printer.auto_print_on_accept} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        {/* stânga: produse + totale */}
        <div className="flex flex-col gap-5">
          <section className="card-surface p-5">
            <h2 className="mb-3 font-display text-lg font-extrabold">Produse</h2>
            <ul className="divide-y divide-[var(--hairline)]">
              {o.items?.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-4 py-3">
                  <div>
                    <p className="font-semibold">
                      <span className="text-gold tabular-nums">{item.qty}×</span> {item.name}
                    </p>
                    {item.options.length > 0 && (
                      <p className="mt-0.5 text-sm text-mute">{optionsSummary(item.options)}</p>
                    )}
                    {item.notes && (
                      <p className="mt-0.5 text-sm italic text-gold">„{item.notes}”</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-bold tabular-nums">{lei(item.total)}</p>
                    <p className="text-xs text-faint tabular-nums">
                      {item.qty} × {lei(item.unit_price)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-col gap-1.5 border-t border-[var(--hairline)] pt-3 text-sm">
              <div className="flex justify-between text-mute">
                <span>Subtotal</span>
                <span className="tabular-nums">{lei(o.subtotal)}</span>
              </div>
              <div className="flex justify-between text-mute">
                <span>Livrare</span>
                <span className="tabular-nums">{Number(o.delivery_fee) ? lei(o.delivery_fee) : "—"}</span>
              </div>
              {Number(o.discount) > 0 && (
                <div className="flex justify-between text-mint">
                  <span>Reducere {o.promo_code ? `(${o.promo_code})` : ""}</span>
                  <span className="tabular-nums">−{lei(o.discount)}</span>
                </div>
              )}
              <div className="flex items-baseline justify-between pt-1">
                <span className="font-display text-base font-extrabold">Total</span>
                <span className="font-display text-2xl font-extrabold text-gold tabular-nums">
                  {lei(o.total)}
                </span>
              </div>
              <p className="text-xs text-faint">
                Plată: {PAYMENT_LABELS[o.payment_method]}
                {o.stripe_payment_intent ? ` · ${o.stripe_payment_intent}` : ""}
              </p>
            </div>
          </section>

          {(o.notes || o.delivery_notes) && (
            <section className="card-surface border-gold/30 p-5">
              <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-extrabold">
                <MessageSquare className="size-4.5 text-gold" /> Observații
              </h2>
              {o.notes && <p className="text-sm text-cream/90">„{o.notes}”</p>}
              {o.delivery_notes && (
                <p className="mt-1 text-sm text-cream/90">
                  <span className="text-mute">Pentru curier:</span> „{o.delivery_notes}”
                </p>
              )}
            </section>
          )}

          {/* istoric acțiuni */}
          <section className="card-surface p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-extrabold">
              <History className="size-4.5 text-gold" /> Istoricul comenzii
            </h2>
            <ol className="flex flex-col gap-2.5">
              {events.map((ev) => (
                <li key={ev.id} className="flex items-baseline gap-3 text-sm">
                  <span className="shrink-0 text-xs text-faint tabular-nums">
                    {formatDateTime(ev.created_at).slice(-5)}
                  </span>
                  <span className="text-cream/85">
                    {ev.event_type === "created" && "Comandă plasată de client"}
                    {ev.event_type === "acknowledged" && "Văzută"}
                    {ev.event_type === "printed" && "Bon imprimat"}
                    {ev.event_type === "payment" && (ev.note ?? "Plată actualizată")}
                    {ev.event_type === "status_changed" &&
                      `${STATUS_LABELS[(ev.from_status ?? "new") as OrderStatus]} → ${STATUS_LABELS[(ev.to_status ?? "new") as OrderStatus]}`}
                    {ev.note && ev.event_type === "status_changed" && (
                      <span className="text-mute"> · {ev.note}</span>
                    )}
                    {ev.staff_name && (
                      <span className="font-semibold text-gold"> — {ev.staff_name}</span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* dreapta: client + livrare */}
        <div className="flex flex-col gap-5">
          <section className="card-surface p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-extrabold">
              <User className="size-4.5 text-gold" /> Client
            </h2>
            <p className="font-semibold">{o.customer_name}</p>
            <a
              href={`tel:${o.customer_phone}`}
              className="mt-1 flex items-center gap-2 text-sm text-gold hover:underline tabular-nums"
            >
              <Phone className="size-3.5" /> {formatPhone(o.customer_phone)}
            </a>
            {o.customer_email && (
              <p className="mt-1 flex items-center gap-2 text-sm text-mute">
                <Mail className="size-3.5" /> {o.customer_email}
              </p>
            )}
            <div className="mt-3 rounded-xl bg-slate/70 px-3.5 py-2.5 text-sm">
              {historyCount <= 1 ? (
                <p className="font-semibold text-gold">✨ Client nou — prima comandă!</p>
              ) : (
                <>
                  <p>
                    <strong className="tabular-nums">{historyCount}</strong> comenzi ·{" "}
                    <strong className="tabular-nums">{lei(historyTotal)}</strong> total
                  </p>
                  {topProducts.length > 0 && (
                    <p className="mt-1 text-xs text-mute">
                      Preferate: {topProducts.map((t) => t.name).join(", ")}
                    </p>
                  )}
                </>
              )}
            </div>
            {o.customer_id && (
              <Link
                href={`/admin/clienti?c=${o.customer_id}`}
                className="mt-3 inline-block text-sm text-gold hover:underline"
              >
                Vezi profilul complet →
              </Link>
            )}
          </section>

          <section className="card-surface p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-extrabold">
              {o.type === "delivery" ? (
                <>
                  <Bike className="size-4.5 text-gold" /> Livrare
                </>
              ) : (
                <>
                  <Store className="size-4.5 text-gold" /> Ridicare personală
                </>
              )}
            </h2>
            {o.type === "delivery" && o.address ? (
              <>
                <p className="flex items-start gap-2 text-sm">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-gold" />
                  <span>
                    {o.address.street}
                    {o.address.details ? `, ${o.address.details}` : ""} · {o.address.city}
                  </span>
                </p>
                {o.address.distance_km != null && (
                  <p className="mt-2 text-xs text-mute">
                    {o.address.distance_km} km de bistro
                  </p>
                )}
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                    `${o.address.street}, ${o.address.city}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-sm text-gold hover:underline"
                >
                  Deschide în Google Maps →
                </a>
              </>
            ) : (
              <p className="flex items-center gap-2 text-sm text-mute">
                <Clock className="size-4 text-gold" />
                {o.requested_time === "asap"
                  ? "Clientul vine cât mai repede"
                  : `Clientul vine la ${o.requested_time}`}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
