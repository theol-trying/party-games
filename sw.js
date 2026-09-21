/* =========================================================================
   SERVICE WORKER — support hors-ligne (« le Wi-Fi saute en pleine soirée »).

   Stratégie network-first pour les fichiers du site : on sert la dernière
   version quand on est en ligne (pas de contenu périmé après un déploiement),
   et on retombe sur le cache quand il n'y a plus de réseau.
   L'API /api/* n'est JAMAIS mise en cache (données de persistance).
   ========================================================================= */

// v2 : précache élargie (la v1 n'avait que la coquille, donc le hors-ligne était
// largement illusoire) — le changement de nom purge aussi les anciens caches,
// y compris d'éventuelles réponses d'erreur mémorisées avant le filtre res.ok.
const CACHE = "soiree-v2";
// La coquille + TOUS les modules transverses : ce sont ceux que le routeur et
// n'importe quel jeu chargent. Les modules propres à un jeu (index/data/style)
// restent mis en cache à la volée, à la première visite du jeu.
const PRECACHE = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "assets/css/base.css",
  "assets/icon.svg",
  "src/main.js",
  "src/registry.js",
  "src/ui.js",
  "src/room.js",
  "src/store.js",
  "src/realtime.js",
  "src/tv.js",
  "src/crown.js",
  "src/fx.js",
  "src/sound.js",
  "src/qr.js",
  "src/deck.js",
  "src/content.js",
  "src/seen.js",
  "src/names.js",
  "src/gages.js",
  "src/levels.js",
  "src/players.js",
  "src/scoring.js",
  "src/teams.js",
  "src/game-kit.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      // addAll() est tout-ou-rien : un seul 404 et le service worker ne
      // s'installe pas du tout. On met donc en cache fichier par fichier.
      .then((c) => Promise.all(PRECACHE.map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
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
        // On ne mémorise QUE les réponses saines. Sans ce filtre, la page
        // d'erreur 502/503 que Render renvoie au réveil (plan gratuit endormi)
        // écrasait la copie valide, et c'est elle qui était servie plus tard
        // hors-ligne — exactement ce que ce service worker doit empêcher.
        if (res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((r) => {
          if (r) return r;
          // index.html en secours UNIQUEMENT pour une navigation : le servir à
          // la place d'un module JS raté casserait l'écran (HTML importé comme JS).
          if (req.mode === "navigate") return caches.match("index.html");
          return new Response("hors-ligne", { status: 503, statusText: "Service Unavailable" });
        })
      )
  );
});
