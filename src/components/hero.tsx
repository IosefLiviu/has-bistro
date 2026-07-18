"use client";

import { Button } from "@/components/ui";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

/**
 * Hero cinematic full-viewport.
 * Redă /media/hero.mp4 dacă există; altfel, fundal „jar auriu” animat —
 * arată premium chiar și înainte ca videoclipul profesional să fie urcat.
 */
export function Hero({ tickerItems }: { tickerItems: string[] }) {
  const [videoOk, setVideoOk] = useState(true);

  return (
    <section className="relative flex min-h-svh flex-col overflow-hidden">
      {/* fundal: video sau jar animat */}
      <div className="absolute inset-0 bg-ink">
        {videoOk && (
          <video
            className="absolute inset-0 size-full object-cover opacity-80"
            src="/media/hero.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            onError={() => setVideoOk(false)}
          />
        )}
        {/* jar auriu — vizibil ca fallback și ca strat de atmosferă sub video */}
        <div className="absolute inset-0" aria-hidden>
          <div
            className="absolute -bottom-1/3 left-1/2 h-[90vh] w-[140vw] -translate-x-1/2 animate-ember rounded-[100%] opacity-70"
            style={{
              background:
                "radial-gradient(50% 60% at 50% 100%, rgb(232 168 46 / 0.34), rgb(169 111 18 / 0.12) 55%, transparent 75%)",
            }}
          />
          <div
            className="absolute -right-1/4 top-1/4 h-[70vh] w-[70vw] animate-ember rounded-full opacity-40"
            style={{
              background:
                "radial-gradient(closest-side, rgb(246 197 80 / 0.14), transparent 70%)",
              animationDelay: "-7s",
            }}
          />
        </div>
        {/* vignetă */}
        <div className="absolute inset-0 bg-[radial-gradient(130%_100%_at_50%_0%,transparent_35%,rgb(10_10_11/0.6)_78%,rgb(10_10_11/0.95))]" />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/60 via-transparent to-ink" />
      </div>

      {/* conținut */}
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-4 pt-24 pb-16 text-center sm:px-6">
        <p
          className="font-script text-4xl text-gold-hot sm:text-5xl"
          style={{ animation: "fade-up 0.9s 0.15s cubic-bezier(0.22,1,0.36,1) both" }}
        >
          Poftiți la masă!
        </p>
        <h1
          className="mt-4 max-w-4xl font-display text-[clamp(2.6rem,8vw,5.5rem)] leading-[0.98] font-extrabold tracking-tight"
          style={{ animation: "fade-up 0.9s 0.3s cubic-bezier(0.22,1,0.36,1) both" }}
        >
          Gătit pe jar,
          <br />
          <span className="text-gold-grad">după rețete tradiționale</span>
        </h1>
        <p
          className="mt-6 max-w-xl text-base text-cream/75 sm:text-lg"
          style={{ animation: "fade-up 0.9s 0.45s cubic-bezier(0.22,1,0.36,1) both" }}
        >
          Meniul zilei, grătar, pizza și burgeri — proaspete, din bucătăria HASH,
          direct la ușa ta în maximum o oră.
        </p>
        <div
          className="mt-9 flex flex-wrap items-center justify-center gap-3.5"
          style={{ animation: "fade-up 0.9s 0.6s cubic-bezier(0.22,1,0.36,1) both" }}
        >
          <Link href="/meniu">
            <Button size="lg" className="text-lg">
              Comandă acum
            </Button>
          </Link>
          <a href="#meniul-zilei">
            <Button variant="ghost" size="lg">
              Meniul zilei · 30 lei
            </Button>
          </a>
        </div>
      </div>

      {/* bandă rulantă cu preparate — „linia de comenzi” */}
      <div className="relative z-10 border-y border-[var(--hairline)] bg-ink/70 py-3 backdrop-blur-sm">
        <div className="flex overflow-hidden" aria-hidden>
          <div className="flex shrink-0 animate-ticker items-center gap-8 pr-8 whitespace-nowrap">
            {[...tickerItems, ...tickerItems].map((item, i) => (
              <span key={i} className="flex items-center gap-8 text-sm font-semibold tracking-wide text-cream/70">
                {item}
                <span className="size-1.5 rounded-full bg-gold/70" />
              </span>
            ))}
          </div>
        </div>
      </div>

      <a
        href="#meniul-zilei"
        aria-label="Derulează în jos"
        className="absolute bottom-20 left-1/2 z-10 hidden -translate-x-1/2 animate-bounce text-gold/70 sm:block"
      >
        <ChevronDown className="size-6" />
      </a>
    </section>
  );
}
