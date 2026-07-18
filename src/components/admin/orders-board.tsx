"use client";

import { OrderCard } from "@/components/admin/order-card";
import type { Order } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const TABS = [
  { key: "active", label: "Active" },
  { key: "new", label: "Noi" },
  { key: "scheduled", label: "Programate" },
  { key: "done", label: "Finalizate azi" },
  { key: "cancelled", label: "Anulate azi" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const ACTIVE_STATUSES = ["new", "accepted", "preparing", "ready", "out_for_delivery"];

export function OrdersBoard({ orders }: { orders: Order[] }) {
  const [tab, setTab] = useState<TabKey>("active");
  const [query, setQuery] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const counts = useMemo(() => {
    return {
      active: orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length,
      new: orders.filter((o) => o.status === "new").length,
      scheduled: orders.filter(
        (o) => o.requested_time !== "asap" && ACTIVE_STATUSES.includes(o.status)
      ).length,
      done: orders.filter((o) => o.status === "completed").length,
      cancelled: orders.filter((o) => o.status === "cancelled" || o.status === "refunded")
        .length,
    };
  }, [orders]);

  const list = useMemo(() => {
    let filtered = orders;
    if (tab === "active") filtered = orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
    if (tab === "new") filtered = orders.filter((o) => o.status === "new");
    if (tab === "scheduled")
      filtered = orders.filter(
        (o) => o.requested_time !== "asap" && ACTIVE_STATUSES.includes(o.status)
      );
    if (tab === "done") filtered = orders.filter((o) => o.status === "completed");
    if (tab === "cancelled")
      filtered = orders.filter((o) => o.status === "cancelled" || o.status === "refunded");

    const q = query.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(
        (o) =>
          String(o.order_number).includes(q) ||
          o.customer_name.toLowerCase().includes(q) ||
          o.customer_phone.includes(q.replace(/\s/g, ""))
      );
    }
    // comenzile noi primele, apoi după vechime
    return filtered.slice().sort((a, b) => {
      const aNew = a.status === "new" ? 0 : 1;
      const bNew = b.status === "new" ? 0 : 1;
      if (aNew !== bNew) return aNew - bNew;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [orders, tab, query]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "cursor-pointer rounded-full border px-4 py-1.5 text-sm font-bold transition",
              tab === t.key
                ? "border-gold bg-gold text-ink"
                : "border-[var(--hairline-strong)] text-cream/80 hover:border-gold/50"
            )}
          >
            {t.label}
            <span className="ml-1.5 opacity-70 tabular-nums">{counts[t.key]}</span>
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Caută nr, nume, telefon…"
            className="w-full rounded-xl border border-[var(--hairline-strong)] bg-slate py-2 pl-9 pr-3 text-sm text-cream placeholder:text-faint outline-none focus:border-gold/70"
          />
        </div>
      </div>

      {list.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-[var(--hairline-strong)] py-20 text-center">
          <p className="text-mute">
            {tab === "active"
              ? "Nicio comandă activă acum. Când sosește una nouă, o auzi imediat. 🔔"
              : "Nimic aici deocamdată."}
          </p>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {list.map((o) => (
            <OrderCard key={o.id} order={o} tick={tick} />
          ))}
        </div>
      )}
    </div>
  );
}
