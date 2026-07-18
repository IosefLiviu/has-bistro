import { MenuBrowser } from "@/components/menu/menu-browser";
import { getCatalog } from "@/lib/catalog";
import type { Metadata } from "next";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Meniu",
  description:
    "Meniul complet HASH Bistro: meniul zilei, ciorbe, grătar, mâncare tradițională, paste, pizza, burgeri și desert. Comandă online.",
};

export default async function MenuPage() {
  const { categories, products } = await getCatalog();

  return (
    <div className="pt-20 pb-16">
      <header className="mx-auto max-w-5xl px-4 pb-2 pt-6 sm:px-6">
        <p className="font-script text-3xl text-gold/90">alege-ți pofta</p>
        <h1 className="mt-1 font-display text-4xl font-extrabold sm:text-5xl">Meniul</h1>
      </header>
      <MenuBrowser categories={categories} products={products} />
    </div>
  );
}
