// Visionneuse 3D d'une bouteille (bourguignonne) — Three.js
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

let renderer, scene, camera, group, raf = 0, host = null, ro = null;
let rotY = -0.5, rotX = 0.06, velY = 0.0, dragging = false, lastX = 0, lastY = 0, idleT = 0, lastT = 0;

function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

  camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
  camera.position.set(0, 1.55, 8.1);
  camera.lookAt(0, 1.5, 0);

  const key = new THREE.DirectionalLight(0xffe2c0, 2.2);
  key.position.set(3, 5, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffb48a, 1.6);
  rim.position.set(-4, 3, -3);
  scene.add(rim);
  scene.add(new THREE.AmbientLight(0xffffff, 0.15));

  const el = renderer.domElement;
  el.style.touchAction = "none";
  el.addEventListener("pointerdown", (e) => {
    dragging = true; lastX = e.clientX; lastY = e.clientY; velY = 0;
    el.setPointerCapture(e.pointerId);
    host?.querySelector(".spin-hint")?.style.setProperty("opacity", "0");
  });
  el.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    velY = dx * 0.012;
    rotY += velY;
    rotX = Math.max(-0.35, Math.min(0.45, rotX + dy * 0.006));
    idleT = 0;
  });
  const up = () => { dragging = false; };
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
}

/* ——— Géométrie ——— */
function profile() {
  const p = [];
  const R = 0.42, H_BODY = 1.62, H_SH = 0.92, R_NECK = 0.135, H_TOP = 3.12;
  p.push(new THREE.Vector2(0.0, 0.06));             // fond (piqûre)
  p.push(new THREE.Vector2(0.24, 0.0));
  p.push(new THREE.Vector2(R - 0.03, 0.0));
  p.push(new THREE.Vector2(R, 0.04));
  p.push(new THREE.Vector2(R, H_BODY));
  // épaule bourguignonne : longue courbe douce
  for (let i = 1; i <= 24; i++) {
    const t = i / 24;
    const s = t * t * (3 - 2 * t);
    const r = R - (R - R_NECK) * Math.pow(s, 0.85);
    p.push(new THREE.Vector2(r, H_BODY + t * H_SH));
  }
  p.push(new THREE.Vector2(R_NECK - 0.005, H_TOP - 0.1));
  p.push(new THREE.Vector2(R_NECK + 0.018, H_TOP - 0.07)); // bague
  p.push(new THREE.Vector2(R_NECK + 0.018, H_TOP - 0.01));
  p.push(new THREE.Vector2(R_NECK - 0.02, H_TOP));
  p.push(new THREE.Vector2(0.0, H_TOP));
  return p;
}

function capsuleGeo() {
  const pts = [];
  const r0 = 0.142, r1 = 0.162, y0 = 2.5, y1 = 3.135;
  pts.push(new THREE.Vector2(r0, y0));
  pts.push(new THREE.Vector2(r0 + 0.004, y0 + 0.02));
  pts.push(new THREE.Vector2(r0 + 0.004, y1 - 0.09));
  pts.push(new THREE.Vector2(r1, y1 - 0.065));
  pts.push(new THREE.Vector2(r1, y1 - 0.01));
  pts.push(new THREE.Vector2(r1 - 0.01, y1));
  pts.push(new THREE.Vector2(0, y1));
  return new THREE.LatheGeometry(pts, 64);
}

/* ——— Étiquette ——— */
function wrapText(ctx, text, maxW) {
  const words = text.split(/\s+/); const lines = []; let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

async function labelTexture(w) {
  try { await Promise.all([document.fonts.load('700 80px "Cormorant Garamond"'), document.fonts.load('600 40px "Cormorant Garamond"'), document.fonts.load('500 30px "Inter"')]); } catch {}
  const W = 1400, H = 900;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d");
  const red = w.color === "R";
  const accent = red ? "#7d1626" : "#9a7535";

  // papier
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#f6efe0"); g.addColorStop(1, "#ebe1cb");
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // grain
  for (let i = 0; i < 9000; i++) {
    x.fillStyle = `rgba(120,95,60,${Math.random() * 0.05})`;
    x.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
  }
  // cadre
  x.strokeStyle = accent; x.lineWidth = 5; x.strokeRect(70, 50, W - 140, H - 100);
  x.lineWidth = 1.5; x.strokeRect(86, 66, W - 172, H - 132);

  const cx = W / 2;
  x.textAlign = "center"; x.textBaseline = "alphabetic";
  const serif = '"Cormorant Garamond", Georgia, serif';
  const sans = '"Inter", Arial, sans-serif';

  // domaine
  x.fillStyle = "#3a2a1c";
  x.font = `500 34px ${sans}`;
  x.letterSpacing = "8px";
  x.fillText(w.domaine.toUpperCase(), cx, 160);
  x.letterSpacing = "0px";

  // ornement
  x.strokeStyle = accent; x.lineWidth = 2;
  x.beginPath(); x.moveTo(cx - 110, 200); x.lineTo(cx - 20, 200); x.moveTo(cx + 20, 200); x.lineTo(cx + 110, 200); x.stroke();
  x.fillStyle = accent; x.beginPath(); x.arc(cx, 200, 6, 0, Math.PI * 2); x.fill();

  // nom principal
  const main = w.cuvee || w.appellation;
  let size = 120;
  x.font = `700 ${size}px ${serif}`;
  let lines = wrapText(x, main, W - 260);
  while ((lines.length > 2 || lines.some((l) => x.measureText(l).width > W - 260)) && size > 64) {
    size -= 6; x.font = `700 ${size}px ${serif}`; lines = wrapText(x, main, W - 260);
  }
  x.fillStyle = "#24170e";
  const baseY = lines.length > 1 ? 330 : 380;
  lines.forEach((l, i) => x.fillText(l, cx, baseY + i * size * 1.0));

  // appellation
  const appY = baseY + (lines.length - 1) * size + 100;
  if (w.cuvee) {
    x.font = `italic 500 62px ${serif}`;
    x.fillStyle = "#4a3624";
    x.fillText(w.appellation, cx, appY);
  }
  x.font = `500 26px ${sans}`;
  x.letterSpacing = "6px";
  x.fillStyle = "#6b5640";
  x.fillText("APPELLATION " + w.appellation.toUpperCase() + " CONTRÔLÉE", cx, Math.min(appY + 70, H - 220));
  x.letterSpacing = "0px";

  // millésime
  x.font = `700 92px ${serif}`;
  x.fillStyle = accent;
  x.fillText(w.vintage ? String(w.vintage) : "—", cx, H - 120);

  // région
  x.font = `500 24px ${sans}`;
  x.fillStyle = "#7a6650";
  x.letterSpacing = "5px";
  x.fillText((w.region || "").toUpperCase(), cx, H - 82 + 0);
  x.letterSpacing = "0px";

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

/* ——— Construction ——— */
async function build(w) {
  if (group) { scene.remove(group); group.traverse((o) => { o.geometry?.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose(); } }); }
  group = new THREE.Group();
  const red = w.color === "R";

  const glass = new THREE.MeshPhysicalMaterial({
    color: red ? 0x050a04 : 0x302c0a,
    roughness: 0.08, metalness: 0.0,
    clearcoat: 1, clearcoatRoughness: 0.04,
    envMapIntensity: red ? 1.1 : 1.3,
    sheen: 0.0,
  });
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile(), 96), glass);
  group.add(body);

  const cap = new THREE.Mesh(capsuleGeo(), new THREE.MeshStandardMaterial({
    color: red ? 0x7a1424 : 0xc39a55, metalness: 0.85, roughness: 0.32, envMapIntensity: 1.2,
  }));
  group.add(cap);

  const arc = Math.PI * 1.05, labelH = 0.9, r = 0.423;
  const labelGeo = new THREE.CylinderGeometry(r, r, labelH, 96, 1, true, -arc / 2, arc);
  const label = new THREE.Mesh(labelGeo, new THREE.MeshStandardMaterial({ map: await labelTexture(w), roughness: 0.85, metalness: 0, envMapIntensity: 0.5 }));
  label.position.y = 0.86;
  group.add(label);

  // contre-étiquette
  const back = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, 0.5, 48, 1, true, Math.PI - 0.45, 0.9),
    new THREE.MeshStandardMaterial({ color: 0xefe6d2, roughness: 0.9 })
  );
  back.position.y = 0.8;
  group.add(back);

  group.position.y = -0.02;
  scene.add(group);
}

function resize() {
  if (!host) return;
  const w = host.clientWidth, h = host.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function loop(t) {
  raf = requestAnimationFrame(loop);
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016); lastT = t;
  if (!dragging) {
    idleT += dt;
    velY *= Math.pow(0.04, dt);           // inertie
    rotY += velY;
    if (idleT > 1.2) rotY += dt * 0.45 * Math.min(1, (idleT - 1.2)); // rotation lente auto
    rotX += (0.06 - rotX) * dt * 1.5;
  }
  if (group) { group.rotation.y = rotY; group.rotation.x = rotX; }
  renderer.render(scene, camera);
}

export async function mount(el, wine) {
  if (!renderer) init();
  host = el;
  rotY = -0.6; rotX = 0.06; velY = 0.12; idleT = 0;
  el.prepend(renderer.domElement);
  resize();
  ro?.disconnect();
  ro = new ResizeObserver(resize); ro.observe(el);
  await build(wine);
  if (host !== el) return; // fermé pendant le chargement
  cancelAnimationFrame(raf);
  lastT = performance.now();
  raf = requestAnimationFrame(loop);
}

export function unmount() {
  cancelAnimationFrame(raf); raf = 0;
  ro?.disconnect(); ro = null;
  renderer?.domElement.remove();
  host = null;
}
