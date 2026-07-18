"use client";

import { useCart, cartTotals } from "@/lib/cart";
import { lei, optionsSummary } from "@/lib/utils";
import { Button, QtyStepper, Sheet } from "@/components/ui";
import { DishArt } from "@/components/dish-art";
import { ShoppingBag, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

const CartDrawerCtx = createContext<{ openCart: () => void }>({ openCart: () => {} });
export const useCartDrawer = () => useContext(CartDrawerCtx);

export function CartProvider({
  children,
  minOrder,
}: {
  children: React.ReactNode;
  minOrder: number;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const lines = useCart((s) => s.lines);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const lastAddedAt = useCart((s) => s.lastAddedAt);
  const [pulse, setPulse] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!lastAddedAt) return;
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 900);
    return () => clearTimeout(t);
  }, [lastAddedAt]);

  const { subtotal, count } = useMemo(() => cartTotals(lines), [lines]);
  const onCheckoutPage = pathname?.startsWith("/comanda");
  const showPill = mounted && count > 0 && !onCheckoutPage;

  return (
    <CartDrawerCtx.Provider value={{ openCart: () => setOpen(true) }}>
      {children}

      {/* pastila plutitoare — mereu la un deget distanță */}
      <div
        className={`fixed inset-x-0 bottom-4 z-90 flex justify-center px-4 transition-all duration-500 ${
          showPill ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-24 opacity-0"
        }`}
      >
        <button
          onClick={() => setOpen(true)}
          className={`btn-gold flex w-full max-w-md cursor-pointer items-center justify-between gap-4 rounded-2xl px-5 py-3.5 text-left shadow-lift ${
            pulse ? "animate-pulse-gold" : ""
          }`}
        >
          <span className="flex items-center gap-3">
            <span className="relative">
              <ShoppingBag className="size-5" />
              <span className="absolute -top-2 -right-2 grid size-5 place-items-center rounded-full bg-ink text-[0.65rem] font-bold text-gold tabular-nums">
                {count}
              </span>
            </span>
            <span className="font-display text-base font-extrabold">Vezi coșul</span>
          </span>
          <span className="font-display text-base font-extrabold tabular-nums">{lei(subtotal)}</span>
        </button>
      </div>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={
          <div className="flex items-baseline gap-3">
            <span className="font-display text-lg font-extrabold">Coșul tău</span>
            {mounted && count > 0 && (
              <span className="text-sm text-mute tabular-nums">{count} produse</span>
            )}
          </div>
        }
      >
        {!mounted || lines.length === 0 ? (
          <div className="grid place-items-center gap-4 px-6 py-16 text-center">
            <ShoppingBag className="size-10 text-faint" />
            <p className="text-mute">Coșul e gol deocamdată — hai să-l umplem cu ceva bun.</p>
            <Link href="/meniu" onClick={() => setOpen(false)}>
              <Button variant="ghost">Vezi meniul</Button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col">
            <ul className="divide-y divide-[var(--hairline)] px-5">
              {lines.map((l) => (
                <li key={l.key} className="flex gap-3 py-4">
                  <DishArt src={l.imageUrl} alt={l.name} className="size-14 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold leading-tight">{l.name}</p>
                      <p className="font-display font-bold text-gold tabular-nums">
                        {lei(l.unitPrice * l.qty)}
                      </p>
                    </div>
                    {l.options.length > 0 && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-mute">
                        {optionsSummary(l.options)}
                      </p>
                    )}
                    {l.notes && <p className="mt-0.5 text-xs text-faint italic">„{l.notes}”</p>}
                    <div className="mt-2 flex items-center justify-between">
                      <QtyStepper size="sm" qty={l.qty} onChange={(q) => setQty(l.key, q)} min={1} />
                      <button
                        onClick={() => remove(l.key)}
                        aria-label={`Șterge ${l.name}`}
                        className="cursor-pointer p-1 text-faint transition hover:text-brick"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="sticky bottom-0 border-t border-[var(--hairline)] bg-coal/95 px-5 py-4 backdrop-blur">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-mute">Subtotal</span>
                <span className="font-display text-xl font-extrabold text-gold tabular-nums">
                  {lei(subtotal)}
                </span>
              </div>
              {subtotal < minOrder && (
                <p className="mb-3 rounded-lg bg-gold/10 px-3 py-2 text-sm text-gold">
                  Comanda minimă pentru livrare este {lei(minOrder)}. Mai adaugă{" "}
                  {lei(minOrder - subtotal)} — sau alege ridicare personală.
                </p>
              )}
              <Button
                size="lg"
                className="w-full"
                onClick={() => {
                  setOpen(false);
                  router.push("/comanda");
                }}
              >
                Continuă spre comandă
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </CartDrawerCtx.Provider>
  );
}

/** Butonul de coș din header. */
export function CartButton() {
  const { openCart } = useCartDrawer();
  const lines = useCart((s) => s.lines);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { count } = cartTotals(lines);

  return (
    <button
      onClick={openCart}
      aria-label="Deschide coșul"
      className="relative grid size-10 cursor-pointer place-items-center rounded-full border border-[var(--hairline-strong)] text-cream transition hover:border-gold/70 hover:text-gold"
    >
      <ShoppingBag className="size-4.5" />
      {mounted && count > 0 && (
        <span className="absolute -top-1 -right-1 grid size-4.5 place-items-center rounded-full bg-gold text-[0.6rem] font-extrabold text-ink tabular-nums">
          {count}
        </span>
      )}
    </button>
  );
}
