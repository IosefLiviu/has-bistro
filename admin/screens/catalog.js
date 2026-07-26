// Catalog — categorii în stânga, produsele categoriei alese în dreapta.
//
// Garanțiile de afișare (spec §5) sunt impuse pe două niveluri:
//   1. În bază, prin constrângerea categories_grid_needs_image. Aia e legea.
//   2. Aici, prin explicații înainte de a lăsa pe cineva să se lovească de ea.
//
// „Categorie activă fără produse disponibile se ascunde de pe site" e o regulă
// CALCULATĂ, nu o mutație: nu schimbăm `active` pe la spatele nimănui. Site-ul
// o va filtra la citire, iar aici e marcată vizibil.

import { db, img, el, esc, toast, incearca, slugify, uniqueSlug, isManager } from "../admin-core.js";
import { panouProduse } from "./products.js";

let categorii = [];
let produse = [];        // toate, 107 randuri — mai ieftin decat N interogari de numarare
let alesId = null;
let gazda = null;
let staff = null;

export async function monteaza(outlet, s) {
  gazda = outlet;
  staff = s;
  await incarca();
  randeaza();
}

async function incarca() {
  const [c, p] = await Promise.all([
    db.from("categories").select("*").order("sort"),
    db.from("products").select("id,category_id,name,slug,price,promo_price,available,archived,image_url,sort").order("sort"),
  ]);
  if (c.error) return toast(c.error.message, "bad");
  categorii = c.data ?? [];
  produse = p.data ?? [];
  if (!alesId || !categorii.some((x) => x.id === alesId)) alesId = categorii[0]?.id ?? null;
}

/* ── Stări derivate ──────────────────────────────────────────────────────── */

const produseDin = (catId, { arhivate = false } = {}) =>
  produse.filter((p) => p.category_id === catId && (arhivate ? p.archived : !p.archived));

/** De ce nu apare categoria pe site. Null = apare. */
function motivAscundere(cat) {
  if (!cat.active) return "ascunsă manual";
  if (!cat.show_in_grid) return "categorie de extra-uri";
  if (!cat.image_url) return "fără imagine";
  if (produseDin(cat.id).filter((p) => p.available).length === 0)
    return "fără produse disponibile";
  return null;
}

const inGrila = () => categorii.filter((c) => !motivAscundere(c));

/* ── Randare ─────────────────────────────────────────────────────────────── */

function randeaza() {
  const poateScrie = isManager(staff);
  gazda.innerHTML = "";

  const vizibile = inGrila().length;
  const layout = el(`
    <div>
      <div class="row" style="margin-bottom:16px;flex-wrap:wrap">
        <div class="grow">
          <div class="kick">Catalog</div>
          <p class="tiny muted" style="margin:4px 0 0">
            ${categorii.length} categorii · ${produse.filter((p) => !p.archived).length} produse active ·
            <b>${vizibile}</b> apar în grila site-ului
          </p>
        </div>
        <button class="btn ghost sm" id="vezi-grila">Previzualizează grila</button>
        ${poateScrie ? '<button class="btn sm" id="cat-nou">Categorie nouă</button>' : ""}
      </div>
      ${poateScrie ? "" : `
        <div class="card pad tiny muted" style="margin-bottom:14px">
          Ai rol <b>personal</b>: poți vedea catalogul, dar modificările sunt refuzate de bază.
        </div>`}
      <div class="pane2">
        <div class="card" id="pane-cat"></div>
        <div id="pane-prod"></div>
      </div>
    </div>`);

  gazda.appendChild(layout);
  layout.querySelector("#vezi-grila").addEventListener("click", previzualizareGrila);
  layout.querySelector("#cat-nou")?.addEventListener("click", () => sertarCategorie(null));

  randeazaCategorii(layout.querySelector("#pane-cat"), poateScrie);
  panouProduse(layout.querySelector("#pane-prod"), {
    categorie: categorii.find((c) => c.id === alesId) ?? null,
    produse: produseDin(alesId),
    arhivate: produseDin(alesId, { arhivate: true }),
    categorii,
    poateScrie,
    reincarca: async () => { await incarca(); randeaza(); },
  });
}

function randeazaCategorii(pane, poateScrie) {
  pane.innerHTML = "";
  pane.appendChild(el(`
    <div class="pad" style="border-bottom:1px solid var(--line)">
      <h3>Categorii</h3>
      ${poateScrie ? '<p class="tiny faint" style="margin:4px 0 0">Trage de ⠿ ca să reordonezi.</p>' : ""}
    </div>`));

  const lista = el('<div class="list"></div>');
  for (const c of categorii) {
    const nrActive = produseDin(c.id).length;
    const nrArhivate = produseDin(c.id, { arhivate: true }).length;
    const motiv = motivAscundere(c);

    const rand = el(`
      <div class="item" data-id="${c.id}" ${poateScrie ? 'draggable="true"' : ""}
           style="cursor:pointer;${c.id === alesId ? "background:var(--bg-3)" : ""}">
        ${poateScrie ? '<span class="grip" title="Trage ca să reordonezi">⠿</span>' : ""}
        ${c.image_url
          ? `<span class="thumb" style="background-image:url('${esc(img(c.image_url, 96))}')"></span>`
          : '<span class="thumb none" title="Fără imagine">▢</span>'}
        <span class="grow" style="min-width:0">
          <b style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.name)}</b>
          <span class="tiny faint">
            ${nrActive} produse${nrArhivate ? ` · ${nrArhivate} ascunse` : ""}
          </span>
        </span>
        ${motiv
          ? `<span class="pill off" title="Nu apare în grila site-ului">${esc(motiv)}</span>`
          : '<span class="pill ok">în grilă</span>'}
      </div>`);

    rand.addEventListener("click", (ev) => {
      if (ev.target.closest(".grip")) return;
      alesId = c.id;
      randeaza();
    });
    if (poateScrie) {
      rand.addEventListener("dblclick", () => sertarCategorie(c));
      legaDragDrop(rand, lista, salveazaOrdineaCategoriilor);
    }
    lista.appendChild(rand);
  }
  pane.appendChild(lista);
}

/* ── Reordonare ──────────────────────────────────────────────────────────
   Un singur RPC care renumerotează sort 0..n-1. Vechiul cod trimitea două
   PATCH-uri paralele care se puteau încrucișa. */

export function legaDragDrop(rand, lista, laFinal) {
  rand.addEventListener("dragstart", (e) => {
    rand.classList.add("drag");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", rand.dataset.id);
  });
  rand.addEventListener("dragend", () => {
    rand.classList.remove("drag");
    lista.querySelectorAll(".over").forEach((x) => x.classList.remove("over"));
  });
  rand.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (!rand.classList.contains("drag")) rand.classList.add("over");
  });
  rand.addEventListener("dragleave", () => rand.classList.remove("over"));
  rand.addEventListener("drop", async (e) => {
    e.preventDefault();
    rand.classList.remove("over");
    const trasId = e.dataTransfer.getData("text/plain");
    if (!trasId || trasId === rand.dataset.id) return;
    const tras = lista.querySelector(`[data-id="${CSS.escape(trasId)}"]`);
    if (!tras) return;
    const randuri = [...lista.children];
    randuri.indexOf(tras) < randuri.indexOf(rand)
      ? rand.after(tras)
      : rand.before(tras);
    await laFinal([...lista.children].map((x) => x.dataset.id));
  });
}

async function salveazaOrdineaCategoriilor(ids) {
  const r = await incearca(() => db.rpc("reorder_categories", { ids }), "Ordine salvată.");
  if (r) { await incarca(); randeaza(); }
}

/* ── Sertarul de categorie ───────────────────────────────────────────────── */

function sertarCategorie(cat) {
  const nou = !cat;
  const stare = {
    name: cat?.name ?? "",
    slug: cat?.slug ?? "",
    description: cat?.description ?? "",
    active: cat?.active ?? true,
    show_in_grid: cat?.show_in_grid ?? true,
    image_url: cat?.image_url ?? null,
  };

  const nrProduse = cat ? produse.filter((p) => p.category_id === cat.id).length : 0;

  const scrim = el(`
    <div class="scrim">
      <div class="sheet" role="dialog" aria-label="${nou ? "Categorie nouă" : "Editează categoria"}">
        <header>
          <h3 class="grow">${nou ? "Categorie nouă" : esc(cat.name)}</h3>
          <button class="btn ghost icon" id="x" aria-label="Închide">✕</button>
        </header>
        <div class="body">
          <div class="field">
            <label for="n">Nume</label>
            <input id="n" type="text" value="${esc(stare.name)}" placeholder="ex. Ciorbe de casă">
            <span class="tiny faint" id="slug-hint"></span>
          </div>

          <div class="field">
            <label>Imagine</label>
            <div class="row">
              <span class="thumb" id="prev" style="width:76px;height:76px;flex-basis:76px;
                ${stare.image_url ? `background-image:url('${esc(img(stare.image_url, 200))}')` : ""}"></span>
              <div class="grow">
                <input type="file" id="fis" accept="image/png,image/jpeg,image/webp" style="font-size:13px">
                <p class="tiny faint" style="margin:6px 0 0">
                  Pătrată arată cel mai bine — grila site-ului taie 1:1.
                </p>
              </div>
            </div>
          </div>

          <div class="field">
            <label for="d">Descriere <span class="faint">(opțional)</span></label>
            <textarea id="d" placeholder="Apare sub titlu, pe pagina categoriei.">${esc(stare.description)}</textarea>
          </div>

          <label class="row" style="gap:9px;cursor:pointer">
            <input type="checkbox" id="grid" ${stare.show_in_grid ? "checked" : ""} style="width:auto">
            <span><b>Apare ca un card în grilă</b>
              <span class="tiny faint" style="display:block">
                Debifat = categorie de extra-uri (sosuri, pâine). Produsele rămân
                comandabile, dar categoria nu e desenată pe site și nu cere imagine.
              </span>
            </span>
          </label>

          <label class="row" style="gap:9px;cursor:pointer">
            <input type="checkbox" id="act" ${stare.active ? "checked" : ""} style="width:auto">
            <span><b>Activă</b>
              <span class="tiny faint" style="display:block">Debifat = ascunsă de pe site, păstrată în bază.</span>
            </span>
          </label>

          <p class="tiny" id="avertisment" style="display:none;color:var(--red);font-weight:700"></p>

          ${!nou ? `
            <div class="card pad" style="background:var(--bg-3);border:0">
              <b class="tiny">Ștergere definitivă</b>
              <p class="tiny muted" style="margin:6px 0 10px">
                ${nrProduse
                  ? `Nu se poate: categoria are <b>${nrProduse}</b> produse (inclusiv ascunse).
                     Mută-le mai întâi în altă categorie.`
                  : "Categoria e goală, deci poate fi ștearsă definitiv."}
              </p>
              <button class="btn danger sm" id="sterge" ${nrProduse ? "disabled" : ""}>
                Șterge definitiv
              </button>
            </div>` : ""}
        </div>
        <footer>
          <button class="btn ghost grow" id="anuleaza">Anulează</button>
          <button class="btn grow" id="salveaza">${nou ? "Creează" : "Salvează"}</button>
        </footer>
      </div>
    </div>`);

  const q = (s) => scrim.querySelector(s);
  const inchide = () => scrim.remove();
  scrim.addEventListener("click", (e) => { if (e.target === scrim) inchide(); });
  q("#x").addEventListener("click", inchide);
  q("#anuleaza").addEventListener("click", inchide);

  const hint = q("#slug-hint");
  function actualizeazaHint() {
    if (!nou) { hint.textContent = `adresă: /${stare.slug}`; return; }
    const s = slugify(q("#n").value);
    hint.textContent = s ? `adresă: /${uniqueSlug(s, categorii.map((c) => c.slug))}` : "";
  }
  q("#n").addEventListener("input", () => { stare.name = q("#n").value; actualizeazaHint(); verifica(); });
  actualizeazaHint();

  q("#d").addEventListener("input", () => (stare.description = q("#d").value));
  q("#grid").addEventListener("change", () => { stare.show_in_grid = q("#grid").checked; verifica(); });
  q("#act").addEventListener("change", () => { stare.active = q("#act").checked; verifica(); });

  /* Regula care ține site-ul întreg: fără imagine, o categorie de grilă nu poate
     fi activă. Constrângerea din bază o impune oricum — aici o spunem înainte. */
  function verifica() {
    const rupt = stare.active && stare.show_in_grid && !stare.image_url;
    q("#avertisment").style.display = rupt ? "block" : "none";
    q("#avertisment").textContent = rupt
      ? "O categorie din grilă are nevoie de imagine ca să fie activă — altfel site-ul ar afișa un card gol."
      : "";
    q("#salveaza").disabled = rupt || !stare.name.trim();
    return !rupt;
  }
  verifica();

  q("#fis").addEventListener("change", async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const cale = `${slugify(stare.name) || "categorie"}-${Date.now()}.${f.name.split(".").pop()}`;
    q("#salveaza").disabled = true;
    const up = await incearca(() =>
      db.storage.from("categories").upload(cale, f, { upsert: true, contentType: f.type }));
    if (up) {
      const { data } = db.storage.from("categories").getPublicUrl(cale);
      stare.image_url = data.publicUrl;
      q("#prev").style.backgroundImage = `url('${img(stare.image_url, 200)}')`;
      q("#prev").classList.remove("none");
      toast("Imagine încărcată.", "ok");
    }
    verifica();
  });

  q("#sterge")?.addEventListener("click", async () => {
    if (!confirm(`Ștergi definitiv „${cat.name}”? Nu se poate anula.`)) return;
    const r = await incearca(
      () => db.from("categories").delete().eq("id", cat.id),
      "Categorie ștearsă."
    );
    if (r) { inchide(); alesId = null; await incarca(); randeaza(); }
  });

  q("#salveaza").addEventListener("click", async () => {
    if (!verifica()) return;
    const date = {
      name: stare.name.trim(),
      description: stare.description.trim() || null,
      active: stare.active,
      show_in_grid: stare.show_in_grid,
      image_url: stare.image_url,
    };
    let r;
    if (nou) {
      date.slug = uniqueSlug(slugify(date.name), categorii.map((c) => c.slug));
      date.sort = categorii.length;
      r = await incearca(() => db.from("categories").insert(date), "Categorie creată.");
    } else {
      r = await incearca(() => db.from("categories").update(date).eq("id", cat.id), "Salvat.");
    }
    if (r) { inchide(); await incarca(); randeaza(); }
  });

  document.body.appendChild(scrim);
  q("#n").focus();
}

/* ── Previzualizarea grilei ──────────────────────────────────────────────
   Aceleași reguli de layout ca site-ul, ca previzualizarea să nu mintă.
   Aici se vede dacă un număr de categorii lasă un rând orfan. */

function previzualizareGrila() {
  const vizibile = inGrila();
  let coloane = 3;

  const scrim = el(`
    <div class="scrim" style="justify-content:center;align-items:center;padding:24px">
      <div class="card" style="width:min(940px,100%);max-height:92vh;overflow:auto">
        <div class="pad row" style="border-bottom:1px solid var(--line);position:sticky;top:0;background:#fff">
          <div class="grow">
            <h3>Grila site-ului</h3>
            <p class="tiny faint" style="margin:4px 0 0">
              ${vizibile.length} categorii vizibile din ${categorii.length}
            </p>
          </div>
          <div class="row" id="latimi"></div>
          <button class="btn ghost icon" id="x" aria-label="Închide">✕</button>
        </div>
        <div class="pad">
          <p class="tiny" id="verdict" style="margin:0 0 12px;font-weight:700"></p>
          <div class="gridprev" data-cols="3" id="prev"></div>
        </div>
      </div>
    </div>`);

  const prev = scrim.querySelector("#prev");
  const verdict = scrim.querySelector("#verdict");

  for (const [n, eticheta] of [[3, "Desktop"], [2, "Tabletă"], [1, "Telefon"]]) {
    const b = el(`<button class="btn ${n === 3 ? "" : "ghost"} sm">${eticheta}</button>`);
    b.addEventListener("click", () => {
      coloane = n;
      scrim.querySelectorAll("#latimi .btn").forEach((x) => x.classList.add("ghost"));
      b.classList.remove("ghost");
      deseneaza();
    });
    scrim.querySelector("#latimi").appendChild(b);
  }

  function deseneaza() {
    prev.dataset.cols = coloane;
    prev.innerHTML = "";
    const grid = el('<div class="catgrid"></div>');
    for (const c of vizibile) {
      grid.appendChild(el(`
        <div class="catcard">
          <div class="ph" style="background-image:url('${esc(img(c.image_url, 300))}')"></div>
          <div class="nm">${esc(c.name)}</div>
        </div>`));
    }
    prev.appendChild(grid);

    const rest = vizibile.length % coloane;
    verdict.style.color = rest === 0 ? "#5F6B1E" : "var(--gold)";
    verdict.textContent =
      coloane === 1
        ? "O coloană — orice număr cade bine."
        : rest === 0
        ? `${vizibile.length} pe ${coloane} coloane: ${vizibile.length / coloane} rânduri pline.`
        : `Ultimul rând are ${rest} din ${coloane}. Se centrează, deci arată intenționat — dar dacă vrei rânduri pline, ai nevoie de un multiplu de ${coloane}.`;
  }

  deseneaza();
  scrim.querySelector("#x").addEventListener("click", () => scrim.remove());
  scrim.addEventListener("click", (e) => { if (e.target === scrim) scrim.remove(); });
  document.body.appendChild(scrim);
}
