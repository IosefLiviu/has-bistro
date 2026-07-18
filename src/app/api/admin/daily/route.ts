import { requireStaff } from "@/lib/admin-api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/** Creare/actualizare „Meniul zilei” pentru o dată anume (programare inclusă). */
export async function POST(req: NextRequest) {
  const { fail } = await requireStaff();
  if (fail) return fail;

  const body = (await req.json()) as {
    id?: string;
    menu_date: string;
    title: string;
    description?: string;
    price: number;
    image_url?: string | null;
    published?: boolean;
    available?: boolean;
  };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.menu_date) || !body.title?.trim() || body.price == null) {
    return NextResponse.json({ error: "Dată, titlu și preț obligatorii." }, { status: 400 });
  }

  const db = supabaseAdmin();
  const record = {
    menu_date: body.menu_date,
    title: body.title.trim(),
    description: body.description?.trim() || null,
    price: body.price,
    image_url: body.image_url || null,
    published: body.published ?? true,
    available: body.available ?? true,
  };

  // înlocuiește automat meniul existent pentru acea dată
  const { error } = await db
    .from("daily_menus")
    .upsert(record, { onConflict: "menu_date" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidatePath("/");
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const { fail } = await requireStaff();
  if (fail) return fail;
  const { id, patch } = (await req.json()) as { id: string; patch: Record<string, unknown> };
  const ALLOWED = ["published", "available"];
  const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => ALLOWED.includes(k)));
  const db = supabaseAdmin();
  const { error } = await db.from("daily_menus").update(clean).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { fail } = await requireStaff();
  if (fail) return fail;
  const { id } = (await req.json()) as { id: string };
  const db = supabaseAdmin();
  const { error } = await db.from("daily_menus").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
