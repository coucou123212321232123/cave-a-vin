// Photos d'étiquettes : stockage sur l'appareil (IndexedDB) et mise à plat d'une étiquette recadrée.

const DB = "cave-photos", STORE = "labels";
let dbp = null;
function db() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(STORE, mode), st = t.objectStore(STORE);
    const out = fn(st);
    t.oncomplete = () => res(out?.result);
    t.onerror = () => rej(t.error);
  });
}
export const put = (id, blob) => tx("readwrite", (s) => s.put(blob, id));
export const del = (id) => tx("readwrite", (s) => s.delete(id));
export const get = (id) => tx("readonly", (s) => s.get(id));
export async function all() {
  const d = await db();
  return new Promise((res, rej) => {
    const out = new Map(), t = d.transaction(STORE, "readonly");
    const c = t.objectStore(STORE).openCursor();
    c.onsuccess = () => { const k = c.result; if (k) { out.set(k.key, k.value); k.continue(); } };
    t.oncomplete = () => res(out);
    t.onerror = () => rej(t.error);
  });
}

export async function blobToImage(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
export const blobToDataURL = (blob) => new Promise((res, rej) => {
  const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob);
});
export const dataURLToBlob = (u) => fetch(u).then((r) => r.blob());

// Image du téléphone → canvas réduit (les photos font souvent 12 Mpx, inutile pour une étiquette)
export async function loadPhoto(file, maxSide = 2200) {
  let src;
  try { src = await createImageBitmap(file, { imageOrientation: "from-image" }); }
  catch { src = await blobToImage(file); }
  const w = src.width, h = src.height, k = Math.min(1, maxSide / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
  src.close?.();
  return c;
}

export function rotate90(src) {
  const c = document.createElement("canvas");
  c.width = src.height; c.height = src.width;
  const x = c.getContext("2d");
  x.translate(c.width, 0); x.rotate(Math.PI / 2);
  x.drawImage(src, 0, 0);
  return c;
}

// Étiquette bombée : sur la photo, elle couvre ±HALF de la bouteille vue de face
const HALF = (55 * Math.PI) / 180;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/*
  Met à plat l'étiquette délimitée par 6 poignées (en pixels de `src`) :
  tl, tm, tr (bord du haut, tm = milieu, pour suivre la courbure), bl, bm, br (bord du bas).
  curved = étiquette photographiée sur la bouteille (on « déroule » le cylindre), sinon étiquette à plat.
  Renvoie { canvas, ratio } — ratio = largeur réelle / hauteur réelle.
*/
export function unwrap(src, q, curved, outW = 1100) {
  const Wp = (dist(q.tl, q.tr) + dist(q.bl, q.br)) / 2;
  const Hp = (dist(q.tl, q.bl) + dist(q.tr, q.br)) / 2;
  const stretch = curved ? HALF / Math.sin(HALF) : 1;
  const ratio = (Wp * stretch) / Math.max(1, Hp);
  const outH = Math.max(8, Math.round(outW / ratio));
  // courbe de Bézier passant par les 3 poignées d'un bord
  const ctrl = (a, m, b) => ({ x: 2 * m.x - (a.x + b.x) / 2, y: 2 * m.y - (a.y + b.y) / 2 });
  const cT = ctrl(q.tl, q.tm, q.tr), cB = ctrl(q.bl, q.bm, q.br);
  const bez = (a, c, b, s) => { const t = 1 - s; return { x: t * t * a.x + 2 * t * s * c.x + s * s * b.x, y: t * t * a.y + 2 * t * s * c.y + s * s * b.y }; };

  const sw = src.width, sh = src.height;
  const sd = src.getContext("2d").getImageData(0, 0, sw, sh).data;
  const out = document.createElement("canvas");
  out.width = outW; out.height = outH;
  const ox = out.getContext("2d"), img = ox.createImageData(outW, outH), od = img.data;
  for (let u = 0; u < outW; u++) {
    const f = (u + 0.5) / outW;
    // position sur la photo : un cylindre vu de face comprime les bords (x ∝ sin θ)
    const s = curved ? (1 + Math.sin((f * 2 - 1) * HALF) / Math.sin(HALF)) / 2 : f;
    const T = bez(q.tl, cT, q.tr, s), B = bez(q.bl, cB, q.br, s);
    for (let v = 0; v < outH; v++) {
      const g = (v + 0.5) / outH;
      const x = T.x + (B.x - T.x) * g, y = T.y + (B.y - T.y) * g;
      const x0 = Math.max(0, Math.min(sw - 2, Math.floor(x))), y0 = Math.max(0, Math.min(sh - 2, Math.floor(y)));
      const fx = Math.min(1, Math.max(0, x - x0)), fy = Math.min(1, Math.max(0, y - y0));
      const i00 = (y0 * sw + x0) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4;
      const o = (v * outW + u) * 4;
      for (let k = 0; k < 3; k++) {
        const a = sd[i00 + k] + (sd[i10 + k] - sd[i00 + k]) * fx;
        const b = sd[i01 + k] + (sd[i11 + k] - sd[i01 + k]) * fx;
        od[o + k] = a + (b - a) * fy;
      }
      od[o + 3] = 255;
    }
  }
  ox.putImageData(img, 0, 0);
  return { canvas: out, ratio };
}

// Équilibre l'éclairage : un léger étirement des niveaux pour que le papier paraisse blanc et pas gris
export function autoLevels(c) {
  const x = c.getContext("2d"), d = x.getImageData(0, 0, c.width, c.height), p = d.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < p.length; i += 16) hist[(p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11) | 0]++;
  const n = hist.reduce((a, b) => a + b, 0);
  let acc = 0, lo = 0, hi = 255;
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc > n * 0.005) { lo = i; break; } }
  acc = 0;
  for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc > n * 0.02) { hi = i; break; } }
  if (hi - lo < 40) return c;
  // prudence : on ne corrige qu'à moitié, pour garder le grain et la couleur du papier
  const top = Math.min(255, hi + (255 - hi) * 0.5), bottom = lo * 0.5;
  const k = 255 / Math.max(1, top - bottom);
  for (let i = 0; i < p.length; i += 4) for (let j = 0; j < 3; j++) p[i + j] = Math.max(0, Math.min(255, (p[i + j] - bottom) * k));
  x.putImageData(d, 0, 0);
  return c;
}

// WebP si le navigateur sait l'écrire (Safari renvoie du PNG à la place : on passe alors en JPEG, bien plus léger)
export const toBlob = (c, q = 0.86) => new Promise((res) => c.toBlob((b) => {
  if (b && b.type === "image/webp") res(b); else c.toBlob(res, "image/jpeg", 0.88);
}, "image/webp", q));
