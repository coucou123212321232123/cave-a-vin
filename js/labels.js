// Étiquettes et habillage des bouteilles, par domaine.
// Inspirés des vraies bouteilles (couleurs, mise en page, typographies) — dessinés sur canvas.

export const F = {
  serif: '"Cormorant Garamond", Georgia, serif',
  caps: '"Cinzel", "Cormorant Garamond", Georgia, serif',
  script: '"Pinyon Script", "Cormorant Garamond", cursive',
  sans: '"Inter", Arial, sans-serif',
};

// Images officielles (site de la Maison Chanzy) : blason découpé et logotype
const IMG = {};
// Vraies étiquettes Chanzy, photographiées sur chanzy.com puis « déroulées » à plat.
// h / y en cm (hauteur totale blason compris, centre au-dessus du fond de la bouteille)
const CHANZY_PHOTOS = {
  "clous": { h: 8.37, y: 6.2, band: 0.148 },
  "corderes": { h: 8.29, y: 6.21, band: 0.149 },
  "fortune": { h: 8.76, y: 6.52, band: 0.148 },
  "fortune-vv": { h: 8.37, y: 6.15, band: 0.148 },
  "clos-du-roy": { h: 8.77, y: 6.43, band: 0.15 },
};
function chanzyPhoto(w) {
  const c = norm(w.cuvee);
  if (c.includes("clous")) return "clous";
  if (c.includes("corderes")) return "corderes";
  if (c.includes("fortune")) return c.includes("vieilles") ? "fortune-vv" : "fortune";
  if (c.includes("clos du roy") && w.color !== "R") return "clos-du-roy";
  return null;
}
function loadImg(k, src) {
  return new Promise((r) => { const i = new Image(); i.onload = () => { IMG[k] = i; r(); }; i.onerror = () => r(); i.src = src; });
}

export async function loadFonts() {
  const specs = [
    `600 40px ${F.serif}`, `700 40px ${F.serif}`, `italic 500 40px ${F.serif}`,
    `500 40px ${F.caps}`, `700 40px ${F.caps}`, `400 40px ${F.script}`,
    `300 20px ${F.sans}`, `400 20px ${F.sans}`, `500 20px ${F.sans}`, `600 20px ${F.sans}`,
  ];
  const imgs = [loadImg("crest", "assets/chanzy-crest.png"), loadImg("wordmark", "assets/chanzy-wordmark.png"),
    ...Object.keys(CHANZY_PHOTOS).map((k) => loadImg("chanzy-" + k, `assets/chanzy-${k}.webp`))];
  try { await Promise.race([Promise.all([...specs.map((s) => document.fonts.load(s)), ...imgs]), new Promise((r) => setTimeout(r, 3000))]); } catch {}
}

const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/* ——————————— helpers de dessin ——————————— */
function spaced(x, text, cx, y, spacing) {
  const chars = [...text];
  const widths = chars.map((c) => x.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let px = cx - total / 2;
  const align = x.textAlign; x.textAlign = "left";
  chars.forEach((c, i) => { x.fillText(c, px, y); px += widths[i] + spacing; });
  x.textAlign = align;
  return total;
}
function fit(x, font, size, text, maxW, min = 8) {
  let s = size;
  x.font = font.replace("{s}", s);
  while (x.measureText(text).width > maxW && s > min) { s -= 1; x.font = font.replace("{s}", s); }
  return s;
}
function paper(x, W, H, base, grain = 0.035) {
  x.fillStyle = base; x.fillRect(0, 0, W, H);
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "rgba(255,255,255,.25)"); g.addColorStop(1, "rgba(120,100,70,.06)");
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const n = Math.floor(W * H / 90);
  for (let i = 0; i < n; i++) {
    x.fillStyle = `rgba(110,90,60,${Math.random() * grain})`;
    x.fillRect(Math.random() * W, Math.random() * H, 1.4, 1.4);
  }
}
function fakeText(x, cx, y, w, lines, lh, color) {
  x.fillStyle = color;
  for (let i = 0; i < lines; i++) {
    const lw = i === lines - 1 ? w * 0.55 : w * (0.9 + Math.random() * 0.1);
    let px = cx - lw / 2;
    while (px < cx + lw / 2) {
      const ww = 4 + Math.random() * 14;
      x.fillRect(px, y + i * lh, Math.min(ww, cx + lw / 2 - px), lh * 0.36);
      px += ww + 4;
    }
  }
}

// Écusson Chanzy : bouclier à bandes diagonales bleues, couronne
function chanzyCrest(x, cx, cy, s) {
  const blue = "#2c4a86";
  x.save(); x.translate(cx, cy);
  const shield = new Path2D();
  shield.moveTo(-s * .5, -s * .45); shield.lineTo(s * .5, -s * .45);
  shield.lineTo(s * .5, s * .05);
  shield.quadraticCurveTo(s * .48, s * .42, 0, s * .6);
  shield.quadraticCurveTo(-s * .48, s * .42, -s * .5, s * .05);
  shield.closePath();
  x.save(); x.clip(shield);
  x.fillStyle = "#fff"; x.fillRect(-s, -s, s * 2, s * 2);
  x.fillStyle = blue;
  for (let i = -6; i <= 6; i++) {
    x.save(); x.rotate(-0.75); x.fillRect(i * s * .18, -s * 1.2, s * .085, s * 2.4); x.restore();
  }
  x.restore();
  x.strokeStyle = blue; x.lineWidth = s * .045; x.stroke(shield);
  // couronne
  x.fillStyle = blue;
  x.beginPath();
  x.moveTo(-s * .32, -s * .52); x.lineTo(-s * .32, -s * .7); x.lineTo(-s * .16, -s * .6); x.lineTo(0, -s * .78);
  x.lineTo(s * .16, -s * .6); x.lineTo(s * .32, -s * .7); x.lineTo(s * .32, -s * .52); x.closePath(); x.fill();
  x.restore();
}

// Armoiries Burrier : écu soutenu par deux lions stylisés
function burrierCrest(x, cx, cy, s, color = "#5b4632") {
  x.save(); x.translate(cx, cy);
  x.strokeStyle = color; x.fillStyle = color; x.lineWidth = s * .035;
  const sh = new Path2D();
  sh.moveTo(-s * .2, -s * .3); sh.lineTo(s * .2, -s * .3); sh.lineTo(s * .2, s * .05);
  sh.quadraticCurveTo(s * .18, s * .28, 0, s * .36); sh.quadraticCurveTo(-s * .18, s * .28, -s * .2, s * .05); sh.closePath();
  x.stroke(sh);
  x.fillRect(-s * .2, -s * .1, s * .4, s * .05);
  for (const d of [-1, 1]) { // lions
    x.save(); x.scale(d, 1);
    x.beginPath();
    x.moveTo(s * .24, s * .3); x.bezierCurveTo(s * .3, s * .05, s * .26, -s * .2, s * .34, -s * .32);
    x.bezierCurveTo(s * .42, -s * .4, s * .52, -s * .34, s * .48, -s * .24);
    x.bezierCurveTo(s * .44, -s * .16, s * .4, s * .0, s * .46, s * .14);
    x.bezierCurveTo(s * .5, s * .26, s * .42, s * .34, s * .24, s * .3);
    x.fill();
    x.beginPath(); x.moveTo(s * .46, s * .14); x.quadraticCurveTo(s * .62, s * .1, s * .58, -s * .05); x.stroke();
    x.restore();
  }
  // couronne
  x.beginPath();
  x.moveTo(-s * .16, -s * .34); x.lineTo(-s * .16, -s * .46); x.lineTo(-s * .06, -s * .4); x.lineTo(0, -s * .5);
  x.lineTo(s * .06, -s * .4); x.lineTo(s * .16, -s * .46); x.lineTo(s * .16, -s * .34); x.closePath(); x.fill();
  x.restore();
}

// Gravure du château et des vignes (Beauregard)
function engraving(x, W, top, bottom, color) {
  x.save();
  x.strokeStyle = color; x.lineWidth = 1.2;
  const cx = W / 2, h = bottom - top;
  // vignes en perspective
  for (let i = -9; i <= 9; i++) {
    x.beginPath(); x.moveTo(cx + i * W * .012, top + h * .55); x.lineTo(cx + i * W * .06, bottom); x.stroke();
  }
  for (let j = 0; j < 4; j++) { x.beginPath(); x.moveTo(W * .12, top + h * (.6 + j * .1)); x.lineTo(W * .88, top + h * (.6 + j * .1)); x.globalAlpha = .5; x.stroke(); x.globalAlpha = 1; }
  // château
  const bw = W * .2, by = top + h * .52;
  x.strokeRect(cx - bw / 2, by - h * .2, bw, h * .2);
  x.beginPath(); x.moveTo(cx - bw / 2 - 6, by - h * .2); x.lineTo(cx, by - h * .38); x.lineTo(cx + bw / 2 + 6, by - h * .2); x.stroke();
  for (const d of [-1, 1]) {
    const tx = cx + d * (bw / 2 + W * .03);
    x.strokeRect(tx - W * .018, by - h * .28, W * .036, h * .28);
    x.beginPath(); x.moveTo(tx - W * .026, by - h * .28); x.lineTo(tx, by - h * .44); x.lineTo(tx + W * .026, by - h * .28); x.stroke();
  }
  for (let k = 0; k < 5; k++) x.strokeRect(cx - bw / 2 + bw * (.1 + k * .17), by - h * .14, bw * .08, h * .07);
  // arbres
  for (const tx of [W * .22, W * .28, W * .72, W * .79]) { x.beginPath(); x.arc(tx, by - h * .08, h * .07, 0, Math.PI * 2); x.stroke(); }
  x.restore();
}

function chanzyFallback(x, W, H, w) { return STYLES.chanzyOld.draw(x, W, H, w); }

/* ——————————— styles par domaine ——————————— */
const BLUE_INK = "#2c4a86";

const STYLES = {
  chanzy: {
    match: (w) => norm(w.domaine).includes("chanzy"),
    habit: (w) => w.color === "R"
      ? { bottle: "burgundy", glass: "dark", capsule: { color: "#141414", metal: .3, rough: .45 } }
      : { bottle: "burgundy", glass: "flint", wine: "#ebd98a", capsule: { color: "#ede7d8", metal: .1, rough: .5 } },
    // étiquette blanche texturée, blason découpé qui dépasse au-dessus (comme les vraies bouteilles)
    label: (w) => {
      const k = chanzyPhoto(w);
      // cutout = hauteur (fraction) de la bande du haut où seul le blason découpé dépasse
      return k ? { arc: 148, ...CHANZY_PHOTOS[k], cutout: CHANZY_PHOTOS[k].band } : { arc: 175, h: 9.6, y: 6.9, cutout: 0.15 };
    },
    draw(x, W, H, w) {
      const photo = IMG["chanzy-" + chanzyPhoto(w)];
      if (photo) { x.drawImage(photo, 0, 0, W, H); return; }
      const u = H / 100, cx = W / 2, band = 15 * u;
      if (!IMG.crest || !IMG.wordmark) return chanzyFallback(x, W, H, w);
      x.save(); x.translate(0, band); paper(x, W, H - band, "#fbfaf6", .05); x.restore();
      // blason : la ligne 156/330 de l'image correspond au bord haut de l'étiquette
      const ch = band * 330 / 156, cw = ch * IMG.crest.width / IMG.crest.height;
      x.drawImage(IMG.crest, cx - cw / 2, 0, cw, ch);
      const ink = "#1c1c1e", blue = "#233f94";
      x.textAlign = "center"; x.fillStyle = ink;
      x.font = `500 ${3.4 * u}px ${F.sans}`; spaced(x, "MAISON", cx, 38.5 * u, 1.5 * u);
      const wh = 7.4 * u, ww = wh * IMG.wordmark.width / IMG.wordmark.height;
      x.drawImage(IMG.wordmark, cx - ww / 2, 48.8 * u - wh, ww, wh);
      // appellation en grandes capitales fines, cuvée en bleu
      const app = w.appellation.replace(/\s*1er cru/i, "").toUpperCase();
      const premier = /1er cru/i.test(w.appellation);
      fit(x, `400 {s}px ${F.sans}`, Math.round(9.6 * u), app, W * .62);
      spaced(x, app, cx, 62.5 * u, .35 * u);
      const cuv = [premier ? "1ER CRU" : "", (w.cuvee || "").toUpperCase()].filter(Boolean).join(" · ");
      if (cuv) {
        x.fillStyle = blue;
        const s = fit(x, `500 {s}px ${F.sans}`, Math.round(5 * u), cuv, W * .56);
        spaced(x, cuv, cx, 70 * u, s * .12);
      }
      // quatre cartouches manuscrits en bas
      const bw = W * .17, by = 80 * u, bh = 17 * u, x0 = cx - bw * 2;
      x.strokeStyle = "rgba(40,40,44,.55)"; x.lineWidth = Math.max(1, .25 * u);
      for (let i = 0; i < 4; i++) x.strokeRect(x0 + i * bw + .6 * u, by, bw - 1.2 * u, bh);
      const region = /vosne|nuits/i.test(w.appellation) ? ["Côte", "de Nuits"] : ["Côte", "Chalonnaise"];
      const notes = [
        ["Millésime", w.vintage ? String(w.vintage) : "—"],
        premier ? ["Premier", "Cru"] : /fortune|clos/i.test(w.cuvee || "") ? ["Clos en", "monopole"] : ["Appellation", "Village"],
        region,
        ["Élevé à", "Bouzeron"],
      ];
      x.fillStyle = "#2a2a2e";
      notes.forEach(([a, b], i) => {
        const bx = x0 + i * bw + bw / 2;
        fit(x, `italic 500 {s}px ${F.serif}`, Math.round(5 * u), a, bw * .82);
        x.fillText(a, bx, by + 7.2 * u);
        fit(x, `italic 600 {s}px ${F.serif}`, Math.round(5.4 * u), b, bw * .82);
        x.fillText(b, bx, by + 13.6 * u);
      });
    },
  },

  chanzyOld: {
    match: () => false,
    habit: () => ({}),
    label: { arc: 175, h: 9.6, y: 6.9 },
    draw(x, W, H, w) {
      paper(x, W, H, "#fbfaf6", .02);
      const u = H / 100, cx = W / 2;
      chanzyCrest(x, cx, 16 * u, 15 * u);
      x.textAlign = "center"; x.fillStyle = "#1d2a48";
      x.font = `600 ${3.4 * u}px ${F.sans}`; spaced(x, "MAISON", cx, 33 * u, 1.4 * u);
      x.font = `700 ${10 * u}px ${F.caps}`; spaced(x, "CHANZY", cx, 43.5 * u, .8 * u);
      const cuv = (w.cuvee || "").replace(/vieilles vignes/i, "").trim();
      const vv = /vieilles vignes/i.test(w.cuvee || "");
      let y = 56 * u;
      if (cuv) {
        x.fillStyle = BLUE_INK;
        fit(x, `500 {s}px ${F.caps}`, Math.round(6 * u), cuv.toUpperCase(), W * .78);
        x.fillText(cuv.toUpperCase(), cx, y); y += 6 * u;
        if (/fortune/i.test(cuv)) { x.font = `600 ${2.8 * u}px ${F.sans}`; spaced(x, "MONOPOLE", cx, y, 1 * u); y += 5 * u; }
        if (vv) { x.font = `italic 500 ${5 * u}px ${F.serif}`; x.fillText("Vieilles Vignes", cx, y + .5 * u); y += 5 * u; }
      }
      const app = w.appellation.replace(/\s*1er cru/i, "");
      const premier = /1er cru/i.test(w.appellation);
      x.fillStyle = "#1d2a48";
      x.strokeStyle = "#c9cfdb"; x.lineWidth = 1.5;
      x.beginPath(); x.moveTo(cx - W * .12, 70 * u); x.lineTo(cx + W * .12, 70 * u); x.stroke();
      fit(x, `600 {s}px ${F.caps}`, Math.round(6.4 * u), app.toUpperCase(), W * .8);
      x.fillText(app.toUpperCase(), cx, 79 * u);
      if (premier) { x.font = `600 ${2.8 * u}px ${F.sans}`; spaced(x, "PREMIER CRU", cx, 84.5 * u, 1 * u); }
      x.font = `600 ${5.2 * u}px ${F.serif}`; x.fillStyle = "#3a4563";
      x.fillText(w.vintage ? String(w.vintage) : "", cx, 92 * u);
      x.font = `500 ${2 * u}px ${F.sans}`; x.fillStyle = "#8b93a6";
      spaced(x, "MIS EN BOUTEILLE À BOUZERON · BOURGOGNE", cx, 97 * u, .5 * u);
    },
  },

  beauregard: {
    match: (w) => norm(w.domaine).includes("beauregard"),
    habit: () => ({ bottle: "burgundy", glass: "antique", wine: "#e3c66c", capsule: { color: "#2b2620", metal: .55, rough: .35, top: "#b0904f" } }),
    label: { arc: 150, h: 8.4, y: 6.5 },
    draw(x, W, H, w) {
      paper(x, W, H, "#f1e8d3", .05);
      const u = H / 100, cx = W / 2, brown = "#4a3826", red = "#8c2c22";
      x.strokeStyle = brown; x.lineWidth = 2; x.strokeRect(3 * u, 3 * u, W - 6 * u, H - 6 * u);
      x.lineWidth = 1; x.strokeRect(4.6 * u, 4.6 * u, W - 9.2 * u, H - 9.2 * u);
      x.textAlign = "center";
      burrierCrest(x, cx, 15 * u, 17 * u, "#5b4632");
      x.fillStyle = brown; x.font = `400 ${7 * u}px ${F.script}`;
      x.fillText("Joseph", cx - W * .22, 17 * u); x.fillText("Burrier", cx + W * .22, 17 * u);
      x.save(); x.translate(cx, 38 * u); x.scale(.78, 1);
      x.fillStyle = red;
      fit(x, `700 {s}px ${F.serif}`, Math.round(14 * u), "POUILLY-FUISSÉ", W * .98);
      x.fillText("POUILLY-FUISSÉ", 0, 0); x.restore();
      x.fillStyle = brown;
      if (/1er cru/i.test(w.appellation) || w.cuvee) {
        x.font = `600 ${4.2 * u}px ${F.caps}`;
        spaced(x, [/1er cru/i.test(w.appellation) ? "1ER CRU" : "", (w.cuvee || "").toUpperCase()].filter(Boolean).join(" · "), cx, 46 * u, .6 * u);
      } else {
        x.font = `500 ${2.4 * u}px ${F.sans}`;
        spaced(x, "APPELLATION POUILLY-FUISSÉ CONTRÔLÉE", cx, 45.5 * u, .45 * u);
      }
      x.font = `700 ${6.4 * u}px ${F.serif}`; x.fillText(w.vintage ? String(w.vintage) : "", cx, 55 * u);
      x.font = `400 ${11 * u}px ${F.script}`; x.fillStyle = "#2b2118";
      fit(x, `400 {s}px ${F.script}`, Math.round(11 * u), "Château de Beauregard", W * .8);
      x.fillText("Château de Beauregard", cx, 68 * u);
      engraving(x, W, 70 * u, 95 * u, "rgba(90,70,48,.55)");
    },
  },

  beauvernay: {
    match: (w) => norm(w.domaine).includes("beauvernay"),
    habit: () => ({ bottle: "burgundy", glass: "dark", capsule: { color: "#a3141e", metal: .55, rough: .35 } }),
    label: { arc: 140, h: 8.2, y: 6.5 },
    draw(x, W, H, w) {
      paper(x, W, H, "#ecdfc2", .05);
      const u = H / 100, cx = W / 2, red = "#8c2c22", brown = "#3e2f22";
      x.textAlign = "center";
      burrierCrest(x, cx, 17 * u, 19 * u, "#6b5238");
      x.fillStyle = red;
      x.font = `700 ${12 * u}px ${F.serif}`; spaced(x, "JULIÉNAS", cx, 44 * u, 1.2 * u);
      x.fillStyle = brown;
      x.font = `italic 500 ${5.6 * u}px ${F.serif}`; x.fillText("Domaine de Beauvernay", cx, 53 * u);
      if (/vieilles/i.test(w.cuvee || "")) { x.font = `400 ${10 * u}px ${F.script}`; x.fillText("Vieilles Vignes", cx, 67 * u); }
      x.font = `600 ${5.4 * u}px ${F.serif}`; x.fillText(w.vintage ? String(w.vintage) : "", cx, /vieilles/i.test(w.cuvee || "") ? 77 * u : 68 * u);
      x.font = `500 ${2.2 * u}px ${F.sans}`; x.fillStyle = "#7a6650";
      spaced(x, "APPELLATION JULIÉNAS CONTRÔLÉE", cx, 84 * u, .45 * u);
      x.font = `400 ${6.5 * u}px ${F.script}`; x.fillStyle = brown;
      x.fillText("Famille Joseph Burrier", cx, 93 * u);
    },
  },

  rolet: {
    match: (w) => norm(w.domaine).includes("rolet"),
    // vraie bouteille : jurassienne en verre clair, capsule jaune d'or
    habit: () => ({ bottle: "jura", glass: "flint", wine: "#e4c56a", capsule: { color: "#dca22c", metal: .3, rough: .38 } }),
    label: { arc: 150, h: 11, y: 7.5 },
    draw(x, W, H, w) {
      paper(x, W, H, "#f6f2e9", .03);
      const u = H / 100, cx = W / 2, ink = "#26221f", green = "#7d9a3c";
      x.textAlign = "center"; x.fillStyle = ink;
      x.font = `600 ${3.6 * u}px ${F.sans}`; spaced(x, "DOMAINE", cx, 10.5 * u, 1.1 * u);
      x.font = `600 ${12 * u}px ${F.caps}`; spaced(x, "ROLET", cx, 23.5 * u, .9 * u);
      // « côtes du jura » en lettres creuses fines, comme sur l'étiquette
      x.strokeStyle = "#9a958c"; x.lineWidth = Math.max(1, .32 * u); x.lineJoin = "round";
      x.font = `300 ${13 * u}px ${F.sans}`;
      x.strokeText("côtes", cx, 43 * u); x.strokeText("du jura", cx, 54 * u);
      x.fillStyle = green; x.font = `600 ${3.8 * u}px ${F.sans}`;
      spaced(x, (w.cuvee || (w.vintage ? String(w.vintage) : "")).toUpperCase(), cx, 61.5 * u, .9 * u);
      x.strokeStyle = "#cfc8b9"; x.lineWidth = Math.max(1, .2 * u);
      x.beginPath(); x.moveTo(W * .22, 89 * u); x.lineTo(W * .78, 89 * u); x.stroke();
      x.fillStyle = "#57514a"; x.font = `500 ${2.6 * u}px ${F.sans}`;
      spaced(x, "VIGNERON · ARBOIS · JURA", cx, 94 * u, .6 * u);
    },
  },

  poncie: {
    match: (w) => norm(w.domaine).includes("poncie"),
    habit: () => ({ bottle: "burgundy", glass: "dark", capsule: { color: "#1f4a56", metal: .55, rough: .35 } }),
    label: { arc: 140, h: 8.4, y: 6.5 },
    draw(x, W, H, w) {
      paper(x, W, H, "#f3ecdc", .04);
      const u = H / 100, cx = W / 2, ink = "#3a2e26";
      x.textAlign = "center"; x.fillStyle = ink;
      x.font = `600 ${3 * u}px ${F.sans}`; spaced(x, "CHÂTEAU DE", cx, 13 * u, 1.1 * u);
      x.font = `600 ${12 * u}px ${F.serif}`; spaced(x, "PONCIÉ", cx, 26 * u, 1.4 * u);
      x.font = `500 ${3 * u}px ${F.sans}`; spaced(x, "949", cx, 32 * u, .8 * u);
      x.font = `400 ${15 * u}px ${F.script}`; x.fillText(w.cuvee || "Le Pavé", cx, 50 * u);
      fakeText(x, cx, 56 * u, W * .62, 5, 2.6 * u, "rgba(70,58,48,.38)");
      x.font = `600 ${4.6 * u}px ${F.caps}`; x.fillStyle = ink;
      spaced(x, w.appellation.toUpperCase(), cx, 80 * u, .9 * u);
      x.font = `600 ${3.4 * u}px ${F.sans}`; spaced(x, w.vintage ? String(w.vintage) : "", cx, 88 * u, 1 * u);
    },
  },

  cornin: {
    match: (w) => norm(w.domaine).includes("cornin"),
    habit: () => ({ bottle: "burgundy", glass: "flint", wine: "#ecdc93", capsule: { color: "#e4e2dc", metal: .35, rough: .4 } }),
    label: { arc: 140, h: 8.4, y: 6.6 },
    draw(x, W, H, w) {
      paper(x, W, H, "#fbfaf7", .02);
      const u = H / 100, cx = W / 2;
      x.strokeStyle = "#bdbcb6"; x.lineWidth = 2.6 * u; x.lineCap = "round";
      x.beginPath(); x.arc(cx - W * .04, 44 * u, 34 * u, 0.28 * Math.PI, 1.72 * Math.PI); x.stroke();
      x.textAlign = "center"; x.fillStyle = "#2a2a28";
      x.font = `600 ${5.4 * u}px ${F.serif}`; spaced(x, w.appellation.toUpperCase(), cx, 50 * u, .9 * u);
      if (w.cuvee) { x.font = `italic 500 ${4.4 * u}px ${F.serif}`; x.fillText(w.cuvee, cx, 57 * u); }
      x.fillStyle = "#e1b12c"; x.fillRect(cx - 2.4 * u, 61 * u, 4.8 * u, 4.8 * u);
      x.fillStyle = "#1e1e1e"; x.fillRect(cx - 1 * u, 62.4 * u, 2 * u, 2 * u);
      x.font = `500 ${3 * u}px ${F.serif}`; x.fillStyle = "#555";
      x.fillText("Dominique", cx - W * .1, 73 * u);
      x.font = `400 ${13 * u}px ${F.script}`; x.fillStyle = "#2a2a28";
      x.fillText("Cornin", cx + W * .02, 83 * u);
      x.font = `600 ${3.4 * u}px ${F.sans}`; x.fillStyle = "#6c6c68";
      spaced(x, w.vintage ? String(w.vintage) : "", cx, 93 * u, 1 * u);
    },
  },

  generic: {
    match: () => true,
    habit: (w) => w.color === "R"
      ? { bottle: "burgundy", glass: "dark", capsule: { color: "#6e1424", metal: .5, rough: .35 } }
      : { bottle: "burgundy", glass: "antique", wine: "#e3c66c", capsule: { color: "#c2a061", metal: .6, rough: .35 } },
    label: { arc: 145, h: 8.4, y: 6.5 },
    draw(x, W, H, w) {
      paper(x, W, H, "#f3ecdd", .04);
      const u = H / 100, cx = W / 2, ink = "#2e241c", acc = w.color === "R" ? "#7d1626" : "#8a6a33";
      x.strokeStyle = acc; x.lineWidth = 2; x.strokeRect(4 * u, 4 * u, W - 8 * u, H - 8 * u);
      x.textAlign = "center"; x.fillStyle = ink;
      fit(x, `600 {s}px ${F.sans}`, Math.round(3.2 * u), w.domaine.toUpperCase(), W * .8);
      spaced(x, w.domaine.toUpperCase(), cx, 18 * u, .9 * u);
      const main = w.cuvee || w.appellation;
      fit(x, `700 {s}px ${F.serif}`, Math.round(12 * u), main, W * .82);
      x.fillText(main, cx, 45 * u);
      if (w.cuvee) { x.font = `italic 500 ${6 * u}px ${F.serif}`; x.fillText(w.appellation, cx, 57 * u); }
      x.fillStyle = acc; x.font = `700 ${8 * u}px ${F.serif}`;
      x.fillText(w.vintage ? String(w.vintage) : "", cx, 80 * u);
      x.font = `500 ${2.4 * u}px ${F.sans}`; x.fillStyle = "#7a6a58";
      spaced(x, (w.region || "").toUpperCase(), cx, 90 * u, .6 * u);
    },
  },
};

export function styleFor(w) {
  const key = Object.keys(STYLES).find((k) => STYLES[k].match(w));
  const s = STYLES[key];
  return { key, ...s.habit(w), label: typeof s.label === "function" ? s.label(w) : s.label, draw: s.draw };
}

// Dessine l'étiquette à la bonne proportion (largeur = arc déroulé)
export function drawLabel(w, pxPerCm) {
  const st = styleFor(w);
  const r = 4.05;
  const Wcm = (st.label.arc * Math.PI / 180) * r, Hcm = st.label.h;
  const c = document.createElement("canvas");
  // plafonné : au-delà, aucun gain visible et l'envoi au GPU ferait saccader l'animation
  const ppc = Math.min(pxPerCm, 1800 / Wcm);
  c.width = Math.round(Wcm * ppc); c.height = Math.round(Hcm * ppc);
  const x = c.getContext("2d");
  x.textBaseline = "alphabetic";
  st.draw(x, c.width, c.height, w);
  return c;
}
