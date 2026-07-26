// Generează admin/config.js din .env.local.
//
// Rulare:  node scripts/gen-admin-config.mjs
//
// Cheia publishable (anon) e făcută să stea în browser — RLS e paznicul, nu ea.
// Dar tot o citim din .env.local în loc s-o scriem de mână, ca să nu ajungă
// într-o linie de comandă sau într-un transcript.
//
// Cheia service role NU ajunge niciodată aici. Dacă vreodată o vezi în
// admin/config.js, ceva e foarte greșit.

import { readFile, writeFile, mkdir } from "node:fs/promises";

const env = Object.fromEntries(
  (await readFile(".env.local", "utf8"))
    .split("\n")
    .filter((l) => l.trim() && !l.trimStart().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Lipsesc NEXT_PUBLIC_SUPABASE_URL sau NEXT_PUBLIC_SUPABASE_ANON_KEY din .env.local");
  process.exit(1);
}
if (key.length > 500 || /service_role/.test(key)) {
  console.error("Cheia din NEXT_PUBLIC_SUPABASE_ANON_KEY pare a fi service role. Oprit.");
  process.exit(1);
}

await mkdir("admin", { recursive: true });
await writeFile(
  "admin/config.js",
  `// Generat de scripts/gen-admin-config.mjs — nu edita manual.
// Cheia de mai jos e publishable (anon): e facuta sa fie publica. RLS e paznicul.
export const SUPABASE_URL = ${JSON.stringify(url)};
export const SUPABASE_ANON_KEY = ${JSON.stringify(key)};
`
);

console.log(`admin/config.js scris. URL: ${url}, cheie anon de ${key.length} caractere.`);
