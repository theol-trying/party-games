/* Roi de la soirée : les parties sur un seul téléphone comptent aussi, et un
   même prénom n'apparaît qu'une fois (audit du 2026-09-28). */
import test from "node:test";
import assert from "node:assert/strict";
import { crownTotals } from "../src/crown.js";

test("un même prénom fusionne téléphone perso et téléphone partagé, un jeu ne compte qu'une fois", () => {
  const rows = crownTotals({
    dlea1: { name: "Léa", avatar: "🦊", byGame: { "quiz-gages": 3, "tu-preferes": 5 } },
    "nom:léa": { name: "Léa", avatar: "", byGame: { "quiz-gages": 5, estimations: 2 } },
    "nom:bob": { name: "Bob", avatar: "", byGame: { estimations: 5 } },
  });
  const lea = rows.find((r) => r.name === "Léa");
  assert.equal(rows.length, 2);
  assert.equal(lea.id, "dlea1", "l'appareil prime (repère « toi »)");
  assert.equal(lea.avatar, "🦊");
  assert.deepEqual(lea.byGame, { "quiz-gages": 5, "tu-preferes": 5, estimations: 2 }, "meilleure contribution par jeu");
  assert.equal(lea.pts, 12);
  assert.equal(rows[0].name, "Léa");
});
