import { Badge, Button } from "@/components/ui";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PAYMENT_LABELS } from "@/lib/types";
import type { PaymentMethod } from "@/lib/types";
import { cn, formatPhone, lei } from "@/lib/utils";
import { Download } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Report = {
  orders_count: number;
  revenue: number;
  avg_order: number;
  cancelled_count: number;
  delivery_count: number;
  pickup_count: number;
  by_payment: Record<string, number>;
  by_day: Array<{ day: string; revenue: number; orders: number }>;
  top_products: Array<{ name: string; qty: number; revenue: number }>;
  top_customers: Array<{ name: string; phone: string; orders: number; spent: number }>;
};

const PERIODS = [
  { key: "azi", label: "Azi", days: 1 },
  { key: "7z", label: "Ultimele 7 zile", days: 7 },
  { key: "30z", label: "Ultimele 30 zile", days: 30 },
  { key: "90z", label: "Ultimele 90 zile", days: 90 },
] as const;

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const { p = "7z" } = await searchParams;
  const period = PERIODS.find((x) => x.key === p) ?? PERIODS[1];

  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - (period.days - 1));
  const to = new Date();
  to.setDate(to.getDate() + 1);
  to.setHours(0, 0, 0, 0);

  const db = supabaseAdmin();
  const { data } = await db.rpc("sales_report", {
    from_ts: from.toISOString(),
    to_ts: to.toISOString(),
  });
  const r = (data ?? {}) as Report;

  const maxDayRevenue = Math.max(1, ...(r.by_day ?? []).map((d) => Number(d.revenue)));
  const maxProductQty = Math.max(1, ...(r.top_products ?? []).map((t) => Number(t.qty)));
  const paymentTotal = Object.values(r.by_payment ?? {}).reduce((s, v) => s + Number(v), 0) || 1;
  const dpTotal = (Number(r.delivery_count) || 0) + (Number(r.pickup_count) || 0) || 1;

  const fromStr = from.toISOString().slice(0, 10);
  const toStr = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-extrabold">Rapoarte</h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {PERIODS.map((x) => (
            <Link
              key={x.key}
              href={`/admin/rapoarte?p=${x.key}`}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-bold transition",
                period.key === x.key
                  ? "border-gold bg-gold text-ink"
                  : "border-[var(--hairline-strong)] text-cream/80 hover:border-gold/50"
              )}
            >
              {x.label}
            </Link>
          ))}
          <a href={`/api/admin/export?type=orders&from=${fromStr}&to=${toStr}`} download>
            <Button size="sm" variant="ghost">
              <Download className="size-4" /> Export comenzi
            </Button>
          </a>
        </div>
      </div>

      {/* KPI */}
      <div className="mt-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {[
          { label: "Comenzi", value: String(r.orders_count ?? 0) },
          { label: "Încasări", value: lei(Number(r.revenue ?? 0)) },
          { label: "Valoare medie", value: lei(Number(r.avg_order ?? 0)) },
          { label: "Anulate / rambursate", value: String(r.cancelled_count ?? 0), warn: true },
        ].map((kpi) => (
          <div key={kpi.label} className="card-surface p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-mute">{kpi.label}</p>
            <p
              className={cn(
                "mt-1.5 font-display text-2xl font-extrabold tabular-nums",
                kpi.warn && Number(kpi.value) > 0 ? "text-brick" : "text-gold"
              )}
            >
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {/* vânzări pe zile */}
        <section className="card-surface p-5">
          <h2 className="mb-4 font-display text-lg font-extrabold">Încasări pe zile</h2>
          {(r.by_day ?? []).length === 0 ? (
            <p className="py-10 text-center text-sm text-mute">Nicio comandă în perioada aleasă.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {r.by_day.map((d) => (
                <div key={d.day} className="flex items-center gap-3 text-sm">
                  <span className="w-24 shrink-0 text-xs text-mute tabular-nums">
                    {new Date(d.day + "T12:00:00").toLocaleDateString("ro-RO", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </span>
                  <div className="h-6 flex-1 overflow-hidden rounded-md bg-slate">
                    <div
                      className="flex h-full items-center rounded-md px-2"
                      style={{
                        width: `${Math.max(4, (Number(d.revenue) / maxDayRevenue) * 100)}%`,
                        background: "var(--gold-grad)",
                      }}
                    >
                      <span className="text-[0.7rem] font-extrabold text-ink whitespace-nowrap tabular-nums">
                        {lei(Number(d.revenue))}
                      </span>
                    </div>
                  </div>
                  <span className="w-16 shrink-0 text-right text-xs text-faint tabular-nums">
                    {d.orders} com.
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* top produse */}
        <section className="card-surface p-5">
          <h2 className="mb-4 font-display text-lg font-extrabold">Cele mai vândute</h2>
          {(r.top_products ?? []).length === 0 ? (
            <p className="py-10 text-center text-sm text-mute">Încă nimic vândut.</p>
          ) : (
            <ol className="flex flex-col gap-2.5">
              {r.top_products.map((t, i) => (
                <li key={t.name} className="flex items-center gap-3 text-sm">
                  <span className="w-5 shrink-0 text-right font-display font-extrabold text-faint tabular-nums">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-semibold">{t.name}</span>
                      <span className="shrink-0 text-xs text-mute tabular-nums">
                        {t.qty} buc · {lei(Number(t.revenue))}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded bg-slate">
                      <div
                        className="h-full rounded"
                        style={{
                          width: `${(Number(t.qty) / maxProductQty) * 100}%`,
                          background: "var(--gold-grad)",
                        }}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* plăți */}
        <section className="card-surface p-5">
          <h2 className="mb-4 font-display text-lg font-extrabold">Metode de plată</h2>
          <div className="flex flex-col gap-2.5">
            {Object.entries(r.by_payment ?? {}).map(([method, count]) => (
              <div key={method} className="flex items-center gap-3 text-sm">
                <span className="w-40 shrink-0">{PAYMENT_LABELS[method as PaymentMethod] ?? method}</span>
                <div className="h-5 flex-1 overflow-hidden rounded-md bg-slate">
                  <div
                    className="h-full rounded-md"
                    style={{
                      width: `${(Number(count) / paymentTotal) * 100}%`,
                      background: "var(--gold-grad)",
                    }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right font-bold tabular-nums">{count}</span>
              </div>
            ))}
            {Object.keys(r.by_payment ?? {}).length === 0 && (
              <p className="py-6 text-center text-sm text-mute">—</p>
            )}
          </div>
          <h3 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wider text-mute">
            Livrare vs ridicare
          </h3>
          <div className="flex h-7 overflow-hidden rounded-lg">
            <div
              className="grid place-items-center text-[0.7rem] font-extrabold text-ink"
              style={{
                width: `${(Number(r.delivery_count) / dpTotal) * 100}%`,
                background: "var(--gold-grad)",
                minWidth: Number(r.delivery_count) ? "3.5rem" : 0,
              }}
            >
              {Number(r.delivery_count) ? `${r.delivery_count} livrare` : ""}
            </div>
            <div
              className="grid flex-1 place-items-center bg-slate text-[0.7rem] font-extrabold text-cream"
              style={{ minWidth: Number(r.pickup_count) ? "3.5rem" : 0 }}
            >
              {Number(r.pickup_count) ? `${r.pickup_count} ridicare` : ""}
            </div>
          </div>
        </section>

        {/* top clienți */}
        <section className="card-surface p-5">
          <h2 className="mb-4 font-display text-lg font-extrabold">Cei mai activi clienți</h2>
          <ul className="flex flex-col gap-2">
            {(r.top_customers ?? []).map((c) => (
              <li key={c.phone} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{c.name}</p>
                  <p className="text-xs text-faint tabular-nums">{formatPhone(c.phone)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone="muted">{c.orders} comenzi</Badge>
                  <span className="font-bold text-gold tabular-nums">{lei(Number(c.spent))}</span>
                </div>
              </li>
            ))}
            {(r.top_customers ?? []).length === 0 && (
              <p className="py-6 text-center text-sm text-mute">—</p>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
