"use client";

import { cn } from "@/lib/utils";
import { Minus, Plus, X } from "lucide-react";
import { useEffect, useRef } from "react";

/* ── Butoane ──────────────────────────────────────────────────────────────── */

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "gold" | "ghost" | "danger" | "bare";
  size?: "sm" | "md" | "lg";
};

export function Button({ variant = "gold", size = "md", className, ...props }: BtnProps) {
  return (
    <button
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-40",
        size === "sm" && "px-3 py-1.5 text-sm",
        size === "md" && "px-5 py-2.5 text-[0.95rem]",
        size === "lg" && "px-7 py-3.5 text-base",
        variant === "gold" && "btn-gold",
        variant === "ghost" && "btn-ghost",
        variant === "danger" &&
          "border border-brick/40 bg-brick/10 text-brick hover:bg-brick/20 active:scale-[0.97]",
        variant === "bare" && "text-mute hover:text-cream",
        className
      )}
      {...props}
    />
  );
}

/* ── Câmpuri ──────────────────────────────────────────────────────────────── */

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      {label && (
        <span className="mb-1.5 block text-[0.8rem] font-semibold uppercase tracking-wider text-mute">
          {label}
        </span>
      )}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-faint">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-brick">{error}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-[var(--hairline-strong)] bg-slate px-4 py-2.5 text-cream placeholder:text-faint outline-none transition focus:border-gold/70 focus:ring-2 focus:ring-gold/20";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputCls, props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputCls, "min-h-20", props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn(inputCls, "appearance-none", props.className)} />
  );
}

/* ── Diverse ──────────────────────────────────────────────────────────────── */

export function GoldPill({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("gold-pill", className)}>{children}</span>;
}

export function Badge({
  tone = "gold",
  children,
  className,
}: {
  tone?: "gold" | "red" | "green" | "muted";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold",
        tone === "gold" && "bg-gold/15 text-gold",
        tone === "red" && "bg-brick/15 text-brick",
        tone === "green" && "bg-mint/15 text-mint",
        tone === "muted" && "bg-cream/8 text-mute",
        className
      )}
    >
      {children}
    </span>
  );
}

export function QtyStepper({
  qty,
  onChange,
  min = 1,
  size = "md",
}: {
  qty: number;
  onChange: (q: number) => void;
  min?: number;
  size?: "sm" | "md";
}) {
  const btn =
    "grid place-items-center rounded-lg border border-[var(--hairline-strong)] text-cream transition hover:border-gold/60 hover:text-gold active:scale-90 cursor-pointer";
  const dim = size === "sm" ? "size-7" : "size-9";
  return (
    <div className="inline-flex items-center gap-2">
      <button type="button" aria-label="Scade cantitatea" className={cn(btn, dim)} onClick={() => onChange(Math.max(min - 1, qty - 1))}>
        <Minus className="size-4" />
      </button>
      <span className={cn("min-w-6 text-center font-display font-bold tabular-nums", size === "sm" ? "text-sm" : "text-base")}>
        {qty}
      </span>
      <button type="button" aria-label="Crește cantitatea" className={cn(btn, dim)} onClick={() => onChange(qty + 1)}>
        <Plus className="size-4" />
      </button>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block size-5 animate-spin rounded-full border-2 border-gold/30 border-t-gold",
        className
      )}
      role="status"
      aria-label="Se încarcă"
    />
  );
}

/* ── Sheet (mobil: de jos / desktop: lateral-centrat) ─────────────────────── */

export function Sheet({
  open,
  onClose,
  children,
  title,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-ink/75 backdrop-blur-sm"
        style={{ animation: "fade-up 0.2s ease both" }}
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal
        className={cn(
          "relative z-10 flex max-h-[92svh] w-full flex-col overflow-hidden rounded-t-3xl border border-[var(--hairline)] bg-coal shadow-lift sm:rounded-3xl",
          wide ? "sm:max-w-3xl" : "sm:max-w-lg"
        )}
        style={{ animation: "fade-up 0.32s cubic-bezier(0.22,1,0.36,1) both" }}
      >
        <div className="flex items-center justify-between gap-4 border-b border-[var(--hairline)] px-5 py-4">
          <div className="min-w-0 flex-1">{title}</div>
          <button
            onClick={onClose}
            aria-label="Închide"
            className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full border border-[var(--hairline-strong)] text-mute transition hover:border-gold/60 hover:text-gold"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
}
