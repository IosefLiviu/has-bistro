"use client";

import { DishArt } from "@/components/dish-art";
import { ProductSheet } from "@/components/menu/product-sheet";
import { Badge, GoldPill } from "@/components/ui";
import { useCart } from "@/lib/cart";
import type { Category, Product } from "@/lib/types";
import { cn, lei } from "@/lib/utils";
import { Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export function MenuBrowser({
  categories,
  products,
}: {
  categories: Category[];
  products: Product[];
}) {
  const [active, setActive] = useState<Product | null>(null);
  const [query, setQuery] = useState("");
  const [currentCat, setCurrentCat] = useState(categories[0]?.slug ?? "");
  const railRef = useRef<HTMLDivElement>(null);
  const add = useCart((s) => s.add);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.ingredients ?? "").toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q)
    );
  }, [products, q]);

  const byCategory = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const c of categories) map.set(c.id, []);
    for (const p of filtered) map.get(p.category_id)?.push(p);
    return map;
  }, [categories, filtered]);

  // scrollspy pe secțiuni
  useEffect(() => {
    if (q) return;
    const sections = categories
      .map((c) => document.getElementById(c.slug))
      .filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setCurrentCat(visible[0].target.id);
      },
      { rootMargin: "-140px 0px -60% 0px" }
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [categories, q]);

  // ține chip-ul activ vizibil în rail
  useEffect(() => {
    const el = railRef.current?.querySelector<HTMLElement>(`[data-cat="${currentCat}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [currentCat]);

  function quickAdd(p: Product, e: React.MouseEvent) {
    e.stopPropagation();
    if (p.option_groups && p.option_groups.length > 0) setActive(p);
    else
      add({
        productId: p.id,
        slug: p.slug,
        name: p.name,
        unitPrice: p.promo_price ?? p.price,
        qty: 1,
        options: [],
        imageUrl: p.image_url,
      });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
      {/* rail sticky: căutare + categorii */}
      <div className="sticky top-16 z-40 -mx-4 border-b border-[var(--hairline)] bg-ink/92 px-4 pb-3 pt-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Caută în meniu — ex: sarmale, pizza, papanași…"
            className="w-full rounded-xl border border-[var(--hairline-strong)] bg-slate py-2.5 pl-10 pr-10 text-[0.95rem] text-cream placeholder:text-faint outline-none transition focus:border-gold/70 focus:ring-2 focus:ring-gold/20"
            aria-label="Caută în meniu"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Șterge căutarea"
              className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-faint hover:text-cream"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        {!q && (
          <div ref={railRef} className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
            {categories.map((c) => (
              <a
                key={c.id}
                href={`#${c.slug}`}
                data-cat={c.slug}
                className={cn(
                  "shrink-0 rounded-lg px-3.5 py-1.5 font-display text-sm font-bold whitespace-nowrap transition",
                  currentCat === c.slug
                    ? "gold-pill !rounded-lg"
                    : "border border-[var(--hairline-strong)] text-cream/80 hover:border-gold/50 hover:text-gold"
                )}
              >
                {c.name}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* secțiuni */}
      {q && filtered.length === 0 && (
        <div className="py-20 text-center text-mute">
          Nimic găsit pentru „{query}”. Încearcă alt cuvânt — sau sună-ne, poate gătim la cerere.
        </div>
      )}

      {categories.map((c) => {
        const items = byCategory.get(c.id) ?? [];
        if (items.length === 0) return null;
        return (
          <section key={c.id} id={c.slug} className="scroll-mt-40 pt-12">
            <div className="mb-2 flex items-baseline gap-4">
              <GoldPill>{c.name}</GoldPill>
              {c.description && (
                <span className="hidden text-sm text-faint sm:block">{c.description}</span>
              )}
            </div>
            <ul className="divide-y divide-[var(--hairline)]">
              {items.map((p) => {
                const price = p.promo_price ?? p.price;
                const off = !p.available;
                return (
                  <li key={p.id}>
                    <div
                      role="button"
                      tabIndex={off ? -1 : 0}
                      onClick={() => !off && setActive(p)}
                      onKeyDown={(e) => e.key === "Enter" && !off && setActive(p)}
                      className={cn(
                        "group flex w-full cursor-pointer items-center gap-4 py-4 text-left transition",
                        off && "cursor-default opacity-45"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline">
                          <h3 className="min-w-0 font-display text-[1.02rem] font-bold leading-snug transition group-hover:text-gold">
                            {p.name}
                          </h3>
                          <span className="leader" aria-hidden />
                          <span className="shrink-0 font-display font-extrabold text-gold tabular-nums">
                            {lei(price)}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 pr-14 sm:pr-20">
                          {p.promo_price != null && (
                            <>
                              <Badge tone="red">{p.promo_label ?? "ofertă"}</Badge>
                              <span className="text-xs text-faint line-through tabular-nums">
                                {lei(p.price)}
                              </span>
                            </>
                          )}
                          {p.is_new && <Badge tone="gold">nou</Badge>}
                          {off && <Badge tone="muted">indisponibil</Badge>}
                          {p.weight_label && (
                            <span className="text-xs text-faint">{p.weight_label}</span>
                          )}
                        </div>
                        {(p.ingredients || p.description) && (
                          <p className="mt-1 line-clamp-2 max-w-xl text-[0.82rem] leading-relaxed text-mute">
                            {p.description ?? p.ingredients}
                          </p>
                        )}
                      </div>

                      <div className="relative shrink-0">
                        <DishArt
                          src={p.image_url}
                          alt={p.name}
                          className="size-[74px] rounded-xl sm:size-20"
                          sizes="80px"
                        />
                        {!off && (
                          <button
                            onClick={(e) => quickAdd(p, e)}
                            aria-label={`Adaugă ${p.name} în coș`}
                            className="btn-gold absolute -bottom-2 -right-2 grid size-8 cursor-pointer place-items-center rounded-full"
                          >
                            <Plus className="size-4" strokeWidth={3} />
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <ProductSheet product={active} open={!!active} onClose={() => setActive(null)} />
    </div>
  );
}
