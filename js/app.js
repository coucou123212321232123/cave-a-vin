import { SEED } from "./data.js";

const STORE_KEY = "cave-camille-v1";
const YEAR = new Date().getFullYear();
const PER_SHELF = 6;
const MIN_SHELVES = 5;

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

/* ————————————————— État ————————————————— */
// Empreinte de js/data.js : permet de détecter qu'une nouvelle liste a été poussée
const SEED_HASH = (() => {
  let h = 0; const s = JSON.stringify(SEED);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return String(h);
})();
let state = load();
const ui = { view: "cave", filter: "all", q: "", sort: "domaine", openId: null };

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (Array.isArray(s.wines)) return { wines: s.wines, history: s.history || [], seedHash: s.seedHash ?? SEED_HASH };
    }
  } catch {}
  return fresh();
}
function fresh() {
  return { wines: SEED.map((w) => ({ id: uid(), notes: "", ...structuredClone(w) })), history: [], seedHash: SEED_HASH };
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {}
}

/* ————————————————— Helpers vin ————————————————— */
const COLORS = {
  B: { label: "Blanc", dot: "var(--blanc)" },
  R: { label: "Rouge", dot: "var(--rouge)" },
};
const title = (w) => w.cuvee || w.appellation;
const subtitle = (w) => (w.cuvee ? w.appellation : w.region || "");
const fullName = (w) => w.appellation + (w.cuvee ? " · " + w.cuvee : "");
const vintageTxt = (w) => (w.vintage ? String(w.vintage) : "NM");

function status(w) {
  if (!w.garde || !w.garde[0] || !w.garde[1]) return { k: "none", t: "Garde non renseignée" };
  const [a, b] = w.garde;
  if (YEAR < a) return { k: "young", t: `En garde · à partir de ${a}`, rank: 3 };
  if (YEAR < b) return { k: "ready", t: `Prêt à boire · jusqu'en ${b}`, rank: 2 };
  if (YEAR === b) return { k: "soon", t: "À boire cette année", rank: 1 };
  return { k: "late", t: "À boire sans tarder", rank: 0 };
}
const drinkable = (w) => ["ready", "soon", "late"].includes(status(w).k);
const priority = (w) => ["soon", "late"].includes(status(w).k);

function matches(w) {
  if (ui.filter === "B" || ui.filter === "R") { if (w.color !== ui.filter) return false; }
  if (ui.filter === "drink" && !drinkable(w)) return false;
  if (ui.q) {
    const hay = norm([w.domaine, w.appellation, w.cuvee, w.vintage, w.region, COLORS[w.color]?.label].join(" "));
    if (!norm(ui.q).split(/\s+/).every((t) => hay.includes(t))) return false;
  }
  return true;
}

function sorted(list) {
  const by = {
    domaine: (a, b) => a.domaine.localeCompare(b.domaine) || a.appellation.localeCompare(b.appellation) || (a.cuvee || "").localeCompare(b.cuvee || "") || (a.vintage || 9999) - (b.vintage || 9999),
    couleur: (a, b) => a.color.localeCompare(b.color) || a.domaine.localeCompare(b.domaine) || (a.vintage || 9999) - (b.vintage || 9999),
    millesime: (a, b) => (a.vintage || 9999) - (b.vintage || 9999) || a.domaine.localeCompare(b.domaine),
    garde: (a, b) => (status(a).rank ?? 9) - (status(b).rank ?? 9) || (a.garde?.[1] || 9999) - (b.garde?.[1] || 9999),
  }[ui.sort];
  return [...list].sort(by);
}

/* ————————————————— SVG bouteille ————————————————— */
document.body.insertAdjacentHTML("afterbegin", `
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <linearGradient id="gB" x1="0" x2="1">
      <stop offset="0" stop-color="#3b3611"/><stop offset=".28" stop-color="#8c8338"/><stop offset=".55" stop-color="#5e5720"/><stop offset="1" stop-color="#28240a"/>
    </linearGradient>
    <linearGradient id="gR" x1="0" x2="1">
      <stop offset="0" stop-color="#090c06"/><stop offset=".28" stop-color="#2c3a22"/><stop offset=".55" stop-color="#141c0f"/><stop offset="1" stop-color="#050704"/>
    </linearGradient>
    <linearGradient id="cB" x1="0" x2="1">
      <stop offset="0" stop-color="#7d5f2c"/><stop offset=".4" stop-color="#ead09a"/><stop offset="1" stop-color="#8a6a33"/>
    </linearGradient>
    <linearGradient id="cR" x1="0" x2="1">
      <stop offset="0" stop-color="#3f0811"/><stop offset=".4" stop-color="#a9283e"/><stop offset="1" stop-color="#4a0b16"/>
    </linearGradient>
    <linearGradient id="lbl" x1="0" x2="1">
      <stop offset="0" stop-color="#b9ad95"/><stop offset=".35" stop-color="#f4ecdb"/><stop offset="1" stop-color="#a89b82"/>
    </linearGradient>
  </defs>
</svg>`);

function bottleSVG(w) {
  const c = w.color === "R" ? "R" : "B";
  const accent = c === "R" ? "#8e1b2c" : "#a88341";
  return `<svg viewBox="0 0 40 130" aria-hidden="true">
    <path d="M9 124Q9 129 14 129H26Q31 129 31 124V64C31 50 23.6 45 22.6 34V9H17.4V34C16.4 45 9 50 9 64Z" fill="url(#g${c})"/>
    <rect x="16.4" y="4" width="7.2" height="27" rx="1.4" fill="url(#c${c})"/>
    <rect x="16.4" y="29.6" width="7.2" height="1.4" fill="rgba(0,0,0,.25)"/>
    <rect x="10.4" y="75" width="19.2" height="33" rx="1" fill="url(#lbl)"/>
    <rect x="12.5" y="80" width="15" height="1" fill="${accent}"/>
    <text x="20" y="96" text-anchor="middle" font-family="Cormorant Garamond, serif" font-weight="700" font-size="7.4" fill="#2b1e14">${esc(vintageTxt(w))}</text>
    <rect x="13.5" y="101" width="13" height=".7" fill="#7a6a55"/>
    <path d="M12 66C12 56 15.6 50 18.2 44H18.9C16.8 51 13.6 57 13.6 66V122H12Z" fill="#fff" opacity=".16"/>
  </svg>`;
}

/* ————————————————— Rendu ————————————————— */
function renderStats() {
  const n = (f) => state.wines.filter(f).reduce((s, w) => s + w.qty, 0);
  const tot = n(() => true), b = n((w) => w.color === "B"), r = n((w) => w.color === "R"), p = n(priority);
  $("#stats").innerHTML = `
    <div class="stat"><b>${tot}</b><span>bouteilles</span></div>
    <div class="stat"><b>${b}</b><span><i style="background:var(--blanc)"></i>blancs</span></div>
    <div class="stat"><b>${r}</b><span><i style="background:var(--rouge)"></i>rouges</span></div>
    <div class="stat"><b>${p}</b><span><i style="background:var(--warn)"></i>priorité</span></div>`;
}

function shelfLabel(items) {
  if (!items.length) return "";
  if (ui.sort === "domaine") return [...new Set(items.map((w) => w.domaine))].join(" · ");
  if (ui.sort === "couleur") return [...new Set(items.map((w) => COLORS[w.color]?.label + "s"))].join(" · ");
  if (ui.sort === "millesime") {
    const ys = items.map((w) => w.vintage).filter(Boolean);
    if (!ys.length) return "";
    const a = Math.min(...ys), b = Math.max(...ys);
    return a === b ? String(a) : `${a} – ${b}`;
  }
  return "";
}

function renderCellar() {
  const bottles = sorted(state.wines).flatMap((w) => Array.from({ length: w.qty }, (_, i) => ({ w, i })));
  const shelves = Math.max(MIN_SHELVES, Math.ceil(bottles.length / PER_SHELF));
  let html = "";
  for (let s = 0; s < shelves; s++) {
    const slice = bottles.slice(s * PER_SHELF, (s + 1) * PER_SHELF);
    html += `<div class="shelf">`;
    for (let k = 0; k < PER_SHELF; k++) {
      const b = slice[k];
      if (!b) { html += `<div class="slot empty"></div>`; continue; }
      const { w } = b;
      const flag = priority(w) ? `<span class="flag" style="background:var(--${status(w).k === "late" ? "late" : "warn"})"></span>` : "";
      html += `<div class="slot"><button class="bottle${matches(w) ? "" : " dim"}" data-id="${w.id}" aria-label="${esc(fullName(w))} ${esc(vintageTxt(w))}, ${esc(w.domaine)}">${bottleSVG(w)}</button>${flag}</div>`;
    }
    html += `<span class="shelf-label">${esc(shelfLabel(slice.map((b) => b.w)))}</span></div>`;
  }
  $("#cellar").innerHTML = html;
  if (!$(".legend", $("#view-cave"))) {
    $("#view-cave").insertAdjacentHTML("beforeend", `<div class="legend">
      <span><i style="background:var(--blanc)"></i>Blanc</span>
      <span><i style="background:var(--rouge)"></i>Rouge</span>
      <span><i style="background:var(--warn)"></i>À boire en priorité</span></div>`);
  }
}

function renderList() {
  const list = sorted(state.wines.filter(matches));
  if (!list.length) {
    $("#view-list").innerHTML = `<div class="empty-state">Aucune bouteille ne correspond.</div>`;
    return;
  }
  const key = ui.sort === "couleur" ? (w) => COLORS[w.color].label + "s" : ui.sort === "millesime" ? (w) => (w.vintage ? String(w.vintage) : "Non millésimé") : ui.sort === "garde" ? (w) => ({ late: "À boire sans tarder", soon: "À boire cette année", ready: "Prêts à boire", young: "En garde", none: "Garde non renseignée" }[status(w).k]) : (w) => w.domaine;
  const groups = new Map();
  for (const w of list) { const k = key(w); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(w); }
  let html = "";
  for (const [k, ws] of groups) {
    const n = ws.reduce((s, w) => s + w.qty, 0);
    html += `<div class="group"><h3>${esc(k)}<small>${n} bouteille${n > 1 ? "s" : ""}</small></h3>`;
    for (const w of ws) {
      const st = status(w);
      html += `<button class="card" data-id="${w.id}">
        <svg class="mini" viewBox="0 0 40 130" aria-hidden="true">${bottleSVG(w).replace(/^<svg[^>]*>|<\/svg>$/g, "")}</svg>
        <div><div class="t">${esc(fullName(w))}</div>
          <div class="s">${ui.sort === "domaine" ? "" : esc(w.domaine) + " · "}<span class="pill st-${st.k}">${esc(st.t.split(" · ")[0])}</span></div></div>
        <div class="r"><div class="y">${esc(vintageTxt(w))}</div><div class="q">× ${w.qty}</div></div>
      </button>`;
    }
    html += `</div>`;
  }
  $("#view-list").innerHTML = html;
}

function render() {
  renderStats();
  renderCellar();
  renderList();
}

/* ————————————————— Feuille du bas ————————————————— */
const sheet = $("#sheet"), scrim = $("#scrim"), body = $("#sheet-body");
let onSheetClose = null;

function openSheet(html, { onClose } = {}) {
  if (onSheetClose) { const f = onSheetClose; onSheetClose = null; f(); }
  body.innerHTML = html;
  body.scrollTop = 0;
  onSheetClose = onClose || null;
  if (!sheet.classList.contains("on")) history.pushState({ sheet: true }, "");
  sheet.classList.add("on");
  scrim.classList.add("on");
}
function closeSheet(fromPop = false) {
  if (!sheet.classList.contains("on")) return;
  sheet.classList.remove("on");
  scrim.classList.remove("on");
  sheet.style.transform = "";
  $$(".bottle.lift").forEach((b) => b.classList.remove("lift"));
  if (onSheetClose) { const f = onSheetClose; onSheetClose = null; f(); }
  ui.openId = null;
  if (!fromPop && history.state?.sheet) history.back();
}
scrim.addEventListener("click", () => closeSheet());
window.addEventListener("popstate", () => closeSheet(true));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });

// Glisser vers le bas pour fermer
(() => {
  let y0 = null, dy = 0;
  const start = (e) => { y0 = e.touches ? e.touches[0].clientY : e.clientY; dy = 0; sheet.classList.add("dragging"); };
  const move = (e) => {
    if (y0 === null) return;
    dy = Math.max(0, (e.touches ? e.touches[0].clientY : e.clientY) - y0);
    sheet.style.transform = `translateY(${dy}px)`;
  };
  const end = () => {
    if (y0 === null) return;
    sheet.classList.remove("dragging");
    y0 = null;
    if (dy > 110) closeSheet(); else sheet.style.transform = "";
  };
  const grab = $(".grab");
  grab.addEventListener("pointerdown", (e) => { grab.setPointerCapture(e.pointerId); start(e); });
  grab.addEventListener("pointermove", move);
  grab.addEventListener("pointerup", end);
  grab.addEventListener("pointercancel", end);
})();

/* ————————————————— Toast ————————————————— */
let toastTimer;
function toast(msg, action) {
  const t = $("#toast");
  t.innerHTML = `<span>${msg}</span>${action ? `<button>${action.label}</button>` : ""}`;
  if (action) $("button", t).onclick = () => { action.fn(); t.classList.remove("on"); };
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), action ? 5000 : 2400);
}

/* ————————————————— Détail ————————————————— */
let viewer = null;
async function load3D() {
  if (viewer) return viewer;
  viewer = await import("./bottle3d.js");
  return viewer;
}

function timelineHTML(w) {
  if (!w.garde || !w.garde[0]) return "";
  const [a, b] = w.garde;
  const lo = Math.min(w.vintage || a, YEAR) , hi = Math.max(b, YEAR) + 1;
  const pct = (y) => ((y - lo) / (hi - lo)) * 100;
  return `<div class="timeline">
      <div class="win" style="left:${pct(a)}%;width:${pct(b + 1) - pct(a)}%"></div>
      <div class="now" style="left:calc(${pct(YEAR + 0.5)}% - 1px)" data-y="${YEAR}"></div>
    </div>
    <div class="tl-scale"><span>${lo}</span><span>Apogée ${a} – ${b}</span><span>${hi}</span></div>`;
}

function openDetail(id) {
  const w = state.wines.find((x) => x.id === id);
  if (!w) return;
  ui.openId = id;
  const st = status(w);
  openSheet(`
    <div class="stage" id="stage"><div class="spin-hint">Faites glisser pour tourner la bouteille</div></div>
    <div class="d-kicker">${esc(w.domaine)}</div>
    <h2 class="d-title">${esc(title(w))}</h2>
    <div class="d-sub">${esc(subtitle(w))}</div>
    <div class="chips">
      <span class="chip"><i style="background:${COLORS[w.color]?.dot}"></i>${COLORS[w.color]?.label || ""}</span>
      <span class="chip">Millésime ${esc(w.vintage || "non renseigné")}</span>
      ${w.region ? `<span class="chip">${esc(w.region)}</span>` : ""}
    </div>

    <div class="block">
      <div class="count-row">
        <div><b id="d-qty">${w.qty}</b> <span>bouteille${w.qty > 1 ? "s" : ""} en cave</span></div>
        <span class="pill st-${st.k}">${esc(st.t.split(" · ")[0])}</span>
      </div>
      <button class="btn btn-primary mt" id="d-drink">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 3h8l-.6 6a3.4 3.4 0 0 1-6.8 0zM12 13v7M8.5 21h7"/></svg>
        Déboucher une bouteille
      </button>
    </div>

    ${w.garde && w.garde[0] ? `<div class="block"><div class="block-h"><span>Fenêtre de dégustation</span><span class="st-${st.k}">${esc(st.t)}</span></div>${timelineHTML(w)}</div>` : ""}

    <div class="block">
      <div class="block-h"><span>Notes</span></div>
      <textarea class="notes" id="d-notes" placeholder="Accords, souvenirs, occasion…">${esc(w.notes)}</textarea>
    </div>

    <div class="btn-row">
      <button class="btn btn-ghost" id="d-edit">Modifier</button>
      <button class="btn btn-ghost" id="d-close">Fermer</button>
    </div>
  `, { onClose: () => viewer?.unmount() });

  $$(`.bottle[data-id="${id}"]`).forEach((b) => b.classList.add("lift"));

  const stage = $("#stage");
  load3D().then((v) => { if (ui.openId === id && document.body.contains(stage)) v.mount(stage, w); })
    .catch(() => {
      stage.innerHTML = `<div class="fallback">${bottleSVG(w)}</div>`;
    });

  $("#d-notes").addEventListener("change", (e) => { w.notes = e.target.value; save(); });
  $("#d-edit").onclick = () => openForm(w);
  $("#d-close").onclick = () => closeSheet();
  $("#d-drink").onclick = () => drink(w);
}

function drink(w) {
  const snapshot = structuredClone(state);
  w.qty -= 1;
  state.history.unshift({ name: fullName(w), domaine: w.domaine, vintage: w.vintage, color: w.color, date: new Date().toISOString() });
  state.history = state.history.slice(0, 200);
  const gone = w.qty <= 0;
  if (gone) state.wines = state.wines.filter((x) => x.id !== w.id);
  save(); render();
  if (gone) closeSheet();
  else {
    $("#d-qty").textContent = w.qty;
    $("#d-qty").nextElementSibling.textContent = `bouteille${w.qty > 1 ? "s" : ""} en cave`;
    $$(`.bottle[data-id="${w.id}"]`).forEach((b) => b.classList.add("lift"));
  }
  toast(`Santé ! ${esc(title(w))} ${esc(vintageTxt(w))}`, {
    label: "Annuler",
    fn: () => { state = snapshot; save(); render(); toast("Bouteille remise en cave"); if (ui.openId === w.id) openDetail(w.id); },
  });
}

/* ————————————————— Formulaire ————————————————— */
function openForm(w) {
  const isNew = !w;
  const d = w || { domaine: "", appellation: "", cuvee: "", vintage: YEAR - 2, color: "R", qty: 1, region: "", garde: null, notes: "" };
  let color = d.color, qty = d.qty;
  const domaines = [...new Set(state.wines.map((x) => x.domaine))].sort();
  const apps = [...new Set(state.wines.map((x) => x.appellation))].sort();
  const regions = [...new Set(state.wines.map((x) => x.region).filter(Boolean))].sort();
  openSheet(`
    <form class="form" id="f">
      <h2>${isNew ? "Nouvelle bouteille" : "Modifier"}</h2>
      <div class="field"><label>Domaine</label><input name="domaine" list="dl-dom" required value="${esc(d.domaine)}" autocomplete="off"></div>
      <div class="field"><label>Appellation</label><input name="appellation" list="dl-app" required value="${esc(d.appellation)}" autocomplete="off"></div>
      <div class="field"><label>Cuvée <span style="color:var(--faint)">(facultatif)</span></label><input name="cuvee" value="${esc(d.cuvee)}" autocomplete="off"></div>
      <div class="grid2">
        <div class="field"><label>Millésime</label><input name="vintage" type="number" inputmode="numeric" min="1900" max="2100" value="${esc(d.vintage ?? "")}" placeholder="—"></div>
        <div class="field"><label>Région</label><input name="region" list="dl-reg" value="${esc(d.region)}" autocomplete="off"></div>
      </div>
      <div class="field"><label>Couleur</label>
        <div class="color-pick">
          <button type="button" data-c="B" class="${color === "B" ? "on" : ""}"><i style="background:var(--blanc)"></i>Blanc</button>
          <button type="button" data-c="R" class="${color === "R" ? "on" : ""}"><i style="background:var(--rouge)"></i>Rouge</button>
        </div>
      </div>
      <div class="field"><label>Nombre de bouteilles</label>
        <div class="stepper"><button type="button" data-q="-1">−</button><output id="f-qty">${qty}</output><button type="button" data-q="1">+</button></div>
      </div>
      <div class="field"><label>À boire entre <span style="color:var(--faint)">(facultatif)</span></label>
        <div class="grid2">
          <input name="g0" type="number" inputmode="numeric" placeholder="de" value="${esc(d.garde?.[0] ?? "")}">
          <input name="g1" type="number" inputmode="numeric" placeholder="à" value="${esc(d.garde?.[1] ?? "")}">
        </div>
      </div>
      <button class="btn btn-primary mt" type="submit">${isNew ? "Ajouter à la cave" : "Enregistrer"}</button>
      ${isNew ? "" : `<button class="btn btn-danger mt" type="button" id="f-del">Retirer de la cave</button>`}
      <datalist id="dl-dom">${domaines.map((x) => `<option value="${esc(x)}">`).join("")}</datalist>
      <datalist id="dl-app">${apps.map((x) => `<option value="${esc(x)}">`).join("")}</datalist>
      <datalist id="dl-reg">${regions.map((x) => `<option value="${esc(x)}">`).join("")}</datalist>
    </form>`);

  const f = $("#f");
  $$(".color-pick button", f).forEach((b) => (b.onclick = () => {
    color = b.dataset.c;
    $$(".color-pick button", f).forEach((x) => x.classList.toggle("on", x === b));
  }));
  $$(".stepper button", f).forEach((b) => (b.onclick = () => {
    qty = Math.max(1, Math.min(99, qty + Number(b.dataset.q)));
    $("#f-qty").textContent = qty;
  }));
  f.onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(f);
    const num = (v) => (v === "" || v == null ? null : Number(v));
    const g0 = num(fd.get("g0")), g1 = num(fd.get("g1"));
    const data = {
      domaine: fd.get("domaine").trim(),
      appellation: fd.get("appellation").trim(),
      cuvee: fd.get("cuvee").trim(),
      vintage: num(fd.get("vintage")),
      region: fd.get("region").trim(),
      color, qty,
      garde: g0 && g1 ? [Math.min(g0, g1), Math.max(g0, g1)] : null,
    };
    let id;
    if (isNew) { id = uid(); state.wines.push({ id, notes: "", ...data }); }
    else { Object.assign(w, data); id = w.id; }
    save(); render();
    toast(isNew ? "Bouteille ajoutée" : "Modifications enregistrées");
    openDetail(id);
  };
  if (!isNew) $("#f-del").onclick = () => {
    if (!confirm(`Retirer « ${fullName(w)} ${vintageTxt(w)} » de la cave ?`)) return;
    const snapshot = structuredClone(state);
    state.wines = state.wines.filter((x) => x.id !== w.id);
    save(); render(); closeSheet();
    toast("Bouteille retirée", { label: "Annuler", fn: () => { state = snapshot; save(); render(); } });
  };
}

/* ————————————————— Réglages ————————————————— */
function openSettings() {
  const h = state.history.slice(0, 30);
  openSheet(`
    <div class="settings">
      <h2>Réglages</h2>
      <p>Les données sont enregistrées sur cet appareil. Exportez une sauvegarde pour les transférer ou les conserver.</p>
      <button class="btn btn-ghost" id="s-export">Exporter la cave (.json)</button>
      <button class="btn btn-ghost" id="s-import">Importer une sauvegarde</button>
      <input type="file" id="s-file" accept="application/json,.json" hidden>
      <button class="btn btn-danger" id="s-reset">Revenir à l'inventaire initial</button>
      <div class="history">
        <h4>Dernières bouteilles ouvertes</h4>
        ${h.length ? `<ul>${h.map((x) => `<li><span>${esc(x.name)} ${esc(x.vintage || "")}<br><small style="color:var(--faint)">${esc(x.domaine)}</small></span><span>${new Date(x.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}</span></li>`).join("")}</ul>` : `<p>Aucune pour l'instant.</p>`}
      </div>
    </div>`);

  $("#s-export").onclick = async () => {
    const name = `cave-${new Date().toISOString().slice(0, 10)}.json`;
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const file = new File([blob], name, { type: "application/json" });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: "Sauvegarde de la cave" }); return; } catch (e) { if (e.name === "AbortError") return; }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  $("#s-import").onclick = () => $("#s-file").click();
  $("#s-file").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.wines)) throw new Error();
      state = { wines: data.wines.map((w) => ({ id: w.id || uid(), notes: "", ...w })), history: data.history || [] };
      save(); render(); closeSheet(); toast("Sauvegarde importée");
    } catch { toast("Fichier invalide"); }
  };
  $("#s-reset").onclick = () => {
    if (!confirm("Remplacer la cave actuelle par l'inventaire initial ?")) return;
    const snapshot = structuredClone(state);
    state = fresh(); save(); render(); closeSheet();
    toast("Inventaire réinitialisé", { label: "Annuler", fn: () => { state = snapshot; save(); render(); } });
  };
}

/* ————————————————— Événements ————————————————— */
document.addEventListener("click", (e) => {
  const b = e.target.closest(".bottle, .card");
  if (b?.dataset.id) openDetail(b.dataset.id);
});
$("#filters").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-filter]");
  if (!b) return;
  ui.filter = b.dataset.filter;
  $$("#filters button").forEach((x) => x.classList.toggle("on", x === b));
  renderCellar(); renderList();
});
$("#q").addEventListener("input", (e) => { ui.q = e.target.value.trim(); renderCellar(); renderList(); });
$("#sort").addEventListener("change", (e) => { ui.sort = e.target.value; renderCellar(); renderList(); });
$$(".tabbar button[data-view]").forEach((b) => (b.onclick = () => {
  ui.view = b.dataset.view;
  $$(".tabbar button[data-view]").forEach((x) => x.classList.toggle("on", x === b));
  $$(".view").forEach((v) => v.classList.toggle("on", v.id === "view-" + ui.view));
  window.scrollTo({ top: 0, behavior: "smooth" });
}));
$("#btn-add").onclick = () => openForm(null);
$("#btn-settings").onclick = openSettings;

render();

// La liste de js/data.js a changé depuis la dernière visite : proposer de la charger
if (state.seedHash !== SEED_HASH) {
  const t = $("#toast");
  t.innerHTML = `<span>La liste de la cave a été mise à jour.</span><button id="seed-yes">Charger</button><button id="seed-no" style="color:#7d6b65">Ignorer</button>`;
  t.classList.add("on");
  $("#seed-yes").onclick = () => {
    const history = state.history;
    state = fresh(); state.history = history;
    save(); render(); t.classList.remove("on"); toast("Nouvelle liste chargée");
  };
  $("#seed-no").onclick = () => { state.seedHash = SEED_HASH; save(); t.classList.remove("on"); };
}

// Préchargement discret du moteur 3D, puis service worker (mode hors-ligne)
setTimeout(() => load3D().catch(() => {}), 1200);
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
