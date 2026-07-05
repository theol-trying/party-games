/* =========================================================================
   GAGES — bibliothèque centrale de gages, partagée par tous les jeux.
   Un seul endroit à enrichir/modérer, ton cohérent. Tag d'intensité soft/hot.
   pickGage("soft") ne pioche que du soft ; pickGage("hot") pioche soft + hot.
   ========================================================================= */

import { pick } from "./ui.js";

export const GAGES = [
  // --- soft ---
  { text: "Bois une gorgée 🍺", niveau: "soft" },
  { text: "Distribue 2 gorgées à qui tu veux", niveau: "soft" },
  { text: "Cul sec du fond de ton verre", niveau: "soft" },
  { text: "Fais un compliment sincère à ton voisin de gauche", niveau: "soft" },
  { text: "Imite un animal jusqu'à ton prochain tour", niveau: "soft" },
  { text: "Parle avec un accent au choix pendant 2 tours", niveau: "soft" },
  { text: "Raconte une anecdote gênante, sinon bois double", niveau: "soft" },
  { text: "Fais 10 pompes ou finis ton verre", niveau: "soft" },
  { text: "Chante le refrain de ta chanson honteuse préférée", niveau: "soft" },
  { text: "Laisse ton voisin poster une story de son choix", niveau: "soft" },
  { text: "Interdiction de dire « oui » / « non » pendant 2 tours (sinon gorgée)", niveau: "soft" },
  { text: "Montre la dernière photo de ta galerie", niveau: "soft" },

  // --- hot ---
  { text: "Bois cul sec, puis désigne qui boit au prochain tour", niveau: "hot" },
  { text: "Fais un bisou sur la joue à la personne de ton choix", niveau: "hot" },
  { text: "Envoie un message coquin (ou drôle) à la 3e personne de ta liste", niveau: "hot" },
  { text: "Mime ta position préférée, les autres devinent", niveau: "hot" },
  { text: "Échange un vêtement avec la personne en face", niveau: "hot" },
  { text: "Lis ton dernier message privé à voix haute", niveau: "hot" },
];

/** Pioche un texte de gage à l'intensité voulue ("soft" par défaut). */
export function pickGage(niveau = "soft") {
  const pool = niveau === "hot" ? GAGES : GAGES.filter((g) => g.niveau === "soft");
  return pick(pool).text;
}
