/* =========================================================================
   SERVEUR (production — Render)
   - Sert les fichiers statiques du site.
   - Expose une API clé/valeur : GET/PUT /api/kv/:key
   - Persistance via Upstash Redis (API REST) si les variables d'env sont
     présentes ; sinon repli en mémoire (utile en dev, réinitialisé au reboot).

   Aucune dépendance npm : Node 18+ fournit `fetch` nativement.
   ========================================================================= */

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 5178;
const ROOT = __dirname;

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const memory = new Map(); // repli si pas d'Upstash configuré

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
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
  const res = await fetch(REDIS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  const data = await res.json();
  return data.result;
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
    await redisCmd(["SET", "kv:" + key, JSON.stringify(value)]);
  } else {
    memory.set(key, value);
  }
}

/* ---------- Utilitaires HTTP ---------- */
function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 1e6) reject(new Error("payload trop gros"));
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function serveStatic(req, res, urlPath) {
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.normalize(path.join(ROOT, decodeURIComponent(urlPath)));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.readFile(filePath, (err, buf) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("404 - " + urlPath);
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(buf);
  });
}

/* ---------- Routeur ---------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // API clé/valeur
  const kvMatch = pathname.match(/^\/api\/kv\/(.+)$/);
  if (kvMatch) {
    const key = decodeURIComponent(kvMatch[1]);
    try {
      if (req.method === "GET") {
        const value = await kvGet(key);
        if (value === null) return sendJson(res, 404, { key, value: null });
        return sendJson(res, 200, { key, value });
      }
      if (req.method === "PUT" || req.method === "POST") {
        const body = await readBody(req);
        const parsed = body ? JSON.parse(body) : {};
        await kvSet(key, parsed.value);
        return sendJson(res, 200, { key, ok: true });
      }
      return sendJson(res, 405, { error: "méthode non autorisée" });
    } catch (e) {
      return sendJson(res, 500, { error: String(e.message || e) });
    }
  }

  // Petit endpoint de santé (pratique pour Render)
  if (pathname === "/api/health") {
    return sendJson(res, 200, { ok: true, redis: Boolean(REDIS_URL && REDIS_TOKEN) });
  }

  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  const mode = REDIS_URL && REDIS_TOKEN ? "Upstash Redis" : "mémoire (non persistant)";
  console.log(`Soirée en écoute sur le port ${PORT} — persistance : ${mode}`);
});
