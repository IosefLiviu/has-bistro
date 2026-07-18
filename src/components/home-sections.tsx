"use client";

import { DishArt } from "@/components/dish-art";
import { ProductSheet } from "@/components/menu/product-sheet";
import { Badge, Button, GoldPill } from "@/components/ui";
import { useCart } from "@/lib/cart";
import type { DailyMenu, Product } from "@/lib/types";
import { formatDateRo, lei } from "@/lib/utils";
import { Flame, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { Reveal } from "./reveal";

/** Spotlight „Meniul Zilei” + preparatele recomandate — cu sheet de configurare comun. */
export function HomeInteractive({
  daily,
  meniulZilei,
  featured,
}: {
  daily: DailyMenu | null;
  meniulZilei: Product | null;
  featured: Product[];
}) {
  const [active, setActive] = useState<Product | null>(null);
  const add = useCart((s) => s.add);

  function quickAdd(p: Product) {
    if (p.option_groups && p.option_groups.length > 0) {
      setActive(p);
    } else {
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
  }

  return (
    <>
      {/* ── Meniul Zilei ── */}
      <section id="meniul-zilei" className="relative mx-auto max-w-6xl scroll-mt-24 px-4 pt-24 sm:px-6">
        <Reveal className="mb-10 flex flex-col items-start gap-3">
          <GoldPill className="text-lg">Meniul Zilei · {lei(meniulZilei?.price ?? 30)}</GoldPill>
          <p className="font-script text-3xl text-gold/90">proaspăt, în fiecare zi</p>
        </Reveal>

        <div className="grid gap-6 md:grid-cols-[1.15fr_1fr]">
          <Reveal className="card-surface relative overflow-hidden">
            {daily?.image_url ? (
              <div className="relative aspect-[4/3] sm:aspect-[16/10]">
                <DishArt
                  src={daily.image_url}
                  alt={daily.title}
                  className="absolute inset-0"
                  sizes="(max-width: 768px) 100vw, 640px"
                  priority
                />
                <div className="vignette absolute inset-0" />
                <div className="absolute right-4 top-4 rounded-full bg-ink/70 px-3.5 py-1.5 text-xs font-bold uppercase tracking-widest text-gold backdrop-blur">
                  {formatDateRo(daily.menu_date + "T12:00:00")}
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <h3 className="font-display text-2xl font-extrabold">{daily.title}</h3>
                  {daily.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-cream/80">{daily.description}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="relative grid aspect-[4/3] place-items-center sm:aspect-[16/10]">
                <div
                  className="absolute inset-0 opacity-60"
                  style={{
                    background:
                      "radial-gradient(90% 90% at 50% 100%, rgb(232 168 46 / 0.25), transparent 65%)",
                  }}
                />
                <div className="relative text-center">
                  <Flame className="mx-auto size-10 text-gold" />
                  <p className="mt-3 font-display text-2xl font-extrabold">
                    {formatDateRo(new Date())}
                  </p>
                  <p className="mt-1 text-sm text-mute">
                    Farfuria zilei se anunță în fiecare dimineață — alege-ți felul preferat.
                  </p>
                </div>
              </div>
            )}
          </Reveal>

          <Reveal delay={120} className="card-surface flex flex-col justify-between p-6">
            <div>
              <h3 className="font-display text-xl font-extrabold">
                Alege-ți prânzul complet
              </h3>
              <ul className="mt-4 space-y-2.5 text-sm text-cream/85">
                <li className="flex gap-2.5">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-gold" />
                  <span><strong>Felul principal</strong> — 17 variante, de la șnițel la aripioare la ceaun (180–220g)</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-gold" />
                  <span><strong>Garnitura</strong> — cartofi, orez sau mămăligă (200–250g)</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-gold" />
                  <span><strong>Salata</strong> — de la varză la murături (150g)</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-brick" />
                  <span className="text-gold">
                    + Ciorbă de 350ml la doar <strong className="text-brick">8 lei</strong> — meniu complet la {lei(38)}
                  </span>
                </li>
              </ul>
            </div>
            <div className="mt-6">
              {meniulZilei ? (
                <Button
                  size="lg"
                  className="w-full"
                  disabled={daily ? !daily.available : !meniulZilei.available}
                  onClick={() => setActive(meniulZilei)}
                >
                  {daily && !daily.available
                    ? "S-a epuizat pentru azi"
                    : `Compune meniul · ${lei(meniulZilei.promo_price ?? meniulZilei.price)}`}
                </Button>
              ) : null}
              <p className="mt-2.5 text-center text-xs text-faint">
                Disponibil zilnic, în limita stocului bucătăriei.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Recomandate ── */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-24 sm:px-6">
          <Reveal className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.24em] text-gold">
                <Sparkles className="size-4" /> Din bucătărie
              </p>
              <h2 className="mt-2 font-display text-3xl font-extrabold sm:text-4xl">
                Cele mai iubite farfurii
              </h2>
            </div>
          </Reveal>
          <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            {featured.map((p, i) => (
              <Reveal
                key={p.id}
                delay={i * 60}
                className="card-surface group relative w-[260px] shrink-0 snap-start overflow-hidden transition hover:shadow-glow"
              >
                <button
                  className="block w-full cursor-pointer text-left"
                  onClick={() => setActive(p)}
                  aria-label={`Detalii ${p.name}`}
                >
                  <DishArt
                    src={p.image_url}
                    alt={p.name}
                    className="aspect-[4/3] w-full transition-transform duration-700 group-hover:scale-[1.03]"
                    sizes="260px"
                  />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display font-bold leading-snug">{p.name}</h3>
                      {p.promo_price != null && <Badge tone="red">ofertă</Badge>}
                    </div>
                    {p.weight_label && (
                      <p className="mt-0.5 text-xs text-faint">{p.weight_label}</p>
                    )}
                    <div className="mt-3 flex items-center justify-between">
                      <span className="font-display text-lg font-extrabold text-gold tabular-nums">
                        {lei(p.promo_price ?? p.price)}
                        {p.promo_price != null && (
                          <span className="ml-2 text-sm font-semibold text-faint line-through">
                            {lei(p.price)}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    quickAdd(p);
                  }}
                  aria-label={`Adaugă ${p.name} în coș`}
                  className="btn-gold absolute bottom-4 right-4 grid size-10 cursor-pointer place-items-center rounded-full"
                >
                  <Plus className="size-5" strokeWidth={3} />
                </button>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      <ProductSheet product={active} open={!!active} onClose={() => setActive(null)} />
    </>
  );
}
