// Urcă imaginile de categorie din img/categorii/ în bucket-ul Supabase
// `categories`, apoi rescrie categories.image_url pe URL-urile publice.
//
// Rulare:  node scripts/upload-category-images.mjs
//
// Fără dependențe: fetch nativ, nu @supabase/supabase-js. Scriptul trebuie să
// funcționeze și după ce dispar node_modules și package.json.
//
// Cheia se citește direct din .env.local, ca să nu ajungă niciodată într-o
// linie de comandă, într-un istoric de shell sau într-un transcript.

import { readFile, readdir } from "node:fs/promises";

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
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !KEY) {
  console.error("Lipsesc NEXT_PUBLIC_SUPABASE_URL sau SUPABASE_SERVICE_ROLE_KEY din .env.local");
  process.exit(1);
}

const DIR = "img/categorii";
const fisiere = (await readdir(DIR)).filter((f) => f.endsWith(".png")).sort();

let urcate = 0;
for (const fisier of fisiere) {
  const corp = await readFile(`${DIR}/${fisier}`);
  const res = await fetch(`${URL_BASE}/storage/v1/object/categories/${encodeURIComponent(fisier)}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${KEY}`,
      "content-type": "image/png",
      "x-upsert": "true",
    },
    body: corp,
  });
  if (res.ok) {
    urcate++;
    console.log(`urcat  ${fisier}  (${(corp.length / 1024).toFixed(0)} kB)`);
  } else {
    console.error(`EROARE ${fisier}: ${res.status} ${await res.text()}`);
  }
}

console.log(`\n${urcate}/${fisiere.length} imagini urcate in bucket-ul "categories".`);
console.log(
  `Prefix public: ${URL_BASE}/storage/v1/object/public/categories/`
);
