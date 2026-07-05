/* =========================================================================
   SERVICE WORKER — support hors-ligne (« le Wi-Fi saute en pleine soirée »).

   Stratégie network-first pour les fichiers du site : on sert la dernière
   version quand on est en ligne (pas de contenu périmé après un déploiement),
   et on retombe sur le cache quand il n'y a plus de réseau.
   L'API /api/* n'est JAMAIS mise en cache (données de persistance).
   ========================================================================= */

const CACHE = "soiree-v1";
const PRECACHE = [
  "./",
  "index.html",
  "assets/css/base.css",
  "src/main.js",
  "src/ui.js",
  "src/registry.js",
  "src/room.js",
  "src/store.js",
  "src/players.js",
  "src/deck.js",
  "src/gages.js",
  "src/scoring.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // On ne gère que le GET même origine ; l'API passe directement au réseau.
  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match("index.html")))
  );
});
