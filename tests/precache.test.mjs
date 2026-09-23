/* =========================================================================
   Tests de la précache du service worker (sw.js).

   Bug réel (septembre 2026) : 4 modules ajoutés au démarrage (art, history,
   stats, tournament) n'avaient pas été reportés dans PRECACHE. Hors-ligne, un
   seul module manquant suffit à faire échouer tout le graphe de modules :
   l'accueil restait vide. Ces tests lisent le code et échouent dès qu'un
   module du démarrage est oublié.
   ========================================================================= */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const lire = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

/** Entrées de PRECACHE, lues dans le source de sw.js. */
function precache() {
  const bloc = lire("sw.js").match(/const PRECACHE = \[([\s\S]*?)\];/);
  assert.ok(bloc, "tableau PRECACHE introuvable dans sw.js");
  return [...bloc[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

/** Modules chargés au démarrage : imports statiques depuis src/main.js, en
    excluant les modules propres à un jeu (chargés à la demande par le routeur). */
function modulesDuDemarrage() {
  const vus = new Set();
  const pile = ["src/main.js"];
  const IMPORT = /(?:^|\n)\s*(?:import|export)\s[^'";]*?from\s*["'](\.{1,2}\/[^"']+)["']|(?:^|\n)\s*import\s*["'](\.{1,2}\/[^"']+)["']/g;
  while (pile.length) {
    const f = pile.pop();
    if (vus.has(f)) continue;
    vus.add(f);
    for (const m of lire(f).matchAll(IMPORT)) {
      const cible = path.posix.join(path.posix.dirname(f), m[1] || m[2]);
      if (!cible.startsWith("src/games/")) pile.push(cible);
    }
  }
  return [...vus];
}

test("tous les modules du démarrage sont précachés", () => {
  const pre = new Set(precache());
  const oublies = modulesDuDemarrage().filter((f) => !pre.has(f));
  assert.deepEqual(oublies, [], `à ajouter dans PRECACHE (sw.js) : ${oublies.join(", ")}`);
});

test("les scripts de index.html sont précachés", () => {
  const pre = new Set(precache());
  const scripts = [...lire("index.html").matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(scripts.includes("src/boot.js"), "le filet de secours src/boot.js doit rester chargé par index.html");
  assert.deepEqual(scripts.filter((s) => !pre.has(s)), []);
});

test("chaque entrée de PRECACHE existe vraiment", () => {
  // Un fichier renommé ou supprimé est ignoré en silence à l'installation
  // (c.add(u).catch(() => {})) : il faut donc le détecter ici.
  const absents = precache().filter((u) => u !== "./" && !fs.existsSync(path.join(ROOT, u)));
  assert.deepEqual(absents, [], `entrées mortes dans PRECACHE : ${absents.join(", ")}`);
});
