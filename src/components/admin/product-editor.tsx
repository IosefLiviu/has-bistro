"use client";

import { Button, Field, Input, Sheet, Spinner, Textarea } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Category, Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ImagePlus, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type GroupDraft = {
  name: string;
  required: boolean;
  multi: boolean;
  max_select: number;
  items: Array<{ name: string; price_delta: number }>;
};

export function ProductEditor({
  product,
  categories,
  open,
  onClose,
}: {
  product: Product | null; // null = produs nou
  categories: Category[];
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    category_id: categories[0]?.id ?? "",
    name: "",
    description: "",
    ingredients: "",
    allergens: "",
    weight_label: "",
    price: "",
    promo_price: "",
    promo_label: "",
    image_url: "",
    available: true,
    featured: false,
    is_new: false,
  });
  const [groups, setGroups] = useState<GroupDraft[]>([]);

  useEffect(() => {
    if (!open) return;
    if (product) {
      setForm({
        category_id: product.category_id,
        name: product.name,
        description: product.description ?? "",
        ingredients: product.ingredients ?? "",
        allergens: product.allergens.join(", "),
        weight_label: product.weight_label ?? "",
        price: String(product.price),
        promo_price: product.promo_price != null ? String(product.promo_price) : "",
        promo_label: product.promo_label ?? "",
        image_url: product.image_url ?? "",
        available: product.available,
        featured: product.featured,
        is_new: product.is_new,
      });
      setGroups(
        (product.option_groups ?? []).map((g) => ({
          name: g.name,
          required: g.required,
          multi: g.multi,
          max_select: g.max_select,
          items: g.items.map((i) => ({ name: i.name, price_delta: i.price_delta })),
        }))
      );
    } else {
      setForm((f) => ({
        ...f,
        name: "",
        description: "",
        ingredients: "",
        allergens: "",
        weight_label: "",
        price: "",
        promo_price: "",
        promo_label: "",
        image_url: "",
        available: true,
        featured: false,
        is_new: false,
      }));
      setGroups([]);
    }
    setError(null);
  }, [product, open]);

  async function uploadImage(file: File) {
    setUploading(true);
    setError(null);
    try {
      const supa = supabaseBrowser();
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error: upErr } = await supa.storage.from("products").upload(path, file, {
        cacheControl: "31536000",
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data } = supa.storage.from("products").getPublicUrl(path);
      setForm((f) => ({ ...f, image_url: data.publicUrl }));
    } catch {
      setError("Încărcarea imaginii a eșuat. Verifică formatul (JPG/PNG/WebP).");
    }
    setUploading(false);
  }

  async function save() {
    if (!form.name.trim() || !form.price) {
      setError("Numele și prețul sunt obligatorii.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: product?.id,
        category_id: form.category_id,
        name: form.name,
        description: form.description || null,
        ingredients: form.ingredients || null,
        allergens: form.allergens
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
        weight_label: form.weight_label || null,
        price: parseFloat(form.price),
        promo_price: form.promo_price ? parseFloat(form.promo_price) : null,
        promo_label: form.promo_label || null,
        image_url: form.image_url || null,
        available: form.available,
        featured: form.featured,
        is_new: form.is_new,
        sort: product?.sort,
        groups,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Eroare la salvare.");
      return;
    }
    router.refresh();
    onClose();
  }

  const toggleCls = (on: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-semibold transition",
      on ? "border-gold bg-gold/15 text-gold" : "border-[var(--hairline-strong)] text-mute"
    );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      wide
      title={
        <span className="font-display text-lg font-extrabold">
          {product ? `Editează: ${product.name}` : "Produs nou"}
        </span>
      }
    >
      <div className="flex flex-col gap-5 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nume produs" className="sm:col-span-2">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Categorie">
            <select
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              className="w-full cursor-pointer rounded-xl border border-[var(--hairline-strong)] bg-slate px-4 py-2.5 text-cream outline-none focus:border-gold/70"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id} className="bg-coal">
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Gramaj (ex: 250g/150g)">
            <Input
              value={form.weight_label}
              onChange={(e) => setForm({ ...form, weight_label: e.target.value })}
            />
          </Field>
          <Field label="Preț (lei)">
            <Input
              type="number"
              step="0.5"
              min="0"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Preț promo" hint="gol = fără promo">
              <Input
                type="number"
                step="0.5"
                min="0"
                value={form.promo_price}
                onChange={(e) => setForm({ ...form, promo_price: e.target.value })}
              />
            </Field>
            <Field label="Etichetă promo">
              <Input
                placeholder="ex: −20%"
                value={form.promo_label}
                onChange={(e) => setForm({ ...form, promo_label: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Descriere (apare pe site)" className="sm:col-span-2">
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <Field label="Ingrediente" className="sm:col-span-2">
            <Textarea
              value={form.ingredients}
              onChange={(e) => setForm({ ...form, ingredients: e.target.value })}
            />
          </Field>
          <Field label="Alergeni (separați prin virgulă)" className="sm:col-span-2">
            <Input
              placeholder="gluten, ou, lactoză…"
              value={form.allergens}
              onChange={(e) => setForm({ ...form, allergens: e.target.value })}
            />
          </Field>
        </div>

        {/* imagine */}
        <div className="flex items-center gap-4">
          {form.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={form.image_url}
              alt=""
              className="size-20 rounded-xl border border-[var(--hairline)] object-cover"
            />
          ) : (
            <div className="grid size-20 place-items-center rounded-xl border border-dashed border-[var(--hairline-strong)] text-faint">
              <ImagePlus className="size-6" />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <label className="btn-ghost inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold">
              {uploading ? <Spinner className="size-4" /> : <ImagePlus className="size-4" />}
              {form.image_url ? "Schimbă imaginea" : "Încarcă imagine"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])}
              />
            </label>
            {form.image_url && (
              <button
                className="cursor-pointer text-left text-xs text-faint hover:text-brick"
                onClick={() => setForm({ ...form, image_url: "" })}
              >
                Șterge imaginea
              </button>
            )}
          </div>
        </div>

        {/* stări */}
        <div className="flex flex-wrap gap-2">
          <button className={toggleCls(form.available)} onClick={() => setForm({ ...form, available: !form.available })}>
            {form.available ? "✓ Disponibil" : "Indisponibil"}
          </button>
          <button className={toggleCls(form.featured)} onClick={() => setForm({ ...form, featured: !form.featured })}>
            ★ Recomandat
          </button>
          <button className={toggleCls(form.is_new)} onClick={() => setForm({ ...form, is_new: !form.is_new })}>
            Nou
          </button>
        </div>

        {/* opțiuni */}
        <div className="rounded-2xl border border-[var(--hairline)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display font-extrabold">Opțiuni și extra</h3>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                setGroups([
                  ...groups,
                  { name: "", required: false, multi: false, max_select: 1, items: [{ name: "", price_delta: 0 }] },
                ])
              }
            >
              <Plus className="size-4" /> Grup nou
            </Button>
          </div>
          {groups.length === 0 && (
            <p className="text-sm text-faint">
              Fără opțiuni — produsul se adaugă direct în coș. Adaugă grupuri pentru garnituri,
              topping-uri, variante etc.
            </p>
          )}
          <div className="flex flex-col gap-4">
            {groups.map((g, gi) => (
              <div key={gi} className="rounded-xl border border-[var(--hairline)] bg-slate/50 p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    placeholder="Numele grupului (ex: Alege garnitura)"
                    value={g.name}
                    onChange={(e) =>
                      setGroups(groups.map((x, i) => (i === gi ? { ...x, name: e.target.value } : x)))
                    }
                    className="!w-auto flex-1"
                  />
                  <button
                    className={toggleCls(g.required)}
                    onClick={() =>
                      setGroups(groups.map((x, i) => (i === gi ? { ...x, required: !x.required } : x)))
                    }
                  >
                    obligatoriu
                  </button>
                  <button
                    className={toggleCls(g.multi)}
                    onClick={() =>
                      setGroups(
                        groups.map((x, i) =>
                          i === gi ? { ...x, multi: !x.multi, max_select: x.multi ? 1 : 10 } : x
                        )
                      )
                    }
                  >
                    selecție multiplă
                  </button>
                  <button
                    onClick={() => setGroups(groups.filter((_, i) => i !== gi))}
                    className="cursor-pointer p-1.5 text-faint hover:text-brick"
                    aria-label="Șterge grupul"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  {g.items.map((item, ii) => (
                    <div key={ii} className="flex items-center gap-2">
                      <Input
                        placeholder="Opțiune (ex: Cartofi prăjiți)"
                        value={item.name}
                        onChange={(e) =>
                          setGroups(
                            groups.map((x, i) =>
                              i === gi
                                ? {
                                    ...x,
                                    items: x.items.map((y, j) =>
                                      j === ii ? { ...y, name: e.target.value } : y
                                    ),
                                  }
                                : x
                            )
                          )
                        }
                        className="flex-1"
                      />
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.5"
                          value={item.price_delta || ""}
                          placeholder="0"
                          onChange={(e) =>
                            setGroups(
                              groups.map((x, i) =>
                                i === gi
                                  ? {
                                      ...x,
                                      items: x.items.map((y, j) =>
                                        j === ii
                                          ? { ...y, price_delta: parseFloat(e.target.value) || 0 }
                                          : y
                                      ),
                                    }
                                  : x
                              )
                            )
                          }
                          className="!w-24 pr-8"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-faint">
                          lei
                        </span>
                      </div>
                      <button
                        onClick={() =>
                          setGroups(
                            groups.map((x, i) =>
                              i === gi ? { ...x, items: x.items.filter((_, j) => j !== ii) } : x
                            )
                          )
                        }
                        className="cursor-pointer p-1 text-faint hover:text-brick"
                        aria-label="Șterge opțiunea"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      setGroups(
                        groups.map((x, i) =>
                          i === gi
                            ? { ...x, items: [...x.items, { name: "", price_delta: 0 }] }
                            : x
                        )
                      )
                    }
                    className="cursor-pointer self-start text-sm text-gold hover:underline"
                  >
                    + adaugă opțiune
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <p className="rounded-xl border border-brick/50 bg-brick/10 px-4 py-2.5 text-sm text-brick">
            {error}
          </p>
        )}
      </div>

      <div className="sticky bottom-0 flex gap-3 border-t border-[var(--hairline)] bg-coal/95 px-5 py-4 backdrop-blur">
        <Button size="lg" className="flex-1" onClick={save} disabled={busy || uploading}>
          {busy ? <Spinner /> : "Salvează produsul"}
        </Button>
        <Button size="lg" variant="bare" onClick={onClose}>
          Renunță
        </Button>
      </div>
    </Sheet>
  );
}
