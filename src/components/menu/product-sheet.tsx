"use client";

import { DishArt } from "@/components/dish-art";
import { Badge, Button, QtyStepper, Sheet, Textarea } from "@/components/ui";
import { useCart } from "@/lib/cart";
import type { CartOption, OptionGroup, Product } from "@/lib/types";
import { cn, lei } from "@/lib/utils";
import { Check } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function defaultSelections(groups: OptionGroup[]) {
  const sel: Record<string, string[]> = {};
  for (const g of groups) {
    const def = g.items.filter((i) => i.default_selected).map((i) => i.id);
    if (def.length) sel[g.id] = def;
    else if (g.required && !g.multi && g.items.length) sel[g.id] = [g.items[0].id];
    else sel[g.id] = [];
  }
  return sel;
}

export function ProductSheet({
  product,
  open,
  onClose,
}: {
  product: Product | null;
  open: boolean;
  onClose: () => void;
}) {
  const add = useCart((s) => s.add);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [sel, setSel] = useState<Record<string, string[]>>({});
  const [missing, setMissing] = useState<string[]>([]);

  useEffect(() => {
    if (product && open) {
      setQty(1);
      setNotes("");
      setSel(defaultSelections(product.option_groups ?? []));
      setMissing([]);
    }
  }, [product, open]);

  const groups = product?.option_groups ?? [];

  const chosen: CartOption[] = useMemo(() => {
    if (!product) return [];
    const out: CartOption[] = [];
    for (const g of groups) {
      for (const id of sel[g.id] ?? []) {
        const item = g.items.find((i) => i.id === id);
        if (item) out.push({ group: g.name, item: item.name, delta: item.price_delta });
      }
    }
    return out;
  }, [product, groups, sel]);

  const basePrice = product ? product.promo_price ?? product.price : 0;
  const unitPrice = basePrice + chosen.reduce((s, o) => s + o.delta, 0);

  function toggle(g: OptionGroup, itemId: string) {
    setSel((prev) => {
      const current = prev[g.id] ?? [];
      let next: string[];
      if (g.multi) {
        next = current.includes(itemId)
          ? current.filter((i) => i !== itemId)
          : current.length >= g.max_select
            ? current
            : [...current, itemId];
      } else {
        next = current.includes(itemId) && !g.required ? [] : [itemId];
      }
      return { ...prev, [g.id]: next };
    });
    setMissing((m) => m.filter((id) => id !== g.id));
  }

  function submit() {
    if (!product) return;
    const missingGroups = groups
      .filter((g) => g.required && (sel[g.id] ?? []).length < Math.max(1, g.min_select))
      .map((g) => g.id);
    if (missingGroups.length) {
      setMissing(missingGroups);
      document
        .getElementById(`group-${missingGroups[0]}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    add({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      unitPrice,
      qty,
      options: chosen,
      notes: notes.trim() || undefined,
      imageUrl: product.image_url,
    });
    onClose();
  }

  return (
    <Sheet
      open={open && !!product}
      onClose={onClose}
      title={
        product && (
          <div className="flex items-baseline justify-between gap-3 pr-2">
            <span className="truncate font-display text-lg font-extrabold">{product.name}</span>
            {product.weight_label && (
              <span className="shrink-0 text-xs text-mute">{product.weight_label}</span>
            )}
          </div>
        )
      }
    >
      {product && (
        <div className="flex flex-col">
          {(product.image_url || product.description || product.ingredients) && (
            <div className="px-5 pt-4">
              {product.image_url && (
                <DishArt
                  src={product.image_url}
                  alt={product.name}
                  className="mb-4 aspect-[16/9] w-full rounded-2xl"
                  sizes="(max-width: 640px) 100vw, 480px"
                />
              )}
              {product.description && (
                <p className="text-sm leading-relaxed text-cream/90">{product.description}</p>
              )}
              {product.ingredients && (
                <p className="mt-2 text-xs leading-relaxed text-mute">
                  {product.ingredients.charAt(0).toUpperCase() + product.ingredients.slice(1)}
                </p>
              )}
              {product.allergens.length > 0 && (
                <p className="mt-2 text-xs text-faint">
                  Alergeni: {product.allergens.join(", ")}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-5 px-5 py-5">
            {groups.map((g) => (
              <fieldset
                key={g.id}
                id={`group-${g.id}`}
                className={cn(
                  "rounded-2xl border p-4 transition",
                  missing.includes(g.id)
                    ? "border-brick/60 bg-brick/5"
                    : "border-[var(--hairline)]"
                )}
              >
                <legend className="flex items-center gap-2 px-1">
                  <span className="font-display text-sm font-extrabold">{g.name}</span>
                  {g.required ? (
                    <Badge tone="gold">obligatoriu</Badge>
                  ) : (
                    <Badge tone="muted">opțional</Badge>
                  )}
                </legend>
                {missing.includes(g.id) && (
                  <p className="mb-2 px-1 text-xs font-semibold text-brick">
                    Alege o variantă ca să continui.
                  </p>
                )}
                <div className="mt-2 flex flex-col gap-1.5">
                  {g.items.map((item) => {
                    const active = (sel[g.id] ?? []).includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggle(g, item.id)}
                        className={cn(
                          "flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm transition",
                          active
                            ? "border-gold/70 bg-gold/10 text-cream"
                            : "border-[var(--hairline)] text-cream/85 hover:border-[var(--hairline-strong)]"
                        )}
                      >
                        <span className="flex items-center gap-2.5">
                          <span
                            className={cn(
                              "grid size-5 shrink-0 place-items-center border transition",
                              g.multi ? "rounded-md" : "rounded-full",
                              active
                                ? "border-gold bg-gold text-ink"
                                : "border-[var(--hairline-strong)]"
                            )}
                          >
                            {active && <Check className="size-3.5" strokeWidth={3} />}
                          </span>
                          {item.name}
                        </span>
                        {item.price_delta > 0 && (
                          <span className="shrink-0 text-gold tabular-nums">
                            +{lei(item.price_delta)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}

            <Textarea
              placeholder="Observații pentru bucătărie (opțional) — ex: fără ceapă"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={300}
            />
          </div>

          <div className="sticky bottom-0 flex items-center gap-4 border-t border-[var(--hairline)] bg-coal/95 px-5 py-4 backdrop-blur">
            <QtyStepper qty={qty} onChange={setQty} />
            <Button size="lg" className="flex-1" onClick={submit}>
              Adaugă · <span className="tabular-nums">{lei(unitPrice * qty)}</span>
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
