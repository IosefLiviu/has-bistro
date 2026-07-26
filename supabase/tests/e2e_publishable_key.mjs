// Proba de capăt la capăt pentru premisa adminului static:
// un client care are DOAR cheia publishable, autentificat ca manager, poate
// scrie în catalog — iar același client neautentificat nu poate.
//
// Rulare:  node supabase/tests/e2e_publishable_key.mjs
//
// Nu cere parole existente și nu comite niciun secret: își creează singur un
// cont temporar de manager cu o parolă generată la rulare, apoi îl șterge.
// Cheile se citesc din .env.local.

import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const env = Object.fromEntries(
  (await readFile(".env.local", "utf8"))
    .split("\n")
    .filter((l) => l.trim() && !l.trimStart().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !ANON || !SERVICE) {
  console.error("Lipsesc cheile din .env.local");
  process.exit(1);
}

const email = `e2e-${randomUUID().slice(0, 8)}@proba.hash.local`;
const parola = randomUUID() + "Aa1!";
const slug = `zzz-e2e-${randomUUID().slice(0, 8)}`;
const rezultate = [];
let userId = null;

const nota = (ok, proba) => rezultate.push({ rezultat: ok ? "OK" : "ESEC", proba });

try {
  // ── Pregătire: cont temporar de manager, creat cu service role ────────────
  const creat = await fetch(`${URL_BASE}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SERVICE, authorization: `Bearer ${SERVICE}`, "content-type": "application/json" },
    body: JSON.stringify({ email, password: parola, email_confirm: true }),
  });
  const user = await creat.json();
  userId = user.id;
  if (!userId) throw new Error(`Nu s-a putut crea contul: ${JSON.stringify(user)}`);

  await fetch(`${URL_BASE}/rest/v1/staff`, {
    method: "POST",
    headers: { apikey: SERVICE, authorization: `Bearer ${SERVICE}`, "content-type": "application/json" },
    body: JSON.stringify({ id: userId, name: "Probă E2E", role: "manager", active: true }),
  });

  // ── Proba 1: clientul anonim, cu cheia publishable, NU poate scrie ────────
  const anonim = await fetch(`${URL_BASE}/rest/v1/categories`, {
    method: "POST",
    headers: { apikey: ANON, authorization: `Bearer ${ANON}`, "content-type": "application/json" },
    body: JSON.stringify({ slug: `${slug}-anon`, name: "Probă anon", sort: 990, active: false }),
  });
  nota(!anonim.ok, `anonimul cu cheia publishable NU poate scrie (HTTP ${anonim.status})`);

  // ── Autentificare prin API-ul public, exact ca browserul ──────────────────
  const login = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ email, password: parola }),
  });
  const sesiune = await login.json();
  const token = sesiune.access_token;
  nota(Boolean(token), "autentificarea cu cheia publishable reuseste");

  // ── Proba 2: managerul autentificat POATE crea o categorie ────────────────
  const creare = await fetch(`${URL_BASE}/rest/v1/categories`, {
    method: "POST",
    headers: {
      apikey: ANON,
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      prefer: "return=representation",
    },
    body: JSON.stringify({ slug, name: "Probă E2E", sort: 991, active: false }),
  });
  const creata = await creare.json();
  nota(creare.ok, `managerul autentificat poate crea o categorie (HTTP ${creare.status})`);

  // ── Proba 3: și o poate șterge ───────────────────────────────────────────
  const stergere = await fetch(`${URL_BASE}/rest/v1/categories?slug=eq.${slug}`, {
    method: "DELETE",
    headers: { apikey: ANON, authorization: `Bearer ${token}` },
  });
  nota(stergere.ok, `managerul isi poate sterge categoria (HTTP ${stergere.status})`);

  // ── Proba 4: nu poate atinge setarile — alea sunt doar ale adminului ──────
  const setari = await fetch(`${URL_BASE}/rest/v1/settings?key=eq.restaurant`, {
    method: "PATCH",
    headers: {
      apikey: ANON,
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      prefer: "return=representation",
    },
    body: JSON.stringify({ updated_at: new Date().toISOString() }),
  });
  const atinse = await setari.json();
  nota(Array.isArray(atinse) && atinse.length === 0,
    `managerul NU poate schimba setarile (${Array.isArray(atinse) ? atinse.length : "?"} randuri atinse)`);

  // ── Proba 5: rapoartele raman inchise pentru anonim ───────────────────────
  const raport = await fetch(`${URL_BASE}/rest/v1/rpc/sales_report`, {
    method: "POST",
    headers: { apikey: ANON, authorization: `Bearer ${ANON}`, "content-type": "application/json" },
    body: JSON.stringify({ from_ts: "2020-01-01T00:00:00Z", to_ts: "2030-01-01T00:00:00Z" }),
  });
  nota(!raport.ok, `anonimul NU poate chema sales_report (HTTP ${raport.status})`);
} finally {
  // ── Curățenie, indiferent ce s-a întâmplat ───────────────────────────────
  await fetch(`${URL_BASE}/rest/v1/categories?slug=like.zzz-e2e-*`, {
    method: "DELETE",
    headers: { apikey: SERVICE, authorization: `Bearer ${SERVICE}` },
  });
  if (userId) {
    await fetch(`${URL_BASE}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: { apikey: SERVICE, authorization: `Bearer ${SERVICE}` },
    });
  }
}

for (const r of rezultate) console.log(`${r.rezultat.padEnd(5)} ${r.proba}`);
const esecuri = rezultate.filter((r) => r.rezultat === "ESEC").length;
console.log(`\n${rezultate.length - esecuri}/${rezultate.length} probe trecute.`);
process.exit(esecuri ? 1 : 0);
