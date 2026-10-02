/* Tests de « Qui a dit ça ? » : le dépouillement tourne sur chaque téléphone
   à la révélation, il doit donner partout les mêmes points et les mêmes gorgées. */

import test from "node:test";
import assert from "node:assert/strict";
import { depouiller } from "../src/games/qui-a-dit/regles.js";
import { QUESTIONS } from "../src/games/qui-a-dit/data.js";

// Réponses mélangées : 0 = Bob, 1 = Alice, 2 = Cléo (indices donnés par le serveur).
const anonymes = [{ texte: "Des Crocs" }, { texte: "Le karaoké" }, { texte: "Un yéti" }];
const roles = { alice: { mien: 1 }, bob: { mien: 0 }, cleo: { mien: 2 }, dan: true };

test("chaque vote rapporte un point : au détective s'il a vu juste, à l'auteur sinon", () => {
  const inputs = {
    alice: { v: { 0: "bob", 2: "dan" } },  // 1 juste, 1 faux
    bob: { v: { 1: "alice", 2: "cleo" } }, // 2 justes
    dan: { v: { 0: "bob", 1: "cleo", 2: "alice" } }, // 1 juste, 2 faux
  };
  const d = depouiller(anonymes, roles, inputs);
  assert.equal(d.reponses[0].auteur, "bob");
  assert.deepEqual(d.reponses[0].trouvePar.sort(), ["alice", "dan"]);
  assert.deepEqual(d.reponses[2].bernes.map((b) => b.id).sort(), ["alice", "dan"]);
  assert.deepEqual(d.points, { alice: 2, bob: 2, dan: 1, cleo: 2 }, "Alice : 1 juste + Dan berné ; Cléo : 2 bernés");
  const total = Object.values(d.points).reduce((a, b) => a + b, 0);
  assert.equal(total, 7, "autant de points que de votes");
});

test("gorgées : démasqué par la majorité, pire détective ; fantôme = distribue", () => {
  const inputs = {
    alice: { v: { 0: "bob", 2: "dan" } },    // 1 juste
    bob: { v: { 1: "alice", 2: "dan" } },    // 1 juste
    cleo: { v: { 0: "bob", 1: "cleo" } },    // 1 juste (vote pour elle-même : compté faux)
    dan: { v: { 0: "cleo", 1: "cleo", 2: "bob" } }, // 0 juste
  };
  const d = depouiller(anonymes, roles, inputs);
  assert.equal(d.reponses[0].demasque, true, "Bob trouvé par 2 votants sur 3");
  assert.equal(d.reponses[1].demasque, false, "Alice trouvée par 1 sur 3 : pas la majorité");
  assert.equal(d.reponses[2].fantome, true, "personne n'a trouvé Cléo");
  assert.deepEqual(d.fantomes, ["cleo"]);
  assert.deepEqual(d.pires, ["dan"], "Dan n'a rien trouvé, les autres une fois chacun");
  assert.deepEqual(d.gorgees, { bob: 1, dan: 1 });
  assert.deepEqual(d.raisons.dan, ["pire détective"]);
});

test("pas de pire détective quand tout le monde est à égalité", () => {
  const inputs = { alice: { v: { 0: "bob" } }, bob: { v: { 1: "alice" } } };
  const d = depouiller(anonymes, roles, inputs);
  assert.deepEqual(d.pires, []);
});

test("robuste : votes absents, indices inconnus, auteur parti", () => {
  const d = depouiller(anonymes, { alice: { mien: 1 } }, { alice: { v: { 0: "zoe" } }, bob: "n'importe quoi" });
  assert.equal(d.reponses[0].auteur, null, "auteur inconnu");
  assert.deepEqual(d.points, {}, "pas de point pour un auteur inconnu");
  assert.equal(depouiller(null, null, null).reponses.length, 0);
});

test("questions : sans doublon, qui finissent par « ? », courtes", () => {
  const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const vues = new Map();
  for (const [lv, liste] of Object.entries(QUESTIONS)) {
    assert.ok(liste.length >= 30, `niveau ${lv} trop maigre`);
    for (const q of liste) {
      assert.ok(!vues.has(norm(q)), `doublon : « ${q} » / « ${vues.get(norm(q))} »`);
      vues.set(norm(q), q);
      assert.match(q, / \?$/, `« ${q} » doit finir par « ? »`);
      assert.ok(q.length <= 80, `trop longue : « ${q} »`);
    }
  }
});
