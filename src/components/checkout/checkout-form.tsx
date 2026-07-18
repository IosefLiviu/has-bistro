"use client";

import { StripePayment } from "@/components/checkout/stripe-payment";
import { DishArt } from "@/components/dish-art";
import { Badge, Button, Field, Input, Textarea } from "@/components/ui";
import { cartTotals, useCart } from "@/lib/cart";
import type { DeliverySettings, GlovoSettings, HoursSettings, OrderingSettings, PaymentMethod } from "@/lib/types";
import { cn, formatPhone, isOpenNow, lei, normalizePhone, optionsSummary, todayHours } from "@/lib/utils";
import {
  AlertTriangle,
  Banknote,
  Bike,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  ExternalLink,
  Globe,
  Loader2,
  MapPin,
  ShoppingBag,
  Store,
  Ticket,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ZoneState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "ok"; distance: number; lat: number; lng: number; display: string | null }
  | { status: "out"; distance: number; radius: number }
  | { status: "notfound" }
  | { status: "error" };

export type SavedAddress = {
  id: string;
  street: string;
  details: string | null;
  city: string;
  lat: number | null;
  lng: number | null;
};

export type CheckoutPrefill = {
  name?: string;
  phone?: string;
  email?: string;
  addresses: SavedAddress[];
  loggedIn: boolean;
};

export function CheckoutForm({
  delivery,
  ordering,
  hours,
  glovo,
  stripeReady,
  restaurantAddress,
  prefill,
}: {
  delivery: DeliverySettings;
  ordering: OrderingSettings;
  hours: HoursSettings;
  glovo: GlovoSettings;
  stripeReady: boolean;
  restaurantAddress: string;
  prefill: CheckoutPrefill;
}) {
  const router = useRouter();
  const lines = useCart((s) => s.lines);
  const clearCart = useCart((s) => s.clear);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [type, setType] = useState<"delivery" | "pickup">(
    ordering.delivery_enabled ? "delivery" : "pickup"
  );
  const [street, setStreet] = useState("");
  const [details, setDetails] = useState("");
  const [zone, setZone] = useState<ZoneState>({ status: "idle" });
  const [name, setName] = useState(prefill.name ?? "");
  const [phone, setPhone] = useState(prefill.phone ?? "");
  const [email, setEmail] = useState(prefill.email ?? "");
  const [timing, setTiming] = useState<"asap" | "scheduled">("asap");
  const [scheduledTime, setScheduledTime] = useState("");
  const [payment, setPayment] = useState<PaymentMethod | null>(null);
  const [notes, setNotes] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoState, setPromoState] = useState<
    { status: "idle" } | { status: "checking" } | { status: "ok"; discount: number } | { status: "bad"; msg: string }
  >({ status: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stripeStage, setStripeStage] = useState<{ clientSecret: string; orderId: string } | null>(null);
  const zoneReqId = useRef(0);

  const { subtotal, count } = useMemo(() => cartTotals(lines), [lines]);
  const openNow = isOpenNow(hours);
  const today = todayHours(hours);

  /* ── verificare zonă (debounce) ── */
  const checkZone = useCallback(
    async (params: string) => {
      const id = ++zoneReqId.current;
      setZone({ status: "checking" });
      try {
        const res = await fetch(`/api/geocode?${params}`);
        const data = await res.json();
        if (id !== zoneReqId.current) return;
        if (!data.found) {
          setZone({ status: data.reason === "network" ? "error" : "notfound" });
        } else if (data.in_zone) {
          setZone({
            status: "ok",
            distance: data.distance_km,
            lat: data.lat,
            lng: data.lng,
            display: data.display_name,
          });
        } else {
          setZone({ status: "out", distance: data.distance_km, radius: data.radius_km });
        }
      } catch {
        if (id === zoneReqId.current) setZone({ status: "error" });
      }
    },
    []
  );

  useEffect(() => {
    if (type !== "delivery") return;
    const q = street.trim();
    if (q.length < 8) {
      setZone({ status: "idle" });
      return;
    }
    const t = setTimeout(() => {
      checkZone(`q=${encodeURIComponent(`${q}, București`)}`);
    }, 700);
    return () => clearTimeout(t);
  }, [street, type, checkZone]);

  function pickSaved(a: SavedAddress) {
    setStreet(a.street);
    setDetails(a.details ?? "");
    if (a.lat != null && a.lng != null) {
      checkZone(`lat=${a.lat}&lng=${a.lng}`);
    }
  }

  /* ── metode de plată disponibile ── */
  const paymentOptions = useMemo(() => {
    const opts: Array<{ id: PaymentMethod; label: string; icon: typeof Banknote; hint?: string }> = [];
    if (stripeReady) {
      opts.push({ id: "card_online", label: "Card online", icon: Globe, hint: "plătești acum, securizat" });
    }
    if (type === "delivery") {
      opts.push(
        { id: "cash_delivery", label: "Numerar la livrare", icon: Banknote },
        { id: "card_delivery", label: "Card la livrare", icon: CreditCard, hint: "POS la curier" }
      );
    } else {
      opts.push(
        { id: "cash_pickup", label: "Numerar la ridicare", icon: Banknote },
        { id: "card_pickup", label: "Card la ridicare", icon: CreditCard }
      );
    }
    return opts;
  }, [type, stripeReady]);

  useEffect(() => {
    if (!payment || !paymentOptions.some((o) => o.id === payment)) {
      setPayment(paymentOptions[type === "delivery" ? (stripeReady ? 1 : 0) : (stripeReady ? 1 : 0)]?.id ?? null);
    }
  }, [paymentOptions, payment, type, stripeReady]);

  /* ── sloturi orare ── */
  const timeSlots = useMemo(() => {
    if (!today) return [];
    const [oh, om] = today.open.split(":").map(Number);
    const [ch, cm] = today.close.split(":").map(Number);
    const now = new Date();
    const startMin = Math.max(oh * 60 + om, now.getHours() * 60 + now.getMinutes() + 40);
    const endMin = ch * 60 + cm;
    const slots: string[] = [];
    for (let m = Math.ceil(startMin / 15) * 15; m <= endMin; m += 15) {
      slots.push(
        `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
      );
    }
    return slots;
  }, [today]);

  /* ── promo ── */
  async function applyPromo() {
    const code = promoCode.trim();
    if (!code) return;
    setPromoState({ status: "checking" });
    try {
      const res = await fetch(`/api/promo?code=${encodeURIComponent(code)}&subtotal=${subtotal}`);
      const data = await res.json();
      if (data.valid) setPromoState({ status: "ok", discount: data.discount });
      else
        setPromoState({
          status: "bad",
          msg:
            data.reason === "min_order"
              ? `Codul se aplică de la ${lei(data.min_order)}.`
              : "Codul nu este valid sau a expirat.",
        });
    } catch {
      setPromoState({ status: "bad", msg: "Nu am putut verifica codul." });
    }
  }

  /* ── totaluri ── */
  const fee =
    type === "delivery"
      ? delivery.free_over != null && subtotal >= delivery.free_over
        ? 0
        : delivery.fee
      : 0;
  const discount = promoState.status === "ok" ? promoState.discount : 0;
  const total = Math.max(0, subtotal + fee - discount);

  const belowMin = type === "delivery" && subtotal < delivery.min_order;
  const zoneBlocked = type === "delivery" && zone.status !== "ok";
  const phoneValid = normalizePhone(phone) != null;
  const closedToday = !today;
  const mustSchedule = !openNow && !closedToday;
  const timingValid = timing === "asap" ? openNow : !!scheduledTime;

  const canSubmit =
    mounted &&
    count > 0 &&
    !belowMin &&
    !zoneBlocked &&
    name.trim().length >= 2 &&
    phoneValid &&
    !!payment &&
    timingValid &&
    !closedToday &&
    !submitting;

  useEffect(() => {
    if (mustSchedule) setTiming("scheduled");
  }, [mustSchedule]);

  /* ── plasare comandă ── */
  async function submit() {
    if (!canSubmit || !payment) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          items: lines.map((l) => ({
            productId: l.productId,
            qty: l.qty,
            options: l.options.map((o) => ({ group: o.group, item: o.item })),
            notes: l.notes,
          })),
          customer: { name, phone, email: email || undefined },
          address:
            type === "delivery" && zone.status === "ok"
              ? { street, details, city: "București", lat: zone.lat, lng: zone.lng }
              : undefined,
          payment_method: payment,
          requested_time: timing === "asap" ? "asap" : scheduledTime,
          notes,
          delivery_notes: type === "delivery" ? deliveryNotes : undefined,
          promo_code: promoState.status === "ok" ? promoCode.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "A apărut o eroare. Încearcă din nou.");
        setSubmitting(false);
        return;
      }
      if (data.client_secret) {
        setStripeStage({ clientSecret: data.client_secret, orderId: data.id });
        setSubmitting(false);
        return;
      }
      clearCart();
      router.replace(`/comanda/${data.id}?noua=1`);
    } catch {
      setError("Conexiune întreruptă. Verifică internetul și încearcă din nou.");
      setSubmitting(false);
    }
  }

  /* ── stări goale ── */
  if (mounted && count === 0 && !stripeStage) {
    return (
      <div className="mx-auto grid max-w-lg place-items-center gap-5 px-4 py-24 text-center">
        <ShoppingBag className="size-12 text-faint" />
        <h1 className="font-display text-2xl font-extrabold">Coșul tău e gol</h1>
        <p className="text-mute">Alege ceva bun din meniu și revino aici pentru finalizare.</p>
        <Link href="/meniu">
          <Button size="lg">Deschide meniul</Button>
        </Link>
      </div>
    );
  }

  if (stripeStage) {
    return (
      <StripePayment
        clientSecret={stripeStage.clientSecret}
        orderId={stripeStage.orderId}
        total={total}
        onSuccess={() => {
          clearCart();
          router.replace(`/comanda/${stripeStage.orderId}?noua=1`);
        }}
      />
    );
  }

  const sectionCls = "card-surface p-5 sm:p-6";
  const sectionTitle = (n: number, label: string) => (
    <h2 className="mb-4 flex items-center gap-3 font-display text-lg font-extrabold">
      <span className="grid size-7 place-items-center rounded-full bg-gold/15 text-sm text-gold">{n}</span>
      {label}
    </h2>
  );

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 pb-28 sm:px-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
      <div className="flex flex-col gap-5">
        {/* ── 1: mod ── */}
        <section className={sectionCls}>
          {sectionTitle(1, "Cum primești comanda?")}
          <div className="grid grid-cols-2 gap-3">
            {ordering.delivery_enabled && (
              <button
                type="button"
                onClick={() => setType("delivery")}
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-2 rounded-2xl border px-4 py-5 transition",
                  type === "delivery"
                    ? "border-gold bg-gold/10 shadow-glow"
                    : "border-[var(--hairline-strong)] hover:border-gold/40"
                )}
              >
                <Bike className={cn("size-6", type === "delivery" ? "text-gold" : "text-mute")} />
                <span className="font-display font-bold">Livrare</span>
                <span className="text-xs text-mute">
                  {fee === 0 && subtotal >= (delivery.free_over ?? Infinity)
                    ? "transport gratuit"
                    : `taxă ${lei(delivery.fee)}${delivery.free_over ? ` · gratuit peste ${lei(delivery.free_over)}` : ""}`}
                </span>
              </button>
            )}
            {ordering.pickup_enabled && (
              <button
                type="button"
                onClick={() => setType("pickup")}
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-2 rounded-2xl border px-4 py-5 transition",
                  type === "pickup"
                    ? "border-gold bg-gold/10 shadow-glow"
                    : "border-[var(--hairline-strong)] hover:border-gold/40"
                )}
              >
                <Store className={cn("size-6", type === "pickup" ? "text-gold" : "text-mute")} />
                <span className="font-display font-bold">Ridicare personală</span>
                <span className="text-xs text-mute">fără taxă, direct de la bistro</span>
              </button>
            )}
          </div>

          {type === "delivery" ? (
            <div className="mt-5 flex flex-col gap-4">
              {prefill.addresses.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {prefill.addresses.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => pickSaved(a)}
                      className="cursor-pointer rounded-full border border-[var(--hairline-strong)] px-3.5 py-1.5 text-sm text-cream/85 transition hover:border-gold/60 hover:text-gold"
                    >
                      <MapPin className="mr-1.5 inline size-3.5 text-gold" />
                      {a.street}
                    </button>
                  ))}
                </div>
              )}
              <Field label="Adresa de livrare" error={null}>
                <Input
                  placeholder="Strada și numărul — ex: Strada Doamna Ghica 5"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  autoComplete="street-address"
                />
              </Field>
              <Field label="Detalii acces (opțional)">
                <Input
                  placeholder="Bloc, scară, etaj, apartament, interfon"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                />
              </Field>

              {/* starea zonei */}
              {zone.status === "checking" && (
                <p className="flex items-center gap-2 text-sm text-mute">
                  <Loader2 className="size-4 animate-spin text-gold" /> Verificăm zona de livrare…
                </p>
              )}
              {zone.status === "ok" && (
                <p className="flex items-start gap-2 rounded-xl border border-mint/30 bg-mint/10 px-4 py-3 text-sm text-mint">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                  <span>
                    Ești în zona de livrare ({zone.distance} km de bistro).
                    {zone.display && <span className="mt-0.5 block text-xs opacity-75">{zone.display}</span>}
                  </span>
                </p>
              )}
              {zone.status === "out" && (
                <div className="rounded-xl border border-brick/50 bg-brick/12 px-4 py-4">
                  <p className="flex items-start gap-2.5 text-sm font-semibold text-brick">
                    <AlertTriangle className="mt-0.5 size-5 shrink-0" />
                    Adresa ta este la {zone.distance} km — în afara zonei noastre de livrare de{" "}
                    {zone.radius} km.
                  </p>
                  <p className="mt-2 pl-7.5 text-sm text-cream/80">
                    Poți comanda totuși prin partenerii noștri de livrare sau poți ridica
                    personal comanda de la bistro.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2.5 pl-7.5">
                    <a href={glovo.url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" className="!bg-[linear-gradient(135deg,#ffc244,#f3a712)]">
                        {glovo.label} <ExternalLink className="size-3.5" />
                      </Button>
                    </a>
                    <Button size="sm" variant="ghost" onClick={() => setType("pickup")}>
                      Aleg ridicare personală
                    </Button>
                  </div>
                </div>
              )}
              {zone.status === "notfound" && street.trim().length >= 8 && (
                <p className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold">
                  Nu am găsit adresa pe hartă. Verifică strada și numărul (ex: „Strada
                  Exemplu 10”) — sau sună-ne și preluăm noi comanda telefonic.
                </p>
              )}
              {zone.status === "error" && (
                <p className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold">
                  Nu am putut verifica adresa acum. Mai încearcă o dată în câteva secunde.
                </p>
              )}
              <Field label="Instrucțiuni pentru curier (opțional)">
                <Input
                  placeholder="Ex: lasă la ușă, sună când ajungi"
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                />
              </Field>
            </div>
          ) : (
            <p className="mt-5 flex items-start gap-2.5 rounded-xl border border-[var(--hairline)] bg-slate/60 px-4 py-3.5 text-sm text-cream/85">
              <MapPin className="mt-0.5 size-4 shrink-0 text-gold" />
              Ridici comanda de la: <strong>{restaurantAddress}</strong>
            </p>
          )}
        </section>

        {/* ── 2: date contact ── */}
        <section className={sectionCls}>
          {sectionTitle(2, "Datele tale")}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nume și prenume">
              <Input
                placeholder="ex: Andrei Popescu"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </Field>
            <Field
              label="Telefon"
              error={phone && !phoneValid ? "Numărul nu pare valid (ex: 0722 123 456)" : null}
            >
              <Input
                placeholder="07xx xxx xxx"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
              />
            </Field>
            <Field label="Email (opțional)" className="sm:col-span-2">
              <Input
                placeholder="pentru confirmarea comenzii"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </Field>
          </div>
          {!prefill.loggedIn && (
            <p className="mt-3 text-xs text-faint">
              Comanzi ca vizitator — rapid și simplu.{" "}
              <Link href="/cont" className="text-gold hover:underline">
                Intră în cont
              </Link>{" "}
              ca să-ți salvezi adresele și istoricul.
            </p>
          )}
        </section>

        {/* ── 3: când ── */}
        <section className={sectionCls}>
          {sectionTitle(3, "Când?")}
          {closedToday ? (
            <p className="rounded-xl border border-brick/40 bg-brick/10 px-4 py-3 text-sm text-brick">
              Astăzi suntem închiși. Revenim mâine de la {hours.mon?.open ?? "10:00"} — te așteptăm!
            </p>
          ) : (
            <>
              {mustSchedule && (
                <p className="mb-3 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold">
                  Suntem închiși acum (program {today?.open}–{today?.close}). Poți programa
                  comanda pentru mai târziu astăzi.
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={!openNow}
                  onClick={() => setTiming("asap")}
                  className={cn(
                    "cursor-pointer rounded-xl border px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40",
                    timing === "asap"
                      ? "border-gold bg-gold/10 text-gold"
                      : "border-[var(--hairline-strong)] text-cream/85"
                  )}
                >
                  Cât mai repede
                  <span className="ml-1.5 text-xs font-normal text-mute">
                    ~{ordering.prep_minutes + (type === "delivery" ? ordering.delivery_minutes - ordering.prep_minutes : 0)}
                    –{type === "delivery" ? ordering.delivery_minutes + 15 : ordering.prep_minutes + 15} min
                  </span>
                </button>
                <div className="relative">
                  <select
                    value={timing === "scheduled" ? scheduledTime : ""}
                    onChange={(e) => {
                      setTiming("scheduled");
                      setScheduledTime(e.target.value);
                    }}
                    className={cn(
                      "cursor-pointer appearance-none rounded-xl border py-2.5 pl-4 pr-9 text-sm font-semibold outline-none transition",
                      timing === "scheduled" && scheduledTime
                        ? "border-gold bg-gold/10 text-gold"
                        : "border-[var(--hairline-strong)] bg-transparent text-cream/85"
                    )}
                  >
                    <option value="" disabled className="bg-coal text-cream">
                      Programează ora
                    </option>
                    {timeSlots.map((t) => (
                      <option key={t} value={t} className="bg-coal text-cream">
                        {t}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-mute" />
                </div>
              </div>
            </>
          )}
        </section>

        {/* ── 4: plată ── */}
        <section className={sectionCls}>
          {sectionTitle(4, "Cum plătești?")}
          <div className="grid gap-2.5 sm:grid-cols-2">
            {paymentOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPayment(opt.id)}
                className={cn(
                  "flex cursor-pointer items-center gap-3.5 rounded-2xl border px-4 py-3.5 text-left transition",
                  payment === opt.id
                    ? "border-gold bg-gold/10"
                    : "border-[var(--hairline-strong)] hover:border-gold/40"
                )}
              >
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-xl",
                    payment === opt.id ? "bg-gold text-ink" : "bg-slate text-mute"
                  )}
                >
                  <opt.icon className="size-5" />
                </span>
                <span>
                  <span className="block font-semibold">{opt.label}</span>
                  {opt.hint && <span className="block text-xs text-mute">{opt.hint}</span>}
                </span>
              </button>
            ))}
          </div>
          {!stripeReady && (
            <p className="mt-3 text-xs text-faint">
              Plata online cu cardul va fi disponibilă în curând.
            </p>
          )}
        </section>

        {/* ── 5: observații ── */}
        <section className={sectionCls}>
          {sectionTitle(5, "Observații pentru comandă (opțional)")}
          <Textarea
            placeholder="Orice ar trebui să știe bucătăria sau curierul"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
          />
        </section>
      </div>

      {/* ── sumar ── */}
      <aside className="card-surface top-24 flex flex-col gap-4 p-5 sm:p-6 lg:sticky">
        <h2 className="font-display text-lg font-extrabold">Sumarul comenzii</h2>
        <ul className="flex flex-col gap-3">
          {lines.map((l) => (
            <li key={l.key} className="flex items-center gap-3">
              <DishArt src={l.imageUrl} alt={l.name} className="size-11 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  <span className="text-gold tabular-nums">{l.qty}×</span> {l.name}
                </p>
                {l.options.length > 0 && (
                  <p className="truncate text-xs text-faint">{optionsSummary(l.options)}</p>
                )}
              </div>
              <span className="shrink-0 text-sm font-bold tabular-nums">
                {lei(l.unitPrice * l.qty)}
              </span>
            </li>
          ))}
        </ul>
        <Link href="/meniu" className="text-sm text-gold hover:underline">
          + Mai adaugă ceva
        </Link>

        {/* promo */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Ticket className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
            <Input
              placeholder="Cod promoțional"
              value={promoCode}
              onChange={(e) => {
                setPromoCode(e.target.value);
                setPromoState({ status: "idle" });
              }}
              className="pl-9"
            />
          </div>
          <Button variant="ghost" size="md" onClick={applyPromo} disabled={promoState.status === "checking" || !promoCode.trim()}>
            {promoState.status === "checking" ? <Loader2 className="size-4 animate-spin" /> : "Aplică"}
          </Button>
        </div>
        {promoState.status === "ok" && (
          <p className="-mt-2 text-xs text-mint">Cod aplicat: −{lei(promoState.discount)}</p>
        )}
        {promoState.status === "bad" && (
          <p className="-mt-2 text-xs text-brick">{promoState.msg}</p>
        )}

        <div className="flex flex-col gap-2 border-t border-[var(--hairline)] pt-4 text-sm">
          <div className="flex justify-between text-cream/85">
            <span>Subtotal</span>
            <span className="tabular-nums">{lei(subtotal)}</span>
          </div>
          {type === "delivery" && (
            <div className="flex justify-between text-cream/85">
              <span>Livrare</span>
              <span className="tabular-nums">{fee === 0 ? "gratuită" : lei(fee)}</span>
            </div>
          )}
          {discount > 0 && (
            <div className="flex justify-between text-mint">
              <span>Reducere</span>
              <span className="tabular-nums">−{lei(discount)}</span>
            </div>
          )}
          <div className="mt-1 flex items-baseline justify-between border-t border-[var(--hairline)] pt-3">
            <span className="font-display text-base font-extrabold">Total</span>
            <span className="font-display text-2xl font-extrabold text-gold tabular-nums">
              {lei(total)}
            </span>
          </div>
        </div>

        {belowMin && (
          <p className="rounded-xl bg-gold/10 px-3.5 py-2.5 text-xs text-gold">
            Comanda minimă pentru livrare este {lei(delivery.min_order)}. Mai adaugă{" "}
            {lei(delivery.min_order - subtotal)} sau alege ridicare personală.
          </p>
        )}
        {error && (
          <p className="rounded-xl border border-brick/50 bg-brick/10 px-3.5 py-2.5 text-sm text-brick">
            {error}
          </p>
        )}

        <Button size="lg" className="w-full" disabled={!canSubmit} onClick={submit}>
          {submitting ? (
            <>
              <Loader2 className="size-5 animate-spin" /> Se trimite…
            </>
          ) : payment === "card_online" ? (
            "Continuă la plată"
          ) : (
            "Plasează comanda"
          )}
        </Button>
        <p className="text-center text-[0.7rem] leading-relaxed text-faint">
          Trimițând comanda, ești de acord să te contactăm telefonic pentru confirmare dacă
          este nevoie.
        </p>
      </aside>
    </div>
  );
}
