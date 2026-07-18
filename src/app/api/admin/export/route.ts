import { requireStaff } from "@/lib/admin-api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PAYMENT_LABELS, STATUS_LABELS } from "@/lib/types";
import type { OrderStatus, PaymentMethod } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: Array<Record<string, unknown>>, headers: string[]): string {
  const lines = [headers.join(";")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvCell(row[h])).join(";"));
  }
  // BOM pentru diacritice corecte în Excel
  return "﻿" + lines.join("\r\n");
}

export async function GET(req: NextRequest) {
  const { fail } = await requireStaff();
  if (fail) return fail;

  const type = req.nextUrl.searchParams.get("type") ?? "orders";
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const db = supabaseAdmin();
  const stamp = new Date().toISOString().slice(0, 10);

  if (type === "customers") {
    const { data } = await db
      .from("customer_stats")
      .select("*")
      .order("total_spent", { ascending: false })
      .limit(5000);
    const rows = (data ?? []).map((c) => ({
      Nume: c.name,
      Telefon: c.phone,
      Email: c.email,
      Comenzi: c.orders_count,
      "Total cheltuit (lei)": c.total_spent,
      "Ultima comandă": c.last_order_at,
      Tip: c.auth_user_id ? "cont" : "vizitator",
      Notițe: c.notes,
    }));
    return new NextResponse(
      toCsv(rows, ["Nume", "Telefon", "Email", "Comenzi", "Total cheltuit (lei)", "Ultima comandă", "Tip", "Notițe"]),
      {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="clienti-hash-${stamp}.csv"`,
        },
      }
    );
  }

  let query = db
    .from("orders")
    .select("*, items:order_items(name,qty,unit_price,options,total)")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (from) query = query.gte("created_at", `${from}T00:00:00`);
  if (to) query = query.lte("created_at", `${to}T23:59:59`);
  const { data } = await query;

  const rows = (data ?? []).map((o) => ({
    Nr: o.order_number,
    Data: new Date(o.created_at).toLocaleString("ro-RO"),
    Client: o.customer_name,
    Telefon: o.customer_phone,
    Email: o.customer_email,
    Tip: o.type === "delivery" ? "livrare" : "ridicare",
    Adresă: o.address ? `${o.address.street}${o.address.details ? ", " + o.address.details : ""}` : "",
    Produse: (o.items ?? [])
      .map(
        (i: { qty: number; name: string; options: Array<{ item: string }> }) =>
          `${i.qty}x ${i.name}${i.options?.length ? ` (${i.options.map((x) => x.item).join(", ")})` : ""}`
      )
      .join(" | "),
    Subtotal: o.subtotal,
    Livrare: o.delivery_fee,
    Reducere: o.discount,
    Total: o.total,
    Plată: PAYMENT_LABELS[o.payment_method as PaymentMethod],
    "Status plată": o.payment_status,
    Status: STATUS_LABELS[o.status as OrderStatus],
    "Cod promo": o.promo_code,
    Observații: o.notes,
  }));

  return new NextResponse(
    toCsv(rows, [
      "Nr", "Data", "Client", "Telefon", "Email", "Tip", "Adresă", "Produse",
      "Subtotal", "Livrare", "Reducere", "Total", "Plată", "Status plată", "Status",
      "Cod promo", "Observații",
    ]),
    {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="comenzi-hash-${stamp}.csv"`,
      },
    }
  );
}
