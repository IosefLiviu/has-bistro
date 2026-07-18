import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree, Great_Vibes } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext"],
  variable: "--font-bricolage",
  display: "swap",
});

const figtree = Figtree({
  subsets: ["latin", "latin-ext"],
  variable: "--font-figtree",
  display: "swap",
});

const vibes = Great_Vibes({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  variable: "--font-vibes",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "HASH Bistro & Take Away — Poftiți la masă!",
    template: "%s · HASH Bistro",
  },
  description:
    "HASH Bistro & Take Away — mâncare gătită după rețete tradiționale, pizza, burgeri și meniul zilei. Comandă online cu livrare rapidă sau ridicare personală.",
  openGraph: {
    title: "HASH Bistro & Take Away",
    description: "Poftiți la masă! Comandă online: meniul zilei, grătar, pizza, burgeri.",
    locale: "ro_RO",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ro" className={`${bricolage.variable} ${figtree.variable} ${vibes.variable}`}>
      <body className="grain min-h-svh antialiased">{children}</body>
    </html>
  );
}
