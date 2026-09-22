/* Palmarès partagé : la fusion de deux historiques et le cumul sont des
   fonctions pures, donc testables sans navigateur — c'est là que vivent les
   règles subtiles (déduplication, ex æquo, regroupement par prénom). */

import test from "node:test";
import assert from "node:assert/strict";
import { fusionner, palmaresCumule } from "../src/history.js";

const soiree = (id, joueurs) => ({ id, room: id.split("#")[1], date: id.split("#")[0], joueurs });
const j = (nom, pts, avatar = "🦊") => ({ nom, avatar, pts });

test("fusion : une soirée présente des deux côtés n'est pas dupliquée", () => {
  const a = [soiree("2026-09-01#ABCD", [j("Alice", 5)])];
  const b = [soiree("2026-09-01#ABCD", [j("Alice", 5)])];
  assert.equal(fusionner(a, b).length, 1);
});

test("fusion : à id égal, la version la plus complète gagne", () => {
  const partiel = [soiree("2026-09-01#ABCD", [j("Alice", 5)])];
  const complet = [soiree("2026-09-01#ABCD", [j("Alice", 5), j("Bob", 3), j("Caro", 1)])];
  // Peu importe l'ordre des arguments : c'est le nombre de joueurs qui tranche.
  assert.equal(fusionner(partiel, complet)[0].joueurs.length, 3);
  assert.equal(fusionner(complet, partiel)[0].joueurs.length, 3);
});

test("fusion : les soirées distinctes sont toutes conservées et ordonnées", () => {
  const a = [soiree("2026-09-03#ABCD", [j("Alice", 1)])];
  const b = [soiree("2026-09-01#ABCD", [j("Bob", 1)]), soiree("2026-09-02#WXYZ", [j("Caro", 1)])];
  const f = fusionner(a, b);
  assert.equal(f.length, 3);
  assert.deepEqual(f.map((s) => s.date), ["2026-09-01", "2026-09-02", "2026-09-03"]);
});

test("fusion : entrées vides ou sans id ignorées", () => {
  assert.deepEqual(fusionner([], []), []);
  assert.equal(fusionner([null, { room: "X" }], [soiree("2026-09-01#A", [j("A", 1)])]).length, 1);
});

test("cumul : points et soirées additionnés par prénom", () => {
  const h = [
    soiree("2026-09-01#ABCD", [j("Alice", 10), j("Bob", 6)]),
    soiree("2026-09-02#ABCD", [j("Alice", 4), j("Bob", 9), j("Caro", 2)]),
  ];
  // Trié par points décroissants : Bob (6+9) devance Alice (10+4).
  assert.deepEqual(
    palmaresCumule(h).map((r) => `${r.nom}:${r.pts}/${r.soirees}/${r.victoires}`),
    ["Bob:15/2/1", "Alice:14/2/1", "Caro:2/1/0"]
  );
});

test("cumul : le regroupement par prénom ignore casse et espaces", () => {
  const h = [
    soiree("2026-09-01#A", [j("Alice", 5)]),
    soiree("2026-09-02#A", [j("  alice ", 5)]),
  ];
  const p = palmaresCumule(h);
  assert.equal(p.length, 1, "un seul joueur");
  assert.equal(p[0].pts, 10);
  assert.equal(p[0].soirees, 2);
});

test("cumul : ex æquo — la victoire compte pour les deux", () => {
  const p = palmaresCumule([soiree("2026-09-01#A", [j("Alice", 7), j("Bob", 7), j("Caro", 1)])]);
  const par = Object.fromEntries(p.map((r) => [r.nom, r.victoires]));
  assert.equal(par.Alice, 1);
  assert.equal(par.Bob, 1);
  assert.equal(par.Caro, 0, "le dernier ne gagne pas");
});

test("cumul : une soirée où personne ne marque ne donne aucune victoire", () => {
  const p = palmaresCumule([soiree("2026-09-01#A", [j("Alice", 0), j("Bob", 0)])]);
  assert.equal(p.reduce((n, r) => n + r.victoires, 0), 0);
});
