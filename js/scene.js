// Scène 3D : la cave, les bouteilles, la caméra et les interactions.
import * as THREE from "three";
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
const SLOT = 10.8, PER = 6, SIDE = 2.6, DEPTH = 34, SHELF_T = 2.4, GAP = 36, PLINTH = 8, TOP = 3.4;
const INNER_W = PER * SLOT + 1.6, OUT_W = INNER_W + SIDE * 2;
const FOV = 32, TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const LOW_RES = 46, HI_RES = 150;

let renderer, scene, camera, root, frame, bottleRoot, dimPlane, canvasEl;
let shelfCount = 5, cabH = 0;
let mode = "overview";
let bottles = [];
let focused = null;
let cb = {};
let panY = 0, panVel = 0, spin = 0, spinVel = 0, lastInteract = 0;
let tweens = [];
let dirty = true;
const V = (x, y) => new THREE.Vector2(x, y);
const labelCache = new Map();
const geoCache = new Map();
const mats = {};
let envTex, glassEnv;

/* ——————————————— Géométries ——————————————— */
const SHAPES = {
  burgundy: { R: 4.02, body: 13.6, neck: 23.4, RN: 1.45, top: 30 },
  jura: { R: 3.92, body: 15.4, neck: 22.6, RN: 1.42, top: 30.8 },
};

function outline(type) {
  const s = SHAPES[type], p = [];
  p.push(V(0, 1.7), V(1.3, 1.3), V(2.7, 0.35), V(s.R - 0.4, 0), V(s.R - 0.06, 0.14), V(s.R, 0.55), V(s.R, s.body));
  const n = 30;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const e = type === "jura" ? Math.pow(t, 0.8) : t;
    const r = s.RN + (s.R - s.RN) * (1 + Math.cos(Math.PI * e)) / 2;
    p.push(V(r, s.body + t * (s.neck - s.body)));
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
const labelGeo = (t, arcDeg, h) => geoFor(`lbl-${t}-${arcDeg}-${h}`, () => {
  const r = SHAPES[t].R + 0.035, arc = THREE.MathUtils.degToRad(arcDeg);
  return new THREE.CylinderGeometry(r, r, h, 64, 1, true, -arc / 2, arc);
});
const backGeo = (t) => geoFor("back-" + t, () => {
  const r = SHAPES[t].R + 0.035, arc = THREE.MathUtils.degToRad(64);
  return new THREE.CylinderGeometry(r, r, 7, 24, 1, true, Math.PI - arc / 2, arc);
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
  return [res, w.domaine, w.appellation, w.cuvee, w.vintage, w.color].join("|");
}
function labelTexture(w, res) {
  const k = labelKey(w, res);
  if (labelCache.has(k)) return labelCache.get(k);
  const tex = new THREE.CanvasTexture(drawLabel(w, res));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  labelCache.set(k, tex);
  return tex;
}

/* ——————————————— Bouteille ——————————————— */
function makeBottle(w) {
  const st = styleFor(w);
  const g = new THREE.Group();
  const t = st.bottle;
  if (st.glass === "dark") {
    const body = new THREE.Mesh(bodyGeo(t), mats.dark);
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);
  } else {
    const wine = new THREE.Mesh(wineGeo(t), wineMat(st.wine || "#e6d38c", st.glass));
    wine.castShadow = true;
    g.add(wine);
    const tint = new THREE.Mesh(bodyGeo(t), mats["tint-" + st.glass]);
    tint.renderOrder = 4;
    const shine = new THREE.Mesh(bodyGeo(t), mats.shine);
    shine.renderOrder = 5;
    g.add(tint, shine);
  }
  const cap = new THREE.Mesh(capGeo(t), capMat(st.capsule));
  cap.castShadow = true;
  g.add(cap);
  const tex = labelTexture(w, LOW_RES);
  const labelMat = new THREE.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 0.6, roughness: 0.78, metalness: 0, envMapIntensity: 0.5 });
  const label = new THREE.Mesh(labelGeo(t, st.label.arc, st.label.h), labelMat);
  label.position.y = st.label.y;
  label.renderOrder = 3;
  g.add(label);
  const back = new THREE.Mesh(backGeo(t), mats.back);
  back.position.y = st.label.y - 0.5;
  g.add(back);
  g.userData = { wineId: w.id, w, labelMat };
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

let woodMat, woodMatH, backMat, ledMat, glowMat, poolMat, shadowBlobMat;
function initCabinetMaterials() {
  woodMat = new THREE.MeshStandardMaterial({ map: woodTexture("#cfae84", "#7a5532"), roughness: 0.62, envMapIntensity: 0.6 });
  woodMatH = new THREE.MeshStandardMaterial({ map: woodTexture("#cfae84", "#7a5532", 512, 1024, true), roughness: 0.62, envMapIntensity: 0.6 });
  backMat = new THREE.MeshStandardMaterial({ map: woodTexture("#5a3f2c", "#2a1a10"), roughness: 0.75, envMapIntensity: 0.4 });
  ledMat = new THREE.MeshStandardMaterial({ color: 0xfff3dc, emissive: 0xffd6a0, emissiveIntensity: 2.2 });
  glowMat = new THREE.MeshBasicMaterial({ map: glowTexture("rgba(255,205,145,.55)"), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  poolMat = new THREE.MeshBasicMaterial({ map: glowTexture("rgba(255,215,160,.35)"), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  shadowBlobMat = new THREE.MeshBasicMaterial({ map: glowTexture("rgba(60,40,25,.38)", "rgba(60,40,25,0)"), transparent: true, depthWrite: false });
}

function buildFrame() {
  if (frame) { root.remove(frame); frame.traverse((o) => o.geometry?.dispose()); }
  frame = new THREE.Group();
  cabH = PLINTH + shelfCount * (SHELF_T + GAP) + TOP;
  const box = (w, h, d, mat, x, y, z, cast = true) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true;
    frame.add(m); return m;
  };
  // côtés, dessus, socle, fond
  box(SIDE, cabH, DEPTH, woodMat, -INNER_W / 2 - SIDE / 2, cabH / 2, 0);
  box(SIDE, cabH, DEPTH, woodMat, INNER_W / 2 + SIDE / 2, cabH / 2, 0);
  box(OUT_W + 0.6, TOP, DEPTH + 0.8, woodMatH, 0, cabH - TOP / 2, 0.2);
  box(INNER_W, PLINTH - 1.5, DEPTH - 4, backMat, 0, (PLINTH - 1.5) / 2, -1.5);
  box(INNER_W, 1.2, DEPTH, woodMatH, 0, PLINTH - 0.6, 0);
  box(INNER_W, cabH - PLINTH, 1.2, backMat, 0, PLINTH + (cabH - PLINTH) / 2, -DEPTH / 2 + 0.6, false);
  for (let i = 0; i < shelfCount; i++) {
    const y = PLINTH + i * (SHELF_T + GAP);
    if (i > 0) box(INNER_W, SHELF_T, DEPTH - 1.2, woodMatH, 0, y + SHELF_T / 2, 0.6);
    const ceil = y + SHELF_T + GAP; // dessous de l'étagère au-dessus
    // ruban LED sous l'étagère du dessus
    const led = new THREE.Mesh(new THREE.BoxGeometry(INNER_W - 2, 0.35, 0.5), ledMat);
    led.position.set(0, ceil - 0.25, DEPTH / 2 - 3.2); frame.add(led);
    // halo chaud sur le fond et lumière sur la tablette
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(INNER_W - 0.2, GAP), glowMat);
    glow.position.set(0, ceil - GAP * 0.38, -DEPTH / 2 + 1.3); frame.add(glow);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(INNER_W - 0.2, DEPTH - 1.4), poolMat);
    pool.rotation.x = -Math.PI / 2; pool.position.set(0, (i === 0 ? PLINTH : y + SHELF_T) + 0.06, 1); frame.add(pool);
  }
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(OUT_W * 2.1, DEPTH * 2.6), shadowBlobMat);
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.05;
  frame.add(blob);
  root.add(frame);
}

/* ——————————————— Init ——————————————— */
export async function init(canvas, callbacks) {
  canvasEl = canvas; cb = callbacks;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 650, 1500);
  envTex = studioEnvironment(renderer);
  scene.environment = envTex;
  glassEnv = studioEnvironment(renderer, 4);

  camera = new THREE.PerspectiveCamera(FOV, 1, 1, 3000);
  scene.add(camera);

  scene.add(new THREE.HemisphereLight(0xfff8ee, 0xd9ccb8, 0.85));
  const key = new THREE.DirectionalLight(0xfff2e2, 1.7);
  key.position.set(-140, 300, 320);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.target.position.set(0, 95, 0);
  Object.assign(key.shadow.camera, { left: -140, right: 140, top: 150, bottom: -150, near: 50, far: 1200 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.25; key.shadow.radius = 5;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xffffff, 0.45);
  fill.position.set(250, 120, 220);
  scene.add(fill);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.ShadowMaterial({ opacity: 0.13 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  scene.add(floor);

  // Fond de studio crème derrière la bouteille sélectionnée (léger dégradé)
  const bd = document.createElement("canvas"); bd.width = bd.height = 512;
  const bx = bd.getContext("2d");
  const bg = bx.createRadialGradient(256, 210, 20, 256, 256, 380);
  bg.addColorStop(0, "#fbf8f2"); bg.addColorStop(0.55, "#f3ede3"); bg.addColorStop(1, "#e6dccd");
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

/* ——————————————— Bouteilles & mise en place ——————————————— */
export function setWines(list) {
  // list : bouteilles dans l'ordre de rangement [{ w }]
  for (const b of bottles) b.parent?.remove(b);
  if (focused) { focused.parent?.remove(focused); focused = null; }
  bottles = [];
  const need = Math.max(5, Math.ceil(list.length / PER));
  if (need !== shelfCount || !frame) { shelfCount = need; buildFrame(); }
  list.forEach(({ w }, i) => {
    const g = makeBottle(w);
    const comp = shelfCount - 1 - Math.floor(i / PER), k = i % PER;
    const y = PLINTH + comp * (SHELF_T + GAP) + (comp === 0 ? 0 : SHELF_T);
    g.position.set(-INNER_W / 2 + 0.8 + SLOT * (k + 0.5), y, 2.2);
    g.rotation.y = (Math.sin(i * 12.9898) * 43758.5453 % 1) * 0.22;
    g.userData.idx = i;
    g.userData.home = { pos: g.position.clone(), rotY: g.rotation.y };
    g.userData.push = 0;
    bottleRoot.add(g);
    bottles.push(g);
  });
  if (mode === "focus") { mode = "cabinet"; hideDim(true); }
  panY = clampPan(panY);
  dirty = true;
}

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
    if (from !== to) tween(0.45, (e) => { b.userData.push = from + (to - from) * e; b.position.z = b.userData.home.pos.z + b.userData.push; });
  }
  dirty = true;
}

/* ——————————————— Caméra ——————————————— */
function overviewPose() {
  const a = camera.aspect, portrait = a < 0.9;
  // la cave occupe ~58 % de la hauteur, décalée à gauche
  const dist = portrait ? 230 / (0.58 * 2 * TAN) * 0.92 : 230 / (0.62 * 2 * TAN);
  return {
    rot: 0.62,
    pos: new THREE.Vector3(portrait ? 70 : 150, cabH * 0.8, dist),
    tgt: new THREE.Vector3(portrait ? 30 : 75 * a * 0.62, cabH * (portrait ? 0.47 : 0.55), 0),
  };
}
function viewH() {
  const want = (OUT_W * 1.1) / camera.aspect;
  return THREE.MathUtils.clamp(want, 112, cabH + 16);
}
function clampPan(y) {
  const vh = viewH();
  const lo = vh / 2 - 6, hi = cabH - vh / 2 + 8;
  return lo > hi ? cabH / 2 : THREE.MathUtils.clamp(y, lo, hi);
}
function cabinetPose(y = panY) {
  const vh = viewH();
  const d = (vh / 2) / TAN;
  return { rot: 0, pos: new THREE.Vector3(0, y, DEPTH / 2 + d), tgt: new THREE.Vector3(0, y, 0) };
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
let currentPose = null;

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function tween(dur, fn, ez = ease) {
  return new Promise((res) => tweens.push({ t0: performance.now(), dur: dur * 1000, fn, ez, res }));
}

export function getMode() { return mode; }

let entering = null;
export function toCabinet() {
  if (mode === "cabinet") return Promise.resolve();
  if (mode === "to-cabinet" && entering) return entering;
  if (mode === "focus") return unfocus();
  mode = "to-cabinet";
  panY = clampPan(cabH);
  const from = currentPose || overviewPose();
  entering = tween(1.5, (e) => { currentPose = lerpPose(from, cabinetPose(), e); })
    .then(() => { mode = "cabinet"; entering = null; });
  return entering;
}
export async function toOverview() {
  if (mode === "focus") await unfocus();
  if (mode !== "cabinet") return;
  mode = "to-overview";
  const from = currentPose;
  await tween(1.4, (e) => { currentPose = lerpPose(from, overviewPose(), e); });
  mode = "overview";
}

/* ——————————————— Focus bouteille ——————————————— */
function focusTarget() {
  const wide = camera.aspect > 1.05;
  const cam = camera.position;
  if (!wide) {
    const D = 30 / (0.76 * TAN), h = D * TAN;
    return new THREE.Vector3(cam.x, cam.y + 0.42 * h - 15.5, cam.z - D);
  }
  const D = 30 / (1.3 * TAN), h = D * TAN;
  return new THREE.Vector3(cam.x - 0.3 * h * camera.aspect, cam.y - 15.5, cam.z - D);
}
function setDimSolid(solid) {
  // opaque une fois en place : le vin translucide « voit » alors ce fond crème
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
  b.userData.labelMat.map = t; b.userData.labelMat.bumpMap = t;
  b.userData.labelMat.needsUpdate = true;
}

export async function focus(wineId, idx) {
  let b = bottles.find((g) => g.userData.idx === idx && g.userData.wineId === wineId) || bottles.find((g) => g.userData.wineId === wineId);
  if (!b) return;
  if (mode === "overview" || mode === "to-cabinet") { await toCabinet(); }
  if (mode === "focus" && focused) await unfocus();
  if (mode !== "cabinet") return;
  mode = "to-focus";
  // amener l'étagère dans le champ
  const wp = b.getWorldPosition(new THREE.Vector3());
  const goal = clampPan(wp.y + 15);
  if (Math.abs(goal - panY) > 4) {
    const p0 = panY;
    await tween(0.6, (e) => { panY = p0 + (goal - p0) * e; currentPose = cabinetPose(); });
  }
  applyPose(currentPose); camera.updateMatrixWorld();
  focused = b;
  scene.attach(b);
  const start = b.position.clone(), r0 = b.rotation.y;
  const end = focusTarget();
  const ctrl = start.clone().add(new THREE.Vector3(0, 6, 26));
  const D = camera.position.z - end.z;
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
    dimPlane.material.opacity = e;
    focusShadow.material.opacity = Math.max(0, e * 1.6 - 0.6);
  });
  setDimSolid(true);
  b.userData.focusBase = end.clone();
  lastInteract = performance.now();
  mode = "focus";
}

export async function unfocus() {
  if (mode !== "focus" || !focused) return;
  mode = "to-cabinet";
  const b = focused;
  const home = bottleRoot.localToWorld(b.userData.home.pos.clone().add(new THREE.Vector3(0, 0, b.userData.push || 0)));
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
    dimPlane.material.opacity = op * (1 - e);
    if (focusShadow) focusShadow.material.opacity = 1 - Math.min(1, e * 3);
  });
  if (focusShadow) b.remove(focusShadow);
  bottleRoot.attach(b);
  b.position.copy(b.userData.home.pos); b.position.z += b.userData.push || 0;
  b.rotation.set(0, b.userData.home.rotY, 0);
  setLabelRes(b, LOW_RES);
  hideDim(true);
  focused = null;
  mode = "cabinet";
}

// Bouteille débouchée : elle s'élève et disparaît
export async function dropFocused() {
  if (!focused) return;
  const b = focused;
  mode = "to-cabinet";
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
  focused = null;
  hideDim(true);
  mode = "cabinet";
}

/* ——————————————— Entrées ——————————————— */
function bindPointer() {
  let p = null;
  const ray = new THREE.Raycaster();
  canvasEl.addEventListener("pointerdown", (e) => {
    p = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false };
    canvasEl.setPointerCapture(e.pointerId);
    panVel = 0; spinVel = 0;
  });
  canvasEl.addEventListener("pointermove", (e) => {
    if (!p) return;
    const dx = e.clientX - p.lx, dy = e.clientY - p.ly;
    p.lx = e.clientX; p.ly = e.clientY;
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 7) p.moved = true;
    if (!p.moved) return;
    if (mode === "cabinet") {
      const k = viewH() / canvasEl.clientHeight;
      panY = clampPan(panY + dy * k); panVel = dy * k; dirty = true;
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
    if (mode !== "cabinet") return;
    e.preventDefault();
    panY = clampPan(panY - e.deltaY * viewH() / canvasEl.clientHeight * 0.6); dirty = true;
  }, { passive: false });
}

function onTap(e, ray) {
  const r = canvasEl.getBoundingClientRect();
  const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  if (mode === "overview") {
    if (ray.intersectObject(root, true).length) cb.onCabinetTap?.();
  } else if (mode === "cabinet") {
    const hit = ray.intersectObjects(bottles, true)[0];
    if (!hit) return;
    let o = hit.object; while (o && o.userData.wineId === undefined) o = o.parent;
    if (o && !o.userData.dim) cb.onBottleTap?.(o.userData.wineId, o.userData.idx);
  } else if (mode === "focus") {
    if (!ray.intersectObject(focused, true).length) cb.onBackgroundTap?.();
  }
}

function resize() {
  const w = canvasEl.clientWidth, h = canvasEl.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (mode === "cabinet") { panY = clampPan(panY); currentPose = cabinetPose(); }
  dirty = true;
}

/* ——————————————— Boucle ——————————————— */
function loop(now) {
  requestAnimationFrame(loop);
  const active = tweens.length > 0;
  for (const t of [...tweens]) {
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
  } else if (mode === "cabinet") {
    if (Math.abs(panVel) > 0.01) { panVel *= 0.92; panY = clampPan(panY + panVel); dirty = true; }
    currentPose = cabinetPose();
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
  const moving = mode !== "cabinet" || active || dirty;
  if (!moving) return;
  applyPose(currentPose);
  renderer.render(scene, camera);
  dirty = false;
}
