/* =========================================================================
   ESTIMATIONS — règles du jeu, sans aucune dépendance au navigateur.
   Séparées de l'interface pour être testées en Node (tests/estimations.test.mjs)
   et pour que tous les téléphones calculent EXACTEMENT le même résultat.
   ========================================================================= */

/** Lit un nombre tapé par un joueur : « 1 500 », « 9,58 », « 1.5 », « -3 ».
    Renvoie null si ce n'est pas un nombre utilisable. */
export function lireNombre(saisie) {
  if (typeof saisie === "number") return Number.isFinite(saisie) ? saisie : null;
  const txt = String(saisie ?? "")
    .replace(/[\s  ]/g, "") // espaces, y compris insécables (« 1 500 »)
    .replace(",", ".");
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(txt)) return null;
  const n = Number(txt);
  return Number.isFinite(n) ? n : null;
}

const EPS = 1e-9; // égalité de flottants (9.58 − 9.5 ≠ 0.08 pile en binaire)

/** Tombé « pile » : écart nul, ou ≤ 1 % de la réponse (la précision d'un bon
    estimateur, pas celle d'une calculatrice). */
export function estPile(reponse, estimation) {
  const ecart = Math.abs(estimation - reponse);
  return ecart <= EPS || ecart <= Math.abs(reponse) * 0.01 + EPS;
}

/**
 * Classe une manche.
 * @param {number} reponse
 * @param {Array<{id:string, v:number|null|undefined}>} estimations  v absent = pas de réponse
 * @returns {{
 *   lignes: Array<{id, v, ecart, rang}>,  // joueurs ayant répondu, du plus proche au plus loin
 *   gagnants: string[],                     // le(s) plus proche(s) — ex æquo compris
 *   perdants: string[],                     // le(s) plus loin(s) : ils boivent
 *   absents: string[],                      // pas de réponse : ils boivent aussi
 *   pile: boolean,                          // un gagnant est tombé pile
 *   points: Object<string, number>,         // points marqués cette manche
 * }}
 */
export function classer(reponse, estimations) {
  const repondu = [];
  const absents = [];
  for (const e of estimations) {
    const v = lireNombre(e.v);
    if (v == null) absents.push(e.id);
    else repondu.push({ id: e.id, v, ecart: Math.abs(v - reponse) });
  }
  repondu.sort((a, b) => a.ecart - b.ecart);

  // Rang « sportif » : deux ex æquo partagent le même rang, le suivant saute.
  repondu.forEach((l, i) => {
    l.rang = i > 0 && Math.abs(l.ecart - repondu[i - 1].ecart) <= EPS ? repondu[i - 1].rang : i + 1;
  });

  const points = {};
  if (!repondu.length) return { lignes: [], gagnants: [], perdants: [], absents, pile: false, points };

  const meilleur = repondu[0].ecart;
  const pire = repondu[repondu.length - 1].ecart;
  const gagnants = repondu.filter((l) => Math.abs(l.ecart - meilleur) <= EPS).map((l) => l.id);
  // Personne ne boit si tout le monde est à égalité (il n'y a pas de « plus loin »).
  const perdants = pire - meilleur > EPS ? repondu.filter((l) => Math.abs(l.ecart - pire) <= EPS).map((l) => l.id) : [];
  const pile = estPile(reponse, repondu[0].v);
  for (const id of gagnants) points[id] = pile ? 2 : 1; // le plus proche : 1 point, 2 s'il tombe pile

  return { lignes: repondu, gagnants, perdants, absents, pile, points };
}
