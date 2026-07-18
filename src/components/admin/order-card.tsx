"use client";

import { Badge } from "@/components/ui";
import type { Order, OrderStatus } from "@/lib/types";
import { PAYMENT_LABELS, STATUS_LABELS } from "@/lib/types";
import { cn, formatPhone, lei, minutesSince } from "@/lib/utils";
import { Banknote, Bike, CheckCheck, CreditCard, Eye, Globe, Store } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export const STATUS_TONES: Record<OrderStatus, string> = {
  new: "bg-gold text-ink",
  accepted: "bg-gold/15 text-gold",
  preparing: "bg-[#e8a82e]/15 text-[#f6c550]",
  ready: "bg-mint/15 text-mint",
  out_for_delivery: "bg-sky-400/15 text-sky-300",
  completed: "bg-mint/15 text-mint",
  cancelled: "bg-brick/15 text-brick",
  refunded: "bg-brick/15 text-brick",
};

export const QUICK_NEXT: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  new: { status: "accepted", label: "Acceptă comanda" },
  accepted: { status: "preparing", label: "În preparare" },
};

export function quickNextFor(order: Order): { status: OrderStatus; label: string } | null {
  if (order.status === "new") return { status: "accepted", label: "Acceptă comanda" };
  if (order.status === "accepted") return { status: "preparing", label: "Începe prepararea" };
  if (order.status === "preparing")
    return order.type === "delivery"
      ? { status: "out_for_delivery", label: "Trimite la livrare" }
      : { status: "ready", label: "Gata de ridicare" };
  if (order.status === "ready") return { status: "completed", label: "Finalizează" };
  if (order.status === "out_for_delivery") return { status: "completed", label: "Finalizează" };
  return null;
}

export function paymentBadge(order: Order) {
  if (order.payment_status === "paid" && order.payment_method === "card_online") {
    return { tone: "green" as const, label: "PLĂTITĂ ONLINE", icon: Globe };
  }
  if (order.payment_status === "paid") {
    return { tone: "green" as const, label: "Încasată", icon: CheckCheck };
  }
  if (order.payment_status === "refunded") {
    return { tone: "red" as const, label: "Rambursată", icon: CheckCheck };
  }
  const cash = order.payment_method.startsWith("cash");
  return {
    tone: "gold" as const,
    label: `De încasat: ${cash ? "numerar" : "card"}`,
    icon: cash ? Banknote : CreditCard,
  };
}

export function OrderCard({ order, tick }: { order: Order; tick: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  void tick; // forțează re-render pentru cronometre

  const ageMin = minutesSince(order.created_at);
  const isNew = order.status === "new";
  const escalated = isNew && !order.acknowledged_at && ageMin >= 3;
  const next = quickNextFor(order);
  const pay = paymentBadge(order);

  async function advance(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!next || busy) return;
    setBusy(true);
    await fetch(`/api/admin/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status", status: next.status }),
    });
    router.refresh();
    setBusy(false);
  }

  return (
    <Link
      href={`/admin/comenzi/${order.id}`}
      className={cn(
        "card-surface relative block p-4 transition hover:border-gold/40",
        isNew && !escalated && "animate-pulse-gold border-gold/60",
        escalated && "animate-pulse-gold border-brick/70 bg-brick/6"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display text-lg font-extrabold text-gold tabular-nums">
              #{order.order_number}
            </span>
            <span className={cn("rounded-full px-2.5 py-0.5 text-[0.7rem] font-extrabold uppercase tracking-wide", STATUS_TONES[order.status])}>
              {STATUS_LABELS[order.status]}
            </span>
          </div>
          <p className="mt-1.5 font-semibold leading-tight">{order.customer_name}</p>
          <p className="text-xs text-mute tabular-nums">{formatPhone(order.customer_phone)}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-lg font-extrabold tabular-nums">{lei(order.total)}</p>
          <p
            className={cn(
              "mt-0.5 text-xs font-semibold tabular-nums",
              escalated ? "text-brick" : ageMin > 10 ? "text-gold" : "text-faint"
            )}
          >
            acum {ageMin} min
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge tone="muted">
          {order.type === "delivery" ? (
            <>
              <Bike className="size-3" /> livrare
            </>
          ) : (
            <>
              <Store className="size-3" /> ridicare
            </>
          )}
        </Badge>
        <Badge tone={pay.tone}>
          <pay.icon className="size-3" />
          {pay.label}
        </Badge>
        {order.requested_time !== "asap" && (
          <Badge tone="gold">programată {order.requested_time}</Badge>
        )}
        {!order.acknowledged_at && order.status === "new" && (
          <Badge tone={escalated ? "red" : "gold"}>
            <Eye className="size-3" /> nevăzută
          </Badge>
        )}
      </div>

      {(order.items?.length ?? 0) > 0 && (
        <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-mute">
          {order.items!.map((i) => `${i.qty}× ${i.name}`).join(", ")}
        </p>
      )}

      {next && (
        <button
          onClick={advance}
          disabled={busy}
          className={cn(
            "btn-gold mt-3 w-full cursor-pointer rounded-xl py-2.5 text-sm font-extrabold",
            busy && "opacity-60"
          )}
        >
          {busy ? "..." : next.label}
        </button>
      )}
    </Link>
  );
}
