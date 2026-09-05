import { Hero } from "@/components/hero";
import { HomeInteractive } from "@/components/home-sections";
import { Reveal } from "@/components/reveal";
import { getCatalog, getFeatured, getProductBySlug, getTodayDailyMenu } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";
import { formatPhone } from "@/lib/utils";
import { ArrowRight, Bike, ChefHat, Clock, PartyPopper, Phone, ShoppingBag } from "lucide-react";
import Link from "next/link";

export const revalidate = 60;

const TICKER = [
  "Aripioare la ceaun",
  "Sarmale cu mămăligă",
  "Pizza H'ash",
  "Burger Black Angus",
  "Ciorbă de burtă",
  "Șnițel „California”",
  "Paste Carbonara",
  "Cotlet de berbecuț",
  "Papanași cu Nutella",
  "Shaorma la farfurie",
  "Tochitură dobrogeană",
  "Somon la grătar",
];

export default async function HomePage() {
  const [{ categories, products }, featured, daily, meniulZilei, settings] =
    await Promise.all([
      getCatalog(),
      getFeatured(),
      getTodayDailyMenu(),
      getProductBySlug("meniul-zilei"),
      getSettings(),
    ]);

  const productCount = products.filter((p) => p.available).length;
  const showcase = categories.filter((c) => c.slug !== "meniul-zilei").slice(0, 8);

  return (
    <>
      <Hero tickerItems={TICKER} />

      <HomeInteractive daily={daily} meniulZilei={meniulZilei} featured={featured} />

      {/* ── Categorii ── */}
      <section className="mx-auto max-w-6xl px-4 pt-24 sm:px-6">
        <Reveal className="mb-8">
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-gold">Meniul complet</p>
          <h2 className="mt-2 font-display text-3xl font-extrabold sm:text-4xl">
            {productCount}+ preparate, {categories.length} categorii
          </h2>
        </Reveal>
        <div className="grid grid-cols-2 gap-3.5 sm:gap-4 lg:grid-cols-4">
          {showcase.map((c, i) => {
            const count = products.filter((p) => p.category_id === c.id).length;
            return (
              <Reveal key={c.id} delay={(i % 4) * 70}>
                <Link
                  href={`/meniu#${c.slug}`}
                  className="card-surface group flex h-full flex-col justify-between gap-6 p-5 transition hover:border-gold/40 hover:shadow-glow"
                >
                  <div>
                    <h3 className="font-display text-lg font-extrabold leading-tight">
                      {c.name}
                    </h3>
                    <p className="mt-1.5 line-clamp-2 text-xs text-mute">{c.description}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-faint">{count} preparate</span>
                    <span className="grid size-8 place-items-center rounded-full border border-[var(--hairline-strong)] text-gold transition group-hover:border-gold group-hover:bg-gold group-hover:text-ink">
                      <ArrowRight className="size-4" />
                    </span>
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>
        <Reveal className="mt-8 text-center">
          <Link
            href="/meniu"
            className="btn-gold inline-flex items-center gap-2 rounded-xl px-8 py-3.5 font-display text-lg font-extrabold"
          >
            Deschide meniul <ArrowRight className="size-5" />
          </Link>
        </Reveal>
      </section>

      {/* ── Cum funcționează ── */}
      <section className="mx-auto max-w-6xl px-4 pt-24 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: ShoppingBag,
              title: "Alegi ce-ți poftește inima",
              text: "Meniul zilei, grătar, pizza sau burgeri — adaugi în coș în două atingeri.",
            },
            {
              icon: ChefHat,
              title: "Gătim pe loc, ca la mama acasă",
              text: "Toate produsele noastre sunt gătite după rețete tradiționale, din ingrediente proaspete.",
            },
            {
              icon: Bike,
              title: "Livrăm în zona ta",
              text: `Livrare pe o rază de ${settings.delivery.radius_km} km sau ridicare direct de la bistro.`,
            },
          ].map((step, i) => (
            <Reveal key={step.title} delay={i * 110} className="card-surface relative overflow-hidden p-6">
              <span className="absolute -right-2 top-1 font-display text-[5.5rem] font-extrabold leading-none text-gold/8 select-none">
                {i + 1}
              </span>
              <step.icon className="size-7 text-gold" />
              <h3 className="mt-4 font-display text-lg font-extrabold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mute">{step.text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Despre / Evenimente ── */}
      <section id="despre" className="relative mx-auto max-w-6xl scroll-mt-24 px-4 pt-24 sm:px-6">
        <Reveal className="card-surface relative overflow-hidden p-8 sm:p-12">
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              background:
                "radial-gradient(70% 90% at 85% 10%, rgb(232 168 46 / 0.12), transparent 60%)",
            }}
          />
          <div className="relative grid items-center gap-8 md:grid-cols-[1.4fr_1fr]">
            <div>
              <p className="font-script text-4xl text-gold">cu drag, din bucătăria HASH</p>
              <h2 className="mt-3 font-display text-3xl font-extrabold sm:text-4xl">
                Un bistro de cartier,
                <br /> cu suflet de casă
              </h2>
              <p className="mt-4 max-w-xl leading-relaxed text-cream/80">
                De la ciorbele fierbinți la grătarul pe jar, gătim în fiecare zi după
                rețete tradiționale, cu răbdare și ingrediente alese. Fie că ne vizitezi,
                comanzi acasă sau sărbătorești cu noi — te primim ca pe-ai noștri.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-[var(--hairline-strong)] px-4 py-2 text-sm text-cream/85">
                  <PartyPopper className="size-4 text-gold" />
                  Evenimente și mese festive · max. 70 persoane
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-[var(--hairline-strong)] px-4 py-2 text-sm text-cream/85">
                  <Clock className="size-4 text-gold" />
                  Luni – Sâmbătă · {settings.hours.mon?.open} – {settings.hours.mon?.close} ·
                  Duminică · {settings.hours.sun?.open} – {settings.hours.sun?.close}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {settings.restaurant.phones.map((p) => (
                <a
                  key={p}
                  href={`tel:${p.replace(/\s/g, "")}`}
                  className="btn-ghost flex items-center justify-between rounded-2xl px-5 py-4"
                >
                  <span className="flex items-center gap-3 font-display text-lg font-extrabold tabular-nums">
                    <Phone className="size-5 text-gold" />
                    {formatPhone(p.replace(/\s/g, ""))}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-widest text-mute">
                    sună acum
                  </span>
                </a>
              ))}
              <p className="text-center text-xs text-faint">
                Comenzi telefonice: luni – sâmbătă {settings.hours.mon?.open} – {settings.hours.mon?.close},
                duminică {settings.hours.sun?.open} – {settings.hours.sun?.close}
              </p>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
