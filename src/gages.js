/* =========================================================================
   GAGES — bibliothèque centrale de gages, partagée par tous les jeux.
   Trois niveaux (voir src/levels.js) : "soft" · "soiree" · "x18".
   pickGage(level) pioche un gage du niveau demandé (repli soft si vide).
   Banque rédigée à la main (90 : 35 soft / 30 soirée / 25 18+).
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
  { text: "Parle en rimes jusqu'à ton prochain tour", niveau: "soft" },
  { text: "Fais le tour de la pièce en marche arrière", niveau: "soft" },
  { text: "Bois sans les mains (paille ou aide autorisée)", niveau: "soft" },
  { text: "Imite quelqu'un de la table jusqu'à ce qu'on devine qui", niveau: "soft" },
  { text: "Raconte une blague ; si personne ne rit, bois 2 gorgées", niveau: "soft" },
  { text: "Garde un objet sur la tête jusqu'à ton prochain tour", niveau: "soft" },
  { text: "Parle en chuchotant jusqu'à ton prochain tour", niveau: "soft" },
  { text: "Fais deviner un film en le mimant en 15 secondes", niveau: "soft" },
  { text: "Tiens ton verre de la main faible jusqu'à la fin de la manche", niveau: "soft" },
  { text: "Invente un surnom à chaque joueur, applicable ce soir", niveau: "soft" },
  { text: "Montre ton emoji le plus utilisé", niveau: "soft" },
  { text: "Danse 15 secondes sans musique", niveau: "soft" },
  { text: "Prends la pose « photo de classe » pendant 20 secondes", niveau: "soft" },
  { text: "Applaudis la prochaine phrase de ton voisin comme un chef-d'œuvre", niveau: "soft" },
  { text: "Fais ton meilleur rire de méchant de film", niveau: "soft" },
  { text: "Récite l'alphabet à l'envers jusqu'à P, sinon bois", niveau: "soft" },
  { text: "Le prochain qui te fait rire te fait boire : tiens 2 minutes", niveau: "soft" },
  { text: "Improvise 10 secondes de beatbox", niveau: "soft" },
  { text: "Termine tes phrases par « voilà voilà » pendant un tour", niveau: "soft" },
  { text: "Échange de place avec ton voisin de droite", niveau: "soft" },
  { text: "Bois à chaque fois que quelqu'un dit ton prénom pendant un tour", niveau: "soft" },
  { text: "Fais un tour de table de high-fives, avec le bruitage", niveau: "soft" },
  { text: "Raconte ton pire rendez-vous chez le coiffeur ou le dentiste", niveau: "soft" },
  { text: "Prends l'accent d'un présentateur météo pour ta prochaine phrase", niveau: "soft" },
  { text: "Cul sec de ce qui reste dans ton verre… d'eau (sinon 2 gorgées)", niveau: "soft" },

  // --- soirée : ça monte d'un cran, festif ---
  { text: "Cul sec du fond de ton verre", niveau: "soiree" },
  { text: "Bois puis désigne qui boit au prochain tour", niveau: "soiree" },
  { text: "Mime une célébrité, les autres devinent (sinon 2 gorgées)", niveau: "soiree" },
  { text: "Twerk de 5 secondes", niveau: "soiree" },
  { text: "Lis ton dernier SMS à voix haute", niveau: "soiree" },
  { text: "Duel de regard avec la personne en face : le premier qui rit boit", niveau: "soiree" },
  { text: "Invente et bois un shot « maison » (validé par la table)", niveau: "soiree" },
  { text: "Appelle un ami et chante-lui « joyeux anniversaire »", niveau: "soiree" },
  { text: "Slow de 20 secondes avec la personne de ton choix", niveau: "soiree" },
  { text: "Montre la photo la plus gênante de ta galerie", niveau: "soiree" },
  { text: "Envoie « on en parle demain » à un contact au hasard", niveau: "soiree" },
  { text: "Raconte ton pire râteau en 30 secondes", niveau: "soiree" },
  { text: "Assieds-toi sur les genoux de ton voisin jusqu'à ton prochain tour", niveau: "soiree" },
  { text: "Fais une déclaration théâtrale à la personne en face", niveau: "soiree" },
  { text: "Laisse ton voisin écrire un message (validé par toi) à qui il veut", niveau: "soiree" },
  { text: "Danse collé-serré 15 secondes avec la personne désignée par la table", niveau: "soiree" },
  { text: "Révèle ton crush de jeunesse le plus improbable", niveau: "soiree" },
  { text: "Fais ta meilleure technique de drague sur une chaise", niveau: "soiree" },
  { text: "Bois 1 gorgée par ex que tu as eu (plafonné à 5, on n'est pas là pour juger)", niveau: "soiree" },
  { text: "Susurre le prénom de ton voisin de la façon la plus sensuelle possible", niveau: "soiree" },
  { text: "Montre ta dernière recherche Internet", niveau: "soiree" },
  { text: "La table choisit ta photo de profil pour la soirée", niveau: "soiree" },
  { text: "Raconte la pire chose que tu aies faite en soirée", niveau: "soiree" },
  { text: "Fais un vocal de compliments à la dernière personne qui t'a écrit", niveau: "soiree" },
  { text: "Regarde ton voisin dans les yeux et dis « je sais tout » sans rire", niveau: "soiree" },
  { text: "Porte un toast dramatique « à ceux qu'on a perdus en soirée »", niveau: "soiree" },
  { text: "Imite la façon de danser de la personne en face", niveau: "soiree" },
  { text: "Distribue autant de gorgées que ton nombre d'applis de rencontre (passées ou présentes)", niveau: "soiree" },
  { text: "Choisis un mot interdit pour toute la table jusqu'à la fin de la manche : qui le dit boit", niveau: "soiree" },
  { text: "Bois en fixant la personne la plus séduisante de la table", niveau: "soiree" },

  // --- 18+ : explicite, adultes avertis, volontaires uniquement ---
  { text: "Bois cul sec, puis désigne qui boit au prochain tour", niveau: "x18" },
  { text: "Fais un bisou sur la joue à la personne de ton choix… ou ailleurs", niveau: "x18" },
  { text: "Envoie un message coquin (ou très drôle) à la 3e personne de ta liste", niveau: "x18" },
  { text: "Mime ta position préférée, les autres devinent", niveau: "x18" },
  { text: "Échange un vêtement avec la personne en face", niveau: "x18" },
  { text: "Fais un lap dance de 10 secondes à la personne volontaire de ton choix", niveau: "x18" },
  { text: "Révèle un fantasme, sinon cul sec", niveau: "x18" },
  { text: "Body shot sur la personne volontaire de ton choix", niveau: "x18" },
  { text: "Retire un vêtement jusqu'à la fin de la manche", niveau: "x18" },
  { text: "Simule un orgasme crédible ; la table note sur 10", niveau: "x18" },
  { text: "Susurre à l'oreille de ton voisin ta pensée la plus inavouable", niveau: "x18" },
  { text: "Embrasse la personne volontaire de ton choix là où elle le décide", niveau: "x18" },
  { text: "Décris ton dernier rêve torride (ou improvises-en un)", niveau: "x18" },
  { text: "Dépose un baiser dans le cou d'un·e volontaire", niveau: "x18" },
  { text: "Fais glisser un glaçon le long de ton cou sans broncher", niveau: "x18" },
  { text: "Raconte ta pire panne ou ton pire fou rire au lit", niveau: "x18" },
  { text: "Assieds-toi à califourchon sur un·e volontaire pendant 30 secondes de conversation banale", niveau: "x18" },
  { text: "Fais ton bruit d'appréciation le plus indécent en buvant", niveau: "x18" },
  { text: "Mordille l'oreille d'un·e volontaire 5 secondes", niveau: "x18" },
  { text: "Strip-tease de 15 secondes : au moins un accessoire doit tomber", niveau: "x18" },
  { text: "Avoue le lieu le plus insolite où tu l'as fait, sinon deux culs secs", niveau: "x18" },
  { text: "Duel de compliments torrides avec un·e volontaire : le premier à court boit", niveau: "x18" },
  { text: "Lis à voix haute ton dernier sexto (ou bois 3 gorgées)", niveau: "x18" },
  { text: "Trace un mot du doigt dans le dos d'un·e volontaire, il doit deviner", niveau: "x18" },
  { text: "Ta voix la plus sensuelle pour commander le silence de la table", niveau: "x18" },
];

/** Pioche un texte de gage du niveau demandé ; repli soft si le niveau est vide. */
export function pickGage(level = "soft") {
  let pool = GAGES.filter((g) => g.niveau === level);
  if (!pool.length) pool = GAGES.filter((g) => g.niveau === "soft");
  return pick(pool).text;
}
