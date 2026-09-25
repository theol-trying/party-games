/* Tests des règles d'Estimations (src/games/estimations/regles.js) : ce calcul
   tourne sur chaque téléphone, il doit donner partout le même verdict. */

import test from "node:test";
import assert from "node:assert/strict";
import { lireNombre, estPile, classer, facteur, gorgees } from "../src/games/estimations/regles.js";
import { QUESTIONS, THEMES } from "../src/games/estimations/data.js";

test("gorgées selon l'écart : un facteur, pas une différence", () => {
  assert.equal(facteur(100, 200), 2);
  assert.equal(facteur(100, 50), 2); // deux fois trop peu = deux fois trop
  assert.equal(facteur(1000000, 10000), 100);
  assert.equal(facteur(0, 5), Infinity);
  assert.equal(gorgees(100, 140), 1);  // ×1,4
  assert.equal(gorgees(100, 150), 1);  // ×1,5 : limite incluse
  assert.equal(gorgees(100, 40), 2);   // ÷2,5
  assert.equal(gorgees(100, 300), 2);  // ×3 : limite incluse
  assert.equal(gorgees(100, 301), 3);
  assert.equal(gorgees(1000000, 10000), 3);
  assert.equal(gorgees(100, null), 3); // pas de réponse = le pire
});

test("chaque question porte un thème connu, chaque thème a des questions", () => {
  const ids = new Set(THEMES.map((t) => t.id));
  const parTheme = {};
  for (const q of QUESTIONS) {
    assert.ok(ids.has(q.cat), `thème inconnu « ${q.cat} » : ${q.q}`);
    parTheme[q.cat] = (parTheme[q.cat] || 0) + 1;
  }
  for (const t of THEMES) assert.ok(parTheme[t.id] >= 10, `thème ${t.id} trop maigre : ${parTheme[t.id] || 0}`);
});

test("lireNombre comprend les saisies à la française", () => {
  assert.equal(lireNombre("1 500"), 1500);
  assert.equal(lireNombre("1 500"), 1500); // espace fine insécable (clavier iOS)
  assert.equal(lireNombre("9,58"), 9.58);
  assert.equal(lireNombre("1.5"), 1.5);
  assert.equal(lireNombre("-3"), -3);
  assert.equal(lireNombre(" 42 "), 42);
  assert.equal(lireNombre(7), 7);
  for (const mauvais of ["", "abc", "12m", "1,2,3", "--1", null, undefined, NaN, Infinity]) {
    assert.equal(lireNombre(mauvais), null, `« ${mauvais} » doit être refusé`);
  }
});

test("le plus proche marque 1 point, le plus loin boit", () => {
  const r = classer(100, [{ id: "a", v: 90 }, { id: "b", v: 130 }, { id: "c", v: 104 }]);
  assert.deepEqual(r.lignes.map((l) => l.id), ["c", "a", "b"]);
  assert.deepEqual(r.gagnants, ["c"]);
  assert.deepEqual(r.perdants, ["b"]);
  assert.deepEqual(r.points, { c: 1 });
  assert.equal(r.pile, false);
});

test("tomber pile (à 1 % près) rapporte 2 points", () => {
  const r = classer(1000, [{ id: "a", v: 1009 }, { id: "b", v: 500 }]);
  assert.equal(r.pile, true);
  assert.deepEqual(r.points, { a: 2 });
  assert.equal(estPile(9.58, 9.58), true);
  assert.equal(estPile(1000, 1011), false);
});

test("ex æquo : tous les plus proches marquent, rang partagé", () => {
  const r = classer(50, [{ id: "a", v: 45 }, { id: "b", v: 55 }, { id: "c", v: 80 }]);
  assert.deepEqual(r.gagnants.sort(), ["a", "b"]);
  assert.deepEqual(r.points, { a: 1, b: 1 });
  assert.deepEqual(r.lignes.map((l) => l.rang), [1, 1, 3]);
  assert.deepEqual(r.perdants, ["c"]);
});

test("décimales : pas de faux écart dû aux flottants", () => {
  // 9.58 − 9.50 et 9.66 − 9.58 valent 0,08 tous les deux, mais pas au bit près.
  const r = classer(9.58, [{ id: "a", v: 9.5 }, { id: "b", v: 9.66 }, { id: "c", v: 12 }]);
  assert.deepEqual(r.gagnants.sort(), ["a", "b"]);
});

test("tout le monde à égalité : personne ne boit", () => {
  const r = classer(10, [{ id: "a", v: 12 }, { id: "b", v: 8 }]);
  assert.deepEqual(r.perdants, []);
  assert.equal(r.gagnants.length, 2);
});

test("sans réponse = absent, qui boit aussi ; seul à répondre = gagnant", () => {
  const r = classer(10, [{ id: "a", v: "12" }, { id: "b", v: null }, { id: "c" }]);
  assert.deepEqual(r.absents, ["b", "c"]);
  assert.deepEqual(r.gagnants, ["a"]);
  assert.deepEqual(r.perdants, []);
  const vide = classer(10, [{ id: "a" }]);
  assert.deepEqual(vide.gagnants, []);
  assert.deepEqual(vide.points, {});
});

test("banque de questions : réponses numériques, énoncés uniques", () => {
  assert.ok(QUESTIONS.length >= 200, `seulement ${QUESTIONS.length} questions`);
  const vus = new Set();
  for (const q of QUESTIONS) {
    assert.ok(q.q && q.q.endsWith("?"), `énoncé mal formé : ${q.q}`);
    assert.ok(Number.isFinite(q.reponse), `réponse non numérique : ${q.q}`);
    // Le clavier numérique de l'iPhone n'a pas de touche « − » : une réponse
    // négative serait impossible à taper. On reformule (« combien SOUS… »).
    assert.ok(q.reponse >= 0, `réponse négative, intapable sur iPhone : ${q.q}`);
    assert.equal(typeof q.unite, "string", `unité manquante : ${q.q}`);
    assert.ok(!vus.has(q.q), `doublon : ${q.q}`);
    vus.add(q.q);
  }
});
