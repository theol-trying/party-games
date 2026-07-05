/* =========================================================================
   SCORING — scores persistés par soirée (room), partagés entre appareils.

   createScores(gameId, players) renvoie un contrôleur :
     .scores        objet { nom: points } (vivant)
     .ready         Promise résolue quand les scores persistés sont chargés
     .add(nom, n)   ajoute n points (défaut 1) et persiste
     .reset()       remet tout à zéro et persiste
     .ranking()     [{ name, points }] trié décroissant

   scoreboard(scoresObj) renvoie un tableau des scores prêt à afficher.
   ========================================================================= */

import { el } from "./ui.js";
import { getData, setData } from "./store.js";

export function createScores(gameId, players) {
  const key = "scores:" + gameId;
  const scores = Object.fromEntries(players.map((p) => [p, 0]));

  // Charge les scores persistés de cette soirée et les fusionne aux joueurs présents.
  const ready = getData(key, {}).then((saved) => {
    if (saved && typeof saved === "object") {
      for (const p of players) {
        if (typeof saved[p] === "number") scores[p] = saved[p];
      }
    }
    return scores;
  });

  const persist = () => setData(key, scores);

  return {
    scores,
    ready,
    add(name, n = 1) {
      scores[name] = (scores[name] || 0) + n;
      persist();
    },
    reset() {
      for (const p of Object.keys(scores)) scores[p] = 0;
      persist();
    },
    ranking() {
      return Object.keys(scores)
        .sort((a, b) => scores[b] - scores[a])
        .map((name) => ({ name, points: scores[name] }));
    },
  };
}

function medal(i) {
  return i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
}

/** Tableau des scores réutilisable (le leader est mis en avant). */
export function scoreboard(scoresObj) {
  const ranked = Object.keys(scoresObj).sort((a, b) => scoresObj[b] - scoresObj[a]);
  const max = Math.max(0, ...Object.values(scoresObj));
  return el(
    "div.sb",
    {},
    ranked.map((name, i) =>
      el("div.sb-row" + (i === 0 && max > 0 ? ".is-leader" : ""), {}, [
        el("span.sb-rank", { text: medal(i) }),
        el("span.sb-name", { text: name }),
        el("span.sb-pts", { text: String(scoresObj[name]) }),
      ])
    )
  );
}
