// Scène 3D : la cave, les bouteilles, la caméra et les interactions.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { styleFor, drawLabel, loadFonts } from "./labels.js";

// Studio photo virtuel : longues boîtes à lumière verticales (les reflets typiques des bouteilles)
function studioEnvironment(renderer, boost = 1) {
  const s = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(120, 120, 120), new THREE.MeshBasicMaterial({ color: 0x6f675d, side: THREE.BackSide }));
  s.add(room);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshBasicMaterial({ color: 0xb9ab95 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -40; s.add(floor);
  const panel = (w, h, pos, intensity, tint = 0xffffff) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(tint).multiplyScalar(intensity * boost), side: THREE.DoubleSide }));
    m.position.copy(pos); m.lookAt(0, pos.y, 0); s.add(m);
    return m;
  };
  panel(9, 80, new THREE.Vector3(-34, 4, 30), 9);          // grande boîte à gauche
  panel(4, 80, new THREE.Vector3(38, 4, 18), 6);           // fine bande à droite
  panel(3, 80, new THREE.Vector3(-14, 4, -46), 2.5, 0xfff1dc); // contre-jour
  const top = panel(50, 26, new THREE.Vector3(0, 50, 6), 2.2, 0xfff6ea);
  top.lookAt(0, 0, 6);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(s, 0.015).texture;
  pmrem.dispose();
  return tex;
}

const BG = 0xf3ede3;
// Cave de vieillissement noire à deux portes vitrées, 6 bouteilles debout par clayette et par porte
const SLOT = 10.8, PER_DOOR = 6, DOORS = 2, PER = PER_DOOR * DOORS;
const SIDE = 3, MID = 3.2, DEPTH = 40, SHELF_T = 1.8, GAP = 35.5, FEET = 3, BASE = 26, TOP = 10;
const INNER_W = PER_DOOR * SLOT + 1.6, OUT_W = INNER_W * DOORS + MID + SIDE * 2;
const TILT = -0.3;           // bouteilles penchées vers l'arrière
const BOTTLE_Z = 7.5;        // pied des bouteilles, derrière la barre de façade
const doorX = (d) => (d - (DOORS - 1) / 2) * (INNER_W + MID);
const FOV = 32, TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const LOW_RES = 46, HI_RES = 110;

// Plusieurs caves côte à côte : 5 clayettes par porte, une clayette = 6 bouteilles
const SHELVES = 5, CL_PER_CAB = SHELVES * DOORS;
const PITCH = OUT_W + 30;
const cabH = BASE + SHELVES * (SHELF_T + GAP) + TOP;

let renderer, scene, camera, root, frame, bottleRoot, dimPlane, canvasEl, keyLight;
let cabCount = 0, cabInfo = [], curCab = -1, tagRoot = null;
let mode = "overview";
let bottles = [];
let focused = null;
let cb = {};
let spin = 0, spinVel = 0, lastInteract = 0, shadowUntil = 0, traveling = false;
// deux « mondes » où l'on se promène : la rangée de caves et le mur des souvenirs
const cellar = { x: 0, y: 0, vx: 0, vy: 0, pull: 0 };
const memw = { x: 0, y: 0, vx: 0, vy: 0, pull: 0 };
const cabX = (c) => (c - (cabCount - 1) / 2) * PITCH;
const rowW = () => (Math.max(1, cabCount) - 1) * PITCH + OUT_W;
let tweens = [];
let dirty = true;
const V = (x, y) => new THREE.Vector2(x, y);
const labelCache = new Map();
const geoCache = new Map();
const mats = {};
let envTex, glassEnv;
// Résolution adaptative : si l'appareil peine (images > 24 ms), on baisse un peu la définition
const DPR_MAX = Math.min(window.devicePixelRatio || 1, 2);
const DPR_MIN = Math.min(DPR_MAX, 1.5);   // plancher : l'image reste nette
let dpr = DPR_MAX, slow = 0, lastFrame = 0, lastRot = null, startT = 0;

/* ——————————————— Géométries ——————————————— */
// Bourguignonne : profil relevé sur une vraie bouteille Chanzy (hauteur cm, rayon cm) — longues épaules en pente douce
const BURGUNDY_SHOULDER = [
  [11.17, 3.99], [11.74, 3.955], [12.3, 3.889], [12.87, 3.81], [13.43, 3.718], [14.0, 3.599], [14.56, 3.468],
  [15.12, 3.31], [15.69, 3.126], [16.25, 2.928], [16.82, 2.731], [17.38, 2.521], [17.95, 2.323], [18.51, 2.126],
  [19.07, 1.968], [19.64, 1.823], [20.2, 1.718], [20.77, 1.613], [21.33, 1.534], [21.9, 1.481], [22.46, 1.455],
  [23.03, 1.44], [23.6, 1.43],
];
// Jurassienne : profil relevé sur une vraie bouteille Rolet — corps qui s'évase légèrement vers le haut,
// longue épaule douce (frappée « JURA » en relief), col fin
const JURA_PROFILE = [
  [3, 3.9], [6, 3.95], [9, 4.0], [12, 4.05], [14.5, 4.08], [15.04, 4.07], [15.54, 4.02], [16.04, 3.93], [16.54, 3.8],
  [17.04, 3.63], [17.55, 3.43], [18.05, 3.24], [18.55, 3.05], [19.05, 2.85], [19.55, 2.64], [20.05, 2.45],
  [20.55, 2.28], [21.05, 2.1], [21.56, 1.95], [22.06, 1.83], [22.56, 1.72], [23.06, 1.62], [23.56, 1.55],
  [24.06, 1.51], [24.56, 1.47], [25.07, 1.45], [25.57, 1.44],
];
// Bordelaise : corps droit et haut, épaule courte et marquée
const BORDEAUX_SHOULDER = [
  [22.2, 3.71], [22.7, 3.6], [23.1, 3.4], [23.5, 3.08], [23.85, 2.7], [24.15, 2.3], [24.45, 1.95],
  [24.8, 1.68], [25.1, 1.53], [25.4, 1.46],
];
const SHAPES = {
  burgundy: { R: 4.0, body: 10.9, neck: 23.6, RN: 1.43, top: 29.6, profile: BURGUNDY_SHOULDER },
  jura: { R: 3.87, body: 0, neck: 24.6, RN: 1.43, top: 30.4, profile: JURA_PROFILE, emboss: [15.2, 19.4] },
  bordeaux: { R: 3.75, body: 21.6, neck: 25.4, RN: 1.45, top: 30.6, profile: BORDEAUX_SHOULDER },
  // flûte d'Alsace / de Provence : haute et fine, longue pente jusqu'au col
  alsace: { R: 3.75, body: 12.5, neck: 27.8, RN: 1.38, top: 34.2 },
  // champenoise : large, verre épais, épaule longue
  champagne: { R: 4.4, body: 12.5, neck: 23.2, RN: 1.55, top: 29.8 },
  // clavelin (62 cl, vin jaune) : trapu, épaule haute et franche
  clavelin: { R: 4.05, body: 12.2, neck: 16.6, RN: 1.45, top: 23.6 },
};

function outline(type) {
  const s = SHAPES[type], p = [];
  p.push(V(0, 1.7), V(1.3, 1.3), V(2.7, 0.35), V(s.R - 0.4, 0), V(s.R - 0.06, 0.14), V(s.R, 0.55));
  if (s.body) p.push(V(s.R, s.body));
  if (s.profile) {
    for (const [h, r] of s.profile) p.push(V(r, h));
  } else {
    const n = 30;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      // épaule arrondie : le rayon reste plein un moment puis plonge vers le col
      const e = Math.pow(t, 1.35);
      const r = s.RN + (s.R - s.RN) * (1 + Math.cos(Math.PI * e)) / 2;
      p.push(V(r, s.body + t * (s.neck - s.body)));
    }
  }
  p.push(V(s.RN - 0.04, s.top - 2.6), V(s.RN + 0.02, s.top - 0.9));
  p.push(V(s.RN + 0.2, s.top - 0.78), V(s.RN + 0.2, s.top - 0.06), V(s.RN + 0.06, s.top), V(0, s.top));
  return p;
}
function geoFor(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}
const bodyGeo = (t) => geoFor("body-" + t, () => new THREE.LatheGeometry(outline(t), 96));
// Le vin : suit la paroi intérieure (verre ≈ 3 mm), remplit jusqu'au bas du goulot
const wineGeo = (t) => geoFor("wine-" + t, () => {
  const s = SHAPES[t], fill = s.neck + 1.6;
  const inner = outline(t).filter((p) => p.y > 0.5 && p.y <= fill).map((p) => V(Math.max(0.2, p.x - 0.3), Math.max(p.y, 0.75)));
  const last = inner[inner.length - 1];
  const rFill = Math.max(0.2, (SHAPES[t].RN) - 0.25);
  return new THREE.LatheGeometry([V(0, 2.0), V(1.1, 1.6), V(2.3, 0.8), ...inner, V(Math.min(last.x, rFill + 0.4), fill), V(0, fill)], 72);
});
const capGeo = (t) => geoFor("cap-" + t, () => {
  const s = SHAPES[t], RN = s.RN;
  return new THREE.LatheGeometry([
    V(RN + 0.06, s.top - 5.8), V(RN + 0.08, s.top - 1.0), V(RN + 0.25, s.top - 0.82),
    V(RN + 0.25, s.top + 0.06), V(RN + 0.1, s.top + 0.16), V(0, s.top + 0.16),
  ], 48);
});
const cutCapGeo = (t) => geoFor("cutcap-" + t, () => {
  const s = SHAPES[t], RN = s.RN;
  return new THREE.LatheGeometry([
    V(RN + 0.06, s.top - 5.8), V(RN + 0.085, s.top - 2.25), V(RN + 0.02, s.top - 2.2),
  ], 48);
});
// rayon extérieur de la bouteille à une hauteur donnée (le corps jurassien n'est pas parfaitement droit)
function radiusAt(t, y) {
  const p = outline(t).filter((q) => q.y >= 0.5);
  for (let i = 1; i < p.length; i++) {
    if (p[i].y >= y) { const a = p[i - 1], b = p[i], k = (y - a.y) / Math.max(1e-6, b.y - a.y); return a.x + (b.x - a.x) * k; }
  }
  return SHAPES[t].R;
}
const backGeo = (t, y) => geoFor(`back-${t}-${y}`, () => {
  const arc = THREE.MathUtils.degToRad(64);
  const rT = radiusAt(t, y + 3.5) + 0.035, rB = radiusAt(t, y - 3.5) + 0.035;
  return new THREE.CylinderGeometry(rT, rB, 7, 24, 1, true, Math.PI - arc / 2, arc);
});

/* ——————————————— Matériaux ——————————————— */
// Verre : trois recettes
//  - "dark"  (rouges) : verre vert-noir opaque, très brillant, liseré vert sur les bords
//  - verre clair / teinté (blancs) : vin translucide qui réfracte la lumière
//    + une coque teintée + une coque de reflets (mélange additif, donc aucun voile laiteux)
const GLASS_TINT = {
  flint: { color: 0x4a4a2c, base: 0.05, edge: 0.92, pow: 1.7 },
  antique: { color: 0x37350e, base: 0.42, edge: 0.55, pow: 2.0 },
  amber: { color: 0x3f2309, base: 0.48, edge: 0.5, pow: 2.0 },
};
// Teinte du verre plus dense sur les bords (là où la lumière traverse plus d'épaisseur)
function fresnelTint({ color, base, edge, pow }) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uBase: { value: base }, uEdge: { value: edge }, uPow: { value: pow } },
    vertexShader: `
      varying vec3 vN; varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uBase; uniform float uEdge; uniform float uPow;
      varying vec3 vN; varying vec3 vV;
      void main() {
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPow);
        gl_FragColor = vec4(uColor, clamp(uBase + uEdge * f, 0.0, 1.0));
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false,
  });
}
function initMaterials() {
  mats.dark = new THREE.MeshPhysicalMaterial({
    color: 0x07100a, roughness: 0.045, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, envMap: glassEnv,
    specularIntensity: 1, envMapIntensity: 0.55, sheen: 1, sheenColor: new THREE.Color(0x24462a), sheenRoughness: 0.35,
  });
  mats.shine = new THREE.MeshPhysicalMaterial({
    color: 0x000000, roughness: 0.03, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, envMap: glassEnv,
    specularIntensity: 1, envMapIntensity: 1.1,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  for (const [k, v] of Object.entries(GLASS_TINT)) mats["tint-" + k] = fresnelTint(v);
  mats.back = new THREE.MeshStandardMaterial({ color: 0xefe7d6, roughness: 0.85 });
  mats.ghost = new THREE.MeshStandardMaterial({ color: 0xe9dfcf, roughness: 0.6, transparent: true, opacity: 0.22, depthWrite: false });
}
const wineMats = new Map();
function wineMat(hex, glass) {
  const k = hex + glass;
  if (!wineMats.has(k)) {
    wineMats.set(k, new THREE.MeshPhysicalMaterial({
      color: 0xffffff, metalness: 0, roughness: 0, ior: 1.34,
      transmission: 1, thickness: 7.2,
      attenuationColor: new THREE.Color(hex), attenuationDistance: glass === "flint" ? 5 : 6,
      specularIntensity: 0.4, envMap: glassEnv, envMapIntensity: 0.25,
    }));
  }
  return wineMats.get(k);
}
const capMats = new Map();
function capMat(c) {
  const k = JSON.stringify(c);
  if (!capMats.has(k)) {
    capMats.set(k, new THREE.MeshPhysicalMaterial({
      color: c.color, metalness: c.metal, roughness: c.rough, envMap: glassEnv, envMapIntensity: 0.45,
      clearcoat: c.metal < 0.3 ? 0.25 : 0.6, clearcoatRoughness: 0.25,
    }));
  }
  return capMats.get(k);
}

function labelKey(w, res) {
  return [res, w.domaine, w.appellation, w.cuvee, w.vintage, w.color, w.bottle || "", w.photo ? w.id + "@" + w.photo.v : ""].join("|");
}
// Étiquette → textures. Une étiquette « découpée » (blason qui dépasse) est séparée en deux textures :
// le rectangle, sans aucune transparence (bord parfaitement net), et la bande du haut avec le blason.
function makeTex(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}
function sliceCanvas(src, y0, y1) {
  const c = document.createElement("canvas"); c.width = src.width; c.height = Math.max(1, y1 - y0);
  c.getContext("2d").drawImage(src, 0, y0, src.width, y1 - y0, 0, 0, src.width, y1 - y0);
  return c;
}
function labelTexture(w, res) {
  const k = labelKey(w, res);
  if (labelCache.has(k)) return labelCache.get(k);
  const full = drawLabel(w, res);
  const band = styleFor(w).label.cutout || 0;
  let out;
  if (!band) out = { rect: makeTex(full) };
  else {
    const by = Math.round(full.height * band);
    const bandC = sliceCanvas(full, 0, by);
    // largeur utile de la bande (le blason) pour ne pas dessiner de grande zone vide découpée
    const d = bandC.getContext("2d").getImageData(0, 0, bandC.width, bandC.height).data;
    let lo = bandC.width, hi = 0;
    for (let y = 0; y < bandC.height; y += 2) for (let x = 0; x < bandC.width; x++) if (d[(y * bandC.width + x) * 4 + 3] > 8) { if (x < lo) lo = x; if (x > hi) hi = x; }
    out = { rect: makeTex(sliceCanvas(full, by, full.height)), band: makeTex(bandC), span: hi > lo ? [Math.max(0, lo - 3) / bandC.width, Math.min(bandC.width, hi + 4) / bandC.width] : null };
  }
  labelCache.set(k, out);
  return out;
}
// morceau d'étiquette posé sur la bouteille : arc [u0,u1] de l'étiquette, hauteur h centrée en y
function labelPartGeo(t, arcDeg, h, y, u0 = 0, u1 = 1) {
  return geoFor(`lp-${t}-${arcDeg}-${h.toFixed(3)}-${y.toFixed(3)}-${u0.toFixed(3)}-${u1.toFixed(3)}`, () => {
    const arc = THREE.MathUtils.degToRad(arcDeg);
    const rT = radiusAt(t, y + h / 2) + 0.035, rB = radiusAt(t, y - h / 2) + 0.035;
    return new THREE.CylinderGeometry(rT, rB, h, Math.max(8, Math.round(64 * (u1 - u0))), 1, true, -arc / 2 + u0 * arc, (u1 - u0) * arc);
  });
}

// « JURA » frappé en relief dans le verre de l'épaule
let embossMat;
function embossGeo(t) {
  return geoFor("emboss-" + t, () => {
    const [a, b] = SHAPES[t].emboss, arc = THREE.MathUtils.degToRad(100);
    const pts = outline(t).filter((q) => q.y >= a && q.y <= b).map((q) => V(q.x + 0.045, q.y));
    return new THREE.LatheGeometry(pts, 40, -arc / 2, arc);
  });
}
function getEmbossMat() {
  if (embossMat) return embossMat;
  const c = document.createElement("canvas"); c.width = 512; c.height = 512;
  const x = c.getContext("2d");
  x.fillStyle = "#000"; x.fillRect(0, 0, 512, 512);
  x.fillStyle = "#fff"; x.textAlign = "center"; x.textBaseline = "middle";
  x.font = `700 250px "Cinzel", Georgia, serif`;
  x.save(); x.translate(256, 250); x.scale(0.66, 1.2); x.fillText("JURA", 0, 0); x.restore();
  const t = new THREE.CanvasTexture(c);
  embossMat = new THREE.MeshPhysicalMaterial({
    color: 0xfff0c4, alphaMap: t, bumpMap: t, bumpScale: 2, transparent: true, opacity: 0.42, depthWrite: false,
    roughness: 0.12, metalness: 0, clearcoat: 1, envMap: glassEnv, envMapIntensity: 1.4,
  });
  return embossMat;
}

/* ——————————————— Bouteille ——————————————— */
function makeBottle(w, opts = {}) {
  const st = styleFor(w);
  const g = new THREE.Group();
  const t = st.bottle;
  if (st.glass === "dark") {
    const body = new THREE.Mesh(bodyGeo(t), mats.dark);
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);
  } else {
    // bouteille bue : verre vide
    if (!opts.empty) {
      const wine = new THREE.Mesh(wineGeo(t), wineMat(st.wine || "#e6d38c", st.glass));
      wine.castShadow = true;
      g.add(wine);
    }
    const tint = new THREE.Mesh(bodyGeo(t), mats["tint-" + st.glass]);
    tint.renderOrder = 4;
    const shine = new THREE.Mesh(bodyGeo(t), mats.shine);
    shine.renderOrder = 5;
    g.add(tint, shine);
  }
  if (SHAPES[t].emboss) {
    const em = new THREE.Mesh(embossGeo(t), getEmbossMat());
    em.renderOrder = 6;
    g.add(em);
  }
  // débouchée : la capsule est coupée sous la bague, le col de verre apparaît
  const cap = new THREE.Mesh(opts.empty ? cutCapGeo(t) : capGeo(t), capMat(st.capsule));
  cap.castShadow = true;
  g.add(cap);
  const tx = labelTexture(w, LOW_RES), lab = st.label, band = lab.cutout || 0;
  const labelMat = new THREE.MeshStandardMaterial({ map: tx.rect, bumpMap: tx.rect, bumpScale: 0.6, roughness: 0.78, metalness: 0, envMapIntensity: 0.5 });
  const rectH = lab.h * (1 - band), rectY = lab.y - lab.h / 2 + rectH / 2;
  const label = new THREE.Mesh(labelPartGeo(t, lab.arc, rectH, rectY), labelMat);
  label.position.y = rectY;
  label.renderOrder = 3;
  g.add(label);
  let crestMat = null;
  if (band && tx.span) {
    crestMat = new THREE.MeshStandardMaterial({ map: tx.band, bumpMap: tx.band, bumpScale: 0.6, roughness: 0.78, metalness: 0, envMapIntensity: 0.5, alphaTest: 0.5, alphaToCoverage: true });
    const bh = lab.h * band, by = lab.y + lab.h / 2 - bh / 2, [u0, u1] = tx.span;
    const geo = labelPartGeo(t, lab.arc, bh, by, u0, u1).clone();
    // l'UV horizontal de ce morceau correspond à [u0,u1] de la texture de bande
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, u0 + uv.getX(i) * (u1 - u0));
    const crest = new THREE.Mesh(geo, crestMat);
    crest.position.y = by;
    crest.renderOrder = 3;
    g.add(crest);
  }
  const back = new THREE.Mesh(backGeo(t, st.label.y - 0.5), mats.back);
  back.position.y = st.label.y - 0.5;
  g.add(back);
  g.userData = { wineId: w.id, w, labelMat, crestMat };
  return g;
}

/* ——————————————— Bois & cave ——————————————— */
function woodTexture(base, dark, w = 512, h = 1024, rot = false) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d");
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {
    const px = Math.random() * w, a = Math.random() * 0.12;
    x.strokeStyle = dark; x.globalAlpha = a; x.lineWidth = 0.6 + Math.random() * 2.4;
    x.beginPath(); x.moveTo(px, 0);
    for (let y = 0; y <= h; y += 64) x.lineTo(px + Math.sin(y * 0.01 + i) * (2 + Math.random() * 3), y);
    x.stroke();
  }
  x.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (rot) { t.center.set(0.5, 0.5); t.rotation = Math.PI / 2; }
  return t;
}
function glowTexture(inner, outer = "rgba(255,200,140,0)") {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, inner); g.addColorStop(1, outer);
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// Mur à tasseaux de bois sombre (fond du mur des souvenirs)
function flutedTexture() {
  const c = document.createElement("canvas"); c.width = 512; c.height = 512;
  const x = c.getContext("2d");
  const n = 8, w = 512 / n;
  for (let i = 0; i < n; i++) {
    const g = x.createLinearGradient(i * w, 0, (i + 1) * w, 0);
    g.addColorStop(0, "#140f0c"); g.addColorStop(0.1, "#3b2e25"); g.addColorStop(0.45, "#33281f");
    g.addColorStop(0.85, "#271e18"); g.addColorStop(1, "#100c0a");
    x.fillStyle = g; x.fillRect(i * w, 0, w, 512);
  }
  for (let i = 0; i < 700; i++) {
    x.globalAlpha = Math.random() * 0.07;
    x.fillStyle = Math.random() < 0.5 ? "#000" : "#7a604c";
    x.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 1.5, 30 + Math.random() * 90);
  }
  x.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function textTexture(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d");
  draw(x, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t;
}
// texte espacé (lettres capitales gravées), aligné à gauche ; renvoie la largeur
function spacedText(x, txt, x0, y, sp, measure = false) {
  let cx = x0;
  for (const ch of txt) { if (!measure) x.fillText(ch, cx, y); cx += x.measureText(ch).width + sp; }
  return cx - x0 - sp;
}
const SANS = 'Inter, "Helvetica Neue", Arial, sans-serif';
const SERIF = '"Cormorant Garamond", Georgia, serif';

let blackMat, interiorMat, shelfMat, beechMat, steelMat, glassMat, lcdMat, ledMat, glowMat, poolMat, shadowBlobMat;
let wallMat, oakMat, memLedMat, memGlowMat, memPoolMat;
const GLASS_OPACITY = 0.2;
function lcdTexture() {
  const c = document.createElement("canvas"); c.width = 256; c.height = 64;
  const x = c.getContext("2d");
  x.fillStyle = "#0a0b0c"; x.fillRect(0, 0, 256, 64);
  x.fillStyle = "#e9f3ff"; x.font = "600 40px Inter, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
  x.fillText("12.0°C", 128, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function initCabinetMaterials() {
  blackMat = new THREE.MeshPhysicalMaterial({ color: 0x0c0c0d, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.3, envMapIntensity: 0.7 });
  interiorMat = new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.92, envMapIntensity: 0.3 });
  shelfMat = new THREE.MeshStandardMaterial({ color: 0x1d1d1f, roughness: 0.7, envMapIntensity: 0.4 });
  beechMat = new THREE.MeshStandardMaterial({ map: woodTexture("#dcb880", "#a8773f", 512, 1024, true), roughness: 0.5, envMapIntensity: 0.7 });
  steelMat = new THREE.MeshStandardMaterial({ color: 0xc4c1bb, metalness: 0.85, roughness: 0.3, envMapIntensity: 1 });
  glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0b0d0d, roughness: 0.03, metalness: 0, transparent: true, opacity: GLASS_OPACITY, depthWrite: false,
    envMapIntensity: 1.6, specularIntensity: 1, clearcoat: 1,
  });
  lcdMat = new THREE.MeshBasicMaterial({ map: lcdTexture(), toneMapped: false });
  ledMat = new THREE.MeshStandardMaterial({ color: 0xfff6e8, emissive: 0xffe2b8, emissiveIntensity: 2.4 });
  glowMat = new THREE.MeshBasicMaterial({ map: glowTexture("rgba(255,222,180,.30)"), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  poolMat = new THREE.MeshBasicMaterial({ map: glowTexture("rgba(255,225,185,.22)"), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  shadowBlobMat = new THREE.MeshBasicMaterial({ map: glowTexture("rgba(60,40,25,.38)", "rgba(60,40,25,0)"), transparent: true, depthWrite: false });
  // mur des souvenirs : tasseaux sombres, étagères en chêne, éclairage chaud (allumé à l'arrivée)
  wallMat = new THREE.MeshStandardMaterial({ map: flutedTexture(), roughness: 0.85, envMapIntensity: 0.35 });
  oakMat = new THREE.MeshStandardMaterial({ map: woodTexture("#b98a57", "#6e4a2a", 512, 1024, true), roughness: 0.55, envMapIntensity: 0.6 });
  memLedMat = new THREE.MeshStandardMaterial({ color: 0xfff6e8, emissive: 0xffd9a8, emissiveIntensity: 2.6 });
  memGlowMat = new THREE.MeshBasicMaterial({ map: glowTexture("rgba(255,205,150,.42)"), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  memPoolMat = new THREE.MeshBasicMaterial({ map: glowTexture("rgba(255,215,165,.34)"), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
}

function buildFrame() {
  if (frame) { root.remove(frame); frame.traverse((o) => o.geometry?.dispose()); }
  frame = new THREE.Group();
  const innerTop = cabH - TOP, front = DEPTH / 2;
  let ox = 0;
  const put = (m, x, y, z) => { m.position.set(ox + x, y, z); frame.add(m); return m; };
  const box = (w, h, d, mat, x, y, z, cast = true) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.castShadow = cast; m.receiveShadow = true;
    return put(m, x, y, z);
  };
  const bodyH = cabH - FEET, midY = FEET + bodyH / 2;
  for (let c = 0; c < cabCount; c++) {
    ox = cabX(c);
    // caisson noir
    box(SIDE, bodyH, DEPTH, blackMat, -OUT_W / 2 + SIDE / 2, midY, 0);
    box(SIDE, bodyH, DEPTH, blackMat, OUT_W / 2 - SIDE / 2, midY, 0);
    box(OUT_W, 1.6, DEPTH, blackMat, 0, cabH - 0.8, 0);
    box(OUT_W - SIDE * 2, 1.6, DEPTH, blackMat, 0, FEET + 0.8, 0);
    box(OUT_W - SIDE * 2, bodyH, 1, interiorMat, 0, midY, -front + 0.5, false);
    box(MID, bodyH, DEPTH - 2, blackMat, 0, midY, -1);
    // pieds réglables
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.9, FEET, 16), steelMat), sx * (OUT_W / 2 - 4), FEET / 2, sz * (front - 4));
    for (let d = 0; d < DOORS; d++) {
      const cx = doorX(d);
      // bandeau inox avec l'afficheur de température
      box(INNER_W - 1, 6.4, 1, steelMat, cx, innerTop + 4.6, front - 4);
      put(new THREE.Mesh(new THREE.PlaneGeometry(9, 2.25), lcdMat), cx, innerTop + 4.6, front - 3.45);
      for (const s of [-1, 1]) put(new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.4, 20), ledMat), cx + s * 15, innerTop + 1.2, front - 7);
      // clayettes : plateau sombre, barre de façade en hêtre, barre d'appui pour les goulots
      for (let i = 0; i < SHELVES; i++) {
        const y = BASE + i * (SHELF_T + GAP), top = y + SHELF_T;
        box(INNER_W, SHELF_T, DEPTH - 6, shelfMat, cx, y + SHELF_T / 2, -2);
        box(INNER_W - 0.4, 2.6, 1.6, beechMat, cx, top - 0.1, front - 6.3);
        box(INNER_W - 0.4, 0.7, 0.7, steelMat, cx, top + 19, -3.4, false);
        const ceil = top + GAP;
        put(new THREE.Mesh(new THREE.BoxGeometry(INNER_W - 3, 0.3, 0.45), ledMat), cx, (i === SHELVES - 1 ? innerTop : ceil) - 0.2, front - 8);
        put(new THREE.Mesh(new THREE.PlaneGeometry(INNER_W - 0.4, GAP), glowMat), cx, ceil - GAP * 0.42, -front + 1.1);
        const pool = new THREE.Mesh(new THREE.PlaneGeometry(INNER_W - 0.4, DEPTH - 8), poolMat);
        pool.rotation.x = -Math.PI / 2; put(pool, cx, top + 0.06, -1);
      }
      // compartiment du bas : clayette de stockage à barreaux
      for (let r = 0; r < 3; r++) box(INNER_W - 0.4, 0.5, 0.5, steelMat, cx, FEET + 6 + r * 6, front - 7 - r * 2, false);
      // porte : cadre noir + verre fumé
      const x0 = cx - (INNER_W + MID) / 2 - (d === 0 ? SIDE - MID / 2 : -0.15);
      const x1 = cx + (INNER_W + MID) / 2 + (d === DOORS - 1 ? SIDE - MID / 2 : -0.15);
      const dw = x1 - x0, dh = cabH - FEET - 0.8, dcx = (x0 + x1) / 2, dcy = FEET + 0.4 + dh / 2, dz = front + 1.1, st = 2.8;
      box(st, dh, 2.2, blackMat, x0 + st / 2, dcy, dz);
      box(st, dh, 2.2, blackMat, x1 - st / 2, dcy, dz);
      box(dw, st, 2.2, blackMat, dcx, cabH - 0.4 - st / 2, dz);
      box(dw, st + 1, 2.2, blackMat, dcx, FEET + 0.4 + (st + 1) / 2, dz);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(dw - st * 2 + 0.4, dh - st * 2 - 0.6), glassMat);
      glass.renderOrder = 6; put(glass, dcx, dcy + 0.5, dz + 0.4);
      // poignée côté centre
      box(0.6, 3, 1.2, steelMat, d === 0 ? x1 - st / 2 : x0 + st / 2, cabH * 0.52, dz + 1.4, false);
    }
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(OUT_W * 1.6, DEPTH * 2.4), shadowBlobMat);
    blob.rotation.x = -Math.PI / 2; put(blob, 0, 0.05, 0);
  }
  mergeStatic(frame);
  root.add(frame);
  // la lumière principale couvre toute la rangée de caves
  const half = rowW() / 2 + 60;
  Object.assign(keyLight.shadow.camera, { left: -half, right: half });
  keyLight.shadow.camera.updateProjectionMatrix();
  if (memRoot) memRoot.position.x = memX();
  refreshShadows();
}

// La cave ne bouge pas : ses pièces sont fusionnées par matériau (une dizaine d'appels de dessin au lieu de centaines)
function mergeStatic(group) {
  group.updateMatrixWorld(true);
  const buckets = new Map();
  for (const m of [...group.children]) {
    if (!m.isMesh) continue;
    const key = [m.material.uuid, m.castShadow, m.receiveShadow, m.renderOrder].join("|");
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(m);
  }
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    const geos = list.map((m) => { const g = m.geometry.clone(); g.clearGroups(); g.applyMatrix4(m.matrix); return g; });
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    const mm = new THREE.Mesh(merged, list[0].material);
    mm.castShadow = list[0].castShadow; mm.receiveShadow = list[0].receiveShadow; mm.renderOrder = list[0].renderOrder;
    for (const m of list) { group.remove(m); m.geometry.dispose(); }
    group.add(mm);
  }
}

// Ombres : calculées seulement quand quelque chose change (et non à chaque image)
function refreshShadows() { if (renderer) renderer.shadowMap.needsUpdate = true; dirty = true; }

/* ——————————————— Clayettes et noms gravés ——————————————— */
const shelfTop = (r) => BASE + (SHELVES - 1 - r) * (SHELF_T + GAP) + SHELF_T;
function clayette(cl) {
  const c = Math.floor(cl / CL_PER_CAB), k = cl % CL_PER_CAB;
  return { c, r: Math.floor(k / DOORS), d: k % DOORS };
}
function disposeTree(o) {
  o.traverse((m) => {
    if (!m.isMesh) return;
    if (m.userData.ownGeo) m.geometry.dispose();
    for (const mat of [].concat(m.material)) { if (mat.userData?.own) { mat.map?.dispose(); mat.dispose(); } }
  });
}
// Nom du groupe gravé dans la barre de hêtre, au début de sa clayette
function buildTags(tags, animate) {
  if (tagRoot) { root.remove(tagRoot); disposeTree(tagRoot); }
  tagRoot = new THREE.Group();
  // petite carte crème clipsée sur le chant de la clayette (comme chez un caviste)
  const TH = 2.7, PPC = 48, front = DEPTH / 2;
  const meas = document.createElement("canvas").getContext("2d");
  for (const t of tags) {
    const { c, r, d } = clayette(t.cl);
    const txt = t.label.toUpperCase(), cnt = String(t.n);
    const size = 1.05 * PPC, sp = size * 0.12;
    meas.font = `600 ${size}px ${SANS}`;
    const tw = spacedText(meas, txt, 0, 0, sp, true);
    meas.font = `500 ${size * 0.9}px ${SANS}`;
    const cw = meas.measureText(cnt).width;
    // largeur de la carte selon le texte, sans dépasser la clayette
    const TW = Math.min(INNER_W - 4, Math.max(9, (tw + cw) / PPC + 3.6));
    const W = Math.round(TW * PPC), H = Math.round(TH * PPC);
    const map = textTexture(W, H, (x) => {
      x.fillStyle = "#f6efe2"; x.fillRect(0, 0, W, H);
      x.fillStyle = "rgba(120,90,60,.10)"; x.fillRect(0, H - 6, W, 6);
      x.strokeStyle = "rgba(90,60,35,.25)"; x.lineWidth = 3; x.strokeRect(1.5, 1.5, W - 3, H - 3);
      x.fillStyle = "#8c2c22"; x.fillRect(0, 0, 7, H);
      x.textBaseline = "middle";
      let s = size;
      x.font = `600 ${s}px ${SANS}`;
      // texte trop long : on le resserre pour qu'il tienne
      const room = W - 1.6 * PPC - cw - 0.8 * PPC;
      while (spacedText(x, txt, 0, 0, s * 0.12, true) > room && s > 18) { s -= 2; x.font = `600 ${s}px ${SANS}`; }
      x.fillStyle = "#2a1f17"; spacedText(x, txt, 0.8 * PPC, H / 2 + 2, s * 0.12);
      x.font = `500 ${size * 0.9}px ${SANS}`; x.fillStyle = "#9a8774"; x.textAlign = "right";
      x.fillText(cnt, W - 0.7 * PPC, H / 2 + 2);
    });
    const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.85, metalness: 0, transparent: animate, opacity: animate ? 0 : 1, envMapIntensity: 0.4 });
    mat.userData.own = true;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(TW, TH), mat);
    m.userData.ownGeo = true;
    // devant le chant de la clayette, légèrement penchée vers le haut pour se lire de face
    m.position.set(cabX(c) + doorX(d) - INNER_W / 2 + 1.6 + TW / 2, shelfTop(r) - 0.75, front - 4.85);
    m.rotation.x = -0.12;
    m.renderOrder = 2;
    tagRoot.add(m);
    if (animate) tween(0.7, (e) => { mat.opacity = e; }, ease, 0.6).then(() => { mat.transparent = false; mat.needsUpdate = true; });
  }
  root.add(tagRoot);
}

/* ——————————————— Init ——————————————— */
export async function init(canvas, callbacks) {
  canvasEl = canvas; cb = callbacks;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 650, 1500);
  envTex = studioEnvironment(renderer);
  scene.environment = envTex;
  glassEnv = studioEnvironment(renderer, 4);

  camera = new THREE.PerspectiveCamera(FOV, 1, 1, 3000);
  scene.add(camera);

  scene.add(new THREE.HemisphereLight(0xfff8ee, 0xd9ccb8, 0.85));
  keyLight = new THREE.DirectionalLight(0xfff2e2, 1.7);
  keyLight.position.set(-140, 300, 320);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.target.position.set(0, 95, 0);
  Object.assign(keyLight.shadow.camera, { left: -140, right: 140, top: 150, bottom: -150, near: 50, far: 1200 });
  keyLight.shadow.bias = -0.0004; keyLight.shadow.normalBias = 0.25; keyLight.shadow.radius = 5;
  scene.add(keyLight, keyLight.target);
  const fill = new THREE.DirectionalLight(0xffffff, 0.45);
  fill.position.set(250, 120, 220);
  scene.add(fill);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.ShadowMaterial({ opacity: 0.13 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  scene.add(floor);

  // Fond sombre et chaud derrière la bouteille sélectionnée
  const bd = document.createElement("canvas"); bd.width = bd.height = 512;
  const bx = bd.getContext("2d");
  const bg = bx.createRadialGradient(256, 212, 10, 256, 236, 360);
  bg.addColorStop(0, "#9a8468"); bg.addColorStop(0.22, "#5d4f41"); bg.addColorStop(0.5, "#2a2420"); bg.addColorStop(0.8, "#161413"); bg.addColorStop(1, "#0e0e0f");
  bx.fillStyle = bg; bx.fillRect(0, 0, 512, 512);
  const bdTex = new THREE.CanvasTexture(bd); bdTex.colorSpace = THREE.SRGBColorSpace;
  dimPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: bdTex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, fog: false }));
  dimPlane.visible = false;
  camera.add(dimPlane);

  root = new THREE.Group();
  scene.add(root);
  bottleRoot = new THREE.Group();
  root.add(bottleRoot);

  initMaterials();
  initCabinetMaterials();
  await loadFonts();

  bindPointer();
  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(loop);
}

/* ——————————————— Bouteilles & rangement ——————————————— */
// groups : [{ label, items: [w, w, …] }] dans l'ordre de rangement (une entrée par bouteille).
// Chaque groupe commence sur une nouvelle clayette ; une cave de plus s'ajoute quand la précédente est pleine.
// Avec animate, les bouteilles déjà là glissent jusqu'à leur nouvelle place.
export function setWines(groups, opts = {}) {
  if (focused && focused.userData.world === "cellar") snapHome(focused);
  const items = [], tags = [];
  let cl = 0;
  for (const g of groups) {
    const n = g.items.length;
    if (!n) continue;
    tags.push({ cl, label: g.label, n });
    g.items.forEach((w, i) => items.push({ w, cl: cl + Math.floor(i / PER_DOOR), s: i % PER_DOOR, g: g.label }));
    cl += Math.ceil(n / PER_DOOR);
  }
  const animate = !!opts.animate && bottles.length > 0;
  const need = Math.max(1, Math.ceil(cl / CL_PER_CAB));
  if (need !== cabCount || !frame) { cabCount = need; buildFrame(); }
  buildTags(tags, animate);

  // chaque cave : ses groupes (premier – dernier) et son nombre de bouteilles
  cabInfo = Array.from({ length: cabCount }, (_, c) => ({ c, groups: [], count: 0 }));
  for (const it of items) {
    const ci = cabInfo[clayette(it.cl).c];
    ci.count++;
    if (ci.groups[ci.groups.length - 1] !== it.g) ci.groups.push(it.g);
  }
  for (const ci of cabInfo) {
    const g = ci.groups;
    ci.title = !g.length ? "Vide" : g.length === 1 ? g[0] : `${g[0]} – ${g[g.length - 1]}`;
  }
  buildCabLabels();

  const old = new Map(bottles.map((b) => [b.userData.key, b]));
  const seen = new Map(), next = [];
  items.forEach(({ w, cl: k, s }, i) => {
    const n = seen.get(w.id) || 0;
    seen.set(w.id, n + 1);
    const key = w.id + "#" + n, sig = labelKey(w, 0);
    const { c, r, d } = clayette(k);
    const home = new THREE.Vector3(cabX(c) + doorX(d) - INNER_W / 2 + 0.8 + SLOT * (s + 0.5), shelfTop(r) + 0.3, BOTTLE_Z);
    const rotY = (Math.sin(i * 12.9898) * 43758.5453 % 1) * 0.06;
    let b = old.get(key);
    if (b) old.delete(key);
    if (b && b.userData.sig !== sig) { removeBottle(b, animate); b = null; }
    const fresh = !b;
    if (fresh) {
      b = makeBottle(w);
      Object.assign(b.userData, { key, sig, world: "cellar", push: 0 });
      b.rotation.set(TILT, rotY, 0);
      bottleRoot.add(b);
    }
    b.userData.w = w; b.userData.wineId = w.id; b.userData.idx = i;
    const from = b.position.clone();
    b.userData.home = { pos: home, rotY, rotX: TILT };
    if (!animate) {
      b.position.copy(home); b.position.z += b.userData.push; b.rotation.y = rotY;
    } else if (fresh) {
      b.position.copy(home); b.scale.setScalar(0.001);
      tween(0.55, (e) => b.scale.setScalar(Math.max(0.001, e)), easeOutBack, 0.45 + Math.min(0.5, i * 0.008));
    } else if (from.distanceToSquared(home) > 0.01) {
      moveBottle(b, from, Math.min(0.55, i * 0.009));
    }
    next.push(b);
  });
  for (const b of old.values()) removeBottle(b, animate);
  bottles = next;
  if (animate) shadowUntil = performance.now() + 2200;
  cellar.x = clampX(cellar, cellar.x); cellar.y = clampY(cellar, cellar.y);
  curCab = -1;
  cb.onCabinets?.(cabInfo.map(({ c, title, count }) => ({ c, title, count })));
  refreshShadows();
}
// glissement en arc : la bouteille sort un peu de la clayette, voyage, puis se repose
function moveBottle(b, from, delay) {
  const r0 = b.rotation.y, tmp = new THREE.Vector3();
  const lift = Math.min(40, 10 + from.distanceTo(b.userData.home.pos) * 0.08);
  b.userData.moving = true;
  tween(1.0, (e) => {
    const h = b.userData.home, s = Math.sin(Math.PI * e);
    tmp.copy(h.pos); tmp.z += b.userData.push;
    b.position.lerpVectors(from, tmp, e);
    b.position.y += 4 * s; b.position.z += lift * s;
    b.rotation.y = r0 + (h.rotY - r0) * e + s * 0.35;
  }, ease, delay).then(() => { b.userData.moving = false; });
}
function removeBottle(b, animate) {
  const done = () => { b.parent?.remove(b); disposeTree(b); };
  if (!animate) { done(); return; }
  const s0 = b.scale.x;
  tween(0.35, (e) => b.scale.setScalar(Math.max(0.001, s0 * (1 - e)))).then(done);
}
const easeOutBack = (t) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

export function setFilter(fn) {
  for (const b of bottles) {
    if (b === focused) continue;
    const on = fn(b.userData.w);
    b.userData.dim = !on;
    b.traverse((m) => {
      if (!m.isMesh) return;
      m.userData.orig ??= m.material;
      m.material = on ? m.userData.orig : mats.ghost;
      m.castShadow = on;
    });
    const from = b.userData.push, to = on ? 0 : -7;
    if (from !== to) tween(0.45, (e) => {
      b.userData.push = from + (to - from) * e;
      if (!b.userData.moving) b.position.z = b.userData.home.pos.z + b.userData.push;
    }).then(refreshShadows);
  }
  refreshShadows();
}

/* ——————————————— Étiquettes des caves (vue d'ensemble) ——————————————— */
function buildCabLabels() {
  const el = cb.labelsEl;
  if (!el) return;
  el.innerHTML = cabCount > 1 ? cabInfo.map((ci) => `
    <button class="cab-label" data-c="${ci.c}">
      <b>Cave ${ci.c + 1}</b><span>${esc(ci.title)}</span><em>${ci.count} bouteille${ci.count > 1 ? "s" : ""}</em>
    </button>`).join("") : "";
}
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const tmpV = new THREE.Vector3();
function placeCabLabels() {
  const el = cb.labelsEl;
  if (!el || cabCount < 2) return;
  const w = canvasEl.clientWidth, h = canvasEl.clientHeight;
  root.updateMatrixWorld();
  el.querySelectorAll(".cab-label").forEach((b) => {
    const c = +b.dataset.c;
    tmpV.set(cabX(c), cabH + 10, 0).applyMatrix4(root.matrixWorld).project(camera);
    b.style.transform = `translate(${((tmpV.x + 1) / 2) * w}px, ${((1 - tmpV.y) / 2) * h}px) translate(-50%, -100%)`;
  });
}

/* ——————————————— Mondes : bornes et caméra ——————————————— */
function viewWOf(W) {
  const cw = canvasEl.clientWidth;
  if (W === memw) return Math.min(memLen * 1.04 + 10, Math.max(50, cw / 7.4));
  // assez près pour lire les étiquettes (≈ 8 px par cm à l'écran)
  return Math.min(OUT_W * 1.06, Math.max(44, cw / 8));
}
const viewHOf = (W) => viewWOf(W) / camera.aspect;
function boundsOf(W) {
  if (W === memw) return { x0: -4, x1: memLen + 4, y0: -16, y1: memTop + 34 };
  return { x0: -rowW() / 2 - 1.5, x1: rowW() / 2 + 1.5, y0: 2, y1: cabH + 6 };
}
function clampX(W, x) {
  const b = boundsOf(W), vw = viewWOf(W);
  if (b.x1 - b.x0 <= vw) return (b.x0 + b.x1) / 2;
  return THREE.MathUtils.clamp(x, b.x0 + vw / 2, b.x1 - vw / 2);
}
function clampY(W, y) {
  const b = boundsOf(W), vh = viewHOf(W);
  const lo = b.y0 + vh / 2, hi = b.y1 - vh / 2;
  return lo > hi ? (b.y0 + b.y1) / 2 : THREE.MathUtils.clamp(y, lo, hi);
}
function poseOf(W, x = W.x, y = W.y) {
  const d = (viewHOf(W) / 2) / TAN + W.pull;
  if (W === memw) {
    const ox = memRoot ? memRoot.position.x : memX();
    return { rot: 0, pos: new THREE.Vector3(ox + x, y + d * 0.1, M.D / 2 + d), tgt: new THREE.Vector3(ox + x, y - 2, 0) };
  }
  // légèrement au-dessus : les étiquettes inclinées se présentent face à nous
  return { rot: 0, pos: new THREE.Vector3(x, y + d * 0.12, DEPTH / 2 + d), tgt: new THREE.Vector3(x, y - 3, 0) };
}
function overviewPose() {
  const a = camera.aspect, portrait = a < 0.9, rot = 0.55;
  // toutes les caves, un peu au loin, décalées à gauche de l'écran
  const span = rowW() * Math.cos(rot) + DEPTH * Math.sin(rot);
  // plusieurs caves en portrait : un peu plus de marge, la plus proche paraît plus grande
  const distW = span / ((portrait ? (cabCount > 1 ? 0.6 : 0.68) : 0.42) * 2 * TAN * a);
  const distH = cabH / ((portrait ? 0.6 : 0.72) * 2 * TAN);
  const dist = Math.max(distW, distH);
  // brume réglée sur la distance : les caves restent nettes, même nombreuses
  scene.fog.near = Math.max(650, dist * 1.15); scene.fog.far = scene.fog.near + 850;
  const visW = 2 * dist * TAN * a, visH = 2 * dist * TAN;
  const tx = (0.5 - (portrait ? (cabCount > 1 ? 0.43 : 0.39) : 0.3)) * visW;
  return {
    rot,
    pos: new THREE.Vector3(tx + 40, cabH * 0.8, dist),
    tgt: new THREE.Vector3(tx, cabH * 0.5 + visH * (portrait ? 0.012 : 0.02), 0),
  };
}
function applyPose(p) {
  root.rotation.y = p.rot;
  camera.position.copy(p.pos);
  camera.lookAt(p.tgt);
}
const lerpPose = (a, b, e) => ({
  rot: a.rot + (b.rot - a.rot) * e,
  pos: a.pos.clone().lerp(b.pos, e),
  tgt: a.tgt.clone().lerp(b.tgt, e),
});
// grand voyage : la caméra prend de la hauteur et du recul en chemin
function flight(a, b, e) {
  const p = lerpPose(a, b, e), s = Math.sin(Math.PI * e);
  p.pos.z += s * 320; p.pos.y += s * 70; p.tgt.y += s * 30;
  return p;
}
let currentPose = null;

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function tween(dur, fn, ez = ease, delay = 0) {
  return new Promise((res) => tweens.push({ t0: performance.now() + delay * 1000, dur: dur * 1000, fn, ez, res }));
}

export function getMode() { return mode; }

let entering = null;
export function toCabinet(c = 0) {
  if (!Number.isInteger(c)) c = 0;
  if (mode === "cabinet") return Promise.resolve();
  if (mode === "to-cabinet" && entering) return entering;
  if (mode === "focus") return unfocus();
  if (mode !== "overview") return Promise.resolve();
  mode = "to-cabinet";
  cellar.vx = cellar.vy = 0;
  cellar.y = clampY(cellar, cabH);
  cellar.x = clampX(cellar, cabX(c) - OUT_W);
  const from = currentPose || overviewPose(), g0 = glassMat.opacity;
  entering = tween(1.5, (e) => { currentPose = lerpPose(from, poseOf(cellar), e); glassMat.opacity = g0 * (1 - e); })
    .then(() => { mode = "cabinet"; entering = null; });
  return entering;
}
export async function toOverview() {
  if (mode === "focus") await unfocus();
  if (mode !== "cabinet") return;
  mode = "to-overview";
  const from = currentPose;
  await tween(1.4, (e) => { currentPose = lerpPose(from, overviewPose(), e); glassMat.opacity = GLASS_OPACITY * e; });
  mode = "overview";
}
// Aller d'une cave à l'autre : travelling latéral avec un léger recul au milieu du trajet
export function goToCabinet(c) {
  if (mode !== "cabinet" || traveling) return Promise.resolve();
  const x0 = cellar.x, x1 = clampX(cellar, cabX(c) - OUT_W / 2 + viewWOf(cellar) / 2);
  const dist = Math.abs(x1 - x0);
  if (dist < 1) return Promise.resolve();
  traveling = true; cellar.vx = cellar.vy = 0;
  return tween(Math.min(1.7, 0.75 + dist / 420), (e) => {
    cellar.x = x0 + (x1 - x0) * e;
    cellar.pull = Math.sin(Math.PI * e) * Math.min(170, dist * 0.5);
  }).then(() => { cellar.pull = 0; traveling = false; });
}

/* ——————————————— Mur des souvenirs ——————————————— */
// une étagère par année (la plus récente en haut), les bouteilles bues de gauche à droite dans l'ordre des dates
const M = { ROW: 46, SP: 11.8, D: 24, T: 3.4, L0: 42, R0: 14, FLOOR: 16 };
let memRoot = null, memBottleRoot = null, memBottles = [], memLen = 160, memTop = 100, memRows = [], backTo = "overview";
const memX = () => rowW() / 2 + 2400;
const memRowTop = (i) => M.FLOOR + (Math.max(1, memRows.length) - 1 - i) * M.ROW;

// rows : [{ label, items: [{ id, w, tag }] }], année la plus récente d'abord
export function setMemories(rows) {
  if (!scene) return;
  if (focused && focused.userData.world === "mem") snapHome(focused);
  if (!memRoot) {
    memRoot = new THREE.Group();
    memRoot.visible = mode === "memories";
    scene.add(memRoot);
  }
  memRoot.position.x = memX();
  for (const ch of [...memRoot.children]) { memRoot.remove(ch); disposeTree(ch); }
  memRows = rows;
  const R = Math.max(1, rows.length);
  const maxN = Math.max(9, ...rows.map((r) => r.items.length));
  memLen = M.L0 + maxN * M.SP + M.R0;
  memTop = M.FLOOR + R * M.ROW + 4;
  const st = new THREE.Group(), own = [];
  const put = (m, x, y, z) => { m.position.set(x, y, z); st.add(m); return m; };
  const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.receiveShadow = true; return put(m, x, y, z); };
  // mur à tasseaux, assez grand pour ne jamais voir ses bords
  const wallW = memLen + 260, wallH = memTop + 200;
  const wm = wallMat.clone(); wm.map = wallMat.map.clone(); wm.map.needsUpdate = true; wm.map.repeat.set(wallW / 36, wallH / 36); wm.userData.own = true;
  put(new THREE.Mesh(new THREE.PlaneGeometry(wallW, wallH), wm), memLen / 2, wallH / 2 - 90, -M.D / 2 - 0.4);
  // corniche lumineuse en haut du mur
  box(memLen + 20, 1.2, 4, oakMat, memLen / 2, memTop + 3, -M.D / 2 + 2);
  put(new THREE.Mesh(new THREE.BoxGeometry(memLen + 10, 0.3, 0.5), memLedMat), memLen / 2, memTop + 2.2, -M.D / 2 + 3.6);
  const shelfL = memLen - 8;
  const bottleGroup = new THREE.Group();
  memBottles = [];
  for (let i = 0; i < R; i++) {
    const row = rows[i] || { label: String(new Date().getFullYear()), items: [] };
    const top = memRowTop(i);
    // étagère flottante en chêne, LED sous l'étagère du dessus, halo sur le mur
    box(shelfL, M.T, M.D, oakMat, memLen / 2, top - M.T / 2, 0);
    put(new THREE.Mesh(new THREE.BoxGeometry(shelfL - 6, 0.3, 0.6), memLedMat), memLen / 2, top + M.ROW - M.T - 0.3, M.D / 2 - 3);
    for (let x0 = 4; x0 < 4 + shelfL; x0 += 60) {
      const w = Math.min(60, 4 + shelfL - x0);
      put(new THREE.Mesh(new THREE.PlaneGeometry(w + 30, M.ROW * 0.95), memGlowMat), x0 + w / 2, top + M.ROW * 0.45, -M.D / 2 + 0.2);
    }
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(shelfL, M.D - 2), memPoolMat);
    pool.rotation.x = -Math.PI / 2; put(pool, memLen / 2, top + 0.05, 0);
    // l'année, en grands chiffres dorés sur le mur
    const year = textTexture(512, 300, (x, W, H) => {
      x.textAlign = "center"; x.textBaseline = "alphabetic";
      x.fillStyle = "#d9b879"; x.font = `600 190px ${SERIF}`;
      x.fillText(row.label, W / 2, 190);
      x.fillStyle = "rgba(225,205,170,.75)"; x.font = `500 34px ${SANS}`;
      const n = row.items.length, t = n ? `${n} bouteille${n > 1 ? "s" : ""}` : "";
      spacedText(x, t.toUpperCase(), (W - spacedText(x, t.toUpperCase(), 0, 0, 6, true)) / 2, 262, 6);
    });
    const ym = new THREE.MeshBasicMaterial({ map: year, transparent: true, depthWrite: false, toneMapped: false });
    ym.userData.own = true;
    put(new THREE.Mesh(new THREE.PlaneGeometry(34, 20), ym), M.L0 / 2 + 2, top + 16, -M.D / 2 + 0.6).userData.ownGeo = true;
    // dates gravées sur la tranche de l'étagère, sous chaque bouteille
    const ppc = Math.min(30, 4000 / shelfL);
    const strip = textTexture(Math.round(shelfL * ppc), Math.round(M.T * ppc), (x, W, H) => {
      x.textAlign = "center"; x.textBaseline = "middle"; x.font = `600 ${1.15 * ppc}px ${SANS}`;
      row.items.forEach((it, j) => {
        const cx = (M.L0 + M.SP * (j + 0.5) - 4) * ppc, t = it.tag.toUpperCase();
        const w = spacedText(x, t, 0, 0, 0.12 * ppc, true);
        x.fillStyle = "rgba(255,232,200,.4)"; spacedText(x, t, cx - w / 2, H / 2 + 1.5, 0.12 * ppc);
        x.fillStyle = "rgba(58,34,16,.9)"; spacedText(x, t, cx - w / 2, H / 2, 0.12 * ppc);
      });
    });
    const sm = new THREE.MeshStandardMaterial({ map: strip, transparent: true, depthWrite: false, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 });
    sm.userData.own = true;
    const sMesh = put(new THREE.Mesh(new THREE.PlaneGeometry(shelfL, M.T), sm), memLen / 2, top - M.T / 2, M.D / 2 + 0.03);
    sMesh.userData.ownGeo = true; sMesh.renderOrder = 2;
    // les bouteilles vides
    row.items.forEach((it, j) => {
      const x = M.L0 + M.SP * (j + 0.5), z = 1.5;
      const blob = new THREE.Mesh(new THREE.PlaneGeometry(13, 13), shadowBlobMat);
      blob.rotation.x = -Math.PI / 2; put(blob, x, top + 0.06, z);
      const b = makeBottle(it.w, { empty: true });
      const rotY = (Math.sin((i * 31 + j) * 12.9898) * 43758.5453 % 1) * 0.12;
      b.position.set(x, top, z); b.rotation.set(0, rotY, 0);
      b.traverse((m) => { if (m.isMesh) m.castShadow = false; });
      Object.assign(b.userData, { memId: it.id, world: "mem", push: 0, home: { pos: b.position.clone(), rotY, rotX: 0 } });
      bottleGroup.add(b);
      memBottles.push(b);
    });
  }
  mergeStatic(st);
  st.traverse((m) => { if (m.isMesh && !m.userData.ownGeo && !m.geometry.userData?.shared) m.userData.ownGeo = true; });
  memRoot.add(st);
  memBottleRoot = bottleGroup;
  memRoot.add(bottleGroup);
  memw.x = clampX(memw, memw.x); memw.y = clampY(memw, memw.y);
  dirty = true;
}
// hauteur de caméra pour cadrer une étagère, un peu basse pour laisser la place à l'en-tête
const memRowY = (i) => memRowTop(i) + 16 + viewHOf(memw) * 0.08;
// place la caméra sur la bouteille la plus récente
function memStart() {
  const n = memRows[0]?.items.length || 0;
  memw.pull = 0;
  memw.y = clampY(memw, memRowY(0));
  memw.x = clampX(memw, M.L0 + n * M.SP - viewWOf(memw) / 2 + 8);
}
function setMemLights(k) {
  memGlowMat.opacity = k; memPoolMat.opacity = k; memLedMat.emissiveIntensity = 2.6 * k;
}
export async function toMemories() {
  if (mode === "focus") await unfocus();
  if (mode !== "overview" && mode !== "cabinet") return;
  if (!memRoot) setMemories([]);
  backTo = mode;
  mode = "to-mem";
  pendingRow = null;
  memRoot.position.x = memX();
  memRoot.visible = true;
  memStart();
  setMemLights(0);
  const from = currentPose || overviewPose(), g0 = glassMat.opacity;
  // les lumières du mur s'allument à l'approche
  tween(1.3, (e) => setMemLights(e), ease, 1.25);
  await tween(2.1, (e) => { currentPose = flight(from, poseOf(memw), e); glassMat.opacity = g0 * (1 - e); });
  root.visible = false;
  mode = "memories";
  if (pendingRow != null) { const i = pendingRow; pendingRow = null; goToMemRow(i); }
}
export async function leaveMemories() {
  if (mode === "focus") await unfocus();
  if (mode !== "memories") return;
  mode = "to-cellar";
  root.visible = true;
  const from = currentPose, dest = backTo;
  await tween(2.1, (e) => {
    currentPose = flight(from, dest === "cabinet" ? poseOf(cellar) : overviewPose(), e);
    if (dest !== "cabinet") glassMat.opacity = GLASS_OPACITY * e;
  });
  memRoot.visible = false;
  mode = dest;
}
// sauter à une année : la caméra glisse jusqu'à l'étagère
let pendingRow = null;
export function goToMemRow(i) {
  if (mode === "to-mem") { pendingRow = i; return; }
  if (mode !== "memories" || traveling) return;
  const n = memRows[i]?.items.length || 0;
  const y1 = clampY(memw, memRowY(i)), x1 = clampX(memw, M.L0 + n * M.SP - viewWOf(memw) / 2 + 8);
  const y0 = memw.y, x0 = memw.x, dist = Math.hypot(x1 - x0, y1 - y0);
  if (dist < 1) return;
  traveling = true; memw.vx = memw.vy = 0;
  tween(Math.min(1.5, 0.7 + dist / 400), (e) => {
    memw.x = x0 + (x1 - x0) * e; memw.y = y0 + (y1 - y0) * e;
    memw.pull = Math.sin(Math.PI * e) * Math.min(120, dist * 0.4);
  }).then(() => { memw.pull = 0; traveling = false; });
}
export const memRowCount = () => memRows.length;

/* ——————————————— Focus bouteille ——————————————— */
function focusTarget() {
  const wide = camera.aspect > 1.05;
  camera.updateMatrixWorld();
  if (!wide) {
    const D = 30 / (0.76 * TAN), h = D * TAN;
    return { D, pos: camera.localToWorld(new THREE.Vector3(0, 0.42 * h - 15.5, -D)) };
  }
  const D = 30 / (1.3 * TAN), h = D * TAN;
  return { D, pos: camera.localToWorld(new THREE.Vector3(-0.3 * h * camera.aspect, -15.5, -D)) };
}
function setDimSolid(solid) {
  // opaque une fois en place : le vin translucide « voit » alors ce fond
  if (dimPlane.material.transparent === !solid) return;
  dimPlane.material.transparent = !solid;
  dimPlane.material.depthWrite = solid;
  dimPlane.material.needsUpdate = true;
}
function showDim(D) {
  const d = D + 22, h = 2 * d * TAN * 1.15;
  dimPlane.scale.set(h * camera.aspect * 1.15, h, 1);
  dimPlane.position.set(0, 0, -d);
  setDimSolid(false);
  dimPlane.visible = true;
}
function hideDim(now) { if (now) { setDimSolid(false); dimPlane.material.opacity = 0; dimPlane.visible = false; } }

let focusShadow = null;
function attachShadow(b) {
  if (!focusShadow) {
    focusShadow = new THREE.Mesh(new THREE.PlaneGeometry(17, 17), shadowBlobMat.clone());
    focusShadow.rotation.x = -Math.PI / 2;
    focusShadow.position.y = 0.03;
    focusShadow.renderOrder = 1;
  }
  focusShadow.material.opacity = 0;
  b.add(focusShadow);
}
function setLabelRes(b, res) {
  const t = labelTexture(b.userData.w, res);
  // envoi au GPU tout de suite : pas de saccade sur la première image de l'animation
  renderer.initTexture(t.rect); if (t.band) renderer.initTexture(t.band);
  const { labelMat, crestMat } = b.userData;
  labelMat.map = labelMat.bumpMap = t.rect; labelMat.needsUpdate = true;
  if (crestMat && t.band) { crestMat.map = crestMat.bumpMap = t.band; crestMat.needsUpdate = true; }
}
const worldOf = (b) => (b.userData.world === "mem" ? memw : cellar);
const parentOf = (b) => (b.userData.world === "mem" ? memBottleRoot : bottleRoot);
const baseMode = (b) => (b.userData.world === "mem" ? "memories" : "cabinet");
// remet une bouteille sortie à sa place, sans animation
function snapHome(b) {
  if (focusShadow) b.remove(focusShadow);
  parentOf(b).attach(b);
  b.position.copy(b.userData.home.pos); b.position.z += b.userData.push || 0;
  b.rotation.set(b.userData.home.rotX, b.userData.home.rotY, 0);
  b.scale.setScalar(1);
  focused = null;
  hideDim(true);
  if (mode === "focus" || mode === "to-focus") mode = baseMode(b);
}

async function focusBottle(b) {
  const W = worldOf(b), base = baseMode(b);
  if (mode === "focus" && focused) await unfocus();
  if (mode !== base) return;
  mode = "to-focus";
  // amener l'étagère dans le champ
  const wp = parentOf(b).localToWorld(b.userData.home.pos.clone());
  const lx = W === memw ? wp.x - memRoot.position.x : wp.x;
  const goal = clampY(W, wp.y + 15), goalX = clampX(W, lx);
  if (Math.abs(goal - W.y) > 4 || Math.abs(goalX - W.x) > 4) {
    const p0 = W.y, x0 = W.x;
    await tween(0.6, (e) => { W.y = p0 + (goal - p0) * e; W.x = x0 + (goalX - x0) * e; currentPose = poseOf(W); });
  }
  W.vx = W.vy = 0;
  currentPose = poseOf(W);
  applyPose(currentPose); camera.updateMatrixWorld();
  focused = b;
  scene.attach(b);
  const start = b.position.clone(), r0 = b.rotation.y, t0 = b.rotation.x;
  const { D, pos: end } = focusTarget();
  const ctrl = start.clone().add(new THREE.Vector3(0, 6, 26));
  showDim(D);
  setLabelRes(b, HI_RES);
  attachShadow(b);
  spin = 0; spinVel = 0;
  const q = new THREE.Vector3();
  await tween(1.05, (e) => {
    const u = 1 - e;
    q.set(0, 0, 0).addScaledVector(start, u * u).addScaledVector(ctrl, 2 * u * e).addScaledVector(end, e * e);
    b.position.copy(q);
    b.rotation.y = r0 * (1 - e) + Math.sin(e * Math.PI) * 0.6;
    b.rotation.x = t0 * (1 - e);
    dimPlane.material.opacity = e;
    focusShadow.material.opacity = Math.max(0, e * 1.6 - 0.6);
  });
  setDimSolid(true);
  b.userData.focusBase = end.clone();
  lastInteract = performance.now();
  mode = "focus";
}
export async function focus(wineId, idx) {
  const b = bottles.find((g) => g.userData.idx === idx && g.userData.wineId === wineId) || bottles.find((g) => g.userData.wineId === wineId);
  if (!b) return;
  if (mode === "overview" || mode === "to-cabinet") {
    if (mode === "overview") await toCabinet(clayetteCab(b)); else await entering;
  }
  await focusBottle(b);
}
const clayetteCab = (b) => Math.max(0, Math.min(cabCount - 1, Math.round(b.userData.home.pos.x / PITCH + (cabCount - 1) / 2)));
export async function focusMemory(memId) {
  const b = memBottles.find((g) => g.userData.memId === memId);
  if (b) await focusBottle(b);
}

export async function unfocus() {
  if (mode !== "focus" || !focused) return;
  const b = focused;
  mode = "to-base";
  const home = parentOf(b).localToWorld(b.userData.home.pos.clone().add(new THREE.Vector3(0, 0, b.userData.push || 0)));
  const start = b.position.clone(), r0 = b.rotation.y % (Math.PI * 2);
  const ctrl = home.clone().add(new THREE.Vector3(0, 6, 26));
  setDimSolid(false);
  const op = dimPlane.material.opacity;
  const q = new THREE.Vector3();
  await tween(0.85, (e) => {
    const u = 1 - e;
    q.set(0, 0, 0).addScaledVector(start, u * u).addScaledVector(ctrl, 2 * u * e).addScaledVector(home, e * e);
    b.position.copy(q);
    b.rotation.y = r0 + (b.userData.home.rotY - r0) * e;
    b.rotation.x = b.userData.home.rotX * e;
    dimPlane.material.opacity = op * (1 - e);
    if (focusShadow) focusShadow.material.opacity = 1 - Math.min(1, e * 3);
  });
  if (focusShadow) b.remove(focusShadow);
  parentOf(b).attach(b);
  b.position.copy(b.userData.home.pos); b.position.z += b.userData.push || 0;
  b.rotation.set(b.userData.home.rotX, b.userData.home.rotY, 0);
  setLabelRes(b, LOW_RES);
  hideDim(true);
  focused = null;
  mode = baseMode(b);
  refreshShadows();
}

// Bouteille débouchée : elle s'élève et disparaît
export async function dropFocused() {
  if (!focused) return;
  const b = focused;
  mode = "to-base";
  setDimSolid(false);
  if (focusShadow) b.remove(focusShadow);
  const p0 = b.position.clone(), op = dimPlane.material.opacity;
  await tween(0.7, (e) => {
    b.position.y = p0.y + 18 * e;
    b.scale.setScalar(1 - 0.5 * e);
    b.rotation.y += 0.08;
    dimPlane.material.opacity = op * (1 - e);
  });
  scene.remove(b);
  bottles = bottles.filter((x) => x !== b);
  memBottles = memBottles.filter((x) => x !== b);
  focused = null;
  hideDim(true);
  mode = baseMode(b);
  refreshShadows();
}

/* ——————————————— Entrées ——————————————— */
const worldNow = () => (mode === "memories" ? memw : mode === "cabinet" ? cellar : null);
function bindPointer() {
  let p = null;
  const ray = new THREE.Raycaster();
  canvasEl.addEventListener("pointerdown", (e) => {
    p = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, axis: null };
    try { canvasEl.setPointerCapture(e.pointerId); } catch {}
    cellar.vx = cellar.vy = memw.vx = memw.vy = 0; spinVel = 0;
  });
  canvasEl.addEventListener("pointermove", (e) => {
    if (!p) return;
    const dx = e.clientX - p.lx, dy = e.clientY - p.ly;
    p.lx = e.clientX; p.ly = e.clientY;
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 7) p.moved = true;
    if (!p.moved) return;
    const W = worldNow();
    if (W && !traveling) {
      // un seul axe par geste : le sens dominant au départ du glisser (jamais de diagonale)
      if (!p.axis) p.axis = Math.abs(e.clientX - p.x) > Math.abs(e.clientY - p.y) ? "x" : "y";
      const k = viewHOf(W) / canvasEl.clientHeight;
      if (p.axis === "y") { W.y = clampY(W, W.y + dy * k); W.vy = dy * k; W.vx = 0; }
      else { W.x = clampX(W, W.x - dx * k); W.vx = -dx * k; W.vy = 0; }
      dirty = true;
    } else if (mode === "focus") {
      spin += dx * 0.012; spinVel = dx * 0.012; lastInteract = performance.now();
    }
  });
  const up = (e) => {
    if (!p) return;
    const tap = !p.moved; p = null;
    if (tap) onTap(e, ray);
  };
  canvasEl.addEventListener("pointerup", up);
  canvasEl.addEventListener("pointercancel", () => { p = null; });
  canvasEl.addEventListener("wheel", (e) => {
    const W = worldNow();
    if (!W || traveling) return;
    e.preventDefault();
    const k = viewHOf(W) / canvasEl.clientHeight * 0.6;
    if (e.shiftKey && !e.deltaX) W.x = clampX(W, W.x + e.deltaY * k);
    else if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) W.x = clampX(W, W.x + e.deltaX * k);
    else W.y = clampY(W, W.y - e.deltaY * k);
    dirty = true;
  }, { passive: false });
}

function onTap(e, ray) {
  const r = canvasEl.getBoundingClientRect();
  const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const find = (list, prop) => {
    const hit = ray.intersectObjects(list, true)[0];
    let o = hit?.object;
    while (o && o.userData[prop] === undefined) o = o.parent;
    return o;
  };
  if (mode === "overview") {
    const hit = ray.intersectObject(root, true)[0];
    if (!hit) return;
    // la cave touchée
    const lx = root.worldToLocal(hit.point.clone()).x;
    const c = Math.max(0, Math.min(cabCount - 1, Math.round(lx / PITCH + (cabCount - 1) / 2)));
    cb.onCabinetTap?.(c);
  } else if (mode === "cabinet") {
    const o = find(bottles, "wineId");
    if (o && !o.userData.dim) cb.onBottleTap?.(o.userData.wineId, o.userData.idx);
  } else if (mode === "memories") {
    const o = find(memBottles, "memId");
    if (o) cb.onMemoryTap?.(o.userData.memId);
  } else if (mode === "focus") {
    if (!ray.intersectObject(focused, true).length) cb.onBackgroundTap?.();
  }
}

function resize() {
  const w = canvasEl.clientWidth, h = canvasEl.clientHeight;
  // écran pas encore affiché (appli lancée en arrière-plan) : on attend d'avoir une vraie taille
  if (!w || !h) { requestAnimationFrame(resize); return; }
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  for (const W of [cellar, memw]) { W.x = clampX(W, W.x); W.y = clampY(W, W.y); }
  if (mode === "cabinet") currentPose = poseOf(cellar);
  if (mode === "memories") currentPose = poseOf(memw);
  dirty = true;
}

/* ——————————————— Boucle ——————————————— */
function loop(now) {
  requestAnimationFrame(loop);
  const active = tweens.length > 0;
  for (const t of [...tweens]) {
    if (now < t.t0) continue;
    const k = Math.min(1, (now - t.t0) / t.dur);
    t.fn(t.ez(k));
    if (k >= 1) { tweens.splice(tweens.indexOf(t), 1); t.res(); }
  }
  const time = now / 1000;
  if (mode === "overview") {
    const p = overviewPose();
    p.pos.x += Math.sin(time * 0.25) * 10;
    p.pos.y += Math.sin(time * 0.33) * 5;
    currentPose = p;
  } else if (mode === "cabinet" || mode === "memories") {
    const W = mode === "memories" ? memw : cellar;
    if (Math.abs(W.vy) > 0.01) { W.vy *= 0.92; W.y = clampY(W, W.y + W.vy); dirty = true; }
    if (Math.abs(W.vx) > 0.01) { W.vx *= 0.92; W.x = clampX(W, W.x + W.vx); dirty = true; }
    currentPose = poseOf(W);
    if (W === cellar && cabCount > 1) {
      // cave la plus proche du centre de l'écran
      const c = Math.max(0, Math.min(cabCount - 1, Math.round(cellar.x / PITCH + (cabCount - 1) / 2)));
      if (c !== curCab) { curCab = c; cb.onCabinet?.(c); }
    }
  } else if (mode === "focus" && focused) {
    spinVel *= 0.94; spin += spinVel;
    const idle = (now - lastInteract) / 1000;
    // après quelques secondes, l'étiquette revient face à nous
    if (idle > 2.5) { const home = Math.round(spin / (Math.PI * 2)) * Math.PI * 2; spin += (home - spin) * 0.035; }
    const sway = idle > 1.5 ? Math.sin((idle - 1.5) * 0.7) * 0.3 * Math.min(1, idle - 1.5) : 0;
    focused.rotation.y = spin + sway;
    focused.position.y = focused.userData.focusBase.y;
  }
  if (!currentPose) currentPose = overviewPose();
  const moving = (mode !== "cabinet" && mode !== "memories") || active || dirty;
  if (!moving) return;
  applyPose(currentPose);
  if (mode === "overview" || mode === "to-overview" || mode === "to-cabinet") placeCabLabels();
  // la cave pivote (entrée / sortie) ou des bouteilles se déplacent : les ombres changent
  if (root.rotation.y !== lastRot || now < shadowUntil) { lastRot = root.rotation.y; renderer.shadowMap.needsUpdate = true; }
  renderer.render(scene, camera);
  dirty = false;
  // fluidité : si les images prennent trop de temps pendant une animation, on baisse un peu la définition
  const dt = now - lastFrame; lastFrame = now;
  if (!startT) startT = now;
  if (now - startT > 4000 && dt > 0 && dt < 120 && document.visibilityState === "visible") {
    if (dt > 24) slow++; else if (slow > 0) slow -= 0.5;
    if (slow > 60 && dpr > DPR_MIN) {
      dpr = Math.max(DPR_MIN, +(dpr - 0.25).toFixed(2)); slow = 0;
      renderer.setPixelRatio(dpr); resize();
    }
  }
}
