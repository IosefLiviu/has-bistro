import { requireStaff } from "@/lib/admin-api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type GroupInput = {
  name: string;
  required: boolean;
  multi: boolean;
  max_select: number;
  items: Array<{ name: string; price_delta: number }>;
};

type ProductInput = {
  id?: string;
  category_id: string;
  name: string;
  slug?: string;
  description?: string | null;
  ingredients?: string | null;
  allergens?: string[];
  weight_label?: string | null;
  price: number;
  promo_price?: number | null;
  promo_label?: string | null;
  image_url?: string | null;
  available?: boolean;
  featured?: boolean;
  is_new?: boolean;
  sort?: number;
  groups?: GroupInput[];
};

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function bust() {
  revalidatePath("/");
  revalidatePath("/meniu");
}

/** Creare / actualizare produs (cu grupele de opțiuni). */
export async function POST(req: NextRequest) {
  const { fail } = await requireStaff();
  if (fail) return fail;

  const input = (await req.json()) as ProductInput;
  if (!input.name?.trim() || !input.category_id || input.price == null) {
    return NextResponse.json({ error: "Nume, categorie și preț obligatorii." }, { status: 400 });
  }
  const db = supabaseAdmin();

  const record = {
    category_id: input.category_id,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    ingredients: input.ingredients?.trim() || null,
    allergens: input.allergens ?? [],
    weight_label: input.weight_label?.trim() || null,
    price: input.price,
    promo_price: input.promo_price ?? null,
    promo_label: input.promo_label?.trim() || null,
    image_url: input.image_url || null,
    available: input.available ?? true,
    featured: input.featured ?? false,
    is_new: input.is_new ?? false,
    sort: input.sort ?? 999,
  };

  let productId = input.id;
  if (productId) {
    const { error } = await db.from("products").update(record).eq("id", productId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    let slug = input.slug?.trim() || slugify(input.name);
    const { data: dupe } = await db.from("products").select("id").eq("slug", slug).maybeSingle();
    if (dupe) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    const { data, error } = await db
      .from("products")
      .insert({ ...record, slug })
      .select("id")
      .single();
    if (error || !data) return NextResponse.json({ error: error?.message }, { status: 500 });
    productId = data.id;
  }

  // rescriem grupele de opțiuni dacă au fost trimise
  if (input.groups) {
    await db.from("product_option_groups").delete().eq("product_id", productId);
    for (let gi = 0; gi < input.groups.length; gi++) {
      const g = input.groups[gi];
      if (!g.name.trim() || g.items.length === 0) continue;
      const { data: group, error: gErr } = await db
        .from("product_option_groups")
        .insert({
          product_id: productId,
          name: g.name.trim(),
          required: g.required,
          multi: g.multi,
          min_select: g.required ? 1 : 0,
          max_select: g.multi ? Math.max(1, g.max_select) : 1,
          sort: gi,
        })
        .select("id")
        .single();
      if (gErr || !group) continue;
      await db.from("product_option_items").insert(
        g.items
          .filter((i) => i.name.trim())
          .map((i, ii) => ({
            group_id: group.id,
            name: i.name.trim(),
            price_delta: i.price_delta || 0,
            sort: ii,
          }))
      );
    }
  }

  bust();
  return NextResponse.json({ ok: true, id: productId });
}

/** Modificări rapide: disponibilitate, ordine, arhivare, ștergere. */
export async function PATCH(req: NextRequest) {
  const { fail } = await requireStaff();
  if (fail) return fail;

  const { id, patch } = (await req.json()) as {
    id: string;
    patch: Record<string, unknown>;
  };
  const ALLOWED = ["available", "featured", "is_new", "archived", "sort", "promo_price", "promo_label"];
  const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => ALLOWED.includes(k)));
  const db = supabaseAdmin();
  const { error } = await db.from("products").update(clean).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  bust();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { fail } = await requireStaff();
  if (fail) return fail;

  const { id } = (await req.json()) as { id: string };
  const db = supabaseAdmin();
  // ștergem doar dacă nu are comenzi; altfel arhivăm
  const { count } = await db
    .from("order_items")
    .select("id", { count: "exact", head: true })
    .eq("product_id", id);
  if ((count ?? 0) > 0) {
    await db.from("products").update({ archived: true, available: false }).eq("id", id);
    bust();
    return NextResponse.json({ ok: true, archived: true });
  }
  const { error } = await db.from("products").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  bust();
  return NextResponse.json({ ok: true, deleted: true });
}
