"use client";

import { Badge, Button, Field, Input, Spinner } from "@/components/ui";
import { useCart } from "@/lib/cart";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Order } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/types";
import { formatDateTime, formatPhone, lei, optionsSummary } from "@/lib/utils";
import type { User } from "@supabase/supabase-js";
import { History, LogOut, MapPin, RotateCcw, Trash2, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type CustomerRow = { id: string; name: string; phone: string; email: string | null };
type AddressRow = {
  id: string;
  street: string;
  details: string | null;
  city: string;
};

export default function AccountPage() {
  const supa = supabaseBrowser();
  const router = useRouter();
  const add = useCart((s) => s.add);

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<AddressRow[]>([]);

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [reordered, setReordered] = useState<string | null>(null);

  const loadData = useCallback(
    async (u: User) => {
      const { data: cust } = await supa
        .from("customers")
        .select("id,name,phone,email")
        .eq("auth_user_id", u.id)
        .maybeSingle();
      setCustomer((cust as CustomerRow) ?? null);
      if (cust) {
        const [ordersRes, addrRes] = await Promise.all([
          supa
            .from("orders")
            .select("*, items:order_items(id,product_id,name,qty,unit_price,options,total)")
            .eq("customer_id", cust.id)
            .order("created_at", { ascending: false })
            .limit(25),
          supa
            .from("customer_addresses")
            .select("id,street,details,city")
            .eq("customer_id", cust.id)
            .order("created_at", { ascending: false }),
        ]);
        setOrders((ordersRes.data as Order[]) ?? []);
        setAddresses((addrRes.data as AddressRow[]) ?? []);
      }
    },
    [supa]
  );

  useEffect(() => {
    supa.auth.getUser().then(async ({ data: { user: u } }) => {
      setUser(u);
      if (u) await loadData(u);
      setLoading(false);
    });
  }, [supa, loadData]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthBusy(true);
    setAuthError(null);
    const fn =
      mode === "login"
        ? supa.auth.signInWithPassword({ email, password })
        : supa.auth.signUp({ email, password });
    const { data, error } = await fn;
    if (error) {
      setAuthError(
        error.message.includes("Invalid login")
          ? "Email sau parolă greșite."
          : error.message.includes("at least")
            ? "Parola trebuie să aibă minimum 6 caractere."
            : error.message
      );
      setAuthBusy(false);
      return;
    }
    const u = data.user;
    if (u) {
      setUser(u);
      setLoading(true);
      await loadData(u);
      setLoading(false);
      router.refresh();
    }
    setAuthBusy(false);
  }

  async function logout() {
    await supa.auth.signOut();
    setUser(null);
    setCustomer(null);
    setOrders([]);
    setAddresses([]);
    router.refresh();
  }

  function reorder(order: Order) {
    for (const item of order.items ?? []) {
      if (!item.product_id) continue;
      add({
        productId: item.product_id,
        slug: "",
        name: item.name,
        unitPrice: Number(item.unit_price),
        qty: item.qty,
        options: item.options,
      });
    }
    setReordered(order.id);
    setTimeout(() => setReordered(null), 2500);
  }

  async function deleteAddress(id: string) {
    await supa.from("customer_addresses").delete().eq("id", id);
    setAddresses((a) => a.filter((x) => x.id !== id));
  }

  if (loading) {
    return (
      <div className="grid min-h-[60svh] place-items-center pt-24">
        <Spinner className="size-8" />
      </div>
    );
  }

  /* ── neautentificat ── */
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 pt-28 pb-16 sm:px-6">
        <div className="card-surface p-6 sm:p-8">
          <UserRound className="size-8 text-gold" />
          <h1 className="mt-3 font-display text-2xl font-extrabold">
            {mode === "login" ? "Bine ai revenit!" : "Creează-ți cont"}
          </h1>
          <p className="mt-1 text-sm text-mute">
            {mode === "login"
              ? "Intră în cont pentru istoric, adrese salvate și re-comandă rapidă."
              : "Îți salvezi adresele și comanzi din nou cu un singur tap."}
          </p>
          <form onSubmit={handleAuth} className="mt-6 flex flex-col gap-4">
            <Field label="Email">
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="adresa@email.ro"
                autoComplete="email"
              />
            </Field>
            <Field label="Parolă">
              <Input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "register" ? "minimum 6 caractere" : "parola ta"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </Field>
            {authError && (
              <p className="rounded-xl border border-brick/50 bg-brick/10 px-4 py-2.5 text-sm text-brick">
                {authError}
              </p>
            )}
            <Button size="lg" type="submit" disabled={authBusy}>
              {authBusy ? <Spinner /> : mode === "login" ? "Intră în cont" : "Creează contul"}
            </Button>
          </form>
          <button
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setAuthError(null);
            }}
            className="mt-4 w-full cursor-pointer text-center text-sm text-gold hover:underline"
          >
            {mode === "login" ? "Nu ai cont? Creează unul" : "Ai deja cont? Intră aici"}
          </button>
          <p className="mt-5 border-t border-[var(--hairline)] pt-4 text-center text-xs text-faint">
            Poți comanda oricând și fără cont — contul se leagă automat de comenzile tale
            după numărul de telefon.
          </p>
        </div>
      </div>
    );
  }

  /* ── autentificat ── */
  return (
    <div className="mx-auto max-w-3xl px-4 pt-28 pb-16 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-script text-3xl text-gold/90">salut!</p>
          <h1 className="font-display text-3xl font-extrabold">
            {customer?.name || user.email}
          </h1>
          {customer && (
            <p className="mt-1 text-sm text-mute tabular-nums">
              {formatPhone(customer.phone)}
              {customer.email ? ` · ${customer.email}` : ""}
            </p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={logout}>
          <LogOut className="size-4" /> Ieși din cont
        </Button>
      </div>

      {!customer && (
        <p className="card-surface mt-6 p-5 text-sm text-mute">
          Încă nu avem comenzi legate de acest cont. La prima comandă cu numărul tău de
          telefon, istoricul apare aici automat.{" "}
          <Link href="/meniu" className="text-gold hover:underline">
            Comandă ceva bun →
          </Link>
        </p>
      )}

      {addresses.length > 0 && (
        <section className="mt-8">
          <h2 className="flex items-center gap-2 font-display text-lg font-extrabold">
            <MapPin className="size-4.5 text-gold" /> Adresele mele
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {addresses.map((a) => (
              <li
                key={a.id}
                className="card-surface flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <span>
                  {a.street}
                  {a.details ? `, ${a.details}` : ""} · {a.city}
                </span>
                <button
                  onClick={() => deleteAddress(a.id)}
                  aria-label="Șterge adresa"
                  className="cursor-pointer p-1 text-faint transition hover:text-brick"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {orders.length > 0 && (
        <section className="mt-8">
          <h2 className="flex items-center gap-2 font-display text-lg font-extrabold">
            <History className="size-4.5 text-gold" /> Comenzile mele
          </h2>
          <ul className="mt-3 flex flex-col gap-3">
            {orders.map((o) => (
              <li key={o.id} className="card-surface p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/comanda/${o.id}`}
                    className="font-display font-extrabold text-gold hover:underline tabular-nums"
                  >
                    #{o.order_number}
                  </Link>
                  <div className="flex items-center gap-2">
                    <Badge
                      tone={
                        o.status === "completed"
                          ? "green"
                          : o.status === "cancelled" || o.status === "refunded"
                            ? "red"
                            : "gold"
                      }
                    >
                      {STATUS_LABELS[o.status]}
                    </Badge>
                    <span className="text-xs text-faint">{formatDateTime(o.created_at)}</span>
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-mute">
                  {(o.items ?? [])
                    .map((i) => `${i.qty}× ${i.name}${i.options.length ? ` (${optionsSummary(i.options)})` : ""}`)
                    .join(", ")}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-display font-extrabold tabular-nums">{lei(o.total)}</span>
                  <Button size="sm" variant="ghost" onClick={() => reorder(o)}>
                    <RotateCcw className="size-3.5" />
                    {reordered === o.id ? "Adăugat în coș!" : "Comandă din nou"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
