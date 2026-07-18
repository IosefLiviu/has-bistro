"use client";

import { Badge } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Order, OrderStatus } from "@/lib/types";
import { ORDER_STATUS_FLOW, PAYMENT_LABELS, STATUS_LABELS } from "@/lib/types";
import { cn, formatPhone, formatTime, lei, optionsSummary } from "@/lib/utils";
import {
  Bike,
  CheckCircle2,
  ChefHat,
  CircleDot,
  Clock,
  PackageCheck,
  PartyPopper,
  Phone,
  Receipt,
  Store,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

const STATUS_ICONS: Record<OrderStatus, typeof Clock> = {
  new: CircleDot,
  accepted: CheckCircle2,
  preparing: ChefHat,
  ready: PackageCheck,
  out_for_delivery: Bike,
  completed: PartyPopper,
  cancelled: XCircle,
  refunded: Receipt,
};

const STATUS_HINTS: Record<OrderStatus, string> = {
  new: "Comanda a ajuns la noi — o preluăm imediat.",
  accepted: "Comanda a fost preluată de echipă.",
  preparing: "Bucătăria lucrează la comanda ta.",
  ready: "Comanda e gata! Te așteptăm să o ridici.",
  out_for_delivery: "Curierul e pe drum spre tine.",
  completed: "Poftă bună! Mulțumim pentru comandă.",
  cancelled: "Comanda a fost anulată.",
  refunded: "Comanda a fost rambursată.",
};

export function OrderTracker({
  initial,
  isNew,
  phones,
}: {
  initial: Order;
  isNew: boolean;
  phones: string[];
}) {
  const [order, setOrder] = useState(initial);

  useEffect(() => {
    const supa = supabaseBrowser();
    const channel = supa
      .channel(`order-${initial.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${initial.id}` },
        (payload) => {
          setOrder((prev) => ({ ...prev, ...(payload.new as Partial<Order>) }));
        }
      )
      .subscribe();
    // fallback: reîmprospătare la 30s dacă realtime nu e disponibil (RLS pentru vizitatori)
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${initial.id}`);
        if (res.ok) {
          const fresh = await res.json();
          setOrder((prev) => ({ ...prev, ...fresh }));
        }
      } catch {
        /* offline */
      }
    }, 30_000);
    return () => {
      supa.removeChannel(channel);
      clearInterval(interval);
    };
  }, [initial.id]);

  const flow =
    order.type === "pickup"
      ? ORDER_STATUS_FLOW.filter((s) => s !== "out_for_delivery")
      : ORDER_STATUS_FLOW;
  const isCancelled = order.status === "cancelled" || order.status === "refunded";
  const currentIdx = flow.indexOf(order.status);

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6">
      {isNew && !isCancelled && (
        <div
          className="card-surface mb-6 border-mint/30 bg-mint/8 p-5 text-center"
          style={{ animation: "fade-up 0.6s cubic-bezier(0.22,1,0.36,1) both" }}
        >
          <PartyPopper className="mx-auto size-8 text-mint" />
          <h2 className="mt-2 font-display text-xl font-extrabold text-mint">
            Comanda a fost trimisă!
          </h2>
          <p className="mt-1 text-sm text-cream/80">
            Numărul comenzii: <strong className="tabular-nums">#{order.order_number}</strong>.
            Păstrează această pagină ca să urmărești statusul în timp real.
          </p>
        </div>
      )}

      <div className="card-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-mute">
              Comanda <span className="tabular-nums">#{order.order_number}</span>
            </p>
            <h1 className="mt-1 font-display text-2xl font-extrabold">
              {STATUS_LABELS[order.status]}
            </h1>
            <p className="mt-1 text-sm text-mute">{STATUS_HINTS[order.status]}</p>
          </div>
          <Badge tone={isCancelled ? "red" : order.payment_status === "paid" ? "green" : "gold"}>
            {order.payment_status === "paid"
              ? "Plătită online"
              : PAYMENT_LABELS[order.payment_method]}
          </Badge>
        </div>

        {/* cronologie */}
        {!isCancelled && (
          <ol className="mt-7 flex flex-col gap-0">
            {flow.map((status, i) => {
              const Icon = STATUS_ICONS[status];
              const reached = i <= currentIdx;
              const isCurrent = i === currentIdx;
              const last = i === flow.length - 1;
              return (
                <li key={status} className="relative flex gap-4 pb-6 last:pb-0">
                  {!last && (
                    <span
                      className={cn(
                        "absolute left-[17px] top-9 h-[calc(100%-2rem)] w-0.5 rounded",
                        i < currentIdx ? "bg-gold" : "bg-[var(--hairline-strong)]"
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      "relative z-10 grid size-9 shrink-0 place-items-center rounded-full border transition-all duration-500",
                      reached
                        ? "border-gold bg-gold text-ink"
                        : "border-[var(--hairline-strong)] bg-coal text-faint",
                      isCurrent && order.status !== "completed" && "animate-pulse-gold"
                    )}
                  >
                    <Icon className="size-4.5" />
                  </span>
                  <div className="pt-1.5">
                    <p
                      className={cn(
                        "font-display font-bold leading-none",
                        reached ? "text-cream" : "text-faint"
                      )}
                    >
                      {status === "ready" && order.type === "delivery"
                        ? "Gata de livrare"
                        : STATUS_LABELS[status]}
                    </p>
                    {status === "new" && (
                      <p className="mt-1 text-xs text-mute">
                        plasată la {formatTime(order.created_at)}
                      </p>
                    )}
                    {status === "accepted" && order.accepted_at && (
                      <p className="mt-1 text-xs text-mute">{formatTime(order.accepted_at)}</p>
                    )}
                    {status === "completed" && order.completed_at && (
                      <p className="mt-1 text-xs text-mute">{formatTime(order.completed_at)}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {isCancelled && (
          <p className="mt-5 rounded-xl border border-brick/40 bg-brick/10 px-4 py-3 text-sm text-cream/85">
            {order.status === "refunded"
              ? "Suma plătită a fost rambursată."
              : "Dacă ai întrebări despre anulare, sună-ne — rezolvăm imediat."}
          </p>
        )}

        {/* detalii */}
        <div className="mt-7 border-t border-[var(--hairline)] pt-5">
          <div className="flex items-center gap-2.5 text-sm text-cream/85">
            {order.type === "delivery" ? (
              <>
                <Bike className="size-4 text-gold" />
                Livrare la: {order.address?.street}
                {order.address?.details ? `, ${order.address.details}` : ""}
              </>
            ) : (
              <>
                <Store className="size-4 text-gold" />
                Ridicare personală de la bistro
              </>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2.5 text-sm text-cream/85">
            <Clock className="size-4 text-gold" />
            {order.requested_time === "asap" ? "Cât mai repede" : `Programată: ${order.requested_time}`}
          </div>
        </div>

        <ul className="mt-5 flex flex-col gap-2.5 border-t border-[var(--hairline)] pt-5">
          {order.items?.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="font-semibold">
                  <span className="text-gold tabular-nums">{item.qty}×</span> {item.name}
                </p>
                {item.options.length > 0 && (
                  <p className="text-xs text-faint">{optionsSummary(item.options)}</p>
                )}
                {item.notes && <p className="text-xs italic text-faint">„{item.notes}”</p>}
              </div>
              <span className="shrink-0 font-semibold tabular-nums">{lei(item.total)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex flex-col gap-1.5 border-t border-[var(--hairline)] pt-4 text-sm">
          <div className="flex justify-between text-mute">
            <span>Subtotal</span>
            <span className="tabular-nums">{lei(order.subtotal)}</span>
          </div>
          {Number(order.delivery_fee) > 0 && (
            <div className="flex justify-between text-mute">
              <span>Livrare</span>
              <span className="tabular-nums">{lei(order.delivery_fee)}</span>
            </div>
          )}
          {Number(order.discount) > 0 && (
            <div className="flex justify-between text-mint">
              <span>Reducere</span>
              <span className="tabular-nums">−{lei(order.discount)}</span>
            </div>
          )}
          <div className="flex items-baseline justify-between pt-1">
            <span className="font-display font-extrabold">Total</span>
            <span className="font-display text-xl font-extrabold text-gold tabular-nums">
              {lei(order.total)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 text-center text-sm text-mute">
        Întrebări despre comandă?{" "}
        {phones.map((p, i) => (
          <span key={p}>
            {i > 0 && " · "}
            <a
              href={`tel:${p.replace(/\s/g, "")}`}
              className="inline-flex items-center gap-1 font-semibold text-gold hover:underline"
            >
              <Phone className="size-3.5" />
              {formatPhone(p.replace(/\s/g, ""))}
            </a>
          </span>
        ))}
      </div>
    </div>
  );
}
