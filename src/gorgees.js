/* =========================================================================
   GORGÉES — 🍺 compteur de la soirée, tous jeux confondus, + option « sans alcool ».

   Les jeux signalent qui boit (compterGorgees) au moment où ils l'annoncent :
   en multi, sur le téléphone de l'HÔTE seulement et une fois par manche (clé
   `manche`), sinon chaque téléphone compterait ; sur un seul téléphone, par
   prénom. Le total vit dans le store partagé de la soirée (clé « gorgees »),
   comme le Roi de la soirée, et s'affiche dans le palmarès.

   Option « sans alcool » (réglage de la soirée, partagé) : les mêmes jeux, mais
   chaque gorgée se boit en soft. Les textes ne changent pas — convertir
   « bois ton verre cul sec » en points n'aurait aucun sens —, les émojis 🍺🍻
   deviennent 🥤 et le compteur parle de « gorgées de soft ».
   ========================================================================= */

import { getData, setData } from "./store.js";
import { reglerSansAlcool } from "./ui.js";

const KEY = "gorgees";
const KEY_REGLAGES = "reglages-soiree";

const dejaComptees = new Set(); // « jeu:manche » déjà comptées sur ce téléphone
let tampon = [];
let timer = null;

/** Ajoute des gorgées. entrees : [{ id?, nom, avatar?, n }] — id = appareil
    (multi), sinon le prénom sert de clé. opts.manche : clé unique de la manche
    (ex. "estimations:12") pour ne compter qu'une fois malgré les re-rendus. */
export function compterGorgees(entrees, { manche } = {}) {
  if (manche) {
    if (dejaComptees.has(manche)) return;
    dejaComptees.add(manche);
  }
  const valides = (entrees || []).filter((x) => x && x.n > 0 && (x.id || x.nom));
  if (!valides.length) return;
  tampon.push(...valides);
  clearTimeout(timer);
  timer = setTimeout(vider, 800); // une écriture pour plusieurs buveurs
}

async function vider() {
  const lot = tampon;
  tampon = [];
  try {
    const g = (await getData(KEY, {})) || {};
    for (const x of lot) {
      const cle = x.id || "nom:" + String(x.nom).trim().toLowerCase();
      const r = g[cle] || (g[cle] = { nom: x.nom || "?", avatar: "", n: 0 });
      if (x.nom) r.nom = x.nom;
      if (x.avatar) r.avatar = x.avatar;
      r.n += x.n;
    }
    await setData(KEY, g);
  } catch {}
}

/** Classement : un même prénom = un même joueur (appareil ou téléphone partagé). */
export async function lireGorgees() {
  const g = (await getData(KEY, {})) || {};
  const parNom = new Map();
  for (const r of Object.values(g)) {
    const cle = String(r.nom || "?").trim().toLowerCase();
    const e = parNom.get(cle) || { nom: r.nom || "?", avatar: "", n: 0 };
    e.n += r.n || 0;
    if (r.avatar) e.avatar = r.avatar;
    parNom.set(cle, e);
  }
  const lignes = [...parNom.values()].filter((e) => e.n > 0).sort((a, b) => b.n - a.n);
  return { lignes, total: lignes.reduce((a, e) => a + e.n, 0) };
}

export async function remettreGorgees() {
  await setData(KEY, {});
}

/* ----------------------------- Sans alcool ----------------------------- */
let sansAlcool = false;
export const estSansAlcool = () => sansAlcool;

/** Lit le réglage partagé de la soirée (à l'ouverture de l'accueil, d'un jeu). */
export async function chargerReglagesSoiree() {
  try {
    const r = (await getData(KEY_REGLAGES, {})) || {};
    appliquer(r.sansAlcool === true);
  } catch {}
  return sansAlcool;
}
export async function changerSansAlcool(v) {
  appliquer(v === true);
  const r = (await getData(KEY_REGLAGES, {})) || {};
  await setData(KEY_REGLAGES, { ...r, sansAlcool: sansAlcool });
}
function appliquer(v) {
  sansAlcool = v;
  reglerSansAlcool(v);
  try { document.documentElement.classList.toggle("sans-alcool", v); } catch {}
}
