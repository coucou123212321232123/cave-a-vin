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

function sorted(list) {
  const by = {
    domaine: (a, b) => a.domaine.localeCompare(b.domaine) || a.appellation.localeCompare(b.appellation) || (a.cuvee || "").localeCompare(b.cuvee || "") || (a.vintage || 9999) - (b.vintage || 9999),
    couleur: (a, b) => a.color.localeCompare(b.color) || a.domaine.localeCompare(b.domaine) || (a.vintage || 9999) - (b.vintage || 9999),
    millesime: (a, b) => (a.vintage || 9999) - (b.vintage || 9999) || a.domaine.localeCompare(b.domaine),
    garde: (a, b) => status(a).rank - status(b).rank || (a.garde?.[1] || 9999) - (b.garde?.[1] || 9999),
  }[ui.sort];
  return [...list].sort(by);
}
const layout = () => sorted(state.wines).flatMap((w) => Array.from({ length: w.qty }, () => ({ w })));

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
    const ids = new Set(state.wines.filter((w) => w.photo).map((w) => w.id));
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
      onCabinetTap: enterCabinet,
      onBottleTap: (id, idx) => openBottle(id, idx),
      onBackgroundTap: () => { if (mode() === "bottle") back(); },
    });
    await photosReady;
    S.setWines(layout());
    S.setFilter(matchesFilter);
    await new Promise((r) => setTimeout(r, 350));
    setMode("overview");
  } catch (e) {
    console.error(e);
    S = null;
    setMode("fallback");
  }
  checkSeed();
}

function refreshScene() {
  if (!S) return;
  S.setWines(layout());
  S.setFilter(matchesFilter);
}

async function enterCabinet() {
  if (!S || mode() !== "overview") return;
  setMode("cabinet");
  push(exitCabinet);
  showHint();
  await S.toCabinet();
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

/* ————————————————— Rendu UI ————————————————— */
function renderStats() {
  const n = (f) => state.wines.filter(f).reduce((s, w) => s + w.qty, 0);
  $("#stats").innerHTML = `
    <div><b>${n(() => true)}</b><span>bouteilles</span></div>
    <span class="sep"></span>
    <div><b>${n((w) => w.color === "B")}</b><span><i style="background:var(--blanc)"></i>blancs</span></div>
    <div><b>${n((w) => w.color === "R")}</b><span><i style="background:var(--rouge)"></i>rouges</span></div>
    <span class="sep"></span>
    <div><b>${n(priority)}</b><span><i style="background:var(--warn)"></i>à boire vite</span></div>`;
}

function renderList() {
  const list = sorted(state.wines.filter((w) => matchesQuery(w)));
  if (!list.length) { $("#list").innerHTML = `<div class="empty-state">Aucune bouteille ne correspond.</div>`; return; }
  const key = ui.sort === "couleur" ? (w) => COLORS[w.color].label + "s"
    : ui.sort === "millesime" ? (w) => (w.vintage ? String(w.vintage) : "Non millésimé")
    : ui.sort === "garde" ? (w) => ({ late: "À boire sans tarder", soon: "À boire cette année", ready: "Prêts à boire", young: "En garde", none: "Garde non renseignée" }[status(w).k])
    : (w) => w.domaine;
  const groups = new Map();
  for (const w of list) { const k = key(w); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(w); }
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

function renderDetail(w) {
  const st = status(w);
  const d = $("#detail");
  d.innerHTML = `
    <button class="round close" id="d-close" aria-label="Fermer">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>
    </button>
    <span class="kicker rise">${esc(w.domaine)}</span>
    <h2 class="d-title rise" style="animation-delay:.05s">${esc(title(w))}</h2>
    <div class="d-sub rise" style="animation-delay:.1s">${esc(subtitle(w))}</div>
    <div class="tags rise" style="animation-delay:.15s">
      <span class="tag"><i style="background:${COLORS[w.color]?.dot}"></i>${COLORS[w.color]?.label || ""}</span>
      <span class="tag">${w.vintage ? "Millésime " + esc(w.vintage) : "Millésime non renseigné"}</span>
      ${w.region ? `<span class="tag">${esc(w.region)}</span>` : ""}
    </div>
    <div class="block rise" style="animation-delay:.2s">
      <div class="count-row">
        <div><b>${w.qty}</b> <span>bouteille${w.qty > 1 ? "s" : ""} en cave</span></div>
        <span class="pill st-${st.k}">${esc(st.t.split(" · ")[0])}</span>
      </div>
      <button class="btn btn-wine mt" id="d-drink">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 3h8l-.6 6a3.4 3.4 0 0 1-6.8 0zM12 13v7M8.5 21h7"/></svg>
        Déboucher cette bouteille
      </button>
    </div>
    <div class="block rise" style="animation-delay:.25s">
      ${w.garde && w.garde[0] ? `<div class="block-h"><span>Fenêtre de dégustation</span><span class="st-${st.k}">${esc(st.t)}</span></div>${timelineHTML(w)}` : ""}
      ${gardeMaxHTML(w)}
    </div>
    <div class="block rise" style="animation-delay:.3s">
      <div class="block-h"><span>Notes</span></div>
      <textarea class="notes" id="d-notes" placeholder="Accords, souvenirs, occasion…">${esc(w.notes)}</textarea>
    </div>
    <div class="btn-row rise" style="animation-delay:.35s">
      <button class="btn btn-ghost" id="d-edit">Modifier</button>
      <button class="btn btn-ghost" id="d-back">Remettre en cave</button>
    </div>`;
  d.scrollTop = 0;
  $("#d-notes").addEventListener("change", (e) => { w.notes = e.target.value; save(); });
  $("#d-close").onclick = () => back();
  $("#d-back").onclick = () => back();
  $("#d-edit").onclick = () => openForm(w);
  $("#d-drink").onclick = () => drink(w);
}

function renderAll() {
  renderStats();
  renderList();
  refreshScene();
}

/* ————————————————— Actions ————————————————— */
async function drink(w) {
  const snapshot = structuredClone(state);
  w.qty -= 1;
  state.history.unshift({ name: fullName(w), domaine: w.domaine, vintage: w.vintage, color: w.color, date: new Date().toISOString() });
  state.history = state.history.slice(0, 200);
  if (w.qty <= 0) state.wines = state.wines.filter((x) => x.id !== w.id);
  save();
  neutralizeTop();
  back();
  setMode("cabinet");
  await S?.dropFocused();
  renderAll();
  toast(`Santé ! ${esc(title(w))} ${esc(vintageTxt(w))}`, {
    label: "Annuler",
    fn: () => { state = snapshot; save(); renderAll(); toast("Bouteille remise en cave"); },
  });
}

/* ————————————————— Feuille du bas ————————————————— */
const sheet = $("#sheet"), scrim = $("#scrim"), body = $("#sheet-body");
function openSheet(html) {
  body.innerHTML = html;
  body.scrollTop = 0;
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
  const d = w || { domaine: "", appellation: "", cuvee: "", vintage: YEAR - 2, color: "R", qty: 1, region: "", garde: null, notes: "" };
  let color = d.color, qty = d.qty;
  // étiquette : null = inchangée, "remove" = retirée, { canvas, ratio } = nouvelle photo recadrée
  let photo = null;
  const hasPhoto = () => (photo && photo !== "remove") || (photo !== "remove" && w?.photo && PHOTOS.has(w.id));
  const uniq = (f) => [...new Set(state.wines.map(f).filter(Boolean))].sort();
  const apps = [...new Set([...uniq((x) => x.appellation), ...APPELLATION_NAMES])];
  openSheet(`
    <form class="form" id="f">
      <h2>${isNew ? "Nouvelle bouteille" : "Modifier"}</h2>
      <div class="field"><label>Étiquette</label>
        <div class="lab-pick">
          <div class="lab-thumb" id="f-thumb"></div>
          <div class="lab-actions">
            <button type="button" class="btn btn-ghost" id="f-photo"></button>
            <button type="button" class="btn btn-danger" id="f-photo-del">Retirer la photo</button>
          </div>
        </div>
        <input type="file" id="f-file" accept="image/*" hidden>
      </div>
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
      <div class="field"><label>Forme de la bouteille</label>
        <select name="bottle" id="f-bottle">
          <option value="">Automatique</option>
          ${Object.entries(SHAPE_NAMES).map(([k, v]) => `<option value="${k}"${d.bottle === k ? " selected" : ""}>${esc(v)}</option>`).join("")}
        </select>
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
    else th.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>`;
    $("#f-photo").textContent = hasPhoto() ? "Reprendre la photo" : "Photographier l'étiquette";
    $("#f-photo-del").hidden = !hasPhoto();
  };
  renderPhoto();
  $("#f-photo").onclick = () => { $("#f-file").value = ""; $("#f-file").click(); };
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
  if (!isNew) $("#f-del").onclick = () => {
    if (!confirm(`Retirer « ${fullName(w)} ${vintageTxt(w)} » de la cave ?`)) return;
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
      state = { wines: data.wines.map((w) => ({ id: w.id || uid(), notes: "", ...w })), history: data.history || [], seedHash: SEED_HASH };
      for (const [id, url] of Object.entries(data.labels || {})) {
        try { const b = await Photos.dataURLToBlob(url); await Photos.put(id, b); PHOTOS.set(id, await Photos.blobToImage(b)); } catch {}
      }
      save(); back(() => { renderAll(); toast("Sauvegarde importée"); });
    } catch { toast("Fichier invalide"); }
  };
  $("#s-reset").onclick = () => {
    if (!confirm("Remplacer la cave actuelle par l'inventaire initial ?")) return;
    const snapshot = structuredClone(state);
    state = fresh(); save();
    back(() => { renderAll(); toast("Inventaire réinitialisé", { label: "Annuler", fn: () => { state = snapshot; save(); renderAll(); } }); });
  };
}

/* ————————————————— Inventaire ————————————————— */
function openList() {
  if (mode() === "fallback") return;
  $("#list-panel").classList.add("on");
  push(() => $("#list-panel").classList.remove("on"));
}
$("#btn-list").onclick = openList;
$("#btn-list-close").onclick = () => back();
$("#list").addEventListener("click", (e) => {
  const c = e.target.closest(".card");
  if (!c) return;
  if (mode() === "fallback") { const w = byId(c.dataset.id); if (w) openForm(w); return; }
  back(() => openBottle(c.dataset.id));
});
$("#q").addEventListener("input", (e) => { ui.q = e.target.value.trim(); renderList(); });
$("#sort").addEventListener("change", (e) => { ui.sort = e.target.value; renderList(); refreshScene(); });

/* ————————————————— Événements ————————————————— */
$("#btn-enter").onclick = enterCabinet;
$("#btn-back").onclick = () => back();
$("#btn-add").onclick = () => openForm(null);
$("#btn-settings").onclick = openSettings;
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
