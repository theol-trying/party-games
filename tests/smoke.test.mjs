/* Smoke tests des moteurs purs (sans DOM) — exécutés par GitHub Actions.
   Lancer localement (si Node installé) : node --test tests/ */

import test from "node:test";
import assert from "node:assert/strict";
import { createDeck } from "../src/deck.js";
import { activeCards } from "../src/content.js";

test("deck : chaque cycle épuise toutes les cartes sans doublon", () => {
  const d = createDeck([1, 2, 3, 4]);
  for (let c = 0; c < 3; c++) {
    const cycle = [d.next(), d.next(), d.next(), d.next()];
    assert.equal(new Set(cycle).size, 4, "cycle incomplet : " + cycle);
  }
});

test("deck : jamais deux fois la même carte de suite (re-mélanges inclus)", () => {
  const d = createDeck(["a", "b", "c"]);
  let prev = null;
  for (let i = 0; i < 60; i++) {
    const cur = d.next();
    assert.notEqual(cur, prev, "répétition immédiate au tirage " + i);
    prev = cur;
  }
});

test("deck vide : next() renvoie null", () => {
  assert.equal(createDeck([]).next(), null);
});

test("deck : setFilter repart sur le pool filtré", () => {
  const d = createDeck([1, 2, 3, 4], { filter: (x) => x % 2 === 0 });
  assert.equal(d.size(), 2);
  d.setFilter(null);
  assert.equal(d.size(), 4);
});

const toText = (e) => e.text;

test("activeCards : fusion intégré + perso", () => {
  const out = activeCards({
    builtIn: ["A", "B"],
    custom: [{ id: "c1", text: "C" }],
    config: {},
    keyOf: (t) => t,
    customToValue: toText,
  });
  assert.deepEqual(out, ["A", "B", "C"]);
});

test("activeCards : onlyCustom exclut l'intégré", () => {
  const out = activeCards({
    builtIn: ["A", "B"],
    custom: [{ id: "c1", text: "C" }],
    config: { onlyCustom: true },
    keyOf: (t) => t,
    customToValue: toText,
  });
  assert.deepEqual(out, ["C"]);
});

test("activeCards : cartes désactivées exclues (intégrée et perso)", () => {
  const out = activeCards({
    builtIn: ["A", "B"],
    custom: [{ id: "c1", text: "C" }, { id: "c2", text: "D" }],
    config: { disabled: { A: true, c2: true } },
    keyOf: (t) => t,
    customToValue: toText,
  });
  assert.deepEqual(out, ["B", "C"]);
});

test("activeCards : customToValue transforme les entrées perso", () => {
  const out = activeCards({
    builtIn: [],
    custom: [{ id: "c1", a: "x", b: "y" }],
    config: {},
    keyOf: (t) => t,
    customToValue: (e) => ({ a: e.a, b: e.b }),
  });
  assert.deepEqual(out, [{ a: "x", b: "y" }]);
});
