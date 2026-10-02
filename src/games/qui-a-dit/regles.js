/* Règles de « Qui a dit ça ? » : module pur (sans DOM), testé par
   tests/qui-a-dit.test.mjs. */

/**
 * Dépouillement d'une manche de vote (pur, testé) : qui a écrit quoi, qui a
 * trouvé, qui s'est fait berner, les points et les gorgées.
 * @param {Array<{texte:string}>} anonymes  réponses dans l'ordre du mélange
 * @param {object} roles   deviceId -> { mien } (révélés avec la manche)
 * @param {object} inputs  deviceId -> { v: { indice: deviceIdChoisi } }
 */
export function depouiller(anonymes, roles, inputs) {
  const auteurDe = {};
  for (const [id, r] of Object.entries(roles || {})) {
    if (r && typeof r === "object" && Number.isInteger(r.mien)) auteurDe[r.mien] = id;
  }
  const votants = Object.keys(inputs || {}).filter((id) => inputs[id] && inputs[id].v && typeof inputs[id].v === "object");
  const points = {};
  const justes = {};
  votants.forEach((id) => (justes[id] = 0));
  const plus = (id) => { points[id] = (points[id] || 0) + 1; };
  const reponses = (anonymes || []).map((rep, i) => {
    const auteur = auteurDe[i] || null;
    const trouvePar = [];
    const bernes = [];
    for (const v of votants) {
      if (v === auteur) continue;
      const choix = inputs[v].v[i];
      if (choix == null) continue;
      if (choix === auteur) { trouvePar.push(v); justes[v]++; plus(v); }
      else { bernes.push({ id: v, choix }); if (auteur) plus(auteur); }
    }
    const nb = trouvePar.length + bernes.length;
    return {
      i,
      texte: String((rep && rep.texte) || "…"),
      auteur,
      trouvePar,
      bernes,
      demasque: !!auteur && nb > 0 && trouvePar.length * 2 > nb, // trouvé par la majorité
      fantome: !!auteur && nb >= 2 && trouvePar.length === 0, // trouvé par personne
    };
  });
  // Pire détective : le moins de bonnes réponses — seulement s'il y a un écart.
  const scores = votants.map((id) => justes[id]);
  const pires = votants.length >= 2 && Math.min(...scores) < Math.max(...scores)
    ? votants.filter((id) => justes[id] === Math.min(...scores))
    : [];
  const gorgees = {};
  const raisons = {};
  const boire = (id, raison) => { gorgees[id] = (gorgees[id] || 0) + 1; (raisons[id] ||= []).push(raison); };
  reponses.forEach((r) => { if (r.demasque) boire(r.auteur, "trop facile à démasquer"); });
  pires.forEach((id) => boire(id, "pire détective"));
  return { reponses, points, justes, pires, gorgees, raisons, fantomes: reponses.filter((r) => r.fantome).map((r) => r.auteur) };
}
