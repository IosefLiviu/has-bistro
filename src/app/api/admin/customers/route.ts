import { requireStaff } from "@/lib/admin-api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest) {
  const { fail } = await requireStaff();
  if (fail) return fail;
  const { id, notes } = (await req.json()) as { id: string; notes: string };
  const db = supabaseAdmin();
  const { error } = await db.from("customers").update({ notes: notes ?? null }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
