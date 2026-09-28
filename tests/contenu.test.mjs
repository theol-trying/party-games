/* =========================================================================
   Contrôles de contenu (audit du 2026-09-28) : pas de doublon, même à la
   ponctuation près, pas de carte « orpheline » qui suppose la précédente.
   ========================================================================= */

import test from "node:test";
import assert from "node:assert/strict";
import { QUESTIONS } from "../src/games/quiz-gages/data.js";
import { PHRASES } from "../src/games/jamais-jamais/data.js";
import { VERITES, ACTIONS } from "../src/games/action-verite/data.js";
import { AFFIRMATIONS } from "../src/games/plus-susceptible/data.js";
import { DILEMMES } from "../src/games/tu-preferes/data.js";
import { MISSIONS } from "../src/games/menteur/data.js";
import { typo } from "../src/ui.js";

// « Qui a peint « La Joconde » ? » = « Qui a peint la Joconde ? »
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const tout = (o) => (Array.isArray(o) ? o : Object.values(o).flat());

function sansDoublon(nom, textes) {
  const vus = new Map();
  for (const t of textes) {
    const k = norm(t);
    assert.ok(!vus.has(k), `${nom} : doublon « ${t} » / « ${vus.get(k)} »`);
    vus.set(k, t);
  }
}

test("aucun doublon, même à la ponctuation ou aux guillemets près", () => {
  sansDoublon("Quiz", QUESTIONS.map((q) => q.q));
  sansDoublon("Je n'ai jamais", tout(PHRASES));
  sansDoublon("Action ou Vérité", [...tout(VERITES), ...tout(ACTIONS)]);
  sansDoublon("Plus susceptible", AFFIRMATIONS);
  sansDoublon("Tu préfères", DILEMMES.map((d) => `${d.a} | ${d.b}`));
  sansDoublon("Menteur", MISSIONS);
});

test("pas de carte orpheline : le paquet est mélangé, aucune ne peut supposer la précédente", () => {
  for (const t of [...tout(VERITES), ...tout(ACTIONS)]) {
    assert.ok(!/^(Et |Termine par |Puis |Ensuite )/.test(t), `carte orpheline : « ${t} »`);
  }
});

test("« Montre… » est une action, pas une vérité", () => {
  for (const t of tout(VERITES)) assert.ok(!/^Montre /.test(t), `vérité qui est une action : « ${t} »`);
});

test("typographie : espace insécable avant ? ! : ; » et après «", () => {
  assert.equal(typo("Prêt ? Go !"), "Prêt ? Go !");
  assert.equal(typo("Le mot « yéti » : place-le ; vite"), "Le mot « yéti » : place-le ; vite");
  assert.equal(typo("0:57"), "0:57", "une heure sans espace n'est pas touchée");
});
