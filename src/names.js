/* =========================================================================
   NAMES — résolution des cartes nominatives.
   Un texte peut contenir {joueur}, {joueur2}, {joueur3}… : chaque marqueur
   distinct est remplacé par un prénom DIFFÉRENT tiré au sort du salon. Si le
   salon est trop petit (ou vide, ex. mode solo), on retombe sur des tournures
   génériques — la carte reste toujours lisible.
   ========================================================================= */

import { shuffle } from "./ui.js";

const GENERIC = [
  "la personne à ta gauche",
  "la personne à ta droite",
  "quelqu'un en face de toi",
  "la personne la plus proche",
];

/** Y a-t-il un marqueur nominatif dans ce texte ? */
export function hasNamePlaceholder(text) {
  return typeof text === "string" && text.indexOf("{joueur") !== -1;
}

/** Remplace {joueur}, {joueur2}… par des prénoms distincts du salon (repli
    générique si trop peu de noms). `names` : tableau de prénoms (strings). */
export function resolveNames(text, names = []) {
  if (!hasNamePlaceholder(text)) return text;
  const pool = shuffle((names || []).filter((n) => typeof n === "string" && n.trim()));
  const chosen = {}; // marqueur -> prénom déjà attribué (mêmes marqueurs = même personne)
  let gi = 0;
  return text.replace(/\{joueur(\d?)\}/g, (_m, num) => {
    const key = num || "1";
    if (chosen[key]) return chosen[key];
    const name = pool.length ? pool.shift() : GENERIC[gi++ % GENERIC.length];
    chosen[key] = name;
    return name;
  });
}
