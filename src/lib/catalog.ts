import { cache } from "react";
import { supabaseAdmin } from "./supabase/admin";
import type { Category, DailyMenu, Product } from "./types";

const PRODUCT_SELECT =
  "id,category_id,slug,name,description,ingredients,allergens,weight_label,price,promo_price,promo_label,image_url,available,featured,is_new,sort,archived,option_groups:product_option_groups(id,product_id,name,required,multi,min_select,max_select,sort,items:product_option_items(id,group_id,name,price_delta,default_selected,available,sort))";

function normalizeProduct(p: Record<string, unknown>): Product {
  const groups = ((p.option_groups as Product["option_groups"]) ?? [])
    .slice()
    .sort((a, b) => a.sort - b.sort)
    .map((g) => ({
      ...g,
      items: (g.items ?? [])
        .filter((i) => i.available)
        .slice()
        .sort((a, b) => a.sort - b.sort)
        .map((i) => ({ ...i, price_delta: Number(i.price_delta) })),
    }));
  return {
    ...(p as unknown as Product),
    price: Number(p.price),
    promo_price: p.promo_price == null ? null : Number(p.promo_price),
    option_groups: groups,
  };
}

/** Tot catalogul public: categorii active + produse nearhivate, cu opțiuni. */
export const getCatalog = cache(async () => {
  const db = supabaseAdmin();
  const [cats, prods] = await Promise.all([
    db.from("categories").select("*").eq("active", true).order("sort"),
    db
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("archived", false)
      .order("sort")
      .order("name"),
  ]);
  if (cats.error) throw new Error(cats.error.message);
  if (prods.error) throw new Error(prods.error.message);
  const categories = (cats.data ?? []) as Category[];
  const products = (prods.data ?? []).map(normalizeProduct);
  return { categories, products };
});

export const getFeatured = cache(async () => {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("archived", false)
    .eq("available", true)
    .eq("featured", true)
    .order("sort")
    .limit(10);
  if (error) throw new Error(error.message);
  return (data ?? []).map(normalizeProduct);
});

export const getProductBySlug = cache(async (slug: string) => {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? normalizeProduct(data) : null;
});

/** Data de azi în fusul orar al restaurantului. */
export function bucharestToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export const getTodayDailyMenu = cache(async (): Promise<DailyMenu | null> => {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("daily_menus")
    .select("*")
    .eq("menu_date", bucharestToday())
    .eq("published", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { ...data, price: Number(data.price) } : null;
});
