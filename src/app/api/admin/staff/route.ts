import { requireStaff } from "@/lib/admin-api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/** Creare cont de staff (doar admin). */
export async function POST(req: NextRequest) {
  const { staff, fail } = await requireStaff();
  if (fail) return fail;
  if (staff.role !== "admin") {
    return NextResponse.json({ error: "Doar administratorii pot adăuga personal." }, { status: 403 });
  }

  const { email, password, name, role } = (await req.json()) as {
    email: string;
    password: string;
    name: string;
    role: "admin" | "manager" | "staff";
  };
  if (!email || !password || password.length < 8 || !name?.trim()) {
    return NextResponse.json(
      { error: "Email, nume și parolă (minimum 8 caractere) obligatorii." },
      { status: 400 }
    );
  }

  const db = supabaseAdmin();
  const { data: created, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !created.user) {
    return NextResponse.json(
      { error: error?.message.includes("already") ? "Există deja un cont cu acest email." : error?.message },
      { status: 400 }
    );
  }
  const { error: staffErr } = await db.from("staff").insert({
    id: created.user.id,
    name: name.trim(),
    role: ["admin", "manager", "staff"].includes(role) ? role : "staff",
  });
  if (staffErr) return NextResponse.json({ error: staffErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** Activare/dezactivare sau schimbare rol. */
export async function PATCH(req: NextRequest) {
  const { staff, fail } = await requireStaff();
  if (fail) return fail;
  if (staff.role !== "admin") {
    return NextResponse.json({ error: "Doar administratorii pot modifica personalul." }, { status: 403 });
  }
  const { id, patch } = (await req.json()) as {
    id: string;
    patch: { active?: boolean; role?: string; name?: string };
  };
  if (id === staff.id && patch.active === false) {
    return NextResponse.json({ error: "Nu îți poți dezactiva propriul cont." }, { status: 400 });
  }
  const clean: Record<string, unknown> = {};
  if (typeof patch.active === "boolean") clean.active = patch.active;
  if (patch.role && ["admin", "manager", "staff"].includes(patch.role)) clean.role = patch.role;
  if (patch.name?.trim()) clean.name = patch.name.trim();
  const db = supabaseAdmin();
  const { error } = await db.from("staff").update(clean).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
