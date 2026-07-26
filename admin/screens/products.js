// Panoul de produse al categoriei alese.
//
// „Șterge" înseamnă două lucruri diferite, intenționat:
//   • Ascunde  → archived=true. Dispare de pe site, rămâne în comenzile vechi
//                și în rapoarte. Reversibil dintr-un click.
//   • Șterge definitiv → doar dacă produsul n-a fost comandat NICIODATĂ.
//                Altfel ai rupe legătura dintre comenzile vechi și produs.
// Verificarea nu e o presupunere: numărăm rândurile din order_items.

import { db, img, el, esc, toast, incearca, slugify, uniqueSlug, lei } from "../admin-core.js";
import { legaDragDrop } from "./catalog.js";

export function panouProduse(gazda, ctx) {
  const { categorie, produse, arhivate, categorii, poateScrie, reincarca } = ctx;
  gazda.innerHTML = "";

  if (!categorie) {
    gazda.appendChild(el('<div class="card empty">Alege o categorie din stânga.</div>'));
    return;
  }

  const alese = new Set();

  const panou = el(`
    <div class="card">
      <div class="pad" style="border-bottom:1px solid var(--line)">
        <div class="row" style="flex-wrap:wrap">
          <div class="grow">
            <h3>${esc(categorie.name)}</h3>
            <p class="tiny faint" style="margin:4px 0 0">
              ${produse.length} disponibile în listă${arhivate.length ? ` · ${arhivate.length} ascunse` : ""}
            </p>
          </div>
          ${poateScrie ? '<button class="btn sm" id="prod-nou">Produs nou</button>' : ""}
        </div>
        <div class="row" id="bara-bulk" style="display:none;margin-top:12px;padding-top:12px;
             border-top:1px solid var(--line);flex-wrap:wrap">
          <span class="tiny grow"><b id="nr-alese">0</b> alese</span>
          <button class="btn ghost sm" id="bulk-on">Marchează disponibile</button>
          <button class="btn ghost sm" id="bulk-off">Marchează indisponibile</button>
          <select id="bulk-muta" style="width:auto;height:32px;padding:0 8px;font-size:12.5px">
            <option value="">Mută în…</option>
            ${categorii.filter((c) => c.id !== categorie.id)
              .map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="list" id="lista"></div>
      ${arhivate.length ? `
        <div class="pad" style="border-top:1px solid var(--line);background:var(--bg-2)">
          <button class="btn ghost sm" id="vezi-ascunse">
            Vezi cele ${arhivate.length} produse ascunse
          </button>
          <div id="lista-ascunse" style="display:none;margin-top:12px"></div>
        </div>` : ""}
    </div>`);

  const lista = panou.querySelector("#lista");

  if (!produse.length) {
    lista.appendChild(el('<div class="empty tiny">Nicio categorie n-are produse la început. Adaugă primul.</div>'));
  }

  for (const p of produse) lista.appendChild(randProdus(p));

  function randProdus(p) {
    const rand = el(`
      <div class="item" data-id="${p.id}" ${poateScrie ? 'draggable="true"' : ""}>
        ${poateScrie ? '<span class="grip">⠿</span>' : ""}
        ${poateScrie ? `<input type="checkbox" class="alege" style="width:auto" aria-label="Alege ${esc(p.name)}">` : ""}
        ${p.image_url
          ? `<span class="thumb" style="background-image:url('${esc(img(p.image_url, 96))}')"></span>`
          : '<span class="thumb none">▢</span>'}
        <span class="grow" style="min-width:0">
          <b style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.name)}</b>
          <span class="tiny faint">
            ${p.promo_price
              ? `<s>${esc(lei(p.price))}</s> <b style="color:var(--red)">${esc(lei(p.promo_price))}</b>`
              : esc(lei(p.price))}
          </span>
        </span>
        ${p.available ? "" : '<span class="pill warn">indisponibil</span>'}
        ${poateScrie ? '<button class="btn ghost sm editeaza">Editează</button>' : ""}
      </div>`);

    rand.querySelector(".alege")?.addEventListener("change", (e) => {
      e.target.checked ? alese.add(p.id) : alese.delete(p.id);
      actualizeazaBulk();
    });
    rand.querySelector(".editeaza")?.addEventListener("click", () => sertarProdus(p));
    if (poateScrie) legaDragDrop(rand, lista, salveazaOrdinea);
    return rand;
  }

  function actualizeazaBulk() {
    const bara = panou.querySelector("#bara-bulk");
    bara.style.display = alese.size ? "flex" : "none";
    panou.querySelector("#nr-alese").textContent = alese.size;
  }

  async function salveazaOrdinea(ids) {
    const r = await incearca(() => db.rpc("reorder_products", { ids }), "Ordine salvată.");
    if (r) reincarca();
  }

  /* ── Acțiuni în masă — cazul „s-a terminat la ora 20" ──────────────────── */
  panou.querySelector("#bulk-on")?.addEventListener("click", () => setDisponibil(true));
  panou.querySelector("#bulk-off")?.addEventListener("click", () => setDisponibil(false));

  async function setDisponibil(v) {
    const r = await incearca(
      () => db.from("products").update({ available: v }).in("id", [...alese]),
      `${alese.size} produse marcate ${v ? "disponibile" : "indisponibile"}.`
    );
    if (r) reincarca();
  }

  panou.querySelector("#bulk-muta")?.addEventListener("change", async (e) => {
    const dest = e.target.value;
    if (!dest) return;
    const numeDest = categorii.find((c) => c.id === dest)?.name ?? "";
    // Intră la finalul categoriei destinație, ca să nu se amestece cu ordinea ei.
    const { data: ultimul } = await db.from("products")
      .select("sort").eq("category_id", dest).order("sort", { ascending: false }).limit(1);
    let sort = (ultimul?.[0]?.sort ?? -1) + 1;
    const r = await incearca(async () => {
      for (const id of alese) {
        const { error } = await db.from("products")
          .update({ category_id: dest, sort: sort++ }).eq("id", id);
        if (error) return { error };
      }
      return {};
    }, `${alese.size} produse mutate în „${numeDest}”.`);
    e.target.value = "";
    if (r) reincarca();
  });

  panou.querySelector("#prod-nou")?.addEventListener("click", () => sertarProdus(null));

  /* ── Produsele ascunse ─────────────────────────────────────────────────── */
  panou.querySelector("#vezi-ascunse")?.addEventListener("click", (e) => {
    const box = panou.querySelector("#lista-ascunse");
    const deschis = box.style.display !== "none";
    box.style.display = deschis ? "none" : "block";
    e.target.textContent = deschis
      ? `Vezi cele ${arhivate.length} produse ascunse`
      : "Ascunde lista";
    if (!deschis && !box.dataset.gata) {
      box.dataset.gata = "1";
      const l = el('<div class="list card"></div>');
      for (const p of arhivate) {
        const r = el(`
          <div class="item">
            <span class="grow"><b>${esc(p.name)}</b>
              <span class="tiny faint" style="display:block">${esc(lei(p.price))}</span></span>
            <button class="btn ghost sm">Readu pe site</button>
          </div>`);
        r.querySelector("button").addEventListener("click", async () => {
          const ok = await incearca(
            () => db.from("products").update({ archived: false }).eq("id", p.id),
            `„${p.name}” e din nou pe site.`
          );
          if (ok) reincarca();
        });
        l.appendChild(r);
      }
      box.appendChild(l);
    }
  });

  /* ── Sertarul de produs ────────────────────────────────────────────────── */
  function sertarProdus(p) {
    const nou = !p;
    const st = {
      name: p?.name ?? "",
      price: p?.price ?? "",
      promo_price: p?.promo_price ?? "",
      available: p?.available ?? true,
      image_url: p?.image_url ?? null,
      category_id: p?.category_id ?? categorie.id,
    };

    const scrim = el(`
      <div class="scrim">
        <div class="sheet" role="dialog">
          <header>
            <h3 class="grow">${nou ? "Produs nou" : esc(p.name)}</h3>
            <button class="btn ghost icon" id="x" aria-label="Închide">✕</button>
          </header>
          <div class="body">
            <div class="field">
              <label for="n">Nume</label>
              <input id="n" type="text" value="${esc(st.name)}">
            </div>
            <div class="row" style="gap:12px;align-items:flex-start">
              <div class="field grow">
                <label for="pr">Preț (lei)</label>
                <input id="pr" type="number" step="0.5" min="0" value="${esc(st.price)}">
              </div>
              <div class="field grow">
                <label for="pp">Preț promo <span class="faint">(opțional)</span></label>
                <input id="pp" type="number" step="0.5" min="0" value="${esc(st.promo_price ?? "")}">
              </div>
            </div>
            <div class="field">
              <label for="cat">Categorie</label>
              <select id="cat">
                ${categorii.map((c) =>
                  `<option value="${c.id}" ${c.id === st.category_id ? "selected" : ""}>${esc(c.name)}</option>`
                ).join("")}
              </select>
            </div>
            <div class="field">
              <label>Imagine <span class="faint">(opțional)</span></label>
              <div class="row">
                <span class="thumb" id="prev" style="width:76px;height:76px;flex-basis:76px;
                  ${st.image_url ? `background-image:url('${esc(img(st.image_url, 200))}')` : ""}"></span>
                <input type="file" id="fis" accept="image/png,image/jpeg,image/webp"
                  class="grow" style="font-size:13px">
              </div>
            </div>
            <label class="row" style="gap:9px;cursor:pointer">
              <input type="checkbox" id="disp" ${st.available ? "checked" : ""} style="width:auto">
              <span><b>Disponibil</b>
                <span class="tiny faint" style="display:block">Debifat = apare pe site, dar nu se poate comanda.</span>
              </span>
            </label>

            ${!nou ? `
              <div class="card pad" style="background:var(--bg-3);border:0">
                <b class="tiny">Scoate de pe site</b>
                <p class="tiny muted" style="margin:6px 0 10px">
                  Dispare din meniu, dar rămâne în comenzile vechi și în rapoarte. Reversibil.
                </p>
                <button class="btn ghost sm" id="ascunde">Ascunde produsul</button>
                <hr style="border:0;border-top:1px solid var(--line);margin:14px 0">
                <b class="tiny">Ștergere definitivă</b>
                <p class="tiny muted" style="margin:6px 0 10px" id="info-sterg">Se verifică…</p>
                <button class="btn danger sm" id="sterge" disabled>Șterge definitiv</button>
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
    q("#x").addEventListener("click", inchide);
    q("#anuleaza").addEventListener("click", inchide);
    scrim.addEventListener("click", (e) => { if (e.target === scrim) inchide(); });

    q("#fis").addEventListener("change", async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const cale = `${slugify(q("#n").value) || "produs"}-${Date.now()}.${f.name.split(".").pop()}`;
      const up = await incearca(() =>
        db.storage.from("products").upload(cale, f, { upsert: true, contentType: f.type }));
      if (up) {
        st.image_url = db.storage.from("products").getPublicUrl(cale).data.publicUrl;
        q("#prev").style.backgroundImage = `url('${img(st.image_url, 200)}')`;
        q("#prev").classList.remove("none");
        toast("Imagine încărcată.", "ok");
      }
    });

    /* Ștergerea definitivă e permisă doar dacă produsul n-a fost comandat. */
    if (!nou) {
      (async () => {
        const { count, error } = await db
          .from("order_items").select("id", { count: "exact", head: true })
          .eq("product_id", p.id);
        const info = q("#info-sterg");
        if (error) { info.textContent = "Nu s-a putut verifica istoricul comenzilor."; return; }
        if (count > 0) {
          const cuv = count === 1 ? "o comandă" : `${count} comenzi`;
          info.innerHTML = `Nu se poate: produsul apare în <b>${cuv}</b>.
            Ștergerea ar rupe legătura cu istoricul. Folosește „Ascunde produsul”.`;
        } else {
          info.textContent = "Produsul n-a fost comandat niciodată, deci poate fi șters definitiv.";
          q("#sterge").disabled = false;
        }
      })();

      q("#ascunde").addEventListener("click", async () => {
        const r = await incearca(
          () => db.from("products").update({ archived: true }).eq("id", p.id),
          `„${p.name}” a fost scos de pe site.`
        );
        if (r) { inchide(); reincarca(); }
      });

      q("#sterge").addEventListener("click", async () => {
        if (!confirm(`Ștergi definitiv „${p.name}”? Nu se poate anula.`)) return;
        const r = await incearca(
          () => db.from("products").delete().eq("id", p.id),
          "Produs șters."
        );
        if (r) { inchide(); reincarca(); }
      });
    }

    q("#salveaza").addEventListener("click", async () => {
      const nume = q("#n").value.trim();
      const pret = parseFloat(q("#pr").value);
      if (!nume || !(pret >= 0)) return toast("Numele și prețul sunt obligatorii.", "bad");

      const date = {
        name: nume,
        price: pret,
        promo_price: q("#pp").value ? parseFloat(q("#pp").value) : null,
        available: q("#disp").checked,
        image_url: st.image_url,
        category_id: q("#cat").value,
      };

      let r;
      if (nou) {
        const { data: toate } = await db.from("products").select("slug");
        date.slug = uniqueSlug(slugify(nume), (toate ?? []).map((x) => x.slug));
        date.sort = produse.length;
        r = await incearca(() => db.from("products").insert(date), "Produs creat.");
      } else {
        r = await incearca(() => db.from("products").update(date).eq("id", p.id), "Salvat.");
      }
      if (r) { inchide(); reincarca(); }
    });

    document.body.appendChild(scrim);
    q("#n").focus();
  }

  gazda.appendChild(panou);
}
