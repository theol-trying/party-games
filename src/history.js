/* =========================================================================
   HISTORIQUE — mémoire des soirées passées.

   Le classement « Roi de la soirée » est room-scopé : il disparaît avec le
   code de soirée. Ici on garde une trace DURABLE, côté appareil, pour offrir
   un palmarès cumulé entre potes au fil des soirées.

   Stockage volontairement LOCAL (localStorage, non room-scopé) : ces données
   n'ont pas à transiter par le serveur partagé, et chaque téléphone garde sa
   propre mémoire des soirées auxquelles il a participé.
   ========================================================================= */

const CLE = "soiree.historique";
const MAX_SOIREES = 60; // au-delà, on oublie les plus anciennes

function lire() {
  try {
    const v = JSON.parse(localStorage.getItem(CLE) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function ecrire(liste) {
  try { localStorage.setItem(CLE, JSON.stringify(liste.slice(-MAX_SOIREES))); } catch {}
}

/** Toutes les soirées enregistrées, de la plus récente à la plus ancienne. */
export function soirees() {
  return lire().slice().reverse();
}

/** Enregistre (ou met à jour) la soirée en cours.
    Une soirée = un code + un jour : rejouer le lendemain crée une entrée,
    relancer une partie le même soir met simplement à jour la même entrée. */
export function enregistrerSoiree(room, totals) {
  if (!room || !Array.isArray(totals) || !totals.length) return;
  const jour = new Date().toISOString().slice(0, 10);
  const id = `${jour}#${room}`;
  const liste = lire();
  const entree = {
    id,
    room,
    date: jour,
    joueurs: totals.slice(0, 12).map((r) => ({ nom: r.name, avatar: r.avatar || "🎲", pts: r.pts })),
  };
  const i = liste.findIndex((s) => s.id === id);
  if (i >= 0) liste[i] = entree; else liste.push(entree);
  ecrire(liste);
}

/** Palmarès cumulé sur toutes les soirées enregistrées.
    Les joueurs sont regroupés par prénom (c'est le seul identifiant stable
    d'une soirée à l'autre : les identifiants d'appareil, eux, changent). */
export function palmaresCumule() {
  const par = new Map();
  for (const s of lire()) {
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
    const meilleurs = (s.joueurs || []).filter((j) => j.pts > 0);
    const max = Math.max(0, ...meilleurs.map((j) => j.pts));
    meilleurs.filter((j) => j.pts === max).forEach((j) => {
      const e = par.get((j.nom || "").trim().toLowerCase());
      if (e) e.victoires += 1;
    });
  }
  return [...par.values()].sort((a, b) => b.pts - a.pts || b.victoires - a.victoires);
}

/** Efface tout l'historique (action explicite de l'utilisateur). */
export function effacerHistorique() {
  try { localStorage.removeItem(CLE); } catch {}
}

export function nbSoirees() {
  return lire().length;
}
