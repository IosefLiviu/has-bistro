"use client";

import { Badge, Button, Sheet, Spinner, Textarea } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { CustomerStats, Order } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/types";
import { formatDateTime, formatPhone, lei, timeAgo } from "@/lib/utils";
import { Download, Phone, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export function CustomersManager({
  customers,
  initialOpenId,
}: {
  customers: CustomerStats[];
  initialOpenId: string | null;
}) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(initialOpenId);
  const open = customers.find((c) => c.id === openId) ?? null;

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q.replace(/\s/g, "")) ||
        (c.email ?? "").toLowerCase().includes(q)
    );
  }, [customers, query]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-extrabold">Clienți</h1>
        <span className="text-sm text-faint tabular-nums">{customers.length}</span>
        <div className="ml-auto flex items-center gap-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nume, telefon, email…"
              className="w-56 rounded-xl border border-[var(--hairline-strong)] bg-slate py-2 pl-9 pr-3 text-sm text-cream placeholder:text-faint outline-none focus:border-gold/70"
            />
          </div>
          <a href="/api/admin/export?type=customers" download>
            <Button size="sm" variant="ghost">
              <Download className="size-4" /> Export CSV
            </Button>
          </a>
        </div>
      </div>

      <div className="card-surface mt-5 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-[var(--hairline)] text-left text-xs font-bold uppercase tracking-wider text-mute">
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Telefon</th>
              <th className="px-4 py-3 text-right">Comenzi</th>
              <th className="px-4 py-3 text-right">Total cheltuit</th>
              <th className="px-4 py-3">Ultima comandă</th>
              <th className="px-4 py-3">Tip</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr
                key={c.id}
                onClick={() => setOpenId(c.id)}
                className="cursor-pointer border-b border-[var(--hairline)] transition last:border-0 hover:bg-cream/4"
              >
                <td className="px-4 py-3 font-semibold">{c.name || "—"}</td>
                <td className="px-4 py-3 tabular-nums">{formatPhone(c.phone)}</td>
                <td className="px-4 py-3 text-right font-bold tabular-nums">{c.orders_count}</td>
                <td className="px-4 py-3 text-right font-bold text-gold tabular-nums">
                  {lei(c.total_spent)}
                </td>
                <td className="px-4 py-3 text-mute">
                  {c.last_order_at ? timeAgo(c.last_order_at) : "—"}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={c.auth_user_id ? "gold" : "muted"}>
                    {c.auth_user_id ? "cont" : "vizitator"}
                  </Badge>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-14 text-center text-mute">
                  Niciun client găsit.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <CustomerSheet customer={open} onClose={() => setOpenId(null)} />
    </div>
  );
}

function CustomerSheet({
  customer,
  onClose,
}: {
  customer: CustomerStats | null;
  onClose: () => void;
}) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [tops, setTops] = useState<Array<{ name: string; qty: number }>>([]);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    if (!customer) return;
    setOrders(null);
    setNotes(customer.notes ?? "");
    const supa = supabaseBrowser();
    Promise.all([
      supa
        .from("orders")
        .select("id,order_number,status,total,type,created_at")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })
        .limit(15),
      supa.rpc("customer_top_products", { cust_id: customer.id, lim: 5 }),
    ]).then(([o, t]) => {
      setOrders((o.data as Order[]) ?? []);
      setTops((t.data as typeof tops) ?? []);
    });
  }, [customer]);

  async function saveNotes() {
    if (!customer) return;
    setSavingNotes(true);
    await fetch("/api/admin/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: customer.id, notes }),
    });
    setSavingNotes(false);
  }

  return (
    <Sheet
      open={!!customer}
      onClose={onClose}
      title={
        customer && (
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-gold/15 text-gold">
              <UserRound className="size-4.5" />
            </span>
            <div>
              <p className="font-display font-extrabold leading-none">{customer.name || "Client"}</p>
              <a
                href={`tel:${customer.phone}`}
                className="mt-0.5 flex items-center gap-1 text-xs text-gold hover:underline tabular-nums"
              >
                <Phone className="size-3" /> {formatPhone(customer.phone)}
              </a>
            </div>
          </div>
        )
      }
    >
      {customer && (
        <div className="flex flex-col gap-5 p-5">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="card-surface p-3">
              <p className="font-display text-2xl font-extrabold text-gold tabular-nums">
                {customer.orders_count}
              </p>
              <p className="text-xs text-mute">comenzi</p>
            </div>
            <div className="card-surface p-3">
              <p className="font-display text-2xl font-extrabold text-gold tabular-nums">
                {lei(customer.total_spent)}
              </p>
              <p className="text-xs text-mute">total</p>
            </div>
            <div className="card-surface p-3">
              <p className="font-display text-2xl font-extrabold tabular-nums">
                {customer.orders_count
                  ? lei(Math.round((customer.total_spent / customer.orders_count) * 100) / 100)
                  : "—"}
              </p>
              <p className="text-xs text-mute">medie/comandă</p>
            </div>
          </div>

          {customer.email && <p className="text-sm text-mute">Email: {customer.email}</p>}

          {tops.length > 0 && (
            <div>
              <h3 className="mb-2 font-display font-extrabold">Produse preferate</h3>
              <div className="flex flex-wrap gap-2">
                {tops.map((t) => (
                  <Badge key={t.name} tone="gold">
                    {t.qty}× {t.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="mb-2 font-display font-extrabold">Notițe interne</h3>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ex: preferă mâncare picantă, atenție la interfon…"
            />
            <Button size="sm" variant="ghost" className="mt-2" onClick={saveNotes} disabled={savingNotes}>
              {savingNotes ? <Spinner className="size-4" /> : "Salvează notițele"}
            </Button>
          </div>

          <div>
            <h3 className="mb-2 font-display font-extrabold">Istoricul comenzilor</h3>
            {orders === null ? (
              <div className="grid place-items-center py-8">
                <Spinner />
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {orders.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/admin/comenzi/${o.id}`}
                      className="card-surface flex items-center justify-between gap-3 px-4 py-2.5 text-sm transition hover:border-gold/40"
                    >
                      <span className="font-bold text-gold tabular-nums">#{o.order_number}</span>
                      <span className="text-xs text-mute">{formatDateTime(o.created_at)}</span>
                      <Badge
                        tone={
                          o.status === "completed"
                            ? "green"
                            : o.status === "cancelled" || o.status === "refunded"
                              ? "red"
                              : "gold"
                        }
                      >
                        {STATUS_LABELS[o.status]}
                      </Badge>
                      <span className="font-bold tabular-nums">{lei(o.total)}</span>
                    </Link>
                  </li>
                ))}
                {orders.length === 0 && (
                  <li className="py-4 text-center text-sm text-mute">Nicio comandă încă.</li>
                )}
              </ul>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}
