import { ProductsManager } from "@/components/admin/products-manager";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Category, Product } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const db = supabaseAdmin();
  const [cats, prods] = await Promise.all([
    db.from("categories").select("*").order("sort"),
    db
      .from("products")
      .select(
        "*, option_groups:product_option_groups(id,product_id,name,required,multi,min_select,max_select,sort,items:product_option_items(id,group_id,name,price_delta,default_selected,available,sort))"
      )
      .order("sort")
      .order("name"),
  ]);

  const products = ((prods.data ?? []) as Product[]).map((p) => ({
    ...p,
    price: Number(p.price),
    promo_price: p.promo_price == null ? null : Number(p.promo_price),
    option_groups: (p.option_groups ?? [])
      .slice()
      .sort((a, b) => a.sort - b.sort)
      .map((g) => ({
        ...g,
        items: (g.items ?? [])
          .slice()
          .sort((a, b) => a.sort - b.sort)
          .map((i) => ({ ...i, price_delta: Number(i.price_delta) })),
      })),
  }));

  return (
    <ProductsManager categories={(cats.data ?? []) as Category[]} products={products} />
  );
}
