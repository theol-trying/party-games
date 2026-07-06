/* Données « Action ou Vérité ».
   Trois niveaux EXCLUSIFS (voir src/levels.js) : soft · soiree · x18.
   Le contenu ci-dessous sera remplacé par ton fichier dédié ; le niveau x18
   est volontairement vide pour l'instant (il s'affichera « à compléter »). */

export const VERITES = {
  soft: [
    "Quel est ton pire souvenir de soirée ?",
    "Quel surnom détestes-tu qu'on te donne ?",
    "Quelle est la dernière chose que tu as cherchée sur ton téléphone ?",
    "Quel talent caché as-tu ?",
    "Quelle est la plus grosse bêtise que tu aies faite enfant ?",
    "Qui, dans la pièce, connais-tu depuis le plus longtemps ?",
    "Quelle chanson honteuse écoutes-tu en boucle ?",
    "Quel est ton plus gros mensonge à tes parents ?",
  ],
  soiree: [
    "Quel est ton plus grand fantasme ?",
    "Qui, dans la pièce, embrasserais-tu si tu devais choisir ?",
    "Quel est l'endroit le plus insolite où tu as fait des choses ?",
    "Quelle est la dernière personne qui t'a fait craquer ?",
    "As-tu déjà menti pour éviter un date ? Raconte.",
    "Quel est ton red flag assumé en couple ?",
  ],
  x18: [],
};

export const ACTIONS = {
  soft: [
    "Imite quelqu'un dans la pièce, les autres devinent qui.",
    "Envoie un message random à la 5e personne de ta liste de contacts.",
    "Parle avec l'accent de ton choix jusqu'à ton prochain tour.",
    "Fais 10 pompes ou finis ton verre.",
    "Laisse ton voisin de droite écrire un statut sur tes réseaux.",
    "Danse 20 secondes sans musique.",
    "Montre la dernière photo de ta galerie.",
  ],
  soiree: [
    "Fais un lap dance de 15 secondes à la personne de ton choix.",
    "Laisse quelqu'un lire ton dernier échange de messages privés.",
    "Fais un bisou sur la joue à la personne à ta gauche… ou ailleurs.",
    "Mime ta position préférée, les autres devinent.",
    "Échange un vêtement avec la personne en face.",
  ],
  x18: [],
};
