/* =========================================================================
   STATS — petites métriques de soirée, pour les superlatifs de fin de partie.

   Le classement « Roi de la soirée » (crown.js) dit QUI a gagné. Ici on garde
   de quoi dire COMMENT : le plus rapide au buzzer, le plus désigné, le plus
   discret… C'est ce qui rend le récap amusant à partager.

   Volontairement minimal : un compteur par (joueur, clé). Les jeux appellent
   bump() à la révélation, côté HÔTE uniquement — comme awardStanding — pour
   qu'un même événement ne soit pas compté une fois par téléphone.

   Stockage : clé KV « stats », room-scopée (elle meurt avec la soirée).
   ========================================================================= */

import { getData, setData } from "./store.js";

const KEY = "stats";

/** Définition des superlatifs : la clé comptée, et comment l'annoncer. */
const SUPERLATIFS = [
  { cle: "buzz1", emoji: "⚡", titre: "Plus rapide", phrase: (n) => `${n} fois premier au buzzer` },
  { cle: "bonneRep", emoji: "🎯", titre: "Meilleure gâchette", phrase: (n) => `${n} bonnes réponses` },
  { cle: "designe", emoji: "👉", titre: "Le plus désigné", phrase: (n) => `désigné ${n} fois` },
  { cle: "demasque", emoji: "🕵️", titre: "Fin limier", phrase: (n) => `${n} imposteurs démasqués` },
  { cle: "impuni", emoji: "🤥", titre: "Meilleur menteur", phrase: (n) => `${n} missions réussies` },
  { cle: "gage", emoji: "🍻", titre: "Roi du gage", phrase: (n) => `${n} gages encaissés` },
];

/** Incrémente un compteur. À n'appeler QUE depuis l'hôte. */
export async function bump(playerId, cle, n = 1) {
  if (!playerId || !cle || !n) return;
  const s = (await getData(KEY, {})) || {};
  const j = s[playerId] || (s[playerId] = {});
  j[cle] = (j[cle] || 0) + n;
  await setData(KEY, s);
}

/** Incrémente plusieurs joueurs d'un coup (une seule écriture). */
export async function bumpMany(paires, cle, n = 1) {
  const ids = (paires || []).filter(Boolean);
  if (!ids.length || !cle) return;
  const s = (await getData(KEY, {})) || {};
  ids.forEach((id) => {
    const j = s[id] || (s[id] = {});
    j[cle] = (j[cle] || 0) + n;
  });
  await setData(KEY, s);
}

export async function getStats() {
  return (await getData(KEY, {})) || {};
}
export async function resetStats() {
  await setData(KEY, {});
}

/** Calcule les superlatifs à décerner.
    Un superlatif n'est décerné que s'il a un vainqueur NET : à égalité, il n'y
    a rien d'amusant à annoncer, donc on l'omet. */
export function superlatifs(stats, names = {}, avatars = {}) {
  const out = [];
  for (const def of SUPERLATIFS) {
    let meilleur = null;
    let exaequo = false;
    for (const id of Object.keys(stats || {})) {
      const v = (stats[id] || {})[def.cle] || 0;
      if (!v) continue;
      if (!meilleur || v > meilleur.v) { meilleur = { id, v }; exaequo = false; }
      else if (v === meilleur.v) exaequo = true;
    }
    if (!meilleur || exaequo) continue;
    out.push({
      cle: def.cle,
      emoji: def.emoji,
      titre: def.titre,
      detail: def.phrase(meilleur.v),
      id: meilleur.id,
      nom: names[meilleur.id] || "?",
      avatar: avatars[meilleur.id] || "🎲",
      valeur: meilleur.v,
    });
  }
  return out;
}
