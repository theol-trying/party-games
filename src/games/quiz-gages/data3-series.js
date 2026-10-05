/* Quiz — SÉRIES, 2e vague. Format compact : [niveau, question, BONNE RÉPONSE, leurre ×3]
   (ordre des choix tiré au hasard à l'affichage).
   Niveau : 1 facile, 2 moyen, 3 expert. */
const Q = [
  [1, "Quelle série française de Netflix met en scène Omar Sy en gentleman cambrioleur ?", "Lupin", "Marseille", "Dix pour cent", "Plan cœur"],
  [1, "Quelle série retrace le règne d'Élisabeth II ?", "The Crown", "Downton Abbey", "Victoria", "The Tudors"],
  [2, "Quel acteur britannique incarne le docteur House ?", "Hugh Laurie", "Benedict Cumberbatch", "Hugh Grant", "Colin Firth"],
  [2, "Dans quelle ville se déroule « Grey's Anatomy » ?", "Seattle", "Chicago", "Boston", "San Francisco"],
  [1, "Quelle série suit Rick Grimes et des survivants face aux zombies ?", "The Walking Dead", "The Last of Us", "Z Nation", "Fear Street"],
  [1, "Quelle série britannique suit un extraterrestre qui voyage dans le temps dans une cabine de police bleue ?", "Doctor Who", "Sherlock", "Black Mirror", "Torchwood"],
  [2, "Comment s'appelle la cabine à voyager dans le temps de Doctor Who ?", "Le TARDIS", "Le DeLorean", "Le Stargate", "Le Chronoscaphe"],
  [2, "Quelle série de HBO suit la famille Roy et son empire médiatique ?", "Succession", "Billions", "Mad Men", "House of Cards"],
  [2, "Quelle série de Canal+ suit des agents secrets de la DGSE ?", "Le Bureau des légendes", "Engrenages", "Braquo", "Baron noir"],
  [1, "Sur quelle chaîne la série « Kaamelott » a-t-elle été diffusée ?", "M6", "TF1", "Canal+", "France 2"],
  [3, "Quelle série a battu en 2024 le record d'Emmy Awards pour une seule saison ?", "Shōgun", "The Bear", "Succession", "Game of Thrones"],
  [2, "Quelle série suit des publicitaires new-yorkais des années 1960, autour de Don Draper ?", "Mad Men", "Suits", "The Newsroom", "Boardwalk Empire"],
  [3, "Dans « Suits », quel faux avocat est embauché sans diplôme ?", "Mike Ross", "Harvey Specter", "Louis Litt", "Jessica Pearson"],
  [2, "Quelle série d'Apple TV+ met en scène des employés dont la mémoire est coupée en deux ?", "Severance", "Ted Lasso", "Silo", "For All Mankind"],
  [2, "Quelle série suit un entraîneur de football américain parti diriger un club anglais ?", "Ted Lasso", "Friday Night Lights", "The Bear", "Coach"],
  [2, "Quelle série suit un jeune chef qui reprend la sandwicherie familiale à Chicago ?", "The Bear", "Chef's Table", "Top Chef", "Boiling Point"],
  [1, "Quelle série adapte un jeu vidéo post-apocalyptique avec Pedro Pascal et Bella Ramsey ?", "The Last of Us", "Fallout", "Arcane", "The Witcher"],
  [1, "Quelle série animée de Netflix adapte l'univers du jeu « League of Legends » ?", "Arcane", "Castlevania", "Cyberpunk : Edgerunners", "Invincible"],
  [1, "Quelle série suit la Mafia du New Jersey avec Tony et sa psy ?", "Les Soprano", "Gomorra", "Boardwalk Empire", "Narcos"],
  [1, "Quelle série coréenne met en scène des jeux d'enfants mortels ?", "Squid Game", "Alice in Borderland", "Kingdom", "Sweet Home"],
  [1, "Quelle série raconte l'histoire de la famille Targaryen, deux siècles avant « Game of Thrones » ?", "House of the Dragon", "The Rings of Power", "The Witcher", "Vikings"],
  [1, "Quelle série française suit une agence d'agents de stars ?", "Dix pour cent", "Lupin", "Fiertés", "Baron noir"],
  // — Expert, 3e vague (2026-10) —
  [3, "Quelle série de David Lynch pose la question « Qui a tué Laura Palmer ? » ?", "Twin Peaks", "X-Files", "Fargo", "True Detective"],
  [3, "Quelle série britannique de 1967 suit « le Numéro 6 », retenu dans un étrange village ?", "Le Prisonnier", "Chapeau melon et bottes de cuir", "Le Saint", "Amicalement vôtre"],
  [3, "Dans quelle ville se déroule la série « The Wire » ?", "Baltimore", "Philadelphie", "Detroit", "Chicago"],
  [3, "Qui a créé la série « Buffy contre les vampires » ?", "Joss Whedon", "J. J. Abrams", "Chris Carter", "Shonda Rhimes"],
  [3, "Quelle série d'Aaron Sorkin suit le quotidien du président et de son équipe à la Maison-Blanche ?", "À la Maison-Blanche", "House of Cards", "Veep", "Scandal"],
  [3, "Quelle famille tient une entreprise de pompes funèbres dans « Six Feet Under » ?", "Les Fisher", "Les Bluth", "Les Gallagher", "Les Crawley"],
];
export const Q3_SERIES = Q.map(([d, q, ...choices]) => ({ d, q, choices, correct: 0 }));
