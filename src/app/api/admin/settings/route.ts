import { requireStaff } from "@/lib/admin-api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const KNOWN_KEYS = [
  "restaurant",
  "delivery",
  "hours",
  "ordering",
  "glovo",
  "notifications",
  "printer",
];
const PUBLIC_KEYS = ["restaurant", "delivery", "hours", "ordering", "glovo"];

export async function POST(req: NextRequest) {
  const { staff, fail } = await requireStaff();
  if (fail) return fail;
  if (staff.role === "staff") {
    return NextResponse.json(
      { error: "Doar managerii și administratorii pot modifica setările." },
      { status: 403 }
    );
  }

  const { key, value } = (await req.json()) as { key: string; value: unknown };
  if (!KNOWN_KEYS.includes(key)) {
    return NextResponse.json({ error: "Cheie necunoscută." }, { status: 400 });
  }
  const db = supabaseAdmin();
  const { error } = await db.from("settings").upsert({
    key,
    value,
    public: PUBLIC_KEYS.includes(key),
    updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidatePath("/");
  revalidatePath("/meniu");
  return NextResponse.json({ ok: true });
}
