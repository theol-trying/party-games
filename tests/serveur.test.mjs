/* =========================================================================
   Tests du vrai serveur (server.js + ws.js), lancé dans un processus fils.

   Ils couvrent deux défauts trouvés à l'audit du 2026-09-28 :
   - une seule requête mal formée (« GET //[ ») arrêtait tout le processus,
     et avec lui tous les salons en cours ;
   - le serveur ne répondait pas à la trame de fermeture d'un client : la
     connexion restait ouverte ~60 s côté navigateur.
   ========================================================================= */

import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import { fileURLToPath } from "node:url";

const RACINE = fileURLToPath(new URL("..", import.meta.url));
const PORT = 5300 + Math.floor(Math.random() * 500);

let srv;
test.before(async () => {
  srv = spawn(process.execPath, ["server.js"], {
    cwd: RACINE,
    env: { ...process.env, PORT: String(PORT), ALLOWED_ORIGIN: "", UPSTASH_REDIS_REST_URL: "", UPSTASH_REDIS_REST_TOKEN: "" },
    stdio: "ignore",
  });
  // Attend que le port réponde.
  for (let i = 0; i < 50; i++) {
    const ok = await fetch(`http://127.0.0.1:${PORT}/api/health`).then((r) => r.ok, () => false);
    if (ok) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("le serveur ne démarre pas");
});
test.after(() => srv && srv.kill());

/** Envoie une requête HTTP brute et renvoie sa ligne de statut. */
function brut(requete) {
  return new Promise((resolve) => {
    const s = net.connect(PORT, "127.0.0.1", () => s.write(requete));
    let out = "";
    s.on("data", (d) => (out += d));
    s.on("close", () => resolve(out.split("\r\n")[0]));
    s.on("error", () => resolve(""));
  });
}

test("une cible de requête impossible à analyser renvoie 400 sans arrêter le serveur", async () => {
  for (const cible of ["//[", "//a%20b", "http://["]) {
    const statut = await brut(`GET ${cible} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n`);
    assert.match(statut, / 400 /, `cible ${cible}`);
  }
  assert.equal(srv.exitCode, null, "le processus serveur doit être toujours vivant");
  const r = await fetch(`http://127.0.0.1:${PORT}/api/health`);
  assert.equal(r.status, 200);
});

test("le serveur répond à la fermeture d'un WebSocket (fermeture propre et rapide)", async () => {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  ws.send(JSON.stringify({ t: "join", room: "TSRV", game: "quiz-gages", id: "dtest1", name: "Test" }));
  await new Promise((r) => setTimeout(r, 100));
  const t0 = Date.now();
  const fin = await new Promise((resolve) => {
    ws.onclose = (e) => resolve(e);
    ws.close(1000);
    setTimeout(() => resolve(null), 4000);
  });
  assert.ok(fin, "aucune fermeture reçue en 4 s");
  assert.equal(fin.wasClean, true);
  assert.ok(Date.now() - t0 < 2000, "fermeture trop lente");
});

test("icône iPhone : un vrai PNG 180 × 180, dessiné par le serveur (aucun binaire dans le dépôt)", async () => {
  const r = await fetch(`http://127.0.0.1:${PORT}/assets/icon-180.png`);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "image/png");
  const b = Buffer.from(await r.arrayBuffer());
  assert.deepEqual([...b.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "signature PNG");
  assert.equal(b.readUInt32BE(16), 180, "largeur");
  assert.equal(b.readUInt32BE(20), 180, "hauteur");
  // Chaque bloc porte un CRC exact (un seul octet faux et iOS ignore l'image).
  const { crc32 } = await import("../icone.js");
  for (let i = 8; i < b.length; ) {
    const long = b.readUInt32BE(i);
    const corps = b.subarray(i + 4, i + 8 + long);
    assert.equal(b.readUInt32BE(i + 8 + long), crc32(corps), "CRC du bloc " + corps.subarray(0, 4).toString());
    i += 12 + long;
  }
  // Pixels : le coin est le dégradé (rose), le centre de la coupe est blanc.
  const zlib = await import("node:zlib");
  const idat = b.subarray(b.indexOf("IDAT") + 4, b.indexOf("IEND") - 8);
  const brut = zlib.inflateSync(idat);
  const px = (x, y) => [...brut.subarray(y * (180 * 3 + 1) + 1 + x * 3, y * (180 * 3 + 1) + 4 + x * 3)];
  assert.ok(px(2, 2)[0] > 200 && px(2, 2)[2] < 140, "coin rose : " + px(2, 2));
  assert.deepEqual(px(90, 64), [255, 255, 255], "coupe blanche");
  const r404 = await fetch(`http://127.0.0.1:${PORT}/assets/icon-77.png`);
  assert.equal(r404.status, 404, "taille inconnue");
});
