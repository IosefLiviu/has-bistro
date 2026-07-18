"use client";

import { Badge, Button, Field, Input, Spinner, Textarea } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { DailyMenu } from "@/lib/types";
import { cn, formatDateRo, lei } from "@/lib/utils";
import { CalendarDays, ImagePlus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DailyManager({ menus, today }: { menus: DailyMenu[]; today: string }) {
  const router = useRouter();
  const todayMenu = menus.find((m) => m.menu_date === today) ?? null;

  const [form, setForm] = useState({
    menu_date: today,
    title: todayMenu?.title ?? "",
    description: todayMenu?.description ?? "",
    price: String(todayMenu?.price ?? 30),
    image_url: todayMenu?.image_url ?? "",
    published: todayMenu?.published ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function loadMenu(m: DailyMenu | null, date: string) {
    setForm({
      menu_date: date,
      title: m?.title ?? "",
      description: m?.description ?? "",
      price: String(m?.price ?? 30),
      image_url: m?.image_url ?? "",
      published: m?.published ?? true,
    });
  }

  async function uploadImage(file: File) {
    setUploading(true);
    setError(null);
    try {
      const supa = supabaseBrowser();
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${form.menu_date}-${Date.now().toString(36)}.${ext}`;
      const { error: upErr } = await supa.storage.from("daily-menu").upload(path, file, {
        upsert: true,
        cacheControl: "3600",
      });
      if (upErr) throw upErr;
      const { data } = supa.storage.from("daily-menu").getPublicUrl(path);
      setForm((f) => ({ ...f, image_url: data.publicUrl }));
    } catch {
      setError("Încărcarea imaginii a eșuat.");
    }
    setUploading(false);
  }

  async function save() {
    if (!form.title.trim()) {
      setError("Titlul este obligatoriu.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/daily", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        menu_date: form.menu_date,
        title: form.title,
        description: form.description,
        price: parseFloat(form.price) || 30,
        image_url: form.image_url || null,
        published: form.published,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Eroare la salvare.");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  async function togglePublished(m: DailyMenu) {
    await fetch("/api/admin/daily", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: m.id, patch: { published: !m.published } }),
    });
    router.refresh();
  }

  async function remove(m: DailyMenu) {
    if (!confirm(`Ștergi meniul din ${m.menu_date}?`)) return;
    await fetch("/api/admin/daily", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: m.id }),
    });
    router.refresh();
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold">Meniul zilei</h1>
      <p className="mt-1 text-sm text-mute">
        Imaginea generată zilnic + titlul apar pe prima pagină. Meniul expiră automat la
        miezul nopții; comanda folosește configuratorul standard de 30 lei.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* editor */}
        <section className="card-surface p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data publicării" hint="poți programa și pentru zilele următoare">
              <Input
                type="date"
                value={form.menu_date}
                min={today}
                onChange={(e) => {
                  const d = e.target.value;
                  loadMenu(menus.find((m) => m.menu_date === d) ?? null, d);
                }}
              />
            </Field>
            <Field label="Preț (lei)">
              <Input
                type="number"
                step="1"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </Field>
            <Field label="Titlu" className="sm:col-span-2">
              <Input
                placeholder="ex: Ostropel de pui cu mămăligă"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </Field>
            <Field label="Descriere (opțional)" className="sm:col-span-2">
              <Textarea
                placeholder="Ce e special azi în farfurie…"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
          </div>

          <div className="mt-4 flex items-start gap-4">
            {form.image_url ? (
              <div className="relative aspect-[4/3] w-44 overflow-hidden rounded-xl border border-[var(--hairline)]">
                <Image src={form.image_url} alt="" fill className="object-cover" sizes="176px" />
              </div>
            ) : (
              <div className="grid aspect-[4/3] w-44 place-items-center rounded-xl border border-dashed border-[var(--hairline-strong)] text-faint">
                <ImagePlus className="size-7" />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <label className="btn-ghost inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold">
                {uploading ? <Spinner className="size-4" /> : <ImagePlus className="size-4" />}
                Încarcă imaginea zilei
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])}
                />
              </label>
              <p className="max-w-52 text-xs text-faint">
                Imaginea AI generată dimineața — pătrată sau 4:3 arată cel mai bine.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setForm({ ...form, published: !form.published })}
              className={cn(
                "cursor-pointer rounded-full border px-4 py-1.5 text-sm font-bold transition",
                form.published
                  ? "border-mint/50 bg-mint/10 text-mint"
                  : "border-[var(--hairline-strong)] text-faint"
              )}
            >
              {form.published ? "✓ Publicat pe site" : "Nepublicat (ascuns)"}
            </button>
            <Button onClick={save} disabled={busy || uploading} className="ml-auto">
              {busy ? <Spinner /> : saved ? "Salvat ✓" : "Salvează meniul"}
            </Button>
          </div>
          {error && (
            <p className="mt-3 rounded-xl border border-brick/50 bg-brick/10 px-4 py-2.5 text-sm text-brick">
              {error}
            </p>
          )}
        </section>

        {/* arhivă */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-extrabold">
            <CalendarDays className="size-4.5 text-gold" /> Istoric și programate
          </h2>
          <ul className="flex flex-col gap-2.5">
            {menus.map((m) => (
              <li key={m.id} className="card-surface flex items-center gap-3 p-3">
                {m.image_url ? (
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-lg">
                    <Image src={m.image_url} alt="" fill className="object-cover" sizes="56px" />
                  </div>
                ) : (
                  <div className="grid size-14 shrink-0 place-items-center rounded-lg bg-slate text-faint">
                    <CalendarDays className="size-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{m.title}</p>
                  <p className="text-xs text-faint">
                    {formatDateRo(m.menu_date + "T12:00:00")} · {lei(m.price)}
                  </p>
                </div>
                {m.menu_date === today && <Badge tone="gold">azi</Badge>}
                {m.menu_date > today && <Badge tone="green">programat</Badge>}
                <button
                  onClick={() => togglePublished(m)}
                  className={cn(
                    "cursor-pointer rounded-full px-2.5 py-1 text-xs font-bold",
                    m.published ? "bg-mint/15 text-mint" : "bg-cream/8 text-faint"
                  )}
                >
                  {m.published ? "publicat" : "ascuns"}
                </button>
                <button
                  onClick={() => remove(m)}
                  className="cursor-pointer p-1.5 text-faint hover:text-brick"
                  aria-label="Șterge"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
            {menus.length === 0 && (
              <li className="rounded-xl border border-dashed border-[var(--hairline-strong)] py-10 text-center text-sm text-mute">
                Încă niciun meniu al zilei salvat.
              </li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
