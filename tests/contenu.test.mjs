/* =========================================================================
   Contrôles de contenu (audit du 2026-09-28) : pas de doublon, même à la
   ponctuation près, pas de carte « orpheline » qui suppose la précédente.
   ========================================================================= */

import test from "node:test";
import assert from "node:assert/strict";
import { QUESTIONS } from "../src/games/quiz-gages/data.js";
import { CATEGORIES as THEMES_QUIZ, garderDifficulte } from "../src/games/quiz-gages/categories.js";
import { PHRASES } from "../src/games/jamais-jamais/data.js";
import { VERITES, ACTIONS } from "../src/games/action-verite/data.js";
import { AFFIRMATIONS } from "../src/games/plus-susceptible/data.js";
import { DILEMMES } from "../src/games/tu-preferes/data.js";
import { MISSIONS } from "../src/games/menteur/data.js";
import { PAIRES } from "../src/games/undercover/data.js";
import { QUESTIONS as ESTIMATIONS } from "../src/games/estimations/data.js";
import { QUESTIONS as QUI_A_DIT } from "../src/games/qui-a-dit/data.js";
import { AMORCES, OUVERTURES, CLOTURES } from "../src/games/cadavre-exquis/data.js";
import { TRACKS } from "../src/games/blind-test/data.js";
import { GAGES } from "../src/gages.js";
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
  // 2e vague de contenu (2026-10) : tous les jeux sont désormais couverts.
  sansDoublon("Undercover", PAIRES.map((p) => [p.civils, p.imposteur].sort().join(" | ")));
  sansDoublon("Estimations", ESTIMATIONS.map((q) => q.q));
  sansDoublon("Qui a dit ça", tout(QUI_A_DIT));
  sansDoublon("Cadavre exquis", [...AMORCES, ...OUVERTURES, ...CLOTURES]);
  sansDoublon("Blind Test", TRACKS.map((t) => `${t.title} | ${t.artist}`));
  sansDoublon("Gages", GAGES.map((g) => g.text));
});

test("quiz : quatre choix distincts et une bonne réponse valide pour chaque question", () => {
  for (const q of QUESTIONS) {
    assert.equal(q.choices.length, 4, `« ${q.q} » : ${q.choices.length} choix`);
    assert.equal(new Set(q.choices.map((c) => c.trim().toLowerCase())).size, 4, `« ${q.q} » : choix en double`);
    assert.ok(Number.isInteger(q.correct) && q.correct >= 0 && q.correct < 4, `« ${q.q} » : bonne réponse invalide`);
  }
  assert.ok(QUESTIONS.length >= 4000, "banque du quiz anormalement réduite");
});

test("quiz : chaque question a un niveau, et chaque thème en propose assez à chaque niveau", () => {
  const parTheme = {};
  for (const q of QUESTIONS) {
    assert.ok([1, 2, 3].includes(q.niveau), `« ${q.q} » : niveau manquant ou invalide (${q.niveau})`);
    (parTheme[q.cat] ||= [0, 0, 0, 0])[q.niveau]++;
  }
  for (const t of THEMES_QUIZ) {
    const [, facile, moyen, expert] = parTheme[t.id] || [0, 0, 0, 0];
    // Actus et Assorti : banques courtes ou volontairement faciles.
    const mini = t.id === "actu" || t.id === "melange" ? 1 : 15;
    assert.ok(facile >= 5 && moyen >= 10 && expert >= mini, `${t.id} : ${facile} facile / ${moyen} moyen / ${expert} expert`);
  }
  // Filtre : « Tous niveaux » garde tout, un niveau ne garde que lui (et les cartes perso, sans niveau).
  assert.equal(QUESTIONS.filter(garderDifficulte("tous")).length, QUESTIONS.length);
  assert.ok(QUESTIONS.filter(garderDifficulte("expert")).every((q) => q.niveau === 3));
  assert.ok(garderDifficulte("facile")({ q: "carte perso" }));
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
