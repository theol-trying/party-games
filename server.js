/* =========================================================================
   SERVEUR (production — Render)
   - Sert les fichiers statiques du site.
   - Expose une API clé/valeur : GET/PUT /api/kv/:key
   - Persistance via Upstash Redis (API REST) si les variables d'env sont
     présentes ; sinon repli en mémoire (utile en dev, réinitialisé au reboot).

   Aucune dépendance npm : Node 18+ fournit `fetch` nativement.

   ------------------------------------------------------------------------
   NOTE DE SÉCURITÉ (importante)
   Le front est 100 % statique : impossible d'y cacher un « secret partagé »
   (tout token embarqué dans le JS est lisible dans le navigateur). La
   protection de l'API ne repose donc PAS sur un token client, mais sur :
     1. Allowlist stricte des clés (regex + longueur bornée)  → pas de spam de clés
     2. Plafond de taille de valeur                            → pas de gros writes
     3. TTL sur chaque clé Redis                               → pas d'accumulation infinie
     4. Rate-limit par IP sur /api/*                           → protège le quota Upstash
     5. Contrôle d'origine optionnel (ALLOWED_ORIGIN)          → bloque l'usage cross-site
     6. Timeout + erreurs génériques                           → robustesse, pas de fuite d'info
   ========================================================================= */

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 5178;
const ROOT = __dirname;

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const memory = new Map(); // repli si pas d'Upstash configuré

/* ---------- Réglages de durcissement ---------- */
// Clés autorisées : lettres/chiffres/ : _ - , longueur 1..80.
const KEY_RE = /^[A-Za-z0-9:_-]{1,80}$/;
const MAX_VALUE_BYTES = 32 * 1024; // 32 Ko max par valeur
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 jours
const UPSTASH_TIMEOUT_MS = 4000;
// Origines autorisées (liste séparée par des virgules). Vide = pas de contrôle
// (pratique en local ; à renseigner en prod, ex "https://soiree-jeux.onrender.com").
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
// Rate-limit par IP sur /api/* (fenêtre glissante simple).
const RATE_MAX = 120;
const RATE_WINDOW_MS = 60 * 1000;
const rate = new Map(); // ip -> { count, windowStart }

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ico": "image/x-icon",
};

/* ---------- Couche persistance ---------- */
async function redisCmd(cmd) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), UPSTASH_TIMEOUT_MS);
  try {
    const res = await fetch(REDIS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cmd),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Upstash ${res.status}`);
    const data = await res.json();
    return data.result;
  } finally {
    clearTimeout(t);
  }
}

async function kvGet(key) {
  if (REDIS_URL && REDIS_TOKEN) {
    const raw = await redisCmd(["GET", "kv:" + key]);
    return raw ? JSON.parse(raw) : null;
  }
  return memory.has(key) ? memory.get(key) : null;
}

async function kvSet(key, value) {
  if (REDIS_URL && REDIS_TOKEN) {
    // SET avec expiration : la clé s'auto-nettoie après TTL_SECONDS.
    await redisCmd(["SET", "kv:" + key, JSON.stringify(value), "EX", String(TTL_SECONDS)]);
  } else {
    memory.set(key, value);
  }
}

/* ---------- Recherche musicale (proxy iTunes / Deezer, sans clé) ---------- */
// Évite les soucis CORS et normalise les résultats. Les extraits sont des MP3/M4A
// de ~30 s lus côté client par <audio> (pas besoin de CORS pour la lecture média).
async function musicSearch(provider, query, limit) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    if (provider === "deezer") {
      const url = `https://api.deezer.com/search?limit=${limit}&q=${encodeURIComponent(query)}`;
      const r = await fetch(url, { signal: ctrl.signal });
      const j = await r.json();
      return (j.data || [])
        .filter((tk) => tk.preview)
        .map((tk) => ({ title: tk.title, artist: tk.artist && tk.artist.name, preview: tk.preview, artwork: tk.album && tk.album.cover_medium }));
    }
    // iTunes (Apple) par défaut
    const url = `https://itunes.apple.com/search?media=music&entity=song&limit=${limit}&term=${encodeURIComponent(query)}`;
    const r = await fetch(url, { signal: ctrl.signal });
    const j = await r.json();
    return (j.results || [])
      .filter((tk) => tk.previewUrl)
      .map((tk) => ({ title: tk.trackName, artist: tk.artistName, preview: tk.previewUrl, artwork: tk.artworkUrl100 }));
  } finally {
    clearTimeout(t);
  }
}

/* ---------- Utilitaires HTTP ---------- */
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
};

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...SECURITY_HEADERS,
  });
  res.end(body);
}

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return String(fwd).split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}

function rateLimited(ip) {
  const now = Date.now();
  const e = rate.get(ip);
  if (!e || now - e.windowStart > RATE_WINDOW_MS) {
    rate.set(ip, { count: 1, windowStart: now });
    if (rate.size > 5000) pruneRate(now); // garde-fou mémoire
    return false;
  }
  e.count++;
  return e.count > RATE_MAX;
}
function pruneRate(now) {
  for (const [ip, e] of rate) if (now - e.windowStart > RATE_WINDOW_MS) rate.delete(ip);
}

function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // même origine (GET) ou client non-navigateur
  // Le site peut TOUJOURS appeler sa propre API, quelle que soit l'URL Render.
  try {
    if (new URL(origin).host === req.headers.host) return true;
  } catch {}
  if (!ALLOWED_ORIGINS.length) return true; // pas de restriction supplémentaire configurée
  return ALLOWED_ORIGINS.includes(origin); // origines externes explicitement autorisées
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) {
        const err = new Error("payload trop gros");
        err.code = "TOO_LARGE";
        req.destroy();
        return reject(err);
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function serveStatic(req, res, urlPath) {
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.normalize(path.join(ROOT, decodeURIComponent(urlPath)));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, SECURITY_HEADERS);
    return res.end("Forbidden");
  }
  fs.readFile(filePath, (err, buf) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", ...SECURITY_HEADERS });
      return res.end("404 - " + urlPath);
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "no-cache",
      ...SECURITY_HEADERS,
    });
    res.end(buf);
  });
}

/* ---------- Routeur ---------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // Endpoint de santé (léger, pas de contrôle) — pratique pour Render.
  if (pathname === "/api/health") {
    const info = {
      ok: true,
      redis: Boolean(REDIS_URL && REDIS_TOKEN), // les variables Upstash sont-elles vues ?
      node: process.version, // >= v18 requis pour que fetch existe
      fetch: typeof fetch === "function",
      originRestricted: ALLOWED_ORIGINS.length > 0,
    };
    // /api/health?deep=1 : teste vraiment la connexion Upstash (PING).
    // Permet de distinguer « variables absentes » de « variables erronées ».
    if (url.searchParams.get("deep") === "1" && info.redis) {
      try {
        info.redisPing = await redisCmd(["PING"]);
      } catch (e) {
        info.ok = false;
        info.redisError = String(e && e.message ? e.message : e);
      }
    }
    return sendJson(res, 200, info);
  }

  // Toutes les autres routes /api/* : contrôles transverses.
  if (pathname.startsWith("/api/")) {
    if (!originAllowed(req)) return sendJson(res, 403, { error: "origine non autorisée" });
    if (rateLimited(clientIp(req))) return sendJson(res, 429, { error: "trop de requêtes" });
  }

  // Recherche musicale : /api/music?q=...&provider=itunes|deezer&limit=N
  if (pathname === "/api/music") {
    const q = (url.searchParams.get("q") || "").slice(0, 120).trim();
    const provider = url.searchParams.get("provider") === "deezer" ? "deezer" : "itunes";
    const limit = Math.min(30, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)));
    if (!q) return sendJson(res, 400, { error: "requête vide" });
    try {
      const results = await musicSearch(provider, q, limit);
      return sendJson(res, 200, { provider, results });
    } catch (e) {
      console.error("[music]", e && e.message ? e.message : e);
      const status = e && e.name === "AbortError" ? 504 : 502;
      return sendJson(res, status, { error: "recherche musicale indisponible" });
    }
  }

  // API clé/valeur
  const kvMatch = pathname.match(/^\/api\/kv\/(.+)$/);
  if (kvMatch) {
    let key;
    try {
      key = decodeURIComponent(kvMatch[1]);
    } catch {
      return sendJson(res, 400, { error: "clé invalide" });
    }
    if (!KEY_RE.test(key)) return sendJson(res, 400, { error: "clé invalide" });

    try {
      if (req.method === "GET") {
        const value = await kvGet(key);
        if (value === null) return sendJson(res, 404, { key, value: null });
        return sendJson(res, 200, { key, value });
      }
      if (req.method === "PUT" || req.method === "POST") {
        let body;
        try {
          body = await readBody(req, MAX_VALUE_BYTES);
        } catch (e) {
          if (e && e.code === "TOO_LARGE") return sendJson(res, 413, { error: "valeur trop volumineuse" });
          throw e;
        }
        let parsed;
        try {
          parsed = body ? JSON.parse(body) : {};
        } catch {
          return sendJson(res, 400, { error: "corps JSON invalide" });
        }
        await kvSet(key, parsed.value);
        return sendJson(res, 200, { key, ok: true });
      }
      return sendJson(res, 405, { error: "méthode non autorisée" });
    } catch (e) {
      // On journalise le détail côté serveur, on renvoie un message générique.
      console.error(`[kv] ${req.method} ${key} :`, e && e.message ? e.message : e);
      const status = e && e.name === "AbortError" ? 504 : 502;
      return sendJson(res, status, { error: "service de persistance indisponible" });
    }
  }

  // /api/* inconnu
  if (pathname.startsWith("/api/")) return sendJson(res, 404, { error: "route inconnue" });

  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  const mode = REDIS_URL && REDIS_TOKEN ? "Upstash Redis" : "mémoire (non persistant)";
  const origin = ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS.join(", ") : "toutes (non restreint)";
  console.log(`Soirée en écoute sur le port ${PORT} — persistance : ${mode} — origines : ${origin}`);
});
