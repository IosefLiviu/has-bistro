"use client";

import { Logo } from "@/components/logo";
import { CartButton } from "@/components/cart/cart-ui";
import { cn, formatPhone } from "@/lib/utils";
import { Phone } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/meniu", label: "Meniu" },
  { href: "/#meniul-zilei", label: "Meniul zilei" },
  { href: "/#despre", label: "Despre" },
  { href: "/#contact", label: "Contact" },
];

export function Header({ phone }: { phone: string }) {
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const overHero = pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const solid = scrolled || !overHero;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-95 transition-all duration-500",
        solid
          ? "border-b border-[var(--hairline)] bg-ink/85 backdrop-blur-xl"
          : "border-b border-transparent bg-gradient-to-b from-ink/70 to-transparent"
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="HASH Bistro — acasă" className="flex items-center gap-3">
          <Logo className="size-11 transition-transform duration-500 hover:rotate-6" />
          <span className="hidden flex-col leading-none sm:flex">
            <span className="font-display text-lg font-extrabold tracking-[0.28em] text-gold-grad">
              HASH
            </span>
            <span className="text-[0.58rem] font-semibold uppercase tracking-[0.34em] text-mute">
              Bistro &amp; Take Away
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Navigare principală">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-semibold text-cream/85 transition hover:text-gold"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <a
            href={`tel:${phone.replace(/\s/g, "")}`}
            className="hidden items-center gap-2 rounded-full border border-[var(--hairline-strong)] px-4 py-2 text-sm font-semibold text-cream transition hover:border-gold/70 hover:text-gold sm:inline-flex"
          >
            <Phone className="size-3.5 text-gold" />
            <span className="tabular-nums">{formatPhone(phone)}</span>
          </a>
          <a
            href={`tel:${phone.replace(/\s/g, "")}`}
            aria-label="Sună la restaurant"
            className="grid size-10 place-items-center rounded-full border border-[var(--hairline-strong)] text-gold sm:hidden"
          >
            <Phone className="size-4.5" />
          </a>
          <CartButton />
          <Link href="/meniu" className="hidden md:block">
            <span className="btn-gold inline-flex items-center rounded-xl px-4 py-2 text-sm">
              Comandă acum
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
