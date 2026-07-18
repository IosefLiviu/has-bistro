"use client";

import type { Order, PrinterSettings, RestaurantSettings } from "@/lib/types";
import { PAYMENT_LABELS } from "@/lib/types";
import { formatDateTime, formatPhone, optionsSummary } from "@/lib/utils";
import { useEffect } from "react";

function money(v: number | string) {
  return `${Number(v).toFixed(2)} lei`;
}

/**
 * Bon pentru imprimantă termică de 80mm (lățime utilă ~72mm).
 * Alb-negru pur, font mono, fără elemente grafice care ies prost la termic.
 */
export function PrintReceipt({
  order,
  restaurant,
  printer,
}: {
  order: Order;
  restaurant: RestaurantSettings;
  printer: PrinterSettings;
}) {
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("preview")) return;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);

  const line = "─".repeat(32);

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @page {
          size: ${printer.width_mm}mm auto;
          margin: 3mm;
        }
        html,
        body {
          background: #fff !important;
          color: #000 !important;
        }
        body::before {
          display: none !important;
        }
        .receipt {
          width: ${printer.width_mm - 8}mm;
          margin: 0 auto;
          font-family: "Courier New", ui-monospace, monospace;
          font-size: 11.5px;
          line-height: 1.45;
          color: #000;
          background: #fff;
          padding: 8px 0 16px;
        }
        .receipt .center { text-align: center; }
        .receipt .big { font-size: 15px; font-weight: 700; }
        .receipt .xl { font-size: 19px; font-weight: 700; }
        .receipt .row { display: flex; justify-content: space-between; gap: 8px; }
        .receipt .row span:first-child { flex: 1; }
        .receipt .muted { font-size: 10.5px; }
        .receipt .sep { margin: 6px 0; white-space: nowrap; overflow: hidden; }
        .receipt .item { margin-bottom: 5px; }
        .receipt .opts { padding-left: 12px; font-size: 10.5px; }
        @media screen {
          body { background: #2a2a2e !important; }
          .receipt {
            margin: 24px auto;
            box-shadow: 0 8px 40px rgb(0 0 0 / 0.5);
            padding: 16px 12px 24px;
            border-radius: 4px;
          }
        }
      `,
        }}
      />

      <div className="receipt">
        <div className="center xl">HASH BISTRO</div>
        <div className="center muted">&amp; Take Away</div>
        <div className="center muted">
          Tel: {restaurant.phones.map((p) => formatPhone(p.replace(/\s/g, ""))).join(" / ")}
        </div>
        {printer.header_note && <div className="center muted">{printer.header_note}</div>}

        <div className="sep">{line}</div>
        <div className="center xl">COMANDA #{order.order_number}</div>
        <div className="center muted">{formatDateTime(order.created_at)}</div>
        <div className="center big">
          {order.type === "delivery" ? "»» LIVRARE ««" : "»» RIDICARE PERSONALĂ ««"}
        </div>
        {order.requested_time !== "asap" && (
          <div className="center big">Ora cerută: {order.requested_time}</div>
        )}
        <div className="sep">{line}</div>

        <div className="big">{order.customer_name}</div>
        <div>Tel: {formatPhone(order.customer_phone)}</div>
        {order.type === "delivery" && order.address && (
          <>
            <div>
              Adresă: {order.address.street}
              {order.address.details ? `, ${order.address.details}` : ""}
            </div>
            {order.address.distance_km != null && (
              <div className="muted">Distanță: {order.address.distance_km} km</div>
            )}
          </>
        )}
        {order.delivery_notes && <div>Curier: {order.delivery_notes}</div>}

        <div className="sep">{line}</div>

        {order.items?.map((item) => (
          <div className="item" key={item.id}>
            <div className="row big">
              <span>
                {item.qty} x {item.name}
              </span>
              <span>{money(item.total)}</span>
            </div>
            {item.options.length > 0 && (
              <div className="opts">» {optionsSummary(item.options)}</div>
            )}
            {item.notes && <div className="opts">! {item.notes}</div>}
          </div>
        ))}

        {order.notes && (
          <>
            <div className="sep">{line}</div>
            <div className="big">OBS: {order.notes}</div>
          </>
        )}

        <div className="sep">{line}</div>
        <div className="row">
          <span>Subtotal</span>
          <span>{money(order.subtotal)}</span>
        </div>
        {Number(order.delivery_fee) > 0 && (
          <div className="row">
            <span>Livrare</span>
            <span>{money(order.delivery_fee)}</span>
          </div>
        )}
        {Number(order.discount) > 0 && (
          <div className="row">
            <span>Reducere{order.promo_code ? ` (${order.promo_code})` : ""}</span>
            <span>-{money(order.discount)}</span>
          </div>
        )}
        <div className="row xl">
          <span>TOTAL</span>
          <span>{money(order.total)}</span>
        </div>

        <div className="sep">{line}</div>
        <div className="center big">
          {order.payment_status === "paid"
            ? "✔ PLĂTITĂ — " + PAYMENT_LABELS[order.payment_method].toUpperCase()
            : "DE ÎNCASAT: " + PAYMENT_LABELS[order.payment_method].toUpperCase()}
        </div>
        {order.payment_status !== "paid" && (
          <div className="center xl">{money(order.total)}</div>
        )}

        <div className="sep">{line}</div>
        <div className="center muted">{printer.footer_note}</div>
        <div className="center muted">Bon nefiscal</div>
      </div>
    </>
  );
}
