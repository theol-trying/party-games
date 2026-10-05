/* Thèmes du quiz, dans l'ordre d'affichage. Module à part, minuscule : le menu,
   les réglages et le salon s'affichent sans attendre les ~500 Ko de questions
   (data.js et ses fichiers de banques), chargés en arrière-plan. */
export const CATEGORIES = [
  { id: "actu", label: "🗞️ Actus 2025-2026" },
  { id: "melange", label: "🎲 Assorti" },
  { id: "geo", label: "🌍 Géographie" },
  { id: "drapeaux", label: "🚩 Drapeaux & symboles" },
  { id: "monde", label: "🌐 Cultures du monde" },
  { id: "histoire", label: "🏛️ Histoire" },
  { id: "mythologie", label: "🏺 Mythologies" },
  { id: "sciences", label: "🔬 Sciences" },
  { id: "espace", label: "🚀 Espace" },
  { id: "terre", label: "🌋 Planète Terre" },
  { id: "maths", label: "🧮 Maths & logique" },
  { id: "culture", label: "🎨 Arts & Culture" },
  { id: "litterature", label: "📚 Littérature" },
  { id: "peinture", label: "🖼️ Peinture & sculpture" },
  { id: "monuments", label: "🏰 Monuments" },
  { id: "philo", label: "🤔 Philosophie" },
  { id: "sport", label: "⚽ Sport" },
  { id: "nature", label: "🦁 Nature & Animaux" },
  { id: "gastro", label: "🍽️ Gastronomie" },
  { id: "cinema", label: "🎬 Cinéma" },
  { id: "series", label: "📺 Séries" },
  { id: "animation", label: "🧸 Dessins animés" },
  { id: "tele", label: "📡 Télé & médias" },
  { id: "musique", label: "🎵 Musique" },
  { id: "jeuxvideo", label: "🎮 Jeux vidéo" },
  { id: "nostalgie", label: "📼 Années 80-2000" },
  { id: "bdmanga", label: "💥 BD & Manga" },
  { id: "techweb", label: "💻 Tech & Web" },
  { id: "marques", label: "🏷️ Marques" },
  { id: "mode", label: "👗 Mode & luxe" },
  { id: "france", label: "🇫🇷 France" },
  { id: "institutions", label: "⚖️ Institutions" },
  { id: "economie", label: "💰 Économie" },
  { id: "religions", label: "☯️ Religions" },
  { id: "sante", label: "🩺 Santé" },
  { id: "records", label: "🏆 Records" },
  { id: "inventions", label: "💡 Inventions" },
  { id: "transports", label: "🚗 Transports" },
  { id: "langue", label: "🔤 Langue" },
  { id: "citations", label: "💬 Citations" },
  { id: "insolite", label: "🤯 Insolite" },
];

/* Difficulté des questions (champ « d » des banques, recopié en « niveau » par
   data.js). « Tous niveaux » mélange les trois. Rien à voir avec le niveau des
   gages (soft / soirée / 18+), réglé à part. */
export const DIFFICULTES = [
  { id: "tous", label: "🎲 Tous niveaux" },
  { id: "facile", n: 1, label: "🟢 Facile" },
  { id: "moyen", n: 2, label: "🟠 Moyen" },
  { id: "expert", n: 3, label: "🔴 Expert" },
];

/** Filtre d'une difficulté : les cartes perso (sans niveau) passent toujours. */
export function garderDifficulte(id) {
  const d = DIFFICULTES.find((x) => x.id === id);
  return d && d.n ? (q) => !q.niveau || q.niveau === d.n : () => true;
}

/** Libellé du niveau d'une question (« 🟠 Moyen »), ou "" pour une carte perso. */
export function libelleNiveau(niveau) {
  const d = DIFFICULTES.find((x) => x.n === niveau);
  return d ? d.label : "";
}
