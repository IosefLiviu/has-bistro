"use client";

import { Button } from "@/components/ui";
import type { Order, OrderStatus } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/types";
import { NEXT_STATUS } from "@/lib/utils";
import { quickNextFor } from "@/components/admin/order-card";
import { Ban, CheckCheck, Printer, RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function OrderActions({
  order,
  autoPrint,
}: {
  order: Order;
  autoPrint: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  /* marcare „văzută” la deschidere */
  useEffect(() => {
    if (!order.acknowledged_at && order.status === "new") {
      fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ack" }),
      }).then(() => router.refresh());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  async function call(body: Record<string, unknown>, key: string) {
    setBusy(key);
    const res = await fetch(`/api/admin/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Eroare");
    }
    router.refresh();
    setBusy(null);
    return res.ok;
  }

  async function setStatus(status: OrderStatus, note?: string) {
    const ok = await call({ action: "status", status, note }, status);
    if (ok && status === "accepted" && autoPrint) {
      openPrint();
    }
  }

  function openPrint() {
    fetch(`/api/admin/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "printed" }),
    });
    window.open(`/imprimare/${order.id}`, "_blank", "width=420,height=650");
  }

  const next = quickNextFor(order);
  const canCancel = (NEXT_STATUS[order.status] ?? []).includes("cancelled");
  const canRefund = (NEXT_STATUS[order.status] ?? []).includes("refunded");
  const offlineUnpaid =
    order.payment_status === "pending" && order.payment_method !== "card_online";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2.5">
        {next && (
          <Button
            size="lg"
            disabled={busy != null}
            onClick={() => setStatus(next.status)}
            className="flex-1 sm:flex-none"
          >
            {next.label}
          </Button>
        )}
        {order.status === "preparing" && order.type === "pickup" && null}
        <Button variant="ghost" size="lg" onClick={openPrint}>
          <Printer className="size-4.5" /> Printează bonul
        </Button>
        {offlineUnpaid && order.status !== "cancelled" && (
          <Button
            variant="ghost"
            size="lg"
            disabled={busy != null}
            onClick={() => call({ action: "payment", payment_status: "paid" }, "pay")}
          >
            <CheckCheck className="size-4.5" /> Marchează încasată
          </Button>
        )}
        {canCancel && (
          <Button
            variant="danger"
            size="lg"
            disabled={busy != null}
            onClick={() => setCancelOpen(!cancelOpen)}
          >
            <Ban className="size-4.5" /> Anulează
          </Button>
        )}
        {canRefund && (
          <Button
            variant="danger"
            size="lg"
            disabled={busy != null}
            onClick={() => setStatus("refunded", "Marcată ca rambursată")}
          >
            <RefreshCcw className="size-4.5" /> Marchează rambursată
          </Button>
        )}
      </div>

      {cancelOpen && (
        <div className="card-surface flex flex-col gap-3 border-brick/40 p-4">
          <label className="text-sm font-semibold text-cream/85">
            Motivul anulării (apare în istoric):
          </label>
          <input
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="ex: client de negăsit, produs indisponibil…"
            className="rounded-xl border border-[var(--hairline-strong)] bg-slate px-4 py-2.5 text-sm text-cream outline-none focus:border-brick/60"
          />
          <div className="flex gap-2">
            <Button
              variant="danger"
              size="sm"
              disabled={busy != null}
              onClick={() => {
                setStatus("cancelled", cancelReason || undefined);
                setCancelOpen(false);
              }}
            >
              Confirmă anularea
            </Button>
            <Button variant="bare" size="sm" onClick={() => setCancelOpen(false)}>
              Renunță
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
