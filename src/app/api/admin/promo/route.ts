import { requireStaff } from "@/lib/admin-api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { fail } = await requireStaff();
  if (fail) return fail;
  const body = (await req.json()) as {
    id?: string;
    code: string;
    type: "percent" | "fixed";
    value: number;
    min_order?: number;
    active?: boolean;
    starts_at?: string | null;
    ends_at?: string | null;
    max_uses?: number | null;
  };
  if (!body.code?.trim() || !body.value) {
    return NextResponse.json({ error: "Cod și valoare obligatorii." }, { status: 400 });
  }
  const db = supabaseAdmin();
  const record = {
    code: body.code.trim().toUpperCase(),
    type: body.type,
    value: body.value,
    min_order: body.min_order ?? 0,
    active: body.active ?? true,
    starts_at: body.starts_at || null,
    ends_at: body.ends_at || null,
    max_uses: body.max_uses ?? null,
  };
  const q = body.id
    ? db.from("promo_codes").update(record).eq("id", body.id)
    : db.from("promo_codes").insert(record);
  const { error } = await q;
  if (error) {
    return NextResponse.json(
      { error: error.message.includes("duplicate") ? "Codul există deja." : error.message },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { fail } = await requireStaff();
  if (fail) return fail;
  const { id } = (await req.json()) as { id: string };
  const db = supabaseAdmin();
  const { error } = await db.from("promo_codes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
