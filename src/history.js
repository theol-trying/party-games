/* =========================================================================
   HISTORIQUE — mémoire des soirées, partagée entre les potes.

   Le classement « Roi de la soirée » meurt avec la soirée. Ici on garde une
   trace des soirées passées pour offrir un palmarès cumulé.

   DEUX SOURCES, volontairement :
   - le KV room-scopé (clé « historique ») : c'est la couche PARTAGÉE. Tous les
     téléphones qui utilisent le même code de soirée voient le même palmarès.
     C'est déjà ainsi que fonctionnent le classement, les cartes perso et
     l'anti-répétition — le code de soirée EST l'identité du groupe.
   - le localStorage : le filet DURABLE. Le KV expire au bout de 30 jours sans
     écriture (TTL serveur) ; un groupe qui ne joue pas pendant un mois
     perdrait tout. La copie locale survit et réhydrate le partage.

   À la lecture on fusionne les deux, par identifiant de soirée. Une soirée =
   un code + un jour, donc rejouer le même soir met à jour l'entrée existante
   au lieu d'en créer une seconde.
   ========================================================================= */

import { getData, setData } from "./store.js";

const CLE_LOCALE = "soiree.historique";
const CLE_PARTAGEE = "historique";
// Plafond : le KV refuse les valeurs > 32 Ko. 40 soirées × 10 joueurs reste
// très en deçà, avec de la marge pour des prénoms longs.
const MAX_SOIREES = 40;
const MAX_JOUEURS = 10;

function lireLocal() {
  try {
    const v = JSON.parse(localStorage.getItem(CLE_LOCALE) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function ecrireLocal(liste) {
  try { localStorage.setItem(CLE_LOCALE, JSON.stringify(liste)); } catch {}
}

/** Fusionne deux listes de soirées par id. Fonction pure (donc testable) :
    à id égal, l'entrée qui a le plus de joueurs gagne — c'est celle qui a vu
    la soirée la plus complète. */
export function fusionner(a = [], b = []) {
  const par = new Map();
  for (const s of [...a, ...b]) {
    if (!s || !s.id) continue;
    const existante = par.get(s.id);
    if (!existante || (s.joueurs || []).length > (existante.joueurs || []).length) par.set(s.id, s);
  }
  return [...par.values()].sort((x, y) => String(x.id).localeCompare(String(y.id))).slice(-MAX_SOIREES);
}

/** Historique complet : partagé (KV) + local, fusionnés. */
export async function chargerHistorique() {
  let partage = [];
  try { partage = (await getData(CLE_PARTAGEE, [])) || []; } catch {}
  const fusion = fusionner(Array.isArray(partage) ? partage : [], lireLocal());
  ecrireLocal(fusion); // le local rattrape ce que le partage lui apprend
  return fusion;
}

/** Enregistre (ou met à jour) la soirée en cours, localement ET pour le groupe. */
export async function enregistrerSoiree(room, totals) {
  if (!room || !Array.isArray(totals) || !totals.length) return;
  const jour = new Date().toISOString().slice(0, 10);
  const entree = {
    id: `${jour}#${room}`,
    room,
    date: jour,
    joueurs: totals.slice(0, MAX_JOUEURS).map((r) => ({ nom: r.name, avatar: r.avatar || "🎲", pts: r.pts })),
  };
  const fusion = fusionner(await chargerHistorique(), [entree]);
  ecrireLocal(fusion);
  try { await setData(CLE_PARTAGEE, fusion); } catch {}
  return fusion;
}

/** Palmarès cumulé sur une liste de soirées. Fonction pure (testable).
    Les joueurs sont regroupés par prénom : c'est le seul identifiant stable
    d'une soirée à l'autre, les identifiants d'appareil changeant à chaque fois. */
export function palmaresCumule(liste = []) {
  const par = new Map();
  for (const s of liste) {
    for (const j of s.joueurs || []) {
      const cle = (j.nom || "").trim().toLowerCase();
      if (!cle) continue;
      const e = par.get(cle) || { nom: j.nom, avatar: j.avatar, pts: 0, soirees: 0, victoires: 0 };
      e.pts += j.pts || 0;
      e.soirees += 1;
      if (j.avatar) e.avatar = j.avatar;
      par.set(cle, e);
    }
    // Victoire = meilleur score de la soirée (ex æquo comptés pour tous).
    const marqueurs = (s.joueurs || []).filter((j) => j.pts > 0);
    const max = Math.max(0, ...marqueurs.map((j) => j.pts));
    marqueurs.filter((j) => j.pts === max).forEach((j) => {
      const e = par.get((j.nom || "").trim().toLowerCase());
      if (e) e.victoires += 1;
    });
  }
  return [...par.values()].sort((a, b) => b.pts - a.pts || b.victoires - a.victoires);
}

/** Efface l'historique — local ET partagé (action explicite de l'utilisateur). */
export async function effacerHistorique() {
  try { localStorage.removeItem(CLE_LOCALE); } catch {}
  try { await setData(CLE_PARTAGEE, []); } catch {}
}
