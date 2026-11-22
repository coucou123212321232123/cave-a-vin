import { SEED } from "./data.js";

const STORE_KEY = "cave-camille-v1";
const YEAR = new Date().getFullYear();

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

async function boot() {
  renderStats();
  renderList();
  try {
    S = await import("./scene.js");
    await S.init($("#scene"), {
      onCabinetTap: enterCabinet,
      onBottleTap: (id, idx) => openBottle(id, idx),
      onBackgroundTap: () => { if (mode() === "bottle") back(); },
    });
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
  const lo = Math.min(w.vintage || a, YEAR), hi = Math.max(b, YEAR) + 1;
  const pct = (y) => ((y - lo) / (hi - lo)) * 100;
  return `<div class="timeline">
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
    ${w.garde && w.garde[0] ? `<div class="block rise" style="animation-delay:.25s"><div class="block-h"><span>Fenêtre de dégustation</span><span class="st-${st.k}">${esc(st.t)}</span></div>${timelineHTML(w)}</div>` : ""}
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

/* ————————————————— Formulaire ————————————————— */
function openForm(w) {
  const isNew = !w;
  const d = w || { domaine: "", appellation: "", cuvee: "", vintage: YEAR - 2, color: "R", qty: 1, region: "", garde: null, notes: "" };
  let color = d.color, qty = d.qty;
  const uniq = (f) => [...new Set(state.wines.map(f).filter(Boolean))].sort();
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
      <datalist id="dl-dom">${uniq((x) => x.domaine).map((x) => `<option value="${esc(x)}">`).join("")}</datalist>
      <datalist id="dl-app">${uniq((x) => x.appellation).map((x) => `<option value="${esc(x)}">`).join("")}</datalist>
      <datalist id="dl-reg">${uniq((x) => x.region).map((x) => `<option value="${esc(x)}">`).join("")}</datalist>
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

  // Ferme la feuille, puis la fiche bouteille si elle est ouverte, puis exécute `then`
  const leave = (then) => back(() => {
    if (mode() === "bottle") { neutralizeTop(); back(() => { setMode("cabinet"); then(); }); }
    else then();
  });

  f.onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(f);
    const num = (v) => (v === "" || v == null ? null : Number(v));
    const g0 = num(fd.get("g0")), g1 = num(fd.get("g1"));
    const data = {
      domaine: fd.get("domaine").trim(), appellation: fd.get("appellation").trim(), cuvee: fd.get("cuvee").trim(),
      vintage: num(fd.get("vintage")), region: fd.get("region").trim(), color, qty,
      garde: g0 && g1 ? [Math.min(g0, g1), Math.max(g0, g1)] : null,
    };
    let id;
    if (isNew) { id = uid(); state.wines.push({ id, notes: "", ...data }); }
    else { Object.assign(w, data); id = w.id; }
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
      state = { wines: data.wines.map((w) => ({ id: w.id || uid(), notes: "", ...w })), history: data.history || [], seedHash: SEED_HASH };
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
