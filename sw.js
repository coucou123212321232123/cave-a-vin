// Service worker : l'application fonctionne hors-ligne une fois ouverte.
const VERSION = "cave-v6";
const SHELL = [
  "./",
  "index.html",
  "css/styles.css",
  "js/app.js",
  "js/data.js",
  "js/scene.js",
  "js/labels.js",
  "js/appellations.js",
  "js/photos.js",
  "assets/chanzy-crest.png",
  "assets/chanzy-wordmark.png",
  "assets/chanzy-clous.webp",
  "assets/chanzy-corderes.webp",
  "assets/chanzy-fortune.webp",
  "assets/chanzy-fortune-vv.webp",
  "assets/chanzy-clos-du-roy.webp",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  const cdn = /(^|\.)jsdelivr\.net$|fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !cdn) return;

  if (sameOrigin) {
    // Réseau d'abord (mises à jour), cache en secours
    e.respondWith(
      fetch(req, { cache: "no-cache" }).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match("index.html")))
    );
  } else {
    // Librairies et polices : cache d'abord
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
        return res;
      }))
    );
  }
});
