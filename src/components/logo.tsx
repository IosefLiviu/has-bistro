import { cn } from "@/lib/utils";

/**
 * Reproducerea vectorială a siglei HASH — cerc auriu, monograma script „h”,
 * arcul „HASH” sus și „BISTRO & TAKE AWAY” jos.
 */
export function Logo({ className, withRing = true }: { className?: string; withRing?: boolean }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={cn("block", className)}
      role="img"
      aria-label="HASH Bistro & Take Away"
    >
      <defs>
        <linearGradient id="hash-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f6c550" />
          <stop offset="55%" stopColor="#e8a82e" />
          <stop offset="100%" stopColor="#a96f12" />
        </linearGradient>
        <path id="hash-arc-top" d="M 22 60 A 38 38 0 0 1 98 60" fill="none" />
        <path id="hash-arc-bottom" d="M 20 60 A 40 40 0 0 0 100 60" fill="none" />
      </defs>
      {withRing && (
        <circle
          cx="60"
          cy="60"
          r="52"
          fill="none"
          stroke="url(#hash-gold)"
          strokeWidth="1.6"
        />
      )}
      <text
        fontFamily="var(--font-bricolage), sans-serif"
        fontSize="13"
        fontWeight="800"
        letterSpacing="6"
        fill="url(#hash-gold)"
      >
        <textPath href="#hash-arc-top" startOffset="50%" textAnchor="middle">
          HASH
        </textPath>
      </text>
      <text
        x="62"
        y="82"
        textAnchor="middle"
        fontFamily="var(--font-vibes), cursive"
        fontSize="64"
        fill="url(#hash-gold)"
      >
        h
      </text>
      <text
        fontFamily="var(--font-figtree), sans-serif"
        fontSize="7"
        fontWeight="700"
        letterSpacing="2.6"
        fill="url(#hash-gold)"
      >
        <textPath href="#hash-arc-bottom" startOffset="50%" textAnchor="middle">
          BISTRO &amp; TAKE AWAY
        </textPath>
      </text>
    </svg>
  );
}

export function LogoWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-baseline gap-2", className)}>
      <span className="font-display text-xl font-extrabold tracking-[0.22em] text-gold-grad">
        HASH
      </span>
      <span className="text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-mute">
        Bistro &amp; Take Away
      </span>
    </span>
  );
}
