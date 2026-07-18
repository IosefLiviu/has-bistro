import { Logo } from "@/components/logo";
import { formatPhone } from "@/lib/utils";
import type { HoursSettings, RestaurantSettings } from "@/lib/types";
import { Clock, MapPin, Phone } from "lucide-react";
import Link from "next/link";

export function Footer({
  restaurant,
  hours,
}: {
  restaurant: RestaurantSettings;
  hours: HoursSettings;
}) {
  const week = hours.mon;
  return (
    <footer id="contact" className="relative mt-24 border-t border-[var(--hairline)] bg-coal/60">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-4">
            <Logo className="size-16" />
            <div>
              <p className="font-display text-xl font-extrabold tracking-[0.24em] text-gold-grad">HASH</p>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-mute">
                Bistro &amp; Take Away
              </p>
            </div>
          </div>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-mute">
            Toate produsele noastre sunt gătite după rețete tradiționale.{" "}
            {restaurant.events_note}
          </p>
          <p className="mt-4 font-script text-3xl text-gold/90">Poftiți la masă!</p>
        </div>

        <div>
          <h3 className="font-display text-sm font-extrabold uppercase tracking-[0.2em] text-cream">
            Comenzi la telefon
          </h3>
          <ul className="mt-4 space-y-3">
            {restaurant.phones.map((p) => (
              <li key={p}>
                <a
                  href={`tel:${p.replace(/\s/g, "")}`}
                  className="inline-flex items-center gap-2.5 text-lg font-bold text-cream transition hover:text-gold tabular-nums"
                >
                  <Phone className="size-4 text-gold" />
                  {formatPhone(p.replace(/\s/g, ""))}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-5 flex items-start gap-2.5 text-sm text-mute">
            <MapPin className="mt-0.5 size-4 shrink-0 text-gold" />
            {restaurant.address_label}
          </p>
        </div>

        <div>
          <h3 className="font-display text-sm font-extrabold uppercase tracking-[0.2em] text-cream">
            Program
          </h3>
          <p className="mt-4 flex items-center gap-2.5 text-sm text-cream">
            <Clock className="size-4 text-gold" />
            Luni – Duminică{week ? `: ${week.open} – ${week.close}` : ""}
          </p>
          <div className="mt-6 flex flex-col gap-2 text-sm">
            <Link href="/meniu" className="text-mute transition hover:text-gold">
              Meniul complet
            </Link>
            <Link href="/cont" className="text-mute transition hover:text-gold">
              Contul meu
            </Link>
            <Link href="/admin" className="text-faint transition hover:text-gold">
              Panou administrare
            </Link>
          </div>
        </div>
      </div>
      <div className="border-t border-[var(--hairline)] py-5 text-center text-xs text-faint">
        © {new Date().getFullYear()} HASH Bistro &amp; Take Away · Toate drepturile rezervate
      </div>
    </footer>
  );
}
