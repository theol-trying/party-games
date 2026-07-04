/* =========================================================================
   REGISTRE DES JEUX
   Source unique de vérité : ce que l'accueil affiche + comment charger un jeu.
   Pour ajouter un jeu : créer src/games/<id>/index.js (+ data.js + style.css)
   puis ajouter une entrée ici.
   Le module est chargé à la demande (import dynamique) pour rester léger.
   ========================================================================= */

export const CATEGORIES = [
  { id: "questions", label: "Questions / Prompts" },
  { id: "deduction", label: "Déduction sociale" },
  { id: "quiz", label: "Rapidité / Quiz" },
  { id: "creatif", label: "Créatif" },
];

export const GAMES = [
  {
    id: "action-verite",
    title: "Action ou Vérité",
    icon: "🎯",
    accent: "#ff4d6d",
    category: "questions",
    desc: "Questions et gages aléatoires, intensité réglable (soft → hot).",
    load: () => import("./games/action-verite/index.js"),
  },
  {
    id: "jamais-jamais",
    title: "Je n'ai jamais",
    icon: "🙅",
    accent: "#ffb84d",
    category: "questions",
    desc: "Une phrase s'affiche, bois si tu l'as déjà fait.",
    load: () => import("./games/jamais-jamais/index.js"),
  },
  {
    id: "plus-susceptible",
    title: "Qui est le plus susceptible de…",
    icon: "👉",
    accent: "#c77dff",
    category: "questions",
    desc: "Vote pour un joueur sur une affirmation. Le plus désigné boit.",
    load: () => import("./games/plus-susceptible/index.js"),
  },
  {
    id: "tu-preferes",
    title: "Tu préfères…",
    icon: "⚖️",
    accent: "#4dd0e1",
    category: "questions",
    desc: "Dilemmes qui lancent le débat. Le camp minoritaire boit.",
    load: () => import("./games/tu-preferes/index.js"),
  },
  {
    id: "undercover",
    title: "Undercover / Imposteur",
    icon: "🕵️",
    accent: "#5c7cfa",
    category: "deduction",
    desc: "Un mot différent pour l'imposteur. Distribution secrète sur ce téléphone.",
    load: () => import("./games/undercover/index.js"),
  },
  {
    id: "menteur",
    title: "Le Menteur",
    icon: "🤥",
    accent: "#69db7c",
    category: "deduction",
    desc: "Une mission secrète à glisser dans la conversation sans se faire griller.",
    load: () => import("./games/menteur/index.js"),
  },
  {
    id: "blind-test",
    title: "Blind Test",
    icon: "🎵",
    accent: "#f783ac",
    category: "quiz",
    desc: "Devine le titre. Buzzer intégré et scores en temps réel.",
    load: () => import("./games/blind-test/index.js"),
  },
  {
    id: "quiz-gages",
    title: "Quiz à gages",
    icon: "🧠",
    accent: "#ffd43b",
    category: "quiz",
    desc: "Culture générale. Mauvaise réponse = gorgée ou gage.",
    load: () => import("./games/quiz-gages/index.js"),
  },
  {
    id: "baccalaureat",
    title: "Baccalauréat",
    icon: "⏱️",
    accent: "#63e6be",
    category: "quiz",
    desc: "Une lettre, des catégories, le chrono tourne.",
    load: () => import("./games/baccalaureat/index.js"),
  },
  {
    id: "cadavre-exquis",
    title: "Cadavre exquis",
    icon: "✍️",
    accent: "#da77f2",
    category: "creatif",
    desc: "Chacun ajoute sans voir la suite. Lecture finale à voix haute.",
    load: () => import("./games/cadavre-exquis/index.js"),
  },
];

export function getGame(id) {
  return GAMES.find((g) => g.id === id) || null;
}

export function gamesByCategory(catId) {
  return GAMES.filter((g) => g.category === catId);
}
