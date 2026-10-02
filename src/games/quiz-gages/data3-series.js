/* Quiz — SÉRIES, 2e vague. Format compact : [question, BONNE RÉPONSE, leurre ×3]
   (ordre des choix tiré au hasard à l'affichage). */
const Q = [
  ["Quelle série française de Netflix met en scène Omar Sy en gentleman cambrioleur ?", "Lupin", "Marseille", "Dix pour cent", "Plan cœur"],
  ["Quelle série retrace le règne d'Élisabeth II ?", "The Crown", "Downton Abbey", "Victoria", "The Tudors"],
  ["Quel acteur britannique incarne le docteur House ?", "Hugh Laurie", "Benedict Cumberbatch", "Hugh Grant", "Colin Firth"],
  ["Dans quelle ville se déroule « Grey's Anatomy » ?", "Seattle", "Chicago", "Boston", "San Francisco"],
  ["Quelle série suit Rick Grimes et des survivants face aux zombies ?", "The Walking Dead", "The Last of Us", "Z Nation", "Fear Street"],
  ["Quelle série britannique suit un extraterrestre qui voyage dans le temps dans une cabine de police bleue ?", "Doctor Who", "Sherlock", "Black Mirror", "Torchwood"],
  ["Comment s'appelle la cabine à voyager dans le temps de Doctor Who ?", "Le TARDIS", "Le DeLorean", "Le Stargate", "Le Chronoscaphe"],
  ["Quelle série de HBO suit la famille Roy et son empire médiatique ?", "Succession", "Billions", "Mad Men", "House of Cards"],
  ["Quelle série de Canal+ suit des agents secrets de la DGSE ?", "Le Bureau des légendes", "Engrenages", "Braquo", "Baron noir"],
  ["Sur quelle chaîne la série « Kaamelott » a-t-elle été diffusée ?", "M6", "TF1", "Canal+", "France 2"],
  ["Quelle série a battu en 2024 le record d'Emmy Awards pour une seule saison ?", "Shōgun", "The Bear", "Succession", "Game of Thrones"],
  ["Quelle série suit des publicitaires new-yorkais des années 1960, autour de Don Draper ?", "Mad Men", "Suits", "The Newsroom", "Boardwalk Empire"],
  ["Dans « Suits », quel faux avocat est embauché sans diplôme ?", "Mike Ross", "Harvey Specter", "Louis Litt", "Jessica Pearson"],
  ["Quelle série d'Apple TV+ met en scène des employés dont la mémoire est coupée en deux ?", "Severance", "Ted Lasso", "Silo", "For All Mankind"],
  ["Quelle série suit un entraîneur de football américain parti diriger un club anglais ?", "Ted Lasso", "Friday Night Lights", "The Bear", "Coach"],
  ["Quelle série suit un jeune chef qui reprend la sandwicherie familiale à Chicago ?", "The Bear", "Chef's Table", "Top Chef", "Boiling Point"],
  ["Quelle série adapte un jeu vidéo post-apocalyptique avec Pedro Pascal et Bella Ramsey ?", "The Last of Us", "Fallout", "Arcane", "The Witcher"],
  ["Quelle série animée de Netflix adapte l'univers du jeu « League of Legends » ?", "Arcane", "Castlevania", "Cyberpunk : Edgerunners", "Invincible"],
  ["Quelle série suit la Mafia du New Jersey avec Tony et sa psy ?", "Les Soprano", "Gomorra", "Boardwalk Empire", "Narcos"],
  ["Quelle série coréenne met en scène des jeux d'enfants mortels ?", "Squid Game", "Alice in Borderland", "Kingdom", "Sweet Home"],
  ["Quelle série raconte l'histoire de la famille Targaryen, deux siècles avant « Game of Thrones » ?", "House of the Dragon", "The Rings of Power", "The Witcher", "Vikings"],
  ["Quelle série française suit une agence d'agents de stars ?", "Dix pour cent", "Lupin", "Fiertés", "Baron noir"],
];
export const Q3_SERIES = Q.map(([q, ...choices]) => ({ q, choices, correct: 0 }));
