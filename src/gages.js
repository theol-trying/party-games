/* =========================================================================
   GAGES — bibliothèque centrale de gages, partagée par tous les jeux.
   Trois niveaux (voir src/levels.js) : "soft" · "soiree" · "x18".
   pickGage(level) pioche un gage du niveau demandé (repli soft si vide).
   ========================================================================= */

import { pick } from "./ui.js";

export const GAGES = [
  // --- soft : bon enfant, tout public ---
  { text: "Bois une gorgée 🍺", niveau: "soft" },
  { text: "Distribue 2 gorgées à qui tu veux", niveau: "soft" },
  { text: "Fais un compliment sincère à ton voisin de gauche", niveau: "soft" },
  { text: "Imite un animal jusqu'à ton prochain tour", niveau: "soft" },
  { text: "Parle avec un accent au choix pendant 2 tours", niveau: "soft" },
  { text: "Raconte une anecdote gênante, sinon bois double", niveau: "soft" },
  { text: "Fais 10 pompes ou finis ton verre", niveau: "soft" },
  { text: "Chante le refrain de ta chanson honteuse préférée", niveau: "soft" },
  { text: "Interdiction de dire « oui » / « non » pendant 2 tours (sinon gorgée)", niveau: "soft" },
  { text: "Montre la dernière photo de ta galerie", niveau: "soft" },

  // --- soirée : ça monte d'un cran, festif ---
  { text: "Cul sec du fond de ton verre", niveau: "soiree" },
  { text: "Bois puis désigne qui boit au prochain tour", niveau: "soiree" },
  { text: "Mime une célébrité, les autres devinent (sinon 2 gorgées)", niveau: "soiree" },
  { text: "Twerk de 5 secondes", niveau: "soiree" },
  { text: "Lis ton dernier SMS à voix haute", niveau: "soiree" },
  { text: "Duel de regard avec la personne en face : le premier qui rit boit", niveau: "soiree" },
  { text: "Parle uniquement en rimes jusqu'à ton prochain tour", niveau: "soiree" },
  { text: "Invente et bois un shot « maison » (à valider par la table)", niveau: "soiree" },
  { text: "Appelle un·e ami·e et chante-lui « joyeux anniversaire »", niveau: "soiree" },

  // --- 18+ : explicite, adultes avertis ---
  { text: "Fais un bisou sur la joue à la personne de ton choix… ou ailleurs", niveau: "x18" },
  { text: "Envoie un message coquin (ou très drôle) à la 3e personne de ta liste", niveau: "x18" },
  { text: "Mime ta position préférée, les autres devinent", niveau: "x18" },
  { text: "Échange un vêtement avec la personne en face", niveau: "x18" },
  { text: "Fais un lap dance de 10 secondes à la personne de ton choix", niveau: "x18" },
  { text: "Révèle un fantasme, sinon cul sec", niveau: "x18" },
  { text: "Body shot avec la personne de ton choix (si tout le monde est OK)", niveau: "x18" },
];

/** Pioche un texte de gage du niveau demandé ; repli soft si le niveau est vide. */
export function pickGage(level = "soft") {
  let pool = GAGES.filter((g) => g.niveau === level);
  if (!pool.length) pool = GAGES.filter((g) => g.niveau === "soft");
  return pick(pool).text;
}
