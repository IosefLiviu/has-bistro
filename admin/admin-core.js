// HASH Bistro — nucleul comun al adminului.
// Client Supabase, sesiune, gărzi de rol, helpere de formatare.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ── Sesiune și roluri ─────────────────────────────────────────────────────
   Rolul se citește din tabela staff, nu din JWT: e sursa de adevăr pe care o
   folosesc și politicile RLS. Dacă cele două ar diverge, UI-ul ar arăta butoane
   pe care baza le refuză. */

let _staff = null;

export async function currentStaff({ refresh = false } = {}) {
  if (_staff && !refresh) return _staff;
  const { data: { session } } = await db.auth.getSession();
  if (!session) return (_staff = null);
  const { data } = await db
    .from("staff")
    .select("id,name,role,active")
    .eq("id", session.user.id)
    .maybeSingle();
  if (!data?.active) return (_staff = null);
  return (_staff = { ...data, email: session.user.email });
}

export const isManager = (s) => s?.role === "admin" || s?.role === "manager";
export const isAdmin = (s) => s?.role === "admin";

export async function signIn(email, password) {
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw new Error("Email sau parolă greșite.");
  const staff = await currentStaff({ refresh: true });
  if (!staff) {
    await db.auth.signOut();
    throw new Error("Contul nu are acces la panou.");
  }
  return staff;
}

export async function signOut() {
  _staff = null;
  await db.auth.signOut();
  location.hash = "";
  location.reload();
}

/* ── Imagini ───────────────────────────────────────────────────────────────
   image_url ține URL-ul canonic al obiectului. Miniaturile se cer prin
   endpointul de transformare, cu dimensiunea potrivită fiecărei suprafețe.

   Măsurat pe salate.png: 1345 kB original → 63 kB la 600px, 33 kB la 300px.
   Transformarea întoarce WebP doar dacă browserul trimite Accept: image/webp,
   ceea ce face. Fără antet ai primi tot PNG, iar `quality` n-ar avea efect.

   ATENȚIE la `width` singur: NU păstrează proporția. Pe un original de
   1024×1024, `?width=96` întoarce 96×1024 — o imagine strivită care, sub
   background-size:cover, se vede ca o felie verticală și pare o suprafață
   goală. Trebuie mereu și `height`, plus `resize=cover`. Diferența se vede și
   în greutate: 9 kB strivit față de 1 kB corect. */

export function img(url, width = 300, height = width, quality = 72) {
  if (!url) return null;
  if (!url.includes("/storage/v1/object/public/")) return url;
  return (
    url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/") +
    `?width=${width}&height=${height}&resize=cover&quality=${quality}`
  );
}

/* ── Formatare ─────────────────────────────────────────────────────────── */

export const lei = (v) =>
  `${Number(v).toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lei`;

export function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ăâ]/g, "a").replace(/[îí]/g, "i")
    .replace(/[șş]/g, "s").replace(/[țţ]/g, "t")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Slug unic față de o listă existentă: „paste" → „paste-2" → „paste-3". */
export function uniqueSlug(base, existing) {
  const luate = new Set(existing);
  if (!luate.has(base)) return base;
  for (let i = 2; i < 200; i++) if (!luate.has(`${base}-${i}`)) return `${base}-${i}`;
  return `${base}-${Date.now()}`;
}

/* ── Notificări ───────────────────────────────────────────────────────── */

export function toast(mesaj, fel = "") {
  let gazda = document.getElementById("toasts");
  if (!gazda) {
    gazda = document.createElement("div");
    gazda.id = "toasts";
    document.body.appendChild(gazda);
  }
  const el = document.createElement("div");
  el.className = `toast ${fel}`;
  el.textContent = mesaj;
  gazda.appendChild(el);
  setTimeout(() => el.remove(), fel === "bad" ? 6000 : 3200);
}

/** Traduce erorile Postgres în ceva ce înseamnă ceva pentru un om. */
export function explicaEroarea(e) {
  const m = e?.message ?? String(e);
  if (e?.code === "23505" || /duplicate key/i.test(m))
    return "Există deja o înregistrare cu acest nume.";
  if (e?.code === "23503" || /violates foreign key/i.test(m))
    return "Nu se poate șterge: există produse care depind de asta.";
  if (e?.code === "23514" || /categories_grid_needs_image/.test(m))
    return "O categorie din grilă are nevoie de imagine ca să fie activă.";
  if (e?.code === "42501" || /row-level security|permission denied/i.test(m))
    return "Nu ai dreptul la această operație.";
  return m;
}

/** Rulează o operație pe bază, arătând eroarea tradusă dacă pică. */
export async function incearca(fn, mesajReusita) {
  try {
    const r = await fn();
    if (r?.error) throw r.error;
    if (mesajReusita) toast(mesajReusita, "ok");
    return r;
  } catch (e) {
    toast(explicaEroarea(e), "bad");
    return null;
  }
}

export const el = (html) => {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
