"use client";

import { Logo } from "@/components/logo";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { NotificationSettings, Order, Staff } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Bell,
  BellOff,
  CalendarDays,
  ClipboardList,
  LogOut,
  Menu as MenuIcon,
  Settings,
  Store,
  Ticket,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/* ─────────────────────────────────────────────────────────────────────────────
   Context de notificări: sunet repetat + notificări browser până la preluare.
   Montat în layout ca să sune pe ORICE pagină de admin.
──────────────────────────────────────────────────────────────────────────── */

type NotifierCtx = {
  unackedCount: number;
  escalated: boolean;
  soundOn: boolean;
  setSoundOn: (v: boolean) => void;
  refreshUnacked: () => void;
  playTest: () => void;
};

const Ctx = createContext<NotifierCtx>({
  unackedCount: 0,
  escalated: false,
  soundOn: true,
  setSoundOn: () => {},
  refreshUnacked: () => {},
  playTest: () => {},
});

export const useAdminNotifier = () => useContext(Ctx);

function playChime(volume: number, urgent = false) {
  try {
    type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };
    const AC = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const notes = urgent ? [880, 1108.7, 880, 1108.7, 1318.5] : [659.3, 830.6, 987.8];
    const dur = urgent ? 0.16 : 0.22;
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t0 = ctx.currentTime + i * dur;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(volume, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur * 1.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur * 1.5);
    });
    setTimeout(() => ctx.close(), (notes.length * dur + 1) * 1000);
  } catch {
    /* audio indisponibil */
  }
}

export function AdminShell({
  staff,
  notifications,
  children,
}: {
  staff: Staff;
  notifications: NotificationSettings;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [unacked, setUnacked] = useState<Order[]>([]);
  const unackedRef = useRef<Order[]>([]);
  unackedRef.current = unacked;
  const escalatedRef = useRef(new Set<string>());
  const baseTitle = useRef("HASH · Admin");

  const refreshUnacked = useCallback(async () => {
    const supa = supabaseBrowser();
    const { data } = await supa
      .from("orders")
      .select("id,order_number,created_at,acknowledged_at,status,total,customer_name,type")
      .eq("status", "new")
      .is("acknowledged_at", null)
      .order("created_at", { ascending: true });
    setUnacked((data as Order[]) ?? []);
  }, []);

  /* abonare realtime la comenzi noi */
  useEffect(() => {
    const supa = supabaseBrowser();
    refreshUnacked();
    const channel = supa
      .channel("admin-orders-notify")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const order = payload.new as Order;
          refreshUnacked();
          if (notifications.browser_notifications && "Notification" in window) {
            if (Notification.permission === "granted") {
              const n = new Notification(`Comandă nouă #${order.order_number}`, {
                body: `${order.customer_name} · ${order.total} lei · ${
                  order.type === "delivery" ? "livrare" : "ridicare"
                }`,
                tag: order.id,
              });
              n.onclick = () => {
                window.focus();
                router.push(`/admin/comenzi/${order.id}`);
              };
            }
          }
          router.refresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        () => {
          refreshUnacked();
          router.refresh();
        }
      )
      .subscribe();
    return () => {
      supa.removeChannel(channel);
    };
  }, [notifications.browser_notifications, refreshUnacked, router]);

  /* buclă de sunet: repetă până la preluare; escaladează după X minute */
  const escalated = useMemo(
    () =>
      unacked.some(
        (o) =>
          Date.now() - new Date(o.created_at).getTime() >
          notifications.escalate_after_minutes * 60_000
      ),
    [unacked]
  );

  useEffect(() => {
    if (!soundOn) return;
    const interval = setInterval(
      () => {
        const list = unackedRef.current;
        if (list.length === 0) return;
        const isEscalated = list.some(
          (o) =>
            Date.now() - new Date(o.created_at).getTime() >
            notifications.escalate_after_minutes * 60_000
        );
        playChime(notifications.volume, isEscalated);
        // escaladare externă (webhook) — o singură dată per comandă
        if (notifications.escalation_webhook_url) {
          for (const o of list) {
            const overdue =
              Date.now() - new Date(o.created_at).getTime() >
              notifications.escalate_after_minutes * 60_000;
            if (overdue && !escalatedRef.current.has(o.id)) {
              escalatedRef.current.add(o.id);
              fetch("/api/admin/escalate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ order_id: o.id }),
              }).catch(() => {});
            }
          }
        }
      },
      Math.max(5, notifications.repeat_seconds) * 1000
    );
    return () => clearInterval(interval);
  }, [soundOn, notifications]);

  /* sunet imediat la prima comandă nouă */
  const prevCount = useRef(0);
  useEffect(() => {
    if (unacked.length > prevCount.current && soundOn) {
      playChime(notifications.volume);
    }
    prevCount.current = unacked.length;
  }, [unacked.length, soundOn, notifications.volume]);

  /* titlu tab intermitent */
  useEffect(() => {
    if (unacked.length === 0) {
      document.title = baseTitle.current;
      return;
    }
    let flip = false;
    const t = setInterval(() => {
      flip = !flip;
      document.title = flip
        ? `🔔 ${unacked.length} ${unacked.length === 1 ? "comandă nouă" : "comenzi noi"}!`
        : baseTitle.current;
    }, 1200);
    return () => {
      clearInterval(t);
      document.title = baseTitle.current;
    };
  }, [unacked.length]);

  /* permisiune notificări browser */
  useEffect(() => {
    if (
      notifications.browser_notifications &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission();
    }
  }, [notifications.browser_notifications]);

  async function logout() {
    await supabaseBrowser().auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  const NAV = [
    { href: "/admin", label: "Comenzi live", icon: ClipboardList, exact: true },
    { href: "/admin/meniul-zilei", label: "Meniul zilei", icon: CalendarDays },
    { href: "/admin/produse", label: "Produse", icon: UtensilsCrossed },
    { href: "/admin/clienti", label: "Clienți", icon: Users },
    { href: "/admin/rapoarte", label: "Rapoarte", icon: BarChart3 },
    { href: "/admin/promo", label: "Promoții", icon: Ticket },
    { href: "/admin/setari", label: "Setări", icon: Settings },
  ];

  const ctxValue: NotifierCtx = {
    unackedCount: unacked.length,
    escalated,
    soundOn,
    setSoundOn,
    refreshUnacked,
    playTest: () => playChime(notifications.volume),
  };

  return (
    <Ctx.Provider value={ctxValue}>
      <div className="flex min-h-svh bg-ink">
        {/* sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-90 flex w-64 flex-col border-r border-[var(--hairline)] bg-coal transition-transform lg:sticky lg:top-0 lg:h-svh lg:translate-x-0",
            navOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex items-center gap-3 border-b border-[var(--hairline)] px-5 py-4">
            <Logo className="size-10" />
            <div className="leading-none">
              <p className="font-display text-sm font-extrabold tracking-[0.2em] text-gold-grad">
                HASH
              </p>
              <p className="mt-1 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-mute">
                Administrare
              </p>
            </div>
            <button
              className="ml-auto cursor-pointer p-1 text-mute lg:hidden"
              onClick={() => setNavOpen(false)}
              aria-label="Închide meniul"
            >
              <X className="size-5" />
            </button>
          </div>

          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
            {NAV.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setNavOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition",
                    active
                      ? "bg-gold/12 text-gold"
                      : "text-cream/75 hover:bg-cream/5 hover:text-cream"
                  )}
                >
                  <item.icon className="size-4.5" />
                  {item.label}
                  {item.href === "/admin" && unacked.length > 0 && (
                    <span
                      className={cn(
                        "ml-auto grid size-5.5 place-items-center rounded-full text-[0.7rem] font-extrabold text-ink tabular-nums",
                        escalated ? "animate-pulse-gold bg-brick text-cream" : "bg-gold"
                      )}
                    >
                      {unacked.length}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-[var(--hairline)] p-3">
            <Link
              href="/"
              className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-cream/60 transition hover:text-cream"
            >
              <Store className="size-4.5" /> Vezi site-ul
            </Link>
            <div className="mt-1 flex items-center justify-between rounded-xl px-3.5 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{staff.name}</p>
                <p className="text-xs capitalize text-faint">{staff.role}</p>
              </div>
              <button
                onClick={logout}
                aria-label="Ieși din cont"
                className="cursor-pointer p-1.5 text-mute transition hover:text-brick"
              >
                <LogOut className="size-4.5" />
              </button>
            </div>
          </div>
        </aside>

        {navOpen && (
          <div
            className="fixed inset-0 z-80 bg-ink/70 backdrop-blur-sm lg:hidden"
            onClick={() => setNavOpen(false)}
          />
        )}

        {/* conținut */}
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-70 flex h-14 items-center gap-3 border-b border-[var(--hairline)] bg-ink/90 px-4 backdrop-blur-xl">
            <button
              className="cursor-pointer p-1.5 text-cream lg:hidden"
              onClick={() => setNavOpen(true)}
              aria-label="Deschide meniul"
            >
              <MenuIcon className="size-5" />
            </button>
            {unacked.length > 0 && (
              <Link
                href="/admin"
                className={cn(
                  "flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-extrabold",
                  escalated
                    ? "animate-pulse-gold bg-brick text-cream"
                    : "bg-gold text-ink"
                )}
              >
                <Bell className="size-4 animate-ring" />
                {unacked.length === 1
                  ? "1 comandă nouă!"
                  : `${unacked.length} comenzi noi!`}
              </Link>
            )}
            <button
              onClick={() => setSoundOn(!soundOn)}
              className={cn(
                "ml-auto flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
                soundOn
                  ? "border-gold/50 text-gold"
                  : "border-[var(--hairline-strong)] text-faint"
              )}
            >
              {soundOn ? <Bell className="size-3.5" /> : <BellOff className="size-3.5" />}
              {soundOn ? "Sunet pornit" : "Sunet oprit"}
            </button>
          </header>
          <main className="p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </Ctx.Provider>
  );
}
