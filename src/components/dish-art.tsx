import { cn } from "@/lib/utils";
import Image from "next/image";

/**
 * Vizual pentru preparate: fotografia produsului sau, în lipsă,
 * o placă „monogramă” aurie — elegantă, niciodată un gri generic.
 */
export function DishArt({
  src,
  alt,
  className,
  sizes = "96px",
  priority,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  if (src) {
    return (
      <div className={cn("relative overflow-hidden", className)}>
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      </div>
    );
  }
  return (
    <div
      aria-hidden
      className={cn(
        "relative grid place-items-center overflow-hidden bg-[radial-gradient(120%_120%_at_30%_20%,rgb(232_179_60/0.16),rgb(18_18_20/1)_60%)]",
        className
      )}
    >
      <span className="font-script text-2xl text-gold/45 select-none">h</span>
      <span className="absolute inset-0 bg-[linear-gradient(160deg,transparent_55%,rgb(255_227_156/0.06))]" />
    </div>
  );
}
