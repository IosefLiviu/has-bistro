"use client";

import { ProductEditor } from "@/components/admin/product-editor";
import { DishArt } from "@/components/dish-art";
import { Badge, Button } from "@/components/ui";
import type { Category, Product } from "@/lib/types";
import { cn, lei } from "@/lib/utils";
import { ArchiveRestore, ChevronDown, ChevronUp, Pencil, Plus, Search, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export function ProductsManager({
  categories,
  products,
}: {
  categories: Category[];
  products: Product[];
}) {
  const router = useRouter();
  const [catFilter, setCatFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const list = useMemo(() => {
    let out = products.filter((p) => (showArchived ? p.archived : !p.archived));
    if (catFilter !== "all") out = out.filter((p) => p.category_id === catFilter);
    const q = query.trim().toLowerCase();
    if (q) out = out.filter((p) => p.name.toLowerCase().includes(q));
    return out;
  }, [products, catFilter, query, showArchived]);

  async function patch(id: string, patchBody: Record<string, unknown>) {
    setBusyId(id);
    await fetch("/api/admin/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, patch: patchBody }),
    });
    router.refresh();
    setBusyId(null);
  }

  async function move(p: Product, dir: -1 | 1) {
    const siblings = products
      .filter((x) => x.category_id === p.category_id && !x.archived)
      .sort((a, b) => a.sort - b.sort);
    const idx = siblings.findIndex((x) => x.id === p.id);
    const swap = siblings[idx + dir];
    if (!swap) return;
    setBusyId(p.id);
    await Promise.all([
      fetch("/api/admin/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, patch: { sort: swap.sort } }),
      }),
      fetch("/api/admin/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: swap.id, patch: { sort: p.sort } }),
      }),
    ]);
    router.refresh();
    setBusyId(null);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-extrabold">Produse</h1>
        <span className="text-sm text-faint tabular-nums">
          {products.filter((p) => !p.archived).length} active
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Caută produs…"
              className="w-48 rounded-xl border border-[var(--hairline-strong)] bg-slate py-2 pl-9 pr-3 text-sm text-cream placeholder:text-faint outline-none focus:border-gold/70"
            />
          </div>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Produs nou
          </Button>
        </div>
      </div>

      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setCatFilter("all")}
          className={cn(
            "shrink-0 cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-bold transition",
            catFilter === "all"
              ? "border-gold bg-gold text-ink"
              : "border-[var(--hairline-strong)] text-cream/80"
          )}
        >
          Toate
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setCatFilter(c.id)}
            className={cn(
              "shrink-0 cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-bold whitespace-nowrap transition",
              catFilter === c.id
                ? "border-gold bg-gold text-ink"
                : "border-[var(--hairline-strong)] text-cream/80"
            )}
          >
            {c.name}
          </button>
        ))}
        <button
          onClick={() => setShowArchived(!showArchived)}
          className={cn(
            "ml-auto shrink-0 cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-bold transition",
            showArchived
              ? "border-brick bg-brick/15 text-brick"
              : "border-[var(--hairline-strong)] text-faint"
          )}
        >
          Arhivate
        </button>
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {list.map((p) => {
          const cat = categories.find((c) => c.id === p.category_id);
          return (
            <li
              key={p.id}
              className={cn(
                "card-surface flex items-center gap-3.5 px-4 py-3",
                busyId === p.id && "opacity-50",
                !p.available && !p.archived && "border-brick/25"
              )}
            >
              <div className="flex flex-col">
                <button
                  onClick={() => move(p, -1)}
                  className="cursor-pointer p-0.5 text-faint hover:text-gold"
                  aria-label="Mută mai sus"
                >
                  <ChevronUp className="size-4" />
                </button>
                <button
                  onClick={() => move(p, 1)}
                  className="cursor-pointer p-0.5 text-faint hover:text-gold"
                  aria-label="Mută mai jos"
                >
                  <ChevronDown className="size-4" />
                </button>
              </div>
              <DishArt src={p.image_url} alt={p.name} className="size-12 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{p.name}</p>
                  {p.featured && <Star className="size-3.5 fill-gold text-gold" />}
                  {p.promo_price != null && <Badge tone="red">promo</Badge>}
                  {p.archived && <Badge tone="muted">arhivat</Badge>}
                </div>
                <p className="text-xs text-faint">
                  {cat?.name}
                  {p.weight_label ? ` · ${p.weight_label}` : ""}
                  {(p.option_groups?.length ?? 0) > 0 &&
                    ` · ${p.option_groups!.length} grupuri opțiuni`}
                </p>
              </div>
              <p className="font-display font-extrabold text-gold tabular-nums">
                {lei(p.promo_price ?? p.price)}
              </p>
              {!p.archived ? (
                <button
                  onClick={() => patch(p.id, { available: !p.available })}
                  className={cn(
                    "cursor-pointer rounded-full px-3 py-1 text-xs font-extrabold transition",
                    p.available ? "bg-mint/15 text-mint" : "bg-brick/15 text-brick"
                  )}
                >
                  {p.available ? "Disponibil" : "Indisponibil"}
                </button>
              ) : (
                <button
                  onClick={() => patch(p.id, { archived: false, available: true })}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full bg-cream/8 px-3 py-1 text-xs font-bold text-mute hover:text-cream"
                >
                  <ArchiveRestore className="size-3.5" /> Restaurează
                </button>
              )}
              <button
                onClick={() => setEditing(p)}
                className="grid size-9 cursor-pointer place-items-center rounded-lg border border-[var(--hairline-strong)] text-mute transition hover:border-gold/60 hover:text-gold"
                aria-label={`Editează ${p.name}`}
              >
                <Pencil className="size-4" />
              </button>
            </li>
          );
        })}
        {list.length === 0 && (
          <li className="rounded-2xl border border-dashed border-[var(--hairline-strong)] py-16 text-center text-mute">
            Niciun produs aici.
          </li>
        )}
      </ul>

      <ProductEditor
        product={editing}
        categories={categories}
        open={!!editing || creating}
        onClose={() => {
          setEditing(null);
          setCreating(false);
        }}
      />
    </div>
  );
}
