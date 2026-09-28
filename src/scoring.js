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
import { awardStanding, effacerContribution } from "./crown.js";

// Jeux qui alimentent le 👑 Roi de la soirée (mêmes jeux qu'en multi).
const JEUX_COURONNE = ["quiz-gages", "estimations", "blind-test", "plus-susceptible"];
const clePrenom = (nom) => "nom:" + String(nom).trim().toLowerCase();

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

  // Partie sur un seul téléphone : le classement du jeu alimente aussi le Roi
  // de la soirée (avant, seul le multi comptait). Pas les équipes (clé
  // « jeu:teams ») : une équipe n'est pas un joueur. Écriture regroupée.
  let couronneTimer = null;
  const couronne = () => {
    if (!JEUX_COURONNE.includes(gameId)) return;
    clearTimeout(couronneTimer);
    couronneTimer = setTimeout(() => {
      const noms = Object.keys(scores);
      const ids = noms.map(clePrenom);
      if (!noms.some((n) => scores[n] > 0)) return void effacerContribution(gameId, ids).catch(() => {});
      const parId = {}, nomDe = {};
      noms.forEach((n) => { parId[clePrenom(n)] = scores[n]; nomDe[clePrenom(n)] = n; });
      const classes = [...ids].sort((a, b) => parId[b] - parId[a]);
      awardStanding(gameId, classes, nomDe, {}, { scores: parId }).catch(() => {});
    }, 1500);
  };
  const persist = () => { setData(key, scores); couronne(); };

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

const reduced = (() => {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
})();

/** Nombre qui défile de `from` à `to` (ralenti en fin de course).
    Options : `format(v)` met en forme chaque valeur (par défaut : entier
    arrondi) ; `duree` en ms (par défaut 700). */
export function compteur(to, from = to, { format = (v) => String(Math.round(v)), duree = 700 } = {}) {
  const node = el("span", { text: format(from) });
  if (reduced || from === to) { node.textContent = format(to); return node; }
  const t0 = performance.now();
  const pas = (t) => {
    const k = Math.min(1, (t - t0) / duree);
    node.textContent = k < 1 ? format(from + (to - from) * (1 - Math.pow(1 - k, 3))) : format(to);
    if (k < 1) requestAnimationFrame(pas);
  };
  requestAnimationFrame(pas);
  // Filet : si le navigateur ne dessine plus (appli en arrière-plan), les images
  // d'animation n'arrivent pas — la valeur finale s'affiche quand même.
  setTimeout(() => { node.textContent = format(to); }, duree + 80);
  return node;
}

/** « +N » qui monte et s'efface à côté d'un score qui vient d'augmenter. */
function gain(n) {
  return n > 0 ? el("span.sb-gain", { text: "+" + n, "aria-hidden": "true" }) : null;
}

/** Mini-podium des 3 premiers. classement : [{ nom, points, avant?, gain? }]
    trié décroissant ; `avant` = score d'où partent les points qui défilent,
    `gain` = « +N » affiché (par défaut points − avant). */
export function podium(classement) {
  const top = classement.slice(0, 3);
  if (top.length < 2) return null;
  // Disposition classique : 2e à gauche, 1er au centre (plus haut), 3e à droite.
  const places = [[top[1], 1], [top[0], 0], [top[2], 2]].filter(([r]) => r);
  return el("div.sb-podium", { role: "list", "aria-label": "Podium" },
    places.map(([r, i]) =>
      el(`div.sb-marche.is-${i + 1}`, { role: "listitem" }, [
        el("div.sb-marche__medaille", { text: medal(i), "aria-hidden": "true" }),
        el("div.sb-marche__nom", { text: r.nom }),
        el("div.sb-marche__bloc", {}, [compteur(r.points, r.avant ?? r.points), gain(r.gain ?? r.points - (r.avant ?? r.points))]),
      ])
    )
  );
}

// Derniers scores AFFICHÉS, par objet de scores : chaque jeu garde le sien
// (sc.scores), donc deux jeux n'échangent jamais leurs valeurs. Au nouvel
// affichage, chaque score défile depuis la valeur vue la dernière fois.
const dejaVus = new WeakMap();

/** Tableau des scores réutilisable (le leader est mis en avant).
    { podium: true } : les 3 premiers en podium, le reste en liste — à utiliser
    sur les écrans de résultats, entre deux manches. */
export function scoreboard(scoresObj, { podium: avecPodium = false } = {}) {
  const ranked = Object.keys(scoresObj).sort((a, b) => scoresObj[b] - scoresObj[a]);
  const max = Math.max(0, ...Object.values(scoresObj));
  const vus = dejaVus.get(scoresObj) || {};
  dejaVus.set(scoresObj, { ...scoresObj });
  const connu = (name) => typeof vus[name] === "number";
  // Premier affichage : les points défilent depuis 0, mais sans « +N » — ce
  // serait faire croire que des points déjà acquis viennent d'être gagnés.
  const avant = (name) => (connu(name) ? vus[name] : 0);
  const gagne = (name) => (connu(name) ? scoresObj[name] - vus[name] : 0);

  const tete = avecPodium && max > 0
    ? podium(ranked.map((name) => ({ nom: name, points: scoresObj[name], avant: avant(name), gain: gagne(name) })))
    : null;
  const reste = tete ? ranked.slice(3) : ranked;
  const debut = tete ? 3 : 0;
  return el("div.sb", {}, [
    tete,
    ...reste.map((name, j) => {
      const i = debut + j;
      // Rang « sportif » : deux ex æquo ont la même médaille ; à 0 point, pas de
      // médaille du tout (avant : 🥇 et 🥈 dès le début, à 0 partout).
      const rang = ranked.filter((x) => scoresObj[x] > scoresObj[name]).length;
      return el("div.sb-row" + (i === 0 && max > 0 ? ".is-leader" : ""), {}, [
        el("span.sb-rank", { text: scoresObj[name] > 0 ? medal(rang) : "–" }),
        el("span.sb-name", { text: name }),
        el("span.sb-pts", {}, [compteur(scoresObj[name], avant(name)), gain(gagne(name))]),
      ]);
    }),
  ]);
}
