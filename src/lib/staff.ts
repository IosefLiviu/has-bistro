import { supabaseServer } from "./supabase/server";
import { supabaseAdmin } from "./supabase/admin";
import type { Staff } from "./types";

/** Returnează membrul staff autentificat sau null. */
export async function getCurrentStaff(): Promise<Staff | null> {
  const supa = await supabaseServer();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return null;
  const db = supabaseAdmin();
  const { data } = await db
    .from("staff")
    .select("id,name,role,active")
    .eq("id", user.id)
    .eq("active", true)
    .maybeSingle();
  return (data as Staff) ?? null;
}
