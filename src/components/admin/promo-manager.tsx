"use client";

import { Badge, Button, Field, Input, Spinner } from "@/components/ui";
import type { PromoCode } from "@/lib/types";
import { formatDateTime, lei } from "@/lib/utils";
import { Plus, Ticket, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function PromoManager({ codes }: { codes: PromoCode[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: "",
    type: "percent" as "percent" | "fixed",
    value: "",
    min_order: "",
    ends_at: "",
    max_uses: "",
  });

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/promo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: form.code,
        type: form.type,
        value: parseFloat(form.value) || 0,
        min_order: parseFloat(form.min_order) || 0,
        ends_at: form.ends_at ? new Date(form.ends_at + "T23:59:59").toISOString() : null,
        max_uses: form.max_uses ? parseInt(form.max_uses) : null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Eroare.");
      return;
    }
    setShowForm(false);
    setForm({ code: "", type: "percent", value: "", min_order: "", ends_at: "", max_uses: "" });
    router.refresh();
  }

  async function toggle(c: PromoCode) {
    await fetch("/api/admin/promo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...c, active: !c.active }),
    });
    router.refresh();
  }

  async function remove(c: PromoCode) {
    if (!confirm(`Ștergi codul ${c.code}?`)) return;
    await fetch("/api/admin/promo", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id }),
    });
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <h1 className="font-display text-2xl font-extrabold">Coduri promoționale</h1>
        <Button size="sm" className="ml-auto" onClick={() => setShowForm(!showForm)}>
          <Plus className="size-4" /> Cod nou
        </Button>
      </div>

      {showForm && (
        <div className="card-surface mt-5 grid gap-4 p-5 sm:grid-cols-3">
          <Field label="Cod">
            <Input
              placeholder="ex: HASH10"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            />
          </Field>
          <Field label="Tip reducere">
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as "percent" | "fixed" })}
              className="w-full cursor-pointer rounded-xl border border-[var(--hairline-strong)] bg-slate px-4 py-2.5 text-cream outline-none"
            >
              <option value="percent" className="bg-coal">Procent (%)</option>
              <option value="fixed" className="bg-coal">Sumă fixă (lei)</option>
            </select>
          </Field>
          <Field label={form.type === "percent" ? "Procent (%)" : "Valoare (lei)"}>
            <Input
              type="number"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
          </Field>
          <Field label="Comandă minimă (lei)">
            <Input
              type="number"
              value={form.min_order}
              onChange={(e) => setForm({ ...form, min_order: e.target.value })}
            />
          </Field>
          <Field label="Valabil până la (opțional)">
            <Input
              type="date"
              value={form.ends_at}
              onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
            />
          </Field>
          <Field label="Nr. maxim de utilizări (opțional)">
            <Input
              type="number"
              value={form.max_uses}
              onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
            />
          </Field>
          {error && <p className="text-sm text-brick sm:col-span-3">{error}</p>}
          <div className="sm:col-span-3">
            <Button onClick={save} disabled={busy || !form.code || !form.value}>
              {busy ? <Spinner /> : "Creează codul"}
            </Button>
          </div>
        </div>
      )}

      <ul className="mt-5 flex flex-col gap-2.5">
        {codes.map((c) => (
          <li key={c.id} className="card-surface flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="grid size-9 place-items-center rounded-lg bg-gold/15 text-gold">
              <Ticket className="size-4.5" />
            </span>
            <span className="font-display text-lg font-extrabold tracking-wider">{c.code}</span>
            <Badge tone="gold">
              {c.type === "percent" ? `−${c.value}%` : `−${lei(c.value)}`}
            </Badge>
            {c.min_order > 0 && <Badge tone="muted">min. {lei(c.min_order)}</Badge>}
            {c.ends_at && (
              <span className="text-xs text-faint">până la {formatDateTime(c.ends_at).slice(0, 10)}</span>
            )}
            <span className="text-xs text-faint tabular-nums">
              folosit {c.used_count}
              {c.max_uses ? `/${c.max_uses}` : ""} ori
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => toggle(c)}
                className={`cursor-pointer rounded-full px-3 py-1 text-xs font-extrabold ${
                  c.active ? "bg-mint/15 text-mint" : "bg-cream/8 text-faint"
                }`}
              >
                {c.active ? "Activ" : "Inactiv"}
              </button>
              <button
                onClick={() => remove(c)}
                className="cursor-pointer p-1.5 text-faint hover:text-brick"
                aria-label="Șterge"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </li>
        ))}
        {codes.length === 0 && !showForm && (
          <li className="rounded-2xl border border-dashed border-[var(--hairline-strong)] py-14 text-center text-mute">
            Niciun cod promoțional încă. Creează primul!
          </li>
        )}
      </ul>
    </div>
  );
}
