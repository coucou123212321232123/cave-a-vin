import { SEED } from "./data.js";
import { appellationInfo, APPELLATION_NAMES, SHAPE_NAMES, shapeFor } from "./appellations.js";
import * as Photos from "./photos.js";
import { PHOTOS } from "./labels.js";

const STORE_KEY = "cave-camille-v1";
const YEAR = new Date().getFullYear();

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const copyCanvas = (c) => { const o = document.createElement("canvas"); o.width = c.width; o.height = c.height; o.getContext("2d").drawImage(c, 0, 0); return o; };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

/* ————————————————— État ————————————————— */
// Empreinte de js/data.js : permet de détecter qu'une nouvelle liste a été poussée
const SEED_HASH = (() => {
  let h = 0; const s = JSON.stringify(SEED);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return String(h);
})();
let state = load();
const ui = { filter: "all", q: "", sort: "domaine" };

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (Array.isArray(s.wines)) return { wines: s.wines, history: normHistory(s.history), seedHash: s.seedHash ?? SEED_HASH };
    }
  } catch {}
  return fresh();
}
// Souvenirs : chaque bouteille bue garde sa fiche complète (pour la revoir en 3D), la date, avec qui, le contexte
function normHistory(h) {
  return (h || []).map((x) => {
    if (x.wine) return { with: [], context: "", place: "", note: "", rating: 0, ...x, id: x.id || uid() };
    const [app, cuvee] = String(x.name || "").split(" · ");
    return {
      id: x.id || uid(), date: x.date || new Date().toISOString(), with: [], context: "", place: "", note: "", rating: 0,
      wine: { id: uid(), domaine: x.domaine || "", appellation: app || "", cuvee: cuvee || "", vintage: x.vintage ?? null, color: x.color || "R", region: "" },
    };
  });
}
function fresh() {
  return { wines: SEED.map((w) => ({ id: uid(), notes: "", ...structuredClone(w) })), history: [], seedHash: SEED_HASH };
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {}
}

/* ————————————————— Helpers vin ————————————————— */
const COLORS = { B: { label: "Blanc", dot: "var(--blanc)" }, R: { label: "Rouge", dot: "var(--rouge)" } };
const title = (w) => w.cuvee || w.appellation;
const subtitle = (w) => (w.cuvee ? w.appellation : "");
const fullName = (w) => w.appellation + (w.cuvee ? " · " + w.cuvee : "");
const vintageTxt = (w) => (w.vintage ? String(w.vintage) : "NM");
const byId = (id) => state.wines.find((w) => w.id === id);

function status(w) {
  if (!w.garde || !w.garde[0] || !w.garde[1]) return { k: "none", t: "Garde non renseignée", rank: 4 };
  const [a, b] = w.garde;
  if (YEAR < a) return { k: "young", t: `En garde · à partir de ${a}`, rank: 3 };
  if (YEAR < b) return { k: "ready", t: `Prêt à boire · jusqu'en ${b}`, rank: 2 };
  if (YEAR === b) return { k: "soon", t: "À boire cette année", rank: 1 };
  return { k: "late", t: "À boire sans tarder", rank: 0 };
}
// Garde maximale estimée (en années après le millésime), selon l'appellation et la cuvée
const NORM = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
function gardeMax(w) {
  const a = NORM(w.appellation), c = NORM(w.cuvee), vv = c.includes("vieilles vignes");
  if (a.includes("bouzeron")) return c.includes("fortune") ? (vv ? [8, 12] : [7, 10]) : [6, 9];
  const info = appellationInfo(w.appellation);
  if (info) {
    const r = info.garde || info.regionGarde[w.color === "B" ? "B" : "R"];
    // un premier cru ou des vieilles vignes se gardent un peu plus longtemps
    if (/\b(1er|premier) cru\b/.test(a) && !info.key.includes("cru")) return [r[0] + 2, r[1] + 3];
    if (vv) return [r[0] + 2, r[1] + 2];
    return r;
  }
  return w.color === "R" ? [8, 12] : [5, 8];
}
function gardeMaxHTML(w) {
  const [m, n] = gardeMax(w);
  const when = w.vintage ? `jusqu'en ${w.vintage + m} – ${w.vintage + n}` : "après le millésime";
  const late = w.vintage && YEAR > w.vintage + n;
  return `<div class="gmax${late ? " late" : ""}"><span>Garde maximale</span><b>${m} à ${n} ans</b><em>${when}</em></div>`;
}
const drinkable = (w) => ["ready", "soon", "late"].includes(status(w).k);
const priority = (w) => ["soon", "late"].includes(status(w).k);

function matchesFilter(w) {
  if (ui.filter === "B" || ui.filter === "R") return w.color === ui.filter;
  if (ui.filter === "drink") return drinkable(w);
  return true;
}
function matchesQuery(w) {
  if (!ui.q) return true;
  const hay = norm([w.domaine, w.appellation, w.cuvee, w.vintage, w.region, COLORS[w.color]?.label].join(" "));
  return norm(ui.q).split(/\s+/).every((t) => hay.includes(t));
}

const regionOf = (w) => w.region || appellationInfo(w.appellation)?.region || "";
const parseDate = (s) => new Date(String(s).length === 10 ? s + "T12:00" : s);
const cap1 = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const addedLabel = (w) => (w.added ? cap1(parseDate(w.added).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })) : "Date inconnue");
const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const SORTS = { domaine: "domaine", millesime: "millésime", region: "région", obtention: "date d'obtention", couleur: "couleur", garde: "urgence" };
// nom du groupe (= de la clayette) d'une bouteille selon le rangement choisi
function groupLabel(w) {
  switch (ui.sort) {
    case "couleur": return COLORS[w.color].label + "s";
    case "millesime": return w.vintage ? String(w.vintage) : "Non millésimé";
    case "region": return regionOf(w) || "Région non renseignée";
    case "obtention": return addedLabel(w);
    case "garde": return { late: "À boire sans tarder", soon: "À boire cette année", ready: "Prêts à boire", young: "En garde", none: "Garde non renseignée" }[status(w).k];
    default: return w.domaine;
  }
}
function groupsOf(list) {
  const g = new Map();
  for (const w of list) { const k = groupLabel(w); if (!g.has(k)) g.set(k, []); g.get(k).push(w); }
  return g;
}
function sorted(list) {
  const by = {
    region: (a, b) => (regionOf(a) || "~").localeCompare(regionOf(b) || "~") || a.domaine.localeCompare(b.domaine) || (a.vintage || 9999) - (b.vintage || 9999),
    obtention: (a, b) => (b.added || "").localeCompare(a.added || "") || a.domaine.localeCompare(b.domaine),
    domaine: (a, b) => a.domaine.localeCompare(b.domaine) || a.appellation.localeCompare(b.appellation) || (a.cuvee || "").localeCompare(b.cuvee || "") || (a.vintage || 9999) - (b.vintage || 9999),
    couleur: (a, b) => a.color.localeCompare(b.color) || a.domaine.localeCompare(b.domaine) || (a.vintage || 9999) - (b.vintage || 9999),
    millesime: (a, b) => (a.vintage || 9999) - (b.vintage || 9999) || a.domaine.localeCompare(b.domaine),
    garde: (a, b) => status(a).rank - status(b).rank || (a.garde?.[1] || 9999) - (b.garde?.[1] || 9999),
  }[ui.sort];
  return [...list].sort(by);
}
// pour la 3D : un groupe par clayette, une entrée par bouteille
const layout = () => [...groupsOf(sorted(state.wines))].map(([label, ws]) => ({ label, items: ws.flatMap((w) => Array.from({ length: w.qty }, () => w)) }));

/* ————————————————— Souvenirs ————————————————— */
const memById = (id) => state.history.find((m) => m.id === id);
const fmtShort = (s) => parseDate(s).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }).replace(".", "");
const fmtLong = (s) => cap1(parseDate(s).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
const yearOf = (m) => parseDate(m.date).getFullYear();
// une étagère par année, la plus récente en haut ; dans l'année, de la plus ancienne à la plus récente
function memRows() {
  const byYear = new Map();
  for (const m of [...state.history].sort((a, b) => parseDate(a.date) - parseDate(b.date))) {
    const y = yearOf(m);
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(m);
  }
  return [...byYear].sort((a, b) => b[0] - a[0]).map(([y, ms]) => ({ label: String(y), items: ms.map((m) => ({ id: m.id, w: m.wine, tag: fmtShort(m.date) })) }));
}
// les personnes déjà croisées, les plus fréquentes d'abord
function knownPeople() {
  const n = new Map();
  for (const m of state.history) for (const p of m.with || []) n.set(p, (n.get(p) || 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1]).map(([p]) => p);
}

/* ————————————————— Navigation (bouton retour du téléphone) ————————————————— */
const stack = [];
let afterPop = null;
function push(onPop) { stack.push(onPop); history.pushState({ depth: stack.length }, ""); }
function back(then) { if (!stack.length) { then?.(); return; } afterPop = then || null; history.back(); }
function neutralizeTop() { if (stack.length) stack[stack.length - 1] = () => {}; }
window.addEventListener("popstate", () => {
  const fn = stack.pop();
  fn?.();
  const t = afterPop; afterPop = null; t?.();
});

/* ————————————————— Scène 3D ————————————————— */
let S = null;
const setMode = (m) => { document.body.dataset.mode = m; };
const mode = () => document.body.dataset.mode;

// Photos d'étiquettes rangées sur l'appareil ; celles des bouteilles disparues sont supprimées
async function loadPhotos() {
  try {
    const all = await Photos.all();
    const ids = new Set([...state.wines, ...state.history.map((m) => m.wine)].filter((w) => w?.photo).map((w) => w.id));
    await Promise.all([...all].map(async ([id, blob]) => {
      if (!ids.has(id)) { await Photos.del(id); return; }
      try { PHOTOS.set(id, await Photos.blobToImage(blob)); } catch {}
    }));
  } catch {}
}

async function boot() {
  renderStats();
  renderList();
  const photosReady = loadPhotos();
  try {
    S = await import("./scene.js");
    await S.init($("#scene"), {
      labelsEl: $("#cab-labels"),
      onCabinetTap: (c) => enterCabinet(c),
      onBottleTap: (id, idx) => openBottle(id, idx),
      onMemoryTap: (id) => openMemory(id),
      onBackgroundTap: () => { if (mode() === "bottle" || mode() === "memory") back(); },
      onCabinets: renderCabNav,
      onCabinet: (c) => $$("#cab-nav button").forEach((b) => b.classList.toggle("on", +b.dataset.c === c)),
    });
    await photosReady;
    S.setWines(layout());
    S.setFilter(matchesFilter);
    S.setMemories(memRows());
    renderMemBar();
    await new Promise((r) => setTimeout(r, 350));
    setMode("overview");
  } catch (e) {
    console.error(e);
    S = null;
    setMode("fallback");
  }
  checkSeed();
}

function refreshScene(animate = false) {
  renderMemBar();
  if (!S) return;
  S.setWines(layout(), { animate });
  S.setFilter(matchesFilter);
  S.setMemories(memRows());
}

async function enterCabinet(c = 0) {
  if (!S || mode() !== "overview") return;
  setMode("cabinet");
  push(exitCabinet);
  showHint();
  await S.toCabinet(c);
}
// Plusieurs caves : une pastille par cave pour voyager de l'une à l'autre
function renderCabNav(list) {
  const nav = $("#cab-nav");
  nav.innerHTML = list.length > 1 ? list.map((c) => `
    <button data-c="${c.c}"><b>${c.c + 1}</b><span>${esc(c.title)}</span></button>`).join("") : "";
  nav.classList.toggle("multi", list.length > 1);
}
$("#cab-nav").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-c]");
  if (b) S?.goToCabinet(+b.dataset.c);
});
$("#cab-labels").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-c]");
  if (b) enterCabinet(+b.dataset.c);
});

// Ranger la cave : les bouteilles glissent jusqu'à leurs nouvelles clayettes
function setSort(k) {
  if (!SORTS[k] || ui.sort === k) return;
  ui.sort = k;
  $("#sort").value = k;
  $$("#sort-pop button").forEach((b) => b.classList.toggle("on", b.dataset.sort === k));
  renderList();
  refreshScene(true);
  toast(`Rangée par ${SORTS[k]}`);
}
const sortPop = $("#sort-pop");
$("#btn-sort").onclick = (e) => { e.stopPropagation(); sortPop.classList.toggle("on"); };
sortPop.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-sort]");
  if (!b) return;
  sortPop.classList.remove("on");
  setSort(b.dataset.sort);
});
document.addEventListener("pointerdown", (e) => { if (!e.target.closest("#sort-pop, #btn-sort")) sortPop.classList.remove("on"); });

/* Cave des souvenirs */
let memFrom = "overview";
async function openMemories() {
  if (!S) { openList("mem"); return; }
  if (mode() !== "overview" && mode() !== "cabinet") return;
  memFrom = mode();
  sortPop.classList.remove("on");
  renderMemBar();
  setMode("memories");
  push(closeMemories);
  await S.toMemories();
}
function closeMemories() {
  setMode(memFrom);
  S?.leaveMemories();
}
function renderMemBar() {
  const rows = memRows(), n = state.history.length;
  $("#mem-count").textContent = n ? `${n} bouteille${n > 1 ? "s" : ""} partagée${n > 1 ? "s" : ""}` : "Aucune bouteille pour l'instant";
  $("#mem-years").innerHTML = rows.length > 1 ? rows.map((r, i) => `<button data-row="${i}" class="${i ? "" : "on"}">${r.label}</button>`).join("") : "";
  $("#mem-years").hidden = rows.length < 2;
  $("#mem-empty").hidden = n > 0;
}
$("#mem-years").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-row]");
  if (!b) return;
  $$("#mem-years button").forEach((x) => x.classList.toggle("on", x === b));
  S?.goToMemRow(+b.dataset.row);
});
async function openMemory(id) {
  const m = memById(id);
  if (!m || !S || mode() !== "memories") return;
  renderMemoryDetail(m);
  setMode("memory");
  push(closeMemory);
  await S.focusMemory(id);
}
let memDirty = false;
function closeMemory() {
  setMode("memories");
  S?.unfocus().then(() => { if (memDirty) { memDirty = false; S.setMemories(memRows()); renderMemBar(); } });
}
function exitCabinet() {
  setMode("overview");
  S?.toOverview();
}

let hintTimer;
function showHint() {
  const h = $("#cab-hint");
  h.classList.remove("gone");
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => h.classList.add("gone"), 4200);
}

async function openBottle(id, idx) {
  const w = byId(id);
  if (!w || !S) return;
  if (mode() === "overview") { setMode("cabinet"); push(exitCabinet); }
  if (mode() === "bottle") return;
  renderDetail(w);
  setMode("bottle");
  push(closeBottle);
  await S.focus(id, idx);
}
function closeBottle() {
  setMode("cabinet");
  S?.unfocus();
}

/* ————————————————— Éléments d'interface communs ————————————————— */
const svg = (d, s = 18, w = 1.7) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>', 18, 1.8),
  glass: svg('<path d="M8 3h8l-.6 6a3.4 3.4 0 0 1-6.8 0zM12 13v7M8.5 21h7"/>', 18, 1.9),
  edit: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>'),
  remove: svg('<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12h7"/>'),
  trash: svg('<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/>'),
  camera: svg('<path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', 22, 1.5),
  redo: svg('<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v4.5h-4.5"/>', 16),
  export: svg('<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 14v5h14v-5"/>'),
  import: svg('<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 14v5h14v-5"/>'),
  reset: svg('<path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4.5h4.5"/>'),
  chev: svg('<path d="M9 6l6 6-6 6"/>', 16),
  mem: svg('<path d="M7 3h10l-.5 5.5a4.5 4.5 0 0 1-9 0zM12 13v8M8.5 21h7"/>'),
};
const RATING = ["", "Décevant", "Correct", "Bon", "Très bon", "Mémorable"];
// en-tête des feuilles : petit titre doré, grand titre, sous-titre et bouton fermer
const sheetHead = (kicker, h, sub = "") => `
  <header class="sh-head">
    <div><span class="kicker">${kicker}</span><h2>${h}</h2>${sub ? `<p>${sub}</p>` : ""}</div>
    <button type="button" class="round sh-close" data-close aria-label="Fermer">${ICON.close}</button>
  </header>`;

// Boîte de confirmation (remplace confirm()) : renvoie la valeur du bouton choisi, ou null
function ask({ kicker = "", title: h, text = "", buttons }) {
  const el = $("#ask");
  return new Promise((resolve) => {
    el.innerHTML = `<div class="ask-card" role="alertdialog" aria-modal="true" aria-label="${esc(h)}">
      ${kicker ? `<span class="kicker">${kicker}</span>` : ""}<h3>${h}</h3>${text ? `<p>${text}</p>` : ""}
      <div class="ask-btns">${buttons.map((b, i) => `<button type="button" class="btn ${b.cls || "btn-ghost"}" data-i="${i}">${b.label}</button>`).join("")}</div>
    </div>`;
    requestAnimationFrame(() => el.classList.add("on"));
    const done = (v) => {
      el.classList.remove("on");
      document.removeEventListener("keydown", key, true);
      el.onclick = null;
      resolve(v);
    };
    const key = (e) => { if (e.key === "Escape") { e.stopImmediatePropagation(); done(null); } };
    document.addEventListener("keydown", key, true);
    el.onclick = (e) => {
      const b = e.target.closest("[data-i]");
      if (b) done(buttons[+b.dataset.i].value ?? null);
      else if (e.target === el) done(null);
    };
  });
}

/* ————————————————— Rendu UI ————————————————— */
function renderStats() {
  const n = (f) => state.wines.filter(f).reduce((s, w) => s + w.qty, 0);
  $("#stats").innerHTML = `
    <div><b>${n(() => true)}</b><span>bouteilles</span></div>
    <span class="sep"></span>
    <div><b>${n((w) => w.color === "B")}</b><span><i style="background:var(--blanc)"></i>blancs</span></div>
    <div><b>${n((w) => w.color === "R")}</b><span><i style="background:var(--rouge)"></i>rouges</span></div>
    <span class="sep"></span>
    <div><b>${n(priority)}</b><span><i style="background:var(--warn)"></i>à boire vite</span></div>
    <div><b>${state.history.length}</b><span>souvenirs</span></div>`;
}

let listKind = "cave";
function renderList() {
  if (listKind === "mem") { renderMemList(); return; }
  const list = sorted(state.wines.filter((w) => matchesQuery(w)));
  if (!list.length) { $("#list").innerHTML = `<div class="empty-state">Aucune bouteille ne correspond.</div>`; return; }
  const groups = groupsOf(list);
  let html = "";
  for (const [k, ws] of groups) {
    const n = ws.reduce((s, w) => s + w.qty, 0);
    html += `<div class="group"><h3>${esc(k)}<small>${n} bouteille${n > 1 ? "s" : ""}</small></h3>`;
    for (const w of ws) {
      const st = status(w);
      html += `<button class="card" data-id="${w.id}">
        <span class="bar" style="background:${COLORS[w.color]?.dot}"></span>
        <div><div class="t">${esc(fullName(w))}</div>
          <div class="s">${ui.sort === "domaine" ? "" : `<span>${esc(w.domaine)}</span>`}<span class="pill st-${st.k}">${esc(st.t.split(" · ")[0])}</span></div></div>
        <div class="r"><div class="y">${esc(vintageTxt(w))}</div><div class="q">× ${w.qty}</div></div>
      </button>`;
    }
    html += `</div>`;
  }
  $("#list").innerHTML = html;
}
function renderMemList() {
  const q = norm(ui.q).split(/\s+/).filter(Boolean);
  const list = [...state.history].sort((a, b) => parseDate(b.date) - parseDate(a.date)).filter((m) => {
    const w = m.wine, hay = norm([w.domaine, w.appellation, w.cuvee, w.vintage, ...(m.with || []), m.context, m.place, m.note, yearOf(m)].join(" "));
    return q.every((t) => hay.includes(t));
  });
  if (!list.length) { $("#list").innerHTML = `<div class="empty-state">${state.history.length ? "Aucun souvenir ne correspond." : "Les bouteilles débouchées viendront ici."}</div>`; return; }
  const groups = new Map();
  for (const m of list) { const y = yearOf(m); if (!groups.has(y)) groups.set(y, []); groups.get(y).push(m); }
  let html = "";
  for (const [y, ms] of groups) {
    html += `<div class="group"><h3>${y}<small>${ms.length} bouteille${ms.length > 1 ? "s" : ""}</small></h3>`;
    for (const m of ms) {
      const w = m.wine, who = (m.with || []).join(", ");
      html += `<button class="card mem-card" data-mem="${m.id}">
        <span class="bar" style="background:${COLORS[w.color]?.dot}"></span>
        <div><div class="t">${esc(fullName(w))} <span class="v">${esc(vintageTxt(w))}</span></div>
          <div class="s"><span>${esc(w.domaine)}</span>${who ? `<span>avec ${esc(who)}</span>` : ""}${m.context ? `<span>${esc(m.context)}</span>` : ""}</div></div>
        <div class="r"><div class="d">${esc(fmtShort(m.date))}</div>${m.rating ? `<div class="q">${"★".repeat(m.rating)}</div>` : ""}</div>
      </button>`;
    }
    html += `</div>`;
  }
  $("#list").innerHTML = html;
}

function timelineHTML(w) {
  const [a, b] = w.garde;
  const max = w.vintage ? w.vintage + gardeMax(w)[1] : b;
  const lo = Math.min(w.vintage || a, YEAR), hi = Math.max(b, max, YEAR) + 1;
  const pct = (y) => ((y - lo) / (hi - lo)) * 100;
  return `<div class="timeline">
      ${max > b ? `<div class="max" style="left:${pct(b + 1)}%;width:${pct(max + 1) - pct(b + 1)}%"></div>` : ""}
      <div class="win" style="left:${pct(a)}%;width:${pct(b + 1) - pct(a)}%"></div>
      <div class="now" style="left:calc(${pct(YEAR + 0.5)}% - 1px)"></div>
    </div>
    <div class="tl-scale"><span>${lo}</span><span>Apogée ${a} – ${b}</span><span>${hi}</span></div>`;
}

// en-tête commun aux fiches : domaine, nom, appellation, puis la fiche technique
function wineHead(w, extra = "") {
  const c = COLORS[w.color] || {};
  return `
    <button class="round close" id="d-close" aria-label="Fermer">${ICON.close}</button>
    <header class="d-head rise">
      <span class="kicker">${esc(w.domaine)}</span>
      <h2 class="d-title">${esc(title(w))}</h2>
      ${subtitle(w) ? `<div class="d-sub">${esc(subtitle(w))}</div>` : ""}
    </header>
    <dl class="specs rise" style="animation-delay:.06s">
      <div><dt>Millésime</dt><dd>${w.vintage ? esc(w.vintage) : "<em>NM</em>"}</dd></div>
      <div><dt>Couleur</dt><dd><i class="dot" style="background:${c.dot}"></i>${esc(c.label || "")}</dd></div>
      <div><dt>Région</dt><dd>${regionOf(w) ? esc(regionOf(w)) : "<em>—</em>"}</dd></div>
      ${extra}
    </dl>`;
}

function renderDetail(w) {
  const st = status(w);
  const d = $("#detail");
  const garde = w.garde && w.garde[0];
  d.innerHTML = `
    ${wineHead(w)}
    <section class="d-cellar rise" style="animation-delay:.12s">
      <div class="d-count"><b>${w.qty}</b><span>bouteille${w.qty > 1 ? "s" : ""}<br>en cave</span></div>
      <div class="d-state">
        <span class="pill st-${st.k}">${esc(st.t.split(" · ")[0])}</span>
        <small>${w.added ? "Entrée en cave " + esc(parseDate(w.added).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })) : "Date d'entrée non renseignée"}</small>
      </div>
    </section>
    <button class="btn btn-wine btn-lg rise" style="animation-delay:.16s" id="d-drink">${ICON.glass}Déboucher cette bouteille</button>
    <div class="d-actions rise" style="animation-delay:.2s">
      <button id="d-edit">${ICON.edit}<span><b>Modifier</b><small>la fiche</small></span></button>
      <button id="d-remove">${ICON.remove}<span><b>Retirer</b><small>sans souvenir</small></span></button>
    </div>
    <section class="d-sec rise" style="animation-delay:.24s">
      <h4>Dégustation</h4>
      ${garde ? `<div class="block-h"><span>Apogée</span><span class="st-${st.k}">${esc(st.t)}</span></div>${timelineHTML(w)}` : ""}
      ${gardeMaxHTML(w)}
    </section>
    <section class="d-sec rise" style="animation-delay:.28s">
      <h4>Notes</h4>
      <textarea class="notes" id="d-notes" rows="3" placeholder="Accords, impressions, à qui la faire goûter…">${esc(w.notes)}</textarea>
    </section>`;
  d.scrollTop = 0;
  $("#d-notes").addEventListener("change", (e) => { w.notes = e.target.value; save(); });
  $("#d-close").onclick = () => back();
  $("#d-edit").onclick = () => openForm(w);
  $("#d-drink").onclick = () => openDrinkForm(w);
  $("#d-remove").onclick = () => removeWithoutMemory(w);
}

// Erreur de saisie, bouteille offerte, cassée… : elle quitte la cave sans passer par les Souvenirs
async function removeWithoutMemory(w) {
  const name = `${esc(title(w))} ${esc(vintageTxt(w))}`;
  const v = await ask({
    kicker: "Retirer sans souvenir",
    title: name,
    text: "La bouteille quitte la cave sans rejoindre les Souvenirs — pratique après une erreur de saisie. Vous pourrez annuler juste après.",
    buttons: [
      ...(w.qty > 1 ? [{ label: "Retirer 1 bouteille", value: "one", cls: "btn-danger-solid" }, { label: `Retirer les ${w.qty}`, value: "all", cls: "btn-ghost danger" }]
        : [{ label: "Retirer la bouteille", value: "all", cls: "btn-danger-solid" }]),
      { label: "Annuler", value: null, cls: "btn-quiet" },
    ],
  });
  if (!v) return;
  const snapshot = structuredClone(state);
  const n = v === "one" ? 1 : w.qty;
  if (v === "one") w.qty -= 1;
  else state.wines = state.wines.filter((x) => x.id !== w.id);
  save();
  if (mode() === "bottle") {
    neutralizeTop();
    back();
    setMode("cabinet");
    await S?.dropFocused("away");
  }
  renderAll();
  toast(n > 1 ? `${n} bouteilles retirées` : `${name} retirée de la cave`, {
    label: "Annuler",
    fn: () => { state = snapshot; save(); renderAll(); toast("Bouteille remise en cave"); },
  });
}

// Fiche d'un souvenir (bouteille vide du mur des souvenirs)
function renderMemoryDetail(m) {
  const w = m.wine, d = $("#detail"), who = m.with || [];
  d.innerHTML = `
    ${wineHead(w)}
    <section class="m-when rise" style="animation-delay:.12s">
      <span class="lbl">Débouchée le</span>
      <b>${esc(fmtLong(m.date))}</b>
      ${m.rating ? `<div class="stars-ro" aria-label="${m.rating} sur 5">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= m.rating ? "on" : ""}">★</i>`).join("")}<span>${RATING[m.rating]}</span></div>` : ""}
    </section>
    <section class="d-sec rise" style="animation-delay:.18s">
      <h4>Avec</h4>
      ${who.length ? `<div class="people">${who.map((p) => `<span class="person"><i>${esc(initials(p))}</i>${esc(p)}</span>`).join("")}</div>` : `<em class="none">Personne n'a été noté</em>`}
    </section>
    ${m.context || m.place ? `<section class="d-sec rise" style="animation-delay:.22s">
      <h4>L'occasion</h4>
      <div class="ctx">${m.context ? `<span class="tag">${esc(m.context)}</span>` : ""}${m.place ? `<span class="place">${esc(m.place)}</span>` : ""}</div>
    </section>` : ""}
    ${m.note ? `<section class="d-sec rise" style="animation-delay:.26s"><h4>Souvenir</h4><blockquote class="mem-note">${esc(m.note)}</blockquote></section>` : ""}
    <div class="d-actions rise" style="animation-delay:.3s">
      <button id="m-edit">${ICON.edit}<span><b>Modifier</b><small>le souvenir</small></span></button>
      <button id="m-del">${ICON.trash}<span><b>Supprimer</b><small>le souvenir</small></span></button>
    </div>`;
  d.scrollTop = 0;
  $("#d-close").onclick = () => back();
  $("#m-edit").onclick = () => openDrinkForm(null, m);
  $("#m-del").onclick = async () => {
    const ok = await ask({
      kicker: "Supprimer le souvenir", title: `${esc(title(w))} ${esc(vintageTxt(w))}`,
      text: `La bouteille du ${esc(fmtShort(m.date))} quitte le mur des Souvenirs.`,
      buttons: [{ label: "Supprimer", value: 1, cls: "btn-danger-solid" }, { label: "Annuler", value: null, cls: "btn-quiet" }],
    });
    if (!ok) return;
    const snapshot = structuredClone(state);
    state.history = state.history.filter((x) => x.id !== m.id);
    save();
    neutralizeTop();
    back(() => {
      setMode("memories");
      S?.unfocus().then(() => { renderAll(); toast("Souvenir supprimé", { label: "Annuler", fn: () => { state = snapshot; save(); renderAll(); } }); });
    });
  };
}
const initials = (p) => p.split(/[\s-]+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase();

function renderAll() {
  renderStats();
  renderList();
  refreshScene();
}

/* ————————————————— Actions ————————————————— */
async function drink(w, memo = {}) {
  const snapshot = structuredClone(state);
  w.qty -= 1;
  const { qty, notes, garde, ...wine } = w;
  state.history.unshift({ id: uid(), date: memo.date || today(), with: memo.with || [], context: memo.context || "", place: memo.place || "", note: memo.note || "", rating: memo.rating || 0, wine: structuredClone(wine) });
  state.history = state.history.slice(0, 3000);
  if (w.qty <= 0) state.wines = state.wines.filter((x) => x.id !== w.id);
  save();
  neutralizeTop();
  back();
  setMode("cabinet");
  await S?.dropFocused();
  renderAll();
  toast(`Santé ! ${esc(title(w))} ${esc(vintageTxt(w))} rejoint vos souvenirs`, {
    label: "Annuler",
    fn: () => { state = snapshot; save(); renderAll(); toast("Bouteille remise en cave"); },
  });
}

/* ————————————————— Feuille du bas ————————————————— */
const sheet = $("#sheet"), scrim = $("#scrim"), body = $("#sheet-body");
function openSheet(html) {
  body.innerHTML = html;
  body.scrollTop = 0;
  $$("[data-close]", body).forEach((b) => (b.onclick = () => back()));
  sheet.classList.add("on"); scrim.classList.add("on");
  push(hideSheet);
}
function hideSheet() {
  sheet.classList.remove("on"); scrim.classList.remove("on");
  sheet.style.transform = "";
}
scrim.addEventListener("click", () => back());
document.addEventListener("keydown", (e) => { if (e.key === "Escape") back(); });
(() => {
  let y0 = null, dy = 0;
  const grab = $(".grab");
  grab.addEventListener("pointerdown", (e) => { grab.setPointerCapture(e.pointerId); y0 = e.clientY; dy = 0; sheet.classList.add("dragging"); });
  grab.addEventListener("pointermove", (e) => { if (y0 === null) return; dy = Math.max(0, e.clientY - y0); sheet.style.transform = `translateY(${dy}px)`; });
  const end = () => { if (y0 === null) return; sheet.classList.remove("dragging"); y0 = null; if (dy > 110) back(); else sheet.style.transform = ""; };
  grab.addEventListener("pointerup", end);
  grab.addEventListener("pointercancel", end);
})();

/* ————————————————— Toast ————————————————— */
let toastTimer;
function toast(msg, action) {
  const t = $("#toast");
  t.innerHTML = `<span>${msg}</span>${action ? `<button>${action.label}</button>` : ""}`;
  if (action) $("button", t).onclick = () => { t.classList.remove("on"); action.fn(); };
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), action ? 5500 : 2400);
}

/* ————————————————— Déboucher : avec qui, contexte, date ————————————————— */
const CONTEXTS = ["Dîner", "Déjeuner", "Apéritif", "En famille", "Entre amis", "En amoureux", "Anniversaire", "Fête", "Restaurant", "Dégustation"];
function openDrinkForm(w, m = null) {
  const edit = !!m, wine = edit ? m.wine : w;
  let rating = m?.rating || 0, context = m?.context || "";
  const people = knownPeople().slice(0, 14);
  const c = COLORS[wine.color] || {};
  openSheet(`
    <form class="form" id="dk">
      ${sheetHead(edit ? "Le souvenir" : "Déboucher", edit ? "Modifier le souvenir" : "Un moment à garder")}
      <div class="wine-chip"><i style="background:${c.dot}"></i><div><span>${esc(wine.domaine)}</span><b>${esc(fullName(wine))}</b></div><em>${esc(vintageTxt(wine))}</em></div>
      <fieldset class="grp"><legend>Quand</legend>
        <div class="grp-box"><label class="row"><span>Date</span><input type="date" name="date" required value="${esc((m?.date || today()).slice(0, 10))}" max="${today()}"></label></div>
      </fieldset>
      <fieldset class="grp"><legend>Avec qui</legend>
        <div class="grp-box"><label class="row"><span>Prénoms</span><input name="with" value="${esc((m?.with || []).join(", "))}" placeholder="Séparés par des virgules" autocomplete="off"></label></div>
        ${people.length ? `<div class="pick" id="dk-people">${people.map((p) => `<button type="button" data-p="${esc(p)}"><i>${esc(initials(p))}</i>${esc(p)}</button>`).join("")}</div>` : ""}
      </fieldset>
      <fieldset class="grp"><legend>L'occasion</legend>
        <div class="pick" id="dk-ctx">${CONTEXTS.map((x) => `<button type="button" data-c="${x}" class="${x === context ? "on" : ""}">${x}</button>`).join("")}</div>
        <div class="grp-box"><label class="row"><span>Lieu, plat, détail</span><input name="place" value="${esc(m?.place || "")}" placeholder="Facultatif" autocomplete="off"></label></div>
      </fieldset>
      <fieldset class="grp"><legend>Votre note</legend>
        <div class="rate"><div class="stars" id="dk-stars">${[1, 2, 3, 4, 5].map((i) => `<button type="button" data-r="${i}" aria-label="${i} sur 5">★</button>`).join("")}</div><span id="dk-rate"></span></div>
      </fieldset>
      <fieldset class="grp"><legend>Un mot</legend>
        <div class="grp-box"><label class="row"><textarea name="note" rows="3" placeholder="Ce qu'on a mangé, ce qu'on a ressenti…">${esc(m?.note || "")}</textarea></label></div>
      </fieldset>
      <div class="sh-foot"><button class="btn btn-wine btn-lg" type="submit">${edit ? "Enregistrer le souvenir" : `${ICON.glass}Déboucher et garder le souvenir`}</button></div>
    </form>`);
  const f = $("#dk"), withIn = f.elements.with;
  const names = () => withIn.value.split(",").map((x) => x.trim()).filter(Boolean);
  const syncPeople = () => { const n = names(); $$("#dk-people button", f).forEach((b) => b.classList.toggle("on", n.includes(b.dataset.p))); };
  $$("#dk-people button", f).forEach((b) => (b.onclick = () => {
    const n = names(), p = b.dataset.p;
    withIn.value = (n.includes(p) ? n.filter((x) => x !== p) : [...n, p]).join(", ");
    syncPeople();
  }));
  withIn.addEventListener("input", syncPeople);
  syncPeople();
  $$("#dk-ctx button", f).forEach((b) => (b.onclick = () => {
    context = context === b.dataset.c ? "" : b.dataset.c;
    $$("#dk-ctx button", f).forEach((x) => x.classList.toggle("on", x.dataset.c === context));
  }));
  const paint = () => {
    $$("#dk-stars button", f).forEach((b) => b.classList.toggle("on", +b.dataset.r <= rating));
    $("#dk-rate").textContent = RATING[rating] || "Touchez pour noter";
  };
  $$("#dk-stars button", f).forEach((b) => (b.onclick = () => { rating = rating === +b.dataset.r ? 0 : +b.dataset.r; paint(); }));
  paint();
  f.onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(f);
    const memo = { date: fd.get("date") || today(), with: names(), context, place: fd.get("place").trim(), rating, note: fd.get("note").trim() };
    if (edit) {
      Object.assign(m, memo);
      save();
      // la bouteille est sortie : le mur sera reconstruit quand elle reprendra sa place
      memDirty = true;
      back(() => { renderMemoryDetail(m); renderList(); renderMemBar(); toast("Souvenir enregistré"); });
    } else {
      back(() => drink(w, memo));
    }
  };
}

/* ————————————————— Recadrage de l'étiquette ————————————————— */
// Plein écran : on place soi-même les 4 coins de l'étiquette (+ 2 poignées au milieu
// des bords du haut et du bas pour suivre la courbure), puis elle est mise à plat.
function cropLabel(file) {
  return new Promise(async (resolve) => {
    let src;
    try { src = await Photos.loadPhoto(file); } catch { toast("Photo illisible"); resolve(null); return; }
    let curved = true, done = false;
    const el = document.createElement("div");
    el.className = "crop";
    el.innerHTML = `
      <div class="crop-top">
        <button data-a="cancel">Annuler</button>
        <p>Placez les coins sur les bords de l'étiquette.<br>Les points du milieu suivent sa courbure.</p>
        <button data-a="rotate" aria-label="Tourner">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>
        </button>
      </div>
      <div class="crop-stage">
        <canvas class="src"></canvas>
        <svg><path fill="rgba(0,0,0,.55)" fill-rule="evenodd"/><path class="edge" fill="none" stroke="#fff" stroke-width="1.5"/></svg>
        ${["tl", "tm", "tr", "br", "bm", "bl"].map((k) => `<div class="crop-h${k[1] === "m" ? " mid" : ""}" data-k="${k}"></div>`).join("")}
        <canvas class="crop-loupe" width="232" height="232"></canvas>
      </div>
      <div class="crop-bottom">
        <div class="crop-seg">
          <button data-c="1" class="on">Sur la bouteille</button>
          <button data-c="0">Étiquette à plat</button>
        </div>
        <div class="crop-prev"><canvas></canvas><button class="btn btn-wine" data-a="ok">Valider</button></div>
      </div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("on"));
    const stage = $(".crop-stage", el), view = $("canvas.src", el), [shade, edge] = $$(".crop-stage svg path", el);
    const loupe = $(".crop-loupe", el), prev = $(".crop-prev canvas", el);
    let q, sc = 1, ox = 0, oy = 0;

    const reset = () => {
      const w = src.width, h = src.height;
      q = { tl: { x: w * .15, y: h * .25 }, tr: { x: w * .85, y: h * .25 }, bl: { x: w * .15, y: h * .75 }, br: { x: w * .85, y: h * .75 } };
      q.tm = { x: w / 2, y: h * .25 }; q.bm = { x: w / 2, y: h * .75 };
    };
    const layout = () => {
      const r = stage.getBoundingClientRect();
      sc = Math.min(r.width / src.width, r.height / src.height);
      const w = src.width * sc, h = src.height * sc;
      ox = (r.width - w) / 2; oy = (r.height - h) / 2;
      const dpr = Math.min(2, devicePixelRatio || 1);
      view.width = Math.round(w * dpr); view.height = Math.round(h * dpr);
      Object.assign(view.style, { left: ox + "px", top: oy + "px", width: w + "px", height: h + "px" });
      view.getContext("2d").drawImage(src, 0, 0, view.width, view.height);
      draw();
    };
    const P = (p) => [ox + p.x * sc, oy + p.y * sc];
    // bord courbe : courbe de Bézier qui passe par la poignée du milieu
    const curve = (a, m, b) => {
      const c = { x: 2 * m.x - (a.x + b.x) / 2, y: 2 * m.y - (a.y + b.y) / 2 };
      return `Q${P(c).join(" ")} ${P(b).join(" ")}`;
    };
    const draw = () => {
      const r = stage.getBoundingClientRect();
      const shape = `M${P(q.tl).join(" ")} ${curve(q.tl, q.tm, q.tr)} L${P(q.br).join(" ")} ${curve(q.br, q.bm, q.bl)} Z`;
      shade.setAttribute("d", `M0 0H${r.width}V${r.height}H0Z ${shape}`);
      edge.setAttribute("d", shape);
      for (const h of $$(".crop-h", el)) { const [x, y] = P(q[h.dataset.k]); h.style.left = x + "px"; h.style.top = y + "px"; }
    };
    const preview = () => {
      const { canvas } = Photos.unwrap(src, q, curved, 320);
      prev.width = canvas.width; prev.height = canvas.height;
      prev.getContext("2d").drawImage(canvas, 0, 0);
    };
    const showLoupe = (p) => {
      const [x, y] = P(p), R = 58, z = 2.6;
      const k = 1 / sc / z;   // pixels source par pixel de loupe
      loupe.style.display = "block";
      loupe.style.left = Math.max(-10, x - R) + "px";
      loupe.style.top = (y - R * 2 - 34 < 0 ? y + 34 : y - R * 2 - 34) + "px";
      const c = loupe.getContext("2d"), s = loupe.width;
      c.fillStyle = "#000"; c.fillRect(0, 0, s, s);
      c.drawImage(src, p.x - (R * k), p.y - (R * k), 2 * R * k, 2 * R * k, 0, 0, s, s);
      c.strokeStyle = "rgba(255,255,255,.9)"; c.lineWidth = 2;
      c.beginPath(); c.moveTo(s / 2, s / 2 - 18); c.lineTo(s / 2, s / 2 + 18); c.moveTo(s / 2 - 18, s / 2); c.lineTo(s / 2 + 18, s / 2); c.stroke();
    };

    // glisser une poignée (décalage conservé : la poignée ne saute pas sous le doigt)
    for (const h of $$(".crop-h", el)) {
      let d = null;
      h.addEventListener("pointerdown", (e) => {
        e.preventDefault(); try { h.setPointerCapture(e.pointerId); } catch {}
        h.classList.add("active");
        const p = q[h.dataset.k];
        d = { x: e.clientX, y: e.clientY, px: p.x, py: p.y };
        showLoupe(p);
      });
      h.addEventListener("pointermove", (e) => {
        if (!d) return;
        const k = h.dataset.k, p = q[k];
        const nx = Math.max(0, Math.min(src.width, d.px + (e.clientX - d.x) / sc));
        const ny = Math.max(0, Math.min(src.height, d.py + (e.clientY - d.y) / sc));
        const dx = nx - p.x, dy = ny - p.y;
        p.x = nx; p.y = ny;
        // un coin entraîne la moitié de la poignée du milieu de son bord
        if (k[1] !== "m") { const m = q[k[0] + "m"]; m.x += dx / 2; m.y += dy / 2; }
        draw(); showLoupe(p);
      });
      const end = () => { if (!d) return; d = null; h.classList.remove("active"); loupe.style.display = "none"; preview(); };
      h.addEventListener("pointerup", end);
      h.addEventListener("pointercancel", end);
    }

    const close = (result) => {
      if (done) return;
      done = true;
      window.removeEventListener("resize", layout);
      el.classList.remove("on");
      setTimeout(() => el.remove(), 260);
      resolve(result);
    };
    push(() => close(null));   // bouton retour du téléphone = annuler
    el.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.a === "cancel") back();
      else if (b.dataset.a === "rotate") { src = Photos.rotate90(src); reset(); layout(); preview(); }
      else if (b.dataset.c) {
        curved = b.dataset.c === "1";
        $$(".crop-seg button", el).forEach((x) => x.classList.toggle("on", x === b));
        preview();
      } else if (b.dataset.a === "ok") {
        const { canvas, ratio } = Photos.unwrap(src, q, curved, 1100);
        Photos.autoLevels(canvas);
        neutralizeTop(); back();
        close({ canvas, ratio });
      }
    });
    window.addEventListener("resize", layout);
    reset();
    requestAnimationFrame(() => { layout(); preview(); });
  });
}

/* ————————————————— Formulaire ————————————————— */
function openForm(w) {
  const isNew = !w;
  const d = w || { domaine: "", appellation: "", cuvee: "", vintage: YEAR - 2, color: "R", qty: 1, region: "", garde: null, notes: "", added: today() };
  let color = d.color, qty = d.qty;
  // étiquette : null = inchangée, "remove" = retirée, { canvas, ratio } = nouvelle photo recadrée
  let photo = null;
  const hasPhoto = () => (photo && photo !== "remove") || (photo !== "remove" && w?.photo && PHOTOS.has(w.id));
  const uniq = (f) => [...new Set(state.wines.map(f).filter(Boolean))].sort();
  const apps = [...new Set([...uniq((x) => x.appellation), ...APPELLATION_NAMES])];
  openSheet(`
    <form class="form" id="f">
      ${sheetHead(isNew ? "Ajouter à la cave" : esc(d.domaine), isNew ? "Nouvelle bouteille" : "Modifier la fiche")}
      <section class="lab-hero" id="f-hero">
        <button type="button" class="lab-thumb" id="f-thumb" aria-label="Photographier l'étiquette"></button>
        <div class="lab-side">
          <b id="f-lab-t"></b>
          <span id="f-lab-s"></span>
          <div class="lab-actions">
            <button type="button" class="mini" id="f-photo"></button>
            <button type="button" class="mini danger" id="f-photo-del">Retirer</button>
          </div>
        </div>
        <input type="file" id="f-file" accept="image/*" hidden>
      </section>
      <fieldset class="grp"><legend>Le vin</legend>
        <div class="grp-box">
          <label class="row"><span>Domaine</span><input name="domaine" list="dl-dom" required value="${esc(d.domaine)}" placeholder="Château, domaine…" autocomplete="off"></label>
          <label class="row"><span>Appellation</span><input name="appellation" list="dl-app" required value="${esc(d.appellation)}" placeholder="Pommard, Sancerre…" autocomplete="off"></label>
          <label class="row"><span>Cuvée</span><input name="cuvee" value="${esc(d.cuvee)}" placeholder="Facultatif" autocomplete="off"></label>
          <div class="row2">
            <label class="row"><span>Millésime</span><input name="vintage" type="number" inputmode="numeric" min="1900" max="2100" value="${esc(d.vintage ?? "")}" placeholder="Non millésimé"></label>
            <label class="row"><span>Région</span><input name="region" list="dl-reg" value="${esc(d.region)}" placeholder="Automatique" autocomplete="off"></label>
          </div>
        </div>
        <p class="grp-hint" id="f-app-hint"></p>
      </fieldset>
      <fieldset class="grp"><legend>Robe et bouteille</legend>
        <div class="seg color-pick">
          <button type="button" data-c="B" class="${color === "B" ? "on" : ""}"><i style="background:var(--blanc)"></i>Blanc</button>
          <button type="button" data-c="R" class="${color === "R" ? "on" : ""}"><i style="background:var(--rouge)"></i>Rouge</button>
        </div>
        <div class="grp-box">
          <label class="row"><span>Forme de la bouteille</span>
            <select name="bottle" id="f-bottle">
              <option value="">Automatique</option>
              ${Object.entries(SHAPE_NAMES).map(([k, v]) => `<option value="${k}"${d.bottle === k ? " selected" : ""}>${esc(v)}</option>`).join("")}
            </select>
          </label>
        </div>
      </fieldset>
      <fieldset class="grp"><legend>En cave</legend>
        <div class="grp-box">
          <div class="row row-inline"><span>Nombre de bouteilles</span>
            <div class="stepper"><button type="button" data-q="-1" aria-label="Une de moins">−</button><output id="f-qty">${qty}</output><button type="button" data-q="1" aria-label="Une de plus">+</button></div>
          </div>
          <label class="row"><span>Date d'obtention</span><input name="added" type="date" value="${esc(d.added || "")}" max="${today()}"></label>
        </div>
      </fieldset>
      <fieldset class="grp"><legend>À boire entre</legend>
        <div class="grp-box">
          <div class="row2">
            <label class="row"><span>De</span><input name="g0" type="number" inputmode="numeric" placeholder="Année" value="${esc(d.garde?.[0] ?? "")}"></label>
            <label class="row"><span>À</span><input name="g1" type="number" inputmode="numeric" placeholder="Année" value="${esc(d.garde?.[1] ?? "")}"></label>
          </div>
        </div>
        <p class="grp-hint">Facultatif : la garde maximale est estimée d'après l'appellation.</p>
      </fieldset>
      ${isNew ? "" : `<button class="link-danger" type="button" id="f-del">${ICON.trash}Supprimer cette fiche de la cave</button>`}
      <div class="sh-foot"><button class="btn btn-primary btn-lg" type="submit">${isNew ? "Ajouter à la cave" : "Enregistrer"}</button></div>
      <datalist id="dl-dom">${uniq((x) => x.domaine).map((x) => `<option value="${esc(x)}">`).join("")}</datalist>
      <datalist id="dl-app">${apps.map((x) => `<option value="${esc(x)}">`).join("")}</datalist>
      <datalist id="dl-reg">${uniq((x) => x.region).map((x) => `<option value="${esc(x)}">`).join("")}</datalist>
    </form>`);

  const f = $("#f");
  const setColor = (c) => {
    color = c;
    $$(".color-pick button", f).forEach((x) => x.classList.toggle("on", x.dataset.c === c));
  };
  let colorTouched = !isNew;
  $$(".color-pick button", f).forEach((b) => (b.onclick = () => { colorTouched = true; setColor(b.dataset.c); }));

  // Étiquette : vignette + boutons
  const renderPhoto = () => {
    const th = $("#f-thumb");
    th.innerHTML = "";
    if (photo && photo !== "remove") th.appendChild(photo.canvas);
    else if (hasPhoto()) { const c = PHOTOS.get(w.id); th.appendChild(c instanceof HTMLCanvasElement ? copyCanvas(c) : c.cloneNode()); }
    else th.innerHTML = ICON.camera;
    const has = hasPhoto();
    $("#f-hero").classList.toggle("has", has);
    $("#f-lab-t").textContent = has ? "Étiquette prête" : "L'étiquette";
    $("#f-lab-s").textContent = has ? "Elle habillera la bouteille dans la cave." : "Photographiez-la : elle sera mise à plat et posée sur la bouteille.";
    $("#f-photo").innerHTML = has ? `${ICON.redo}Reprendre` : `Prendre une photo`;
    $("#f-photo-del").hidden = !has;
  };
  renderPhoto();
  $("#f-photo").onclick = $("#f-thumb").onclick = () => { $("#f-file").value = ""; $("#f-file").click(); };
  $("#f-file").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const r = await cropLabel(file);
    if (r) { photo = r; renderPhoto(); }
  };
  $("#f-photo-del").onclick = () => { photo = "remove"; renderPhoto(); };

  // Appellation reconnue : région, couleur et forme se remplissent toutes seules
  const appIn = f.elements.appellation, regIn = f.elements.region, shapeSel = $("#f-bottle");
  let autoRegion = isNew ? "" : null;
  const onApp = () => {
    const info = appellationInfo(appIn.value);
    shapeSel.options[0].textContent = `Automatique — ${SHAPE_NAMES[info?.shape || "burgundy"]}`;
    $("#f-app-hint").innerHTML = info ? `<i></i>Appellation reconnue · ${esc(info.region)}` : "";
    if (!info) return;
    if (autoRegion !== null && (regIn.value === "" || regIn.value === autoRegion)) { regIn.value = info.region; autoRegion = info.region; }
    if (!colorTouched && info.color) setColor(info.color);
  };
  appIn.addEventListener("input", onApp);
  onApp();
  $$(".stepper button", f).forEach((b) => (b.onclick = () => {
    qty = Math.max(1, Math.min(99, qty + Number(b.dataset.q)));
    $("#f-qty").textContent = qty;
  }));

  // Ferme la feuille, puis la fiche bouteille si elle est ouverte, puis exécute `then`
  const leave = (then) => back(() => {
    if (mode() === "bottle") { neutralizeTop(); back(() => { setMode("cabinet"); then(); }); }
    else then();
  });

  let saving = false;
  f.onsubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    saving = true;
    const fd = new FormData(f);
    const num = (v) => (v === "" || v == null ? null : Number(v));
    const g0 = num(fd.get("g0")), g1 = num(fd.get("g1"));
    const data = {
      domaine: fd.get("domaine").trim(), appellation: fd.get("appellation").trim(), cuvee: fd.get("cuvee").trim(),
      vintage: num(fd.get("vintage")), region: fd.get("region").trim(), color, qty,
      garde: g0 && g1 ? [Math.min(g0, g1), Math.max(g0, g1)] : null,
      bottle: fd.get("bottle") || null,
      added: fd.get("added") || null,
    };
    const id = isNew ? uid() : w.id;
    // la photo est rangée sur l'appareil (IndexedDB), la fiche ne garde que sa version et ses proportions
    if (photo === "remove") {
      data.photo = null; PHOTOS.delete(id);
      Photos.del(id).catch(() => {});
    } else if (photo) {
      try {
        await Photos.put(id, await Photos.toBlob(photo.canvas));
        PHOTOS.set(id, photo.canvas);
        data.photo = { v: Date.now(), r: +photo.ratio.toFixed(4) };
      } catch { toast("La photo n'a pas pu être enregistrée"); }
    }
    if (isNew) state.wines.push({ id, notes: "", ...data });
    else Object.assign(w, data);
    save();
    leave(() => {
      renderAll();
      toast(isNew ? "Bouteille ajoutée" : "Modifications enregistrées");
      if (S && mode() !== "fallback") setTimeout(() => openBottle(id), 250);
    });
  };
  if (!isNew) $("#f-del").onclick = async () => {
    const ok = await ask({
      kicker: "Supprimer la fiche", title: `${esc(fullName(w))} ${esc(vintageTxt(w))}`,
      text: `${w.qty > 1 ? `Les ${w.qty} bouteilles quittent` : "La bouteille quitte"} la cave, sans rejoindre les Souvenirs.`,
      buttons: [{ label: "Supprimer", value: 1, cls: "btn-danger-solid" }, { label: "Annuler", value: null, cls: "btn-quiet" }],
    });
    if (!ok) return;
    const snapshot = structuredClone(state);
    state.wines = state.wines.filter((x) => x.id !== w.id);
    save();
    leave(() => {
      renderAll();
      toast("Bouteille retirée", { label: "Annuler", fn: () => { state = snapshot; save(); renderAll(); } });
    });
  };
}

/* ————————————————— Réglages ————————————————— */
function openSettings() {
  const h = [...state.history].sort((a, b) => parseDate(b.date) - parseDate(a.date)).slice(0, 5);
  const n = state.wines.reduce((s, w) => s + w.qty, 0);
  const item = (id, icon, t, s, cls = "") => `<button type="button" class="item ${cls}" id="${id}"><span class="ic">${icon}</span><span class="tx"><b>${t}</b><small>${s}</small></span>${ICON.chev}</button>`;
  openSheet(`
    <div class="settings">
      ${sheetHead("La cave de Camille", "Réglages", `${n} bouteille${n > 1 ? "s" : ""} en cave · ${state.history.length} souvenir${state.history.length > 1 ? "s" : ""}`)}
      <fieldset class="grp"><legend>Sauvegarde</legend>
        <div class="grp-box">
          ${item("s-export", ICON.export, "Exporter la cave", "Fichier .json avec les photos d'étiquettes")}
          ${item("s-import", ICON.import, "Importer une sauvegarde", "Remplace la cave de cet appareil")}
        </div>
        <p class="grp-hint">Les données restent sur cet appareil. Exportez de temps en temps pour les garder à l'abri ou les transférer.</p>
        <input type="file" id="s-file" accept="application/json,.json" hidden>
      </fieldset>
      <fieldset class="grp"><legend>Derniers souvenirs</legend>
        <div class="grp-box">
          ${h.length ? h.map((x) => `<div class="hist"><i style="background:${COLORS[x.wine.color]?.dot}"></i><span><b>${esc(fullName(x.wine))} ${esc(x.wine.vintage || "")}</b><small>${esc(x.wine.domaine)}${x.with?.length ? " · avec " + esc(x.with.join(", ")) : ""}</small></span><em>${esc(parseDate(x.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }))}</em></div>`).join("")
            : `<div class="hist empty">Aucune bouteille débouchée pour l'instant.</div>`}
          ${state.history.length ? item("s-mem", ICON.mem, "Voir tous les souvenirs", "Classés par année") : ""}
        </div>
      </fieldset>
      <fieldset class="grp"><legend>Inventaire</legend>
        <div class="grp-box">${item("s-reset", ICON.reset, "Revenir à l'inventaire initial", "Recharge la liste du fichier de départ", "danger")}</div>
      </fieldset>
    </div>`);
  if (state.history.length) $("#s-mem").onclick = () => back(() => openList("mem"));

  $("#s-export").onclick = async () => {
    const name = `cave-${new Date().toISOString().slice(0, 10)}.json`;
    // les photos d'étiquettes voyagent avec la sauvegarde
    const labels = {};
    for (const w of state.wines) {
      if (!w.photo) continue;
      try { const b = await Photos.get(w.id); if (b) labels[w.id] = await Photos.blobToDataURL(b); } catch {}
    }
    const blob = new Blob([JSON.stringify({ ...state, labels }, null, 2)], { type: "application/json" });
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
      state = { wines: data.wines.map((w) => ({ id: w.id || uid(), notes: "", ...w })), history: normHistory(data.history), seedHash: SEED_HASH };
      for (const [id, url] of Object.entries(data.labels || {})) {
        try { const b = await Photos.dataURLToBlob(url); await Photos.put(id, b); PHOTOS.set(id, await Photos.blobToImage(b)); } catch {}
      }
      save(); back(() => { renderAll(); toast("Sauvegarde importée"); });
    } catch { toast("Fichier invalide"); }
  };
  $("#s-reset").onclick = async () => {
    const ok = await ask({
      kicker: "Inventaire initial", title: "Remplacer la cave actuelle ?",
      text: "Les bouteilles de cet appareil sont remplacées par la liste de départ. Les souvenirs sont gardés.",
      buttons: [{ label: "Remplacer", value: 1, cls: "btn-danger-solid" }, { label: "Annuler", value: null, cls: "btn-quiet" }],
    });
    if (!ok) return;
    const snapshot = structuredClone(state);
    state = { ...fresh(), history: state.history }; save();
    back(() => { renderAll(); toast("Inventaire réinitialisé", { label: "Annuler", fn: () => { state = snapshot; save(); renderAll(); } }); });
  };
}

/* ————————————————— Inventaire ————————————————— */
function openList(kind) {
  listKind = kind || (mode() === "memories" ? "mem" : "cave");
  $("#list-title").textContent = listKind === "mem" ? "Souvenirs" : "Inventaire";
  $("#q").placeholder = listKind === "mem" ? "Vin, personne, occasion, année…" : "Domaine, appellation, millésime…";
  $(".sort").hidden = listKind === "mem";
  renderList();
  if (mode() === "fallback") { if (kind) toast("Souvenirs : " + state.history.length); return; }
  $("#list-panel").classList.add("on");
  push(() => { $("#list-panel").classList.remove("on"); listKind = "cave"; });
}
$("#btn-list").onclick = () => openList();
$("#btn-list-close").onclick = () => back();
$("#list").addEventListener("click", (e) => {
  const c = e.target.closest(".card");
  if (!c) return;
  if (c.dataset.mem) { back(() => openMemory(c.dataset.mem)); return; }
  if (mode() === "fallback") { const w = byId(c.dataset.id); if (w) openForm(w); return; }
  back(() => openBottle(c.dataset.id));
});
$("#q").addEventListener("input", (e) => { ui.q = e.target.value.trim(); renderList(); });
$("#sort").addEventListener("change", (e) => setSort(e.target.value));

/* ————————————————— Événements ————————————————— */
$("#btn-enter").onclick = () => enterCabinet(0);
$("#btn-back").onclick = () => back();
$("#btn-add").onclick = () => openForm(null);
$("#btn-settings").onclick = openSettings;
$("#tab-cave").onclick = () => {
  if (mode() === "memories") back();
  else if (mode() === "memory") back(() => back());
};
$("#tab-mem").onclick = () => openMemories();
$("#btn-mem-back").onclick = () => back();
$("#filters").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-filter]");
  if (!b) return;
  ui.filter = b.dataset.filter;
  $$("#filters button").forEach((x) => x.classList.toggle("on", x === b));
  S?.setFilter(matchesFilter);
});

// La liste de js/data.js a changé depuis la dernière visite : proposer de la charger
function checkSeed() {
  if (state.seedHash === SEED_HASH) return;
  const t = $("#toast");
  t.innerHTML = `<span>La liste de la cave a été mise à jour.</span><button id="seed-yes">Charger</button><button id="seed-no" style="color:#bfae9c">Ignorer</button>`;
  t.classList.add("on");
  $("#seed-yes").onclick = () => {
    const history = state.history;
    state = fresh(); state.history = history;
    save(); t.classList.remove("on"); renderAll(); toast("Nouvelle liste chargée");
  };
  $("#seed-no").onclick = () => { state.seedHash = SEED_HASH; save(); t.classList.remove("on"); };
}

boot();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
