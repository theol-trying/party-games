/* Quiz bank ACTU (2025-2026) - correct = 0-based index.

   Banque volontairement datée : on demande « qui a gagné en 2026 », jamais
   « qui est l'actuel Premier ministre ». Un fait daté reste vrai, une question
   au présent devient fausse toute seule au prochain remaniement.
   Faits vérifiés en septembre 2026 ; à relire avant chaque nouvelle saison. */
export const Q_ACTU = [
  /* --- Coupe du monde 2026 --- */
  { q: "Quel pays a remporté la Coupe du monde de football 2026 ?", choices: ["L'Argentine", "L'Espagne", "La France", "Le Brésil"], correct: 1 },
  { q: "Qui l'Espagne a-t-elle battu en finale du Mondial 2026 ?", choices: ["Le Brésil", "L'Angleterre", "L'Argentine", "La France"], correct: 2 },
  { q: "Dans quels pays s'est jouée la Coupe du monde 2026 ?", choices: ["États-Unis, Canada et Mexique", "Espagne, Portugal et Maroc", "Brésil et Argentine", "Allemagne et Pologne"], correct: 0 },
  { q: "Combien d'équipes participaient à la Coupe du monde 2026 ?", choices: ["24", "32", "40", "48"], correct: 3 },
  { q: "Dans quel stade s'est jouée la finale du Mondial 2026 ?", choices: ["Le MetLife Stadium", "L'Azteca", "Le Rose Bowl", "Le SoFi Stadium"], correct: 0 },
  { q: "Comment l'Espagne a-t-elle gagné la finale du Mondial 2026 ?", choices: ["1-0 après prolongation", "3-0 dans le temps réglementaire", "Aux tirs au but", "Sur un but contre son camp"], correct: 0 },

  /* --- JO d'hiver de Milan-Cortina 2026 --- */
  { q: "Quelle ville a accueilli les Jeux olympiques d'hiver 2026 ?", choices: ["Milan-Cortina", "Sapporo", "Salt Lake City", "Stockholm"], correct: 0 },
  { q: "Combien de médailles la France a-t-elle décrochées aux JO d'hiver 2026 ?", choices: ["9", "15", "23", "31"], correct: 2 },
  { q: "Combien de titres olympiques la France a-t-elle gagnés à Milan-Cortina ?", choices: ["3", "5", "8", "12"], correct: 2 },
  { q: "À quelle place la France a-t-elle fini au tableau des médailles en 2026 ?", choices: ["3e", "6e", "10e", "14e"], correct: 1 },
  { q: "Quel sport a rapporté le plus de médailles à la France en 2026 ?", choices: ["Le ski alpin", "Le biathlon", "Le patinage artistique", "Le snowboard"], correct: 1 },
  { q: "Qui est devenu en 2026 le Français le plus médaillé de l'histoire des JO ?", choices: ["Martin Fourcade", "Quentin Fillon Maillet", "Jean-Claude Killy", "Renaud Lavillenie"], correct: 1 },

  /* --- Football de clubs --- */
  { q: "Quel club a remporté la Ligue des champions 2026 ?", choices: ["Arsenal", "Le Real Madrid", "Le PSG", "Le Bayern Munich"], correct: 2 },
  { q: "Comment s'est décidée la finale de la Ligue des champions 2026 ?", choices: ["Aux tirs au but", "Sur un 5-0", "Sur un but en or", "Par forfait"], correct: 0 },
  { q: "Dans quel stade s'est jouée la finale de la Ligue des champions 2026 ?", choices: ["Wembley", "Le Puskás Aréna de Budapest", "Le Camp Nou", "San Siro"], correct: 1 },
  { q: "Quel club français a gagné sa première Ligue des champions en 2025 ?", choices: ["L'OM", "Le PSG", "Monaco", "Lyon"], correct: 1 },
  { q: "Quel score le PSG a-t-il infligé à l'Inter en finale de C1 en 2025 ?", choices: ["2-1", "3-0", "5-0", "4-2"], correct: 2 },
  { q: "Qui a remporté le Ballon d'Or 2025 ?", choices: ["Lamine Yamal", "Kylian Mbappé", "Ousmane Dembélé", "Vinícius Júnior"], correct: 2 },
  { q: "Dans quel club jouait Ousmane Dembélé lors de son Ballon d'Or ?", choices: ["Le FC Barcelone", "Le PSG", "Le Real Madrid", "Manchester City"], correct: 1 },

  /* --- Cyclisme et tennis --- */
  { q: "Qui a remporté le Tour de France 2026 ?", choices: ["Jonas Vingegaard", "Remco Evenepoel", "Tadej Pogačar", "Primož Roglič"], correct: 2 },
  { q: "Combien de Tours de France Pogačar avait-il gagnés fin 2026 ?", choices: ["3", "4", "5", "6"], correct: 2 },
  { q: "Quel Français de 19 ans a fini 4e du Tour de France 2026 ?", choices: ["Paul Seixas", "Kévin Vauquelin", "Romain Bardet", "David Gaudu"], correct: 0 },
  { q: "Qui a gagné Roland-Garros 2026 en simple messieurs ?", choices: ["Carlos Alcaraz", "Jannik Sinner", "Alexander Zverev", "Novak Djokovic"], correct: 2 },
  { q: "Pourquoi la victoire de Zverev à Roland-Garros 2026 est-elle historique ?", choices: ["1er Allemand sacré dans l'ère Open", "1er titre d'un gaucher", "Plus long match de l'histoire", "1er vainqueur issu des qualifications"], correct: 0 },
  { q: "Quel Italien Zverev a-t-il battu en finale de Roland-Garros 2026 ?", choices: ["Jannik Sinner", "Lorenzo Musetti", "Flavio Cobolli", "Matteo Berrettini"], correct: 2 },
  { q: "Qui avait gagné Roland-Garros 2025 en simple messieurs ?", choices: ["Jannik Sinner", "Carlos Alcaraz", "Alexander Zverev", "Novak Djokovic"], correct: 1 },

  /* --- Cinéma --- */
  { q: "Quel film a remporté l'Oscar du meilleur film en 2026 ?", choices: ["Une bataille après l'autre", "Anora", "Wicked", "Dune : partie 3"], correct: 0 },
  { q: "Qui a réalisé « Une bataille après l'autre » ?", choices: ["Christopher Nolan", "Paul Thomas Anderson", "Denis Villeneuve", "Quentin Tarantino"], correct: 1 },
  { q: "Quel film avait remporté l'Oscar du meilleur film en 2025 ?", choices: ["Anora", "Emilia Pérez", "The Brutalist", "Conclave"], correct: 0 },
  { q: "Qui a présenté les cérémonies des Oscars 2025 et 2026 ?", choices: ["Jimmy Kimmel", "Conan O'Brien", "Ricky Gervais", "Chris Rock"], correct: 1 },

  /* --- Eurovision --- */
  { q: "Quel pays a remporté l'Eurovision 2026 ?", choices: ["La Bulgarie", "Israël", "La Roumanie", "L'Autriche"], correct: 0 },
  { q: "Quelle chanson a gagné l'Eurovision 2026 ?", choices: ["Wasted Love", "Bangaranga", "Choke Me", "Michelle"], correct: 1 },
  { q: "Dans quelle ville s'est tenue l'Eurovision 2026 ?", choices: ["Bâle", "Vienne", "Malmö", "Liverpool"], correct: 1 },
  { q: "Qu'a eu d'historique le résultat de la Bulgarie à l'Eurovision 2026 ?", choices: ["Sa première participation", "Sa première victoire", "Sa première chanson en anglais", "Son premier dernier rang"], correct: 1 },
  { q: "Quel pays a fini 2e de l'Eurovision 2026 ?", choices: ["La Roumanie", "Israël", "La Belgique", "La France"], correct: 1 },

  /* --- Jeux vidéo --- */
  { q: "Quel jeu a été élu jeu de l'année aux Game Awards 2025 ?", choices: ["Clair Obscur: Expedition 33", "Hollow Knight: Silksong", "Death Stranding 2", "Elden Ring Nightreign"], correct: 0 },
  { q: "De quel pays vient le studio de « Clair Obscur: Expedition 33 » ?", choices: ["Le Japon", "La France", "La Suède", "Le Canada"], correct: 1 },
  { q: "Quelle console Nintendo est sortie en juin 2025 ?", choices: ["La Switch 2", "La Wii U", "La 3DS XL", "La Switch Lite"], correct: 0 },
  { q: "Quel épisode de Grand Theft Auto se fait attendre depuis 2025 ?", choices: ["GTA V", "GTA VI", "GTA Online 2", "GTA IV Remastered"], correct: 1 },

  /* --- Tech et IA --- */
  { q: "Comment s'appelle la famille de modèles d'IA d'Anthropic ?", choices: ["Claude", "Gemini", "Llama", "Mistral"], correct: 0 },
  { q: "Quelle start-up française d'IA s'est fait connaître par ses modèles ouverts ?", choices: ["Mistral AI", "DeepMind", "Stability", "Cohere"], correct: 0 },
  { q: "Quelle IA chinoise a secoué la tech début 2025 par son coût réduit ?", choices: ["DeepSeek", "Ernie", "Qwen", "Kimi"], correct: 0 },
  { q: "Comment s'appelle l'assistant d'intelligence artificielle de Google ?", choices: ["Gemini", "Siri", "Alexa", "Cortana"], correct: 0 },
  { q: "Quel réseau social a bien failli être interdit aux États-Unis en 2025 ?", choices: ["TikTok", "Snapchat", "Pinterest", "Reddit"], correct: 0 },
  { q: "Quel réseau Meta a lancé pour concurrencer Twitter ?", choices: ["Threads", "Bluesky", "Mastodon", "Truth Social"], correct: 0 },
  { q: "Par quelle lettre le réseau social Twitter a-t-il été rebaptisé ?", choices: ["X", "Z", "W", "O"], correct: 0 },
  { q: "Quelle entreprise d'Elon Musk fabrique des fusées réutilisables ?", choices: ["Blue Origin", "SpaceX", "Virgin Galactic", "Rocket Lab"], correct: 1 },
  { q: "Comment s'appelle la fusée géante testée par SpaceX ?", choices: ["Falcon 9", "Starship", "New Glenn", "Vulcan"], correct: 1 },
  { q: "Quel lanceur européen a fait son premier vol en juillet 2024 ?", choices: ["Ariane 5", "Ariane 6", "Vega", "Soyouz"], correct: 1 },

  /* --- France et monde --- */
  { q: "Qui a été élu pape en mai 2025 ?", choices: ["Léon XIV", "Benoît XVII", "Jean-Paul III", "Pie XIII"], correct: 0 },
  { q: "Quel pape est mort en avril 2025 ?", choices: ["Benoît XVI", "François", "Jean-Paul II", "Léon XIII"], correct: 1 },
  { q: "De quel pays est originaire le pape Léon XIV ?", choices: ["L'Italie", "Les États-Unis", "L'Argentine", "La Pologne"], correct: 1 },
  { q: "Qui a succédé à François Bayrou à Matignon en septembre 2025 ?", choices: ["Gabriel Attal", "Sébastien Lecornu", "Élisabeth Borne", "Michel Barnier"], correct: 1 },
  { q: "Quelles élections ont eu lieu en France en mars 2026 ?", choices: ["Les municipales", "Les législatives", "La présidentielle", "Les européennes"], correct: 0 },
  { q: "Qui a été investi président des États-Unis en janvier 2025 ?", choices: ["Joe Biden", "Kamala Harris", "Donald Trump", "Barack Obama"], correct: 2 },
  { q: "Quel monument parisien a rouvert fin 2024, cinq ans après son incendie ?", choices: ["La cathédrale Notre-Dame", "Le Grand Palais", "La Sainte-Chapelle", "Le Panthéon"], correct: 0 },
  { q: "Quelle ville accueillera les Jeux olympiques d'été 2028 ?", choices: ["Brisbane", "Los Angeles", "Paris", "Rome"], correct: 1 },
];
