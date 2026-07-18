"use client";

import { useAdminNotifier } from "@/components/admin/admin-shell";
import { Badge, Button, Field, Input, Spinner, Textarea } from "@/components/ui";
import type { AllSettings } from "@/lib/settings";
import type { HoursSettings, Staff } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Loader2, MapPin, Plus, Volume2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

function SectionCard({
  title,
  description,
  children,
  onSave,
  saving,
  saved,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
}) {
  return (
    <section className="card-surface p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-extrabold">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-mute">{description}</p>}
        </div>
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? <Spinner className="size-4" /> : saved ? "Salvat ✓" : "Salvează"}
        </Button>
      </div>
      {children}
    </section>
  );
}

const DAY_LABELS: Array<{ key: keyof Omit<HoursSettings, "closed_dates">; label: string }> = [
  { key: "mon", label: "Luni" },
  { key: "tue", label: "Marți" },
  { key: "wed", label: "Miercuri" },
  { key: "thu", label: "Joi" },
  { key: "fri", label: "Vineri" },
  { key: "sat", label: "Sâmbătă" },
  { key: "sun", label: "Duminică" },
];

export function SettingsManager({
  settings,
  staffList,
  currentStaff,
}: {
  settings: AllSettings;
  staffList: Staff[];
  currentStaff: Staff;
}) {
  const router = useRouter();
  const notifier = useAdminNotifier();
  const [state, setState] = useState(settings);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(key: keyof AllSettings) {
    setSaving(key);
    setError(null);
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value: state[key] }),
    });
    setSaving(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Eroare la salvare.");
      return;
    }
    setSaved(key);
    setTimeout(() => setSaved(null), 2000);
    router.refresh();
  }

  async function locate() {
    setGeoBusy(true);
    setGeoMsg(null);
    try {
      const res = await fetch(
        `/api/geocode?q=${encodeURIComponent(state.restaurant.address_label)}`
      );
      const data = await res.json();
      if (data.found) {
        setState((s) => ({
          ...s,
          restaurant: { ...s.restaurant, lat: data.lat, lng: data.lng },
        }));
        setGeoMsg(`✓ Găsit: ${data.display_name ?? "coordonate actualizate"} — apasă Salvează.`);
      } else {
        setGeoMsg("Nu am găsit adresa. Scrie strada, numărul și orașul.");
      }
    } catch {
      setGeoMsg("Eroare de rețea la căutare.");
    }
    setGeoBusy(false);
  }

  const inputRow = "grid gap-4 sm:grid-cols-2";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <h1 className="font-display text-2xl font-extrabold">Setări</h1>
      {error && (
        <p className="rounded-xl border border-brick/50 bg-brick/10 px-4 py-2.5 text-sm text-brick">
          {error}
        </p>
      )}

      {/* Restaurant + locație */}
      <SectionCard
        title="Restaurant și locație"
        description="Coordonatele sunt centrul zonei de livrare — setează adresa exactă a bistroului."
        onSave={() => save("restaurant")}
        saving={saving === "restaurant"}
        saved={saved === "restaurant"}
      >
        <div className={inputRow}>
          <Field label="Nume restaurant" className="sm:col-span-2">
            <Input
              value={state.restaurant.name}
              onChange={(e) =>
                setState({ ...state, restaurant: { ...state.restaurant, name: e.target.value } })
              }
            />
          </Field>
          <Field label="Telefon principal">
            <Input
              value={state.restaurant.phones[0] ?? ""}
              onChange={(e) =>
                setState({
                  ...state,
                  restaurant: {
                    ...state.restaurant,
                    phones: [e.target.value, state.restaurant.phones[1] ?? ""].filter(Boolean),
                  },
                })
              }
            />
          </Field>
          <Field label="Telefon secundar">
            <Input
              value={state.restaurant.phones[1] ?? ""}
              onChange={(e) =>
                setState({
                  ...state,
                  restaurant: {
                    ...state.restaurant,
                    phones: [state.restaurant.phones[0] ?? "", e.target.value].filter(Boolean),
                  },
                })
              }
            />
          </Field>
          <Field label="Adresa completă" className="sm:col-span-2">
            <div className="flex gap-2">
              <Input
                value={state.restaurant.address_label}
                onChange={(e) =>
                  setState({
                    ...state,
                    restaurant: { ...state.restaurant, address_label: e.target.value },
                  })
                }
                placeholder="Strada, numărul, sector, București"
              />
              <Button variant="ghost" onClick={locate} disabled={geoBusy}>
                {geoBusy ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4" />}
                Caută pe hartă
              </Button>
            </div>
            {geoMsg && <span className="mt-1.5 block text-xs text-gold">{geoMsg}</span>}
            <span className="mt-1 block text-xs text-faint tabular-nums">
              Coordonate curente: {state.restaurant.lat.toFixed(5)}, {state.restaurant.lng.toFixed(5)}
            </span>
          </Field>
        </div>
      </SectionCard>

      {/* Livrare */}
      <SectionCard
        title="Livrare"
        onSave={() => save("delivery")}
        saving={saving === "delivery"}
        saved={saved === "delivery"}
      >
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Rază livrare (km)">
            <Input
              type="number"
              step="0.5"
              value={state.delivery.radius_km}
              onChange={(e) =>
                setState({
                  ...state,
                  delivery: { ...state.delivery, radius_km: parseFloat(e.target.value) || 0 },
                })
              }
            />
          </Field>
          <Field label="Taxă livrare (lei)">
            <Input
              type="number"
              value={state.delivery.fee}
              onChange={(e) =>
                setState({
                  ...state,
                  delivery: { ...state.delivery, fee: parseFloat(e.target.value) || 0 },
                })
              }
            />
          </Field>
          <Field label="Gratuit peste (lei)" hint="gol = niciodată">
            <Input
              type="number"
              value={state.delivery.free_over ?? ""}
              onChange={(e) =>
                setState({
                  ...state,
                  delivery: {
                    ...state.delivery,
                    free_over: e.target.value ? parseFloat(e.target.value) : null,
                  },
                })
              }
            />
          </Field>
          <Field label="Comandă minimă (lei)">
            <Input
              type="number"
              value={state.delivery.min_order}
              onChange={(e) =>
                setState({
                  ...state,
                  delivery: { ...state.delivery, min_order: parseFloat(e.target.value) || 0 },
                })
              }
            />
          </Field>
        </div>
      </SectionCard>

      {/* Program */}
      <SectionCard
        title="Program de funcționare"
        onSave={() => save("hours")}
        saving={saving === "hours"}
        saved={saved === "hours"}
      >
        <div className="flex flex-col gap-2.5">
          {DAY_LABELS.map(({ key, label }) => {
            const day = state.hours[key];
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="w-24 text-sm font-semibold">{label}</span>
                <button
                  onClick={() =>
                    setState({
                      ...state,
                      hours: {
                        ...state.hours,
                        [key]: day ? null : { open: "10:00", close: "22:00" },
                      },
                    })
                  }
                  className={cn(
                    "cursor-pointer rounded-full px-3 py-1 text-xs font-bold transition",
                    day ? "bg-mint/15 text-mint" : "bg-brick/15 text-brick"
                  )}
                >
                  {day ? "deschis" : "închis"}
                </button>
                {day && (
                  <>
                    <Input
                      type="time"
                      value={day.open}
                      onChange={(e) =>
                        setState({
                          ...state,
                          hours: { ...state.hours, [key]: { ...day, open: e.target.value } },
                        })
                      }
                      className="!w-32"
                    />
                    <span className="text-faint">–</span>
                    <Input
                      type="time"
                      value={day.close}
                      onChange={(e) =>
                        setState({
                          ...state,
                          hours: { ...state.hours, [key]: { ...day, close: e.target.value } },
                        })
                      }
                      className="!w-32"
                    />
                  </>
                )}
              </div>
            );
          })}
          <Field
            label="Zile închise (sărbători) — câte o dată pe linie, format AAAA-LL-ZZ"
            className="mt-2"
          >
            <Textarea
              value={(state.hours.closed_dates ?? []).join("\n")}
              placeholder="2026-12-25"
              onChange={(e) =>
                setState({
                  ...state,
                  hours: {
                    ...state.hours,
                    closed_dates: e.target.value
                      .split("\n")
                      .map((x) => x.trim())
                      .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)),
                  },
                })
              }
            />
          </Field>
        </div>
      </SectionCard>

      {/* Comenzi online */}
      <SectionCard
        title="Comenzi online"
        onSave={() => save("ordering")}
        saving={saving === "ordering"}
        saved={saved === "ordering"}
      >
        <div className="flex flex-wrap gap-2.5">
          {(
            [
              ["enabled", "Comenzi online active"],
              ["delivery_enabled", "Livrare activă"],
              ["pickup_enabled", "Ridicare activă"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() =>
                setState({ ...state, ordering: { ...state.ordering, [k]: !state.ordering[k] } })
              }
              className={cn(
                "cursor-pointer rounded-full border px-4 py-1.5 text-sm font-bold transition",
                state.ordering[k]
                  ? "border-mint/50 bg-mint/10 text-mint"
                  : "border-brick/50 bg-brick/10 text-brick"
              )}
            >
              {label}: {state.ordering[k] ? "DA" : "NU"}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Timp estimat preparare (min)">
            <Input
              type="number"
              value={state.ordering.prep_minutes}
              onChange={(e) =>
                setState({
                  ...state,
                  ordering: { ...state.ordering, prep_minutes: parseInt(e.target.value) || 30 },
                })
              }
            />
          </Field>
          <Field label="Timp estimat livrare (min)">
            <Input
              type="number"
              value={state.ordering.delivery_minutes}
              onChange={(e) =>
                setState({
                  ...state,
                  ordering: { ...state.ordering, delivery_minutes: parseInt(e.target.value) || 45 },
                })
              }
            />
          </Field>
          <Field label="Mesaj pauză (când comenzile sunt oprite)" className="sm:col-span-2">
            <Input
              placeholder="ex: Revenim la ora 18:00 — ne pare rău!"
              value={state.ordering.pause_message}
              onChange={(e) =>
                setState({
                  ...state,
                  ordering: { ...state.ordering, pause_message: e.target.value },
                })
              }
            />
          </Field>
        </div>
      </SectionCard>

      {/* Notificări */}
      <SectionCard
        title="Notificări comenzi noi"
        description="Sunetul se repetă până când cineva preia comanda."
        onSave={() => save("notifications")}
        saving={saving === "notifications"}
        saved={saved === "notifications"}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Volum alertă: ${Math.round(state.notifications.volume * 100)}%`}>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={state.notifications.volume}
                onChange={(e) =>
                  setState({
                    ...state,
                    notifications: {
                      ...state.notifications,
                      volume: parseFloat(e.target.value),
                    },
                  })
                }
                className="flex-1 accent-[#e8b33c]"
              />
              <Button size="sm" variant="ghost" onClick={notifier.playTest}>
                <Volume2 className="size-4" /> Test
              </Button>
            </div>
          </Field>
          <Field label="Repetă sunetul la fiecare (secunde)">
            <Input
              type="number"
              min="5"
              value={state.notifications.repeat_seconds}
              onChange={(e) =>
                setState({
                  ...state,
                  notifications: {
                    ...state.notifications,
                    repeat_seconds: parseInt(e.target.value) || 15,
                  },
                })
              }
            />
          </Field>
          <Field label="Escaladare după (minute)" hint="alerta devine urgentă + trimite webhook">
            <Input
              type="number"
              min="1"
              value={state.notifications.escalate_after_minutes}
              onChange={(e) =>
                setState({
                  ...state,
                  notifications: {
                    ...state.notifications,
                    escalate_after_minutes: parseInt(e.target.value) || 3,
                  },
                })
              }
            />
          </Field>
          <Field label="Webhook escaladare (opțional)" hint="URL apelat când o comandă nu e preluată — pentru SMS/WhatsApp prin Make/Zapier/Twilio">
            <Input
              placeholder="https://…"
              value={state.notifications.escalation_webhook_url}
              onChange={(e) =>
                setState({
                  ...state,
                  notifications: {
                    ...state.notifications,
                    escalation_webhook_url: e.target.value,
                  },
                })
              }
            />
          </Field>
          <button
            onClick={() =>
              setState({
                ...state,
                notifications: {
                  ...state.notifications,
                  browser_notifications: !state.notifications.browser_notifications,
                },
              })
            }
            className={cn(
              "cursor-pointer justify-self-start rounded-full border px-4 py-1.5 text-sm font-bold transition",
              state.notifications.browser_notifications
                ? "border-mint/50 bg-mint/10 text-mint"
                : "border-[var(--hairline-strong)] text-faint"
            )}
          >
            Notificări browser/desktop: {state.notifications.browser_notifications ? "DA" : "NU"}
          </button>
        </div>
      </SectionCard>

      {/* Imprimantă */}
      <SectionCard
        title="Imprimantă bonuri"
        onSave={() => save("printer")}
        saving={saving === "printer"}
        saved={saved === "printer"}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <button
            onClick={() =>
              setState({
                ...state,
                printer: {
                  ...state.printer,
                  auto_print_on_accept: !state.printer.auto_print_on_accept,
                },
              })
            }
            className={cn(
              "cursor-pointer justify-self-start self-end rounded-full border px-4 py-1.5 text-sm font-bold transition",
              state.printer.auto_print_on_accept
                ? "border-mint/50 bg-mint/10 text-mint"
                : "border-[var(--hairline-strong)] text-faint"
            )}
          >
            Printare automată la acceptare: {state.printer.auto_print_on_accept ? "DA" : "NU"}
          </button>
          <Field label="Lățime hârtie (mm)">
            <Input
              type="number"
              value={state.printer.width_mm}
              onChange={(e) =>
                setState({
                  ...state,
                  printer: { ...state.printer, width_mm: parseInt(e.target.value) || 80 },
                })
              }
            />
          </Field>
          <Field label="Mesaj subsol bon" className="sm:col-span-2">
            <Input
              value={state.printer.footer_note}
              onChange={(e) =>
                setState({ ...state, printer: { ...state.printer, footer_note: e.target.value } })
              }
            />
          </Field>
        </div>
      </SectionCard>

      {/* Glovo */}
      <SectionCard
        title="Glovo (în afara zonei)"
        description="Linkul afișat clienților din afara zonei de livrare."
        onSave={() => save("glovo")}
        saving={saving === "glovo"}
        saved={saved === "glovo"}
      >
        <div className={inputRow}>
          <Field label="Link Glovo restaurant" className="sm:col-span-2">
            <Input
              value={state.glovo.url}
              onChange={(e) => setState({ ...state, glovo: { ...state.glovo, url: e.target.value } })}
            />
          </Field>
        </div>
      </SectionCard>

      {/* Personal */}
      <StaffSection staffList={staffList} currentStaff={currentStaff} />
    </div>
  );
}

function StaffSection({ staffList, currentStaff }: { staffList: Staff[]; currentStaff: Staff }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "staff" });
  const isAdmin = currentStaff.role === "admin";

  async function create() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Eroare.");
      return;
    }
    setShowForm(false);
    setForm({ name: "", email: "", password: "", role: "staff" });
    router.refresh();
  }

  async function patch(id: string, patchBody: Record<string, unknown>) {
    await fetch("/api/admin/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, patch: patchBody }),
    });
    router.refresh();
  }

  return (
    <section className="card-surface p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-extrabold">Personal și permisiuni</h2>
          <p className="mt-0.5 text-sm text-mute">
            Admin: totul · Manager: comenzi, produse, setări · Staff: comenzi
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" variant="ghost" onClick={() => setShowForm(!showForm)}>
            <Plus className="size-4" /> Cont nou
          </Button>
        )}
      </div>

      {showForm && (
        <div className="mb-4 grid gap-3 rounded-xl border border-[var(--hairline)] bg-slate/50 p-4 sm:grid-cols-2">
          <Field label="Nume">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Rol">
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full cursor-pointer rounded-xl border border-[var(--hairline-strong)] bg-slate px-4 py-2.5 text-cream outline-none"
            >
              <option value="staff" className="bg-coal">Staff</option>
              <option value="manager" className="bg-coal">Manager</option>
              <option value="admin" className="bg-coal">Admin</option>
            </select>
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Parolă (min. 8 caractere)">
            <Input
              type="text"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </Field>
          {error && <p className="text-sm text-brick sm:col-span-2">{error}</p>}
          <div className="sm:col-span-2">
            <Button size="sm" onClick={create} disabled={busy}>
              {busy ? <Spinner className="size-4" /> : "Creează contul"}
            </Button>
          </div>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {staffList.map((s) => (
          <li key={s.id} className="flex items-center gap-3 rounded-xl border border-[var(--hairline)] px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {s.name}
                {s.id === currentStaff.id && <span className="text-xs text-faint"> (tu)</span>}
              </p>
            </div>
            {isAdmin && s.id !== currentStaff.id ? (
              <select
                value={s.role}
                onChange={(e) => patch(s.id, { role: e.target.value })}
                className="cursor-pointer rounded-lg border border-[var(--hairline-strong)] bg-slate px-2.5 py-1 text-xs font-bold text-cream outline-none"
              >
                <option value="staff" className="bg-coal">staff</option>
                <option value="manager" className="bg-coal">manager</option>
                <option value="admin" className="bg-coal">admin</option>
              </select>
            ) : (
              <Badge tone="gold">{s.role}</Badge>
            )}
            {isAdmin && s.id !== currentStaff.id && (
              <button
                onClick={() => patch(s.id, { active: !s.active })}
                className={cn(
                  "cursor-pointer rounded-full px-3 py-1 text-xs font-extrabold",
                  s.active ? "bg-mint/15 text-mint" : "bg-brick/15 text-brick"
                )}
              >
                {s.active ? "Activ" : "Dezactivat"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
