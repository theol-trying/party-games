/* Questions d'estimation : { q, reponse, unite, info? }.
   - reponse : un nombre (les décimales passent par un point : 9.58).
   - unite   : affichée après les nombres (« m », « km », « » pour une année…).
   - info    : précision facultative montrée à la révélation (arrondi, date, source).

   Règle de rédaction : uniquement des valeurs stables et bien établies. Tout
   chiffre qui bouge est DATÉ dans l'énoncé (« en 2025 », « au 1er janvier 2025 »)
   et les ordres de grandeur sont annoncés comme tels (« environ »). Le jeu
   récompense le plus proche : une valeur arrondie suffit, une valeur fausse non. */
export const QUESTIONS = [
  /* --- Le monde et ses records --- */
  { q: "Quelle est la hauteur de la tour Eiffel, antennes comprises ?", reponse: 330, unite: "m", info: "Depuis l'ajout d'une antenne en 2022." },
  { q: "Quelle est l'altitude de l'Everest ?", reponse: 8849, unite: "m", info: "Mesure officielle de 2020." },
  { q: "Quelle est la hauteur du Burj Khalifa, à Dubaï ?", reponse: 828, unite: "m" },
  { q: "Quelle est la longueur de la Seine ?", reponse: 777, unite: "km" },
  { q: "Quelle distance sépare Paris de Marseille à vol d'oiseau ?", reponse: 660, unite: "km", info: "Environ." },
  { q: "Quelle est la longueur totale de la Grande Muraille de Chine, tous tronçons compris ?", reponse: 21196, unite: "km", info: "Relevé officiel chinois de 2012." },
  { q: "Combien de marches faut-il gravir pour atteindre le 2e étage de la tour Eiffel ?", reponse: 674, unite: "marches" },
  { q: "Combien de pays sont membres de l'ONU ?", reponse: 193, unite: "pays" },
  { q: "Combien de pays compte l'Afrique ?", reponse: 54, unite: "pays" },
  { q: "Combien de pays compte l'Union européenne ?", reponse: 27, unite: "pays" },
  { q: "Combien la France compte-t-elle de départements ?", reponse: 101, unite: "départements" },
  { q: "Combien la France compte-t-elle de régions, outre-mer compris ?", reponse: 18, unite: "régions" },
  { q: "Combien d'habitants comptait la France au 1er janvier 2025 ?", reponse: 68.6, unite: "millions", info: "Estimation de l'Insee." },
  { q: "Combien d'humains vivaient sur Terre en 2025 ?", reponse: 8.2, unite: "milliards", info: "Estimation de l'ONU." },
  { q: "Combien d'habitants compte Paris intra-muros ?", reponse: 2100, unite: "milliers", info: "Environ 2,1 millions." },

  /* --- Espace et sciences --- */
  { q: "Quelle distance sépare la Terre de la Lune ?", reponse: 384400, unite: "km", info: "Distance moyenne." },
  { q: "Quelle distance sépare la Terre du Soleil ?", reponse: 150, unite: "millions de km", info: "Environ (149,6 millions en moyenne)." },
  { q: "À quelle vitesse va la lumière ?", reponse: 299792, unite: "km/s" },
  { q: "Quel est l'âge de l'Univers ?", reponse: 13.8, unite: "milliards d'années" },
  { q: "Quelle est la température à la surface du Soleil ?", reponse: 5500, unite: "°C", info: "Environ." },
  { q: "Combien de pixels compte un écran Full HD ?", reponse: 2.07, unite: "millions", info: "1 920 × 1 080 = 2 073 600 pixels." },
  { q: "Combien de caractères pouvait contenir un tweet avant 2017 ?", reponse: 140, unite: "caractères" },

  /* --- Le corps humain et les animaux --- */
  { q: "Combien d'os compte le squelette d'un adulte ?", reponse: 206, unite: "os" },
  { q: "Combien de dents a un adulte, dents de sagesse comprises ?", reponse: 32, unite: "dents" },
  { q: "Combien de litres de sang circulent dans le corps d'un adulte ?", reponse: 5, unite: "litres", info: "Environ." },
  { q: "Combien pèse en moyenne le cerveau d'un adulte ?", reponse: 1350, unite: "g", info: "Environ." },
  { q: "À combien de battements par minute bat le cœur d'un adulte au repos ?", reponse: 70, unite: "battements", info: "En moyenne, environ (entre 60 et 100)." },
  { q: "À quelle vitesse maximale court un guépard ?", reponse: 110, unite: "km/h", info: "Environ." },
  { q: "Combien de mois dure la gestation d'un éléphant ?", reponse: 22, unite: "mois" },
  { q: "Combien de cœurs a une pieuvre ?", reponse: 3, unite: "cœurs" },

  /* --- Dates --- */
  { q: "En quelle année a eu lieu la prise de la Bastille ?", reponse: 1789, unite: "" },
  { q: "En quelle année l'homme a-t-il marché sur la Lune pour la première fois ?", reponse: 1969, unite: "" },
  { q: "En quelle année le mur de Berlin est-il tombé ?", reponse: 1989, unite: "" },
  { q: "En quelle année la tour Eiffel a-t-elle été inaugurée ?", reponse: 1889, unite: "" },
  { q: "En quelle année s'est jouée la toute première Coupe du monde de football ?", reponse: 1930, unite: "" },
  { q: "En quelle année le Titanic a-t-il coulé ?", reponse: 1912, unite: "" },
  { q: "En quelle année Charlemagne a-t-il été couronné empereur ?", reponse: 800, unite: "" },
  { q: "En quelle année a eu lieu la bataille de Marignan ?", reponse: 1515, unite: "" },
  { q: "Combien d'années a duré la guerre de Cent Ans ?", reponse: 116, unite: "ans", info: "De 1337 à 1453." },
  { q: "En quelle année la peine de mort a-t-elle été abolie en France ?", reponse: 1981, unite: "" },
  { q: "En quelle année est né Napoléon Bonaparte ?", reponse: 1769, unite: "" },
  { q: "En quelle année le premier iPhone est-il sorti ?", reponse: 2007, unite: "" },
  { q: "En quelle année Google a-t-il été fondé ?", reponse: 1998, unite: "" },
  { q: "En quelle année Facebook a-t-il été lancé ?", reponse: 2004, unite: "" },
  { q: "En quelle année est sorti le tout premier film Star Wars ?", reponse: 1977, unite: "" },

  /* --- Sport --- */
  { q: "Quelle est la longueur exacte d'un marathon ?", reponse: 42195, unite: "m" },
  { q: "Quel est le record du monde du 100 mètres, établi par Usain Bolt en 2009 ?", reponse: 9.58, unite: "secondes" },
  { q: "Combien de médailles la France a-t-elle remportées aux JO de Paris 2024 ?", reponse: 64, unite: "médailles" },
  { q: "Combien de médailles la France a-t-elle remportées aux JO d'hiver de 2026 ?", reponse: 23, unite: "médailles" },
  { q: "Combien d'équipes participaient à la Coupe du monde de football 2026 ?", reponse: 48, unite: "équipes" },
  { q: "Combien de joueurs sont sur le terrain pendant un match de rugby à XV (les deux équipes) ?", reponse: 30, unite: "joueurs" },
  { q: "Combien de Ballons d'Or Lionel Messi a-t-il remportés ?", reponse: 8, unite: "Ballons d'Or" },
  { q: "Combien de Tours de France Tadej Pogačar avait-il gagnés fin 2026 ?", reponse: 5, unite: "Tours" },
  { q: "Combien de Tours de France Bernard Hinault a-t-il gagnés ?", reponse: 5, unite: "Tours" },

  /* --- Culture et loisirs --- */
  { q: "Combien de touches compte un piano classique ?", reponse: 88, unite: "touches" },
  { q: "Combien de cartes compte un jeu de tarot ?", reponse: 78, unite: "cartes" },
  { q: "Combien d'épisodes compte la série Friends ?", reponse: 236, unite: "épisodes" },
  { q: "Combien de minutes dure le film Titanic de James Cameron ?", reponse: 194, unite: "minutes" },
  { q: "Combien de romans compte la saga Harry Potter ?", reponse: 7, unite: "romans" },

  /* --- Spécial soirée --- */
  { q: "Combien de verres de vin de 12,5 cl peut-on servir avec une bouteille de 75 cl ?", reponse: 6, unite: "verres" },
  { q: "Combien de bulles contient une flûte de champagne ?", reponse: 1000000, unite: "bulles", info: "Estimation d'un chercheur de l'université de Reims : environ un million." },
  { q: "Quel est le degré d'alcool d'un champagne classique ?", reponse: 12, unite: "%", info: "Environ." },
  { q: "Combien de litres contient une bouteille de champagne « Nabuchodonosor » ?", reponse: 15, unite: "litres", info: "L'équivalent de 20 bouteilles." },
  { q: "Combien de bouteilles de 75 cl contient un « Mathusalem » de champagne ?", reponse: 8, unite: "bouteilles", info: "6 litres." },

  /* ====================== Deuxième série (septembre 2026) ======================
     Même règle que ci-dessus. Aucune réponse négative : le clavier numérique de
     l'iPhone n'a pas de touche « − » (d'où « combien de mètres SOUS… »). */

  /* --- France --- */
  { q: "Quelle est l'altitude du mont Blanc ?", reponse: 4806, unite: "m", info: "Environ : elle varie de quelques mètres avec la neige (4 805,59 m mesurés en 2023)." },
  { q: "Quelle est la longueur de la Loire, plus long fleuve de France ?", reponse: 1006, unite: "km", info: "Environ 1 000 km (1 006 à 1 012 km selon les sources)." },
  { q: "Combien la France compte-t-elle de communes ?", reponse: 35000, unite: "communes", info: "Un peu moins de 35 000." },
  { q: "Quelle est la hauteur de la tour Montparnasse ?", reponse: 210, unite: "m" },
  { q: "Quelle est la hauteur de l'Arc de triomphe de l'Étoile ?", reponse: 50, unite: "m" },
  { q: "Quelle est la longueur de l'avenue des Champs-Élysées ?", reponse: 1910, unite: "m" },
  { q: "Quelle est la superficie de Paris, bois de Boulogne et de Vincennes compris ?", reponse: 105, unite: "km²" },
  { q: "Combien de ponts enjambent la Seine dans Paris ?", reponse: 37, unite: "ponts" },
  { q: "Quelle est l'altitude du puy de Dôme ?", reponse: 1465, unite: "m" },
  { q: "Quelle est la profondeur maximale du lac Léman ?", reponse: 310, unite: "m", info: "Environ (309,7 m)." },
  { q: "Quelle est la hauteur du plus haut pylône du viaduc de Millau ?", reponse: 343, unite: "m" },
  { q: "Avec combien de pays la France métropolitaine partage-t-elle une frontière terrestre ?", reponse: 8, unite: "pays", info: "Belgique, Luxembourg, Allemagne, Suisse, Italie, Monaco, Espagne, Andorre." },
  { q: "Combien de fuseaux horaires couvre la France, outre-mer compris ?", reponse: 12, unite: "fuseaux", info: "Un record mondial." },
  { q: "Quelle est la longueur du tunnel sous la Manche ?", reponse: 50, unite: "km" },

  /* --- Le monde --- */
  { q: "Quelle est la longueur du Nil ?", reponse: 6650, unite: "km", info: "Environ." },
  { q: "Quelle est la longueur de l'Amazone ?", reponse: 6400, unite: "km", info: "Environ (6 400 à 7 000 km selon la source retenue)." },
  { q: "Quelle est la superficie de la Russie, plus grand pays du monde ?", reponse: 17.1, unite: "millions de km²" },
  { q: "Combien d'habitants comptait l'Inde, pays le plus peuplé du monde, en 2024 ?", reponse: 1.45, unite: "milliard", info: "Environ (estimation de l'ONU)." },
  { q: "Quelle est la profondeur de la fosse des Mariannes, point le plus profond des océans ?", reponse: 11000, unite: "m", info: "Environ (10 900 à 11 000 m selon les mesures)." },
  { q: "Quelle est la hauteur du Salto Ángel, plus haute chute d'eau du monde ?", reponse: 979, unite: "m" },
  { q: "Quelle est l'altitude du Kilimandjaro ?", reponse: 5895, unite: "m" },
  { q: "Quelle est la superficie du Sahara ?", reponse: 9, unite: "millions de km²", info: "Environ." },
  { q: "À combien de mètres sous le niveau de la mer se trouvent les rives de la mer Morte ?", reponse: 430, unite: "m", info: "Plus de 430 m, et le niveau baisse encore d'environ un mètre par an." },
  { q: "Combien de pays compte l'Amérique du Sud ?", reponse: 12, unite: "pays" },
  { q: "Combien de pays le Danube traverse-t-il ?", reponse: 10, unite: "pays" },
  { q: "Combien de langues sont parlées dans le monde ?", reponse: 7000, unite: "langues", info: "Environ." },
  { q: "Quelle distance sépare Paris de New York à vol d'oiseau ?", reponse: 5840, unite: "km", info: "Environ." },
  { q: "Quelle est la hauteur de la statue de la Liberté, socle compris ?", reponse: 93, unite: "m" },
  { q: "Quelle est la hauteur de l'Empire State Building, jusqu'au toit ?", reponse: 381, unite: "m", info: "443 m avec l'antenne." },
  { q: "Quelle était la hauteur d'origine de la grande pyramide de Khéops ?", reponse: 146, unite: "m", info: "Environ ; elle ne mesure plus qu'environ 138 m." },
  { q: "Combien de blocs de pierre compte la grande pyramide de Khéops ?", reponse: 2.3, unite: "millions", info: "Environ." },
  { q: "Combien de pays utilisent l'euro au 1er janvier 2026 ?", reponse: 21, unite: "pays", info: "La Bulgarie est le 21e, depuis le 1er janvier 2026." },

  /* --- Espace --- */
  { q: "Combien de lunes tournent autour de Mars ?", reponse: 2, unite: "lunes", info: "Phobos et Déimos." },
  { q: "Combien de jours terrestres dure une année sur Mars ?", reponse: 687, unite: "jours" },
  { q: "Quelle est la température à la surface de Vénus ?", reponse: 465, unite: "°C", info: "Environ : c'est la planète la plus chaude." },
  { q: "Quel est le diamètre de la Terre ?", reponse: 12742, unite: "km", info: "Diamètre moyen." },
  { q: "Combien de minutes met la lumière du Soleil pour atteindre la Terre ?", reponse: 8.3, unite: "minutes", info: "Environ 8 minutes et 20 secondes." },
  { q: "Combien d'astronautes ont marché sur la Lune ?", reponse: 12, unite: "astronautes", info: "Entre 1969 et 1972." },
  { q: "À quelle distance minimale Mars s'approche-t-elle de la Terre ?", reponse: 55, unite: "millions de km", info: "Environ." },
  { q: "Combien de jours séparent deux pleines lunes ?", reponse: 29.5, unite: "jours", info: "Environ." },
  { q: "À quelle vitesse la Station spatiale internationale tourne-t-elle autour de la Terre ?", reponse: 28000, unite: "km/h", info: "Environ : un tour de la Terre en 1 h 30." },
  { q: "À quelle altitude vole la Station spatiale internationale ?", reponse: 400, unite: "km", info: "Environ." },
  { q: "À quelle vitesse la Terre tourne-t-elle autour du Soleil ?", reponse: 30, unite: "km/s", info: "Environ (29,8 km/s)." },
  { q: "À quelle vitesse la Terre tourne-t-elle sur elle-même, à l'équateur ?", reponse: 1670, unite: "km/h", info: "Environ." },

  /* --- Sciences --- */
  { q: "À quelle température l'eau bout-elle au sommet de l'Everest ?", reponse: 70, unite: "°C", info: "Environ : la pression de l'air y est bien plus faible." },
  { q: "À quelle vitesse le son se déplace-t-il dans l'air ?", reponse: 343, unite: "m/s", info: "À 20 °C." },
  { q: "Combien d'éléments chimiques compte le tableau périodique ?", reponse: 118, unite: "éléments" },
  { q: "Combien de degrés sous zéro vaut le zéro absolu, la température la plus basse possible ?", reponse: 273.15, unite: "°C" },
  { q: "À quelle température le fer fond-il ?", reponse: 1538, unite: "°C" },
  { q: "Combien de secondes compte une journée ?", reponse: 86400, unite: "secondes" },
  { q: "Combien d'heures compte une année non bissextile ?", reponse: 8760, unite: "heures" },
  { q: "Combien de zéros faut-il pour écrire un milliard ?", reponse: 9, unite: "zéros" },

  /* --- Le corps humain --- */
  { q: "Quelle est la surface de la peau d'un adulte ?", reponse: 1.8, unite: "m²", info: "Environ." },
  { q: "Quelle est la longueur de l'intestin grêle d'un adulte ?", reponse: 7, unite: "m", info: "Environ (6 à 7 m)." },
  { q: "Combien de cheveux compte une tête humaine ?", reponse: 100000, unite: "cheveux", info: "Environ." },
  { q: "Quelle part du corps d'un adulte est constituée d'eau ?", reponse: 60, unite: "%", info: "Environ." },
  { q: "Combien de fois cligne-t-on des yeux par minute ?", reponse: 15, unite: "fois", info: "Environ (15 à 20)." },
  { q: "Combien de vertèbres compte la colonne vertébrale ?", reponse: 33, unite: "vertèbres", info: "Dont 24 mobiles." },
  { q: "Combien de chromosomes contient une cellule humaine ?", reponse: 46, unite: "chromosomes" },
  { q: "Combien pèse le foie d'un adulte ?", reponse: 1.5, unite: "kg", info: "Environ." },

  /* --- Animaux et nature --- */
  { q: "À quelle vitesse le faucon pèlerin plonge-t-il en piqué ?", reponse: 390, unite: "km/h", info: "Environ : l'animal le plus rapide du monde." },
  { q: "Combien pèse un éléphant d'Afrique mâle adulte ?", reponse: 6, unite: "tonnes", info: "Environ." },
  { q: "Combien de jours vit une abeille ouvrière en été ?", reponse: 40, unite: "jours", info: "Environ." },
  { q: "Combien de dents compte la mâchoire d'un grand requin blanc ?", reponse: 300, unite: "dents", info: "Environ, sur plusieurs rangées." },
  { q: "Quelle taille peut atteindre une girafe mâle ?", reponse: 5.5, unite: "m", info: "Environ." },
  { q: "Quelle longueur peut atteindre une baleine bleue ?", reponse: 30, unite: "m", info: "Environ : le plus grand animal ayant jamais vécu." },
  { q: "Combien pèse le cœur d'une baleine bleue ?", reponse: 180, unite: "kg", info: "Environ." },
  { q: "Combien d'espèces d'oiseaux connaît-on dans le monde ?", reponse: 11000, unite: "espèces", info: "Environ." },
  { q: "Quelle est la hauteur du plus grand arbre du monde, un séquoia de Californie ?", reponse: 116, unite: "m", info: "Il s'appelle Hyperion." },
  { q: "Quel âge a le plus vieil arbre vivant connu, un pin de Californie ?", reponse: 4850, unite: "ans", info: "Environ." },
  { q: "Combien d'œufs pond une poule pondeuse en un an ?", reponse: 300, unite: "œufs", info: "Environ." },
  { q: "Vers quelle année est née Jonathan, la plus vieille tortue connue ?", reponse: 1832, unite: "", info: "Elle vit sur l'île de Sainte-Hélène." },
  { q: "Combien d'yeux ont la plupart des araignées ?", reponse: 8, unite: "yeux" },

  /* --- Histoire --- */
  { q: "En quelle année Christophe Colomb a-t-il atteint l'Amérique ?", reponse: 1492, unite: "" },
  { q: "En quelle année Napoléon s'est-il fait sacrer empereur ?", reponse: 1804, unite: "" },
  { q: "En quelle année a eu lieu la bataille de Waterloo ?", reponse: 1815, unite: "" },
  { q: "En quelle année a été signé l'armistice de la Première Guerre mondiale ?", reponse: 1918, unite: "" },
  { q: "Combien de jours a duré la Première Guerre mondiale ?", reponse: 1567, unite: "jours", info: "Du 28 juillet 1914 au 11 novembre 1918." },
  { q: "En quelle année a eu lieu le débarquement de Normandie ?", reponse: 1944, unite: "" },
  { q: "En quelle année les Françaises ont-elles obtenu le droit de vote ?", reponse: 1944, unite: "", info: "Ordonnance du 21 avril 1944 ; premier vote en 1945." },
  { q: "En quelle année les pièces et billets en euros sont-ils entrés en circulation ?", reponse: 2002, unite: "" },
  { q: "En quelle année Louis XIV est-il mort ?", reponse: 1715, unite: "" },
  { q: "Combien d'années a duré le règne de Louis XIV ?", reponse: 72, unite: "ans", info: "De 1643 à 1715 : le plus long de l'histoire de France." },
  { q: "En quelle année le canal de Suez a-t-il été inauguré ?", reponse: 1869, unite: "" },
  { q: "En quelle année Louis Blériot a-t-il traversé la Manche en avion ?", reponse: 1909, unite: "" },
  { q: "En quelle année l'Empire romain d'Occident est-il tombé ?", reponse: 476, unite: "" },
  { q: "En quelle année Jeanne d'Arc est-elle morte ?", reponse: 1431, unite: "" },
  { q: "En quelle année a eu lieu la révolution russe ?", reponse: 1917, unite: "" },
  { q: "En quelle année Notre-Dame de Paris a-t-elle brûlé ?", reponse: 2019, unite: "" },
  { q: "En quelle année le premier TGV a-t-il été mis en service ?", reponse: 1981, unite: "", info: "Entre Paris et Lyon." },
  { q: "Combien de présidents a eus la Ve République, de Charles de Gaulle à Emmanuel Macron ?", reponse: 8, unite: "présidents" },

  /* --- Technologie et jeux vidéo --- */
  { q: "En quelle année a été envoyé le tout premier SMS ?", reponse: 1992, unite: "" },
  { q: "En quelle année le Web a-t-il été ouvert au public ?", reponse: 1991, unite: "" },
  { q: "En quelle année YouTube a-t-il été lancé ?", reponse: 2005, unite: "" },
  { q: "En quelle année la première PlayStation est-elle sortie au Japon ?", reponse: 1994, unite: "" },
  { q: "En quelle année Pokémon Rouge et Vert sont-ils sortis au Japon ?", reponse: 1996, unite: "" },
  { q: "En quelle année la version complète de Minecraft est-elle sortie ?", reponse: 2011, unite: "" },
  { q: "Combien de joueurs s'affrontent dans une partie classique de Fortnite Battle Royale ?", reponse: 100, unite: "joueurs" },
  { q: "Combien de mégaoctets contenait une disquette 3,5 pouces classique ?", reponse: 1.44, unite: "Mo" },
  { q: "Combien de touches compte un clavier d'ordinateur français complet ?", reponse: 105, unite: "touches" },

  /* --- Sport --- */
  { q: "À quelle hauteur est fixé un panier de basket ?", reponse: 3.05, unite: "m" },
  { q: "Quelle est la longueur recommandée d'un terrain de football international ?", reponse: 105, unite: "m" },
  { q: "Combien pèse un ballon de football officiel ?", reponse: 430, unite: "g", info: "Entre 410 et 450 g." },
  { q: "Combien d'étapes compte un Tour de France ?", reponse: 21, unite: "étapes" },
  { q: "Combien de kilomètres parcourt-on sur un Tour de France ?", reponse: 3400, unite: "km", info: "Environ, selon les éditions." },
  { q: "Quel est le record du monde masculin du saut en hauteur ?", reponse: 2.45, unite: "m", info: "Javier Sotomayor, depuis 1993." },
  { q: "Combien de trous compte un parcours de golf classique ?", reponse: 18, unite: "trous" },
  { q: "Quelle est la hauteur d'un filet de tennis en son centre ?", reponse: 91.4, unite: "cm" },
  { q: "Combien de fois Rafael Nadal a-t-il gagné Roland-Garros ?", reponse: 14, unite: "fois" },
  { q: "Combien de Coupes du monde de football le Brésil a-t-il gagnées ?", reponse: 5, unite: "Coupes" },
  { q: "Quelle est la longueur d'une piscine olympique ?", reponse: 50, unite: "m" },
  { q: "Combien pèse une boule de pétanque ?", reponse: 700, unite: "g", info: "Entre 650 et 800 g." },
  { q: "Combien de médailles d'or olympiques Michael Phelps a-t-il remportées ?", reponse: 23, unite: "médailles" },
  { q: "Combien de minutes dure un match de rugby, hors arrêts de jeu ?", reponse: 80, unite: "minutes" },

  /* --- Cinéma, musique, livres, arts --- */
  { q: "Combien d'épisodes compte la série Game of Thrones ?", reponse: 73, unite: "épisodes" },
  { q: "Combien de minutes dure « Le Retour du roi », dernier volet du Seigneur des anneaux au cinéma ?", reponse: 201, unite: "minutes", info: "Version cinéma." },
  { q: "En quelle année est sorti le premier film Harry Potter ?", reponse: 2001, unite: "" },
  { q: "En quelle année est sorti le film Titanic de James Cameron ?", reponse: 1997, unite: "" },
  { q: "Combien d'Oscars le film Titanic a-t-il remportés ?", reponse: 11, unite: "Oscars" },
  { q: "Combien de films James Bond officiels sont sortis de 1962 à 2021 ?", reponse: 25, unite: "films" },
  { q: "Combien de symphonies Beethoven a-t-il composées ?", reponse: 9, unite: "symphonies" },
  { q: "Combien de cordes compte une harpe de concert ?", reponse: 47, unite: "cordes" },
  { q: "Combien de secondes dure la chanson « Bohemian Rhapsody » de Queen ?", reponse: 355, unite: "secondes", info: "5 minutes 55." },
  { q: "En quelle année « Le Petit Prince » a-t-il été publié ?", reponse: 1943, unite: "" },
  { q: "Combien d'albums de Tintin Hergé a-t-il achevés ?", reponse: 23, unite: "albums", info: "Un 24e, « Tintin et l'Alph-Art », est resté inachevé." },
  { q: "Combien d'albums d'Astérix étaient parus fin 2025 ?", reponse: 41, unite: "albums", info: "Le 41e, « Astérix en Lusitanie », est sorti en octobre 2025." },
  { q: "Quelle est la hauteur de « La Joconde » ?", reponse: 77, unite: "cm", info: "Pour 53 cm de large." },
  { q: "Combien de visiteurs le musée du Louvre a-t-il accueillis en 2024 ?", reponse: 8.7, unite: "millions", info: "Le musée le plus visité du monde." },

  /* --- Cuisine --- */
  { q: "Combien de couches compte une pâte feuilletée classique à six tours ?", reponse: 729, unite: "couches", info: "3 × 3 × 3 × 3 × 3 × 3." },
  { q: "Combien pèse une baguette de pain ?", reponse: 250, unite: "g", info: "Environ." },
  { q: "Combien de fromages bénéficient d'une AOP en France ?", reponse: 46, unite: "fromages", info: "Environ." },
  { q: "Combien de litres d'eau faut-il pour produire 1 kg de bœuf ?", reponse: 15000, unite: "litres", info: "Environ, pluie et irrigation comprises." },
  { q: "À quelle température le chocolat commence-t-il à fondre ?", reponse: 34, unite: "°C", info: "Environ : juste sous la température du corps." },
  { q: "Combien de litres contient une barrique bordelaise ?", reponse: 225, unite: "litres" },

  /* --- Jeux et objets du quotidien --- */
  { q: "Combien de lettres compte l'alphabet grec ?", reponse: 24, unite: "lettres" },
  { q: "Combien de lettres compte le mot « anticonstitutionnellement » ?", reponse: 25, unite: "lettres" },
  { q: "Combien de petits carrés colorés compte un Rubik's Cube classique ?", reponse: 54, unite: "carrés" },
  { q: "Combien de pièces compte un jeu d'échecs complet ?", reponse: 32, unite: "pièces" },
  { q: "Combien de cases compte le plateau du Monopoly ?", reponse: 40, unite: "cases" },
  { q: "Combien de dominos compte un jeu classique ?", reponse: 28, unite: "dominos" },
  { q: "Combien de jetons-lettres contient un Scrabble français ?", reponse: 102, unite: "jetons", info: "Dont 2 jokers." },
  { q: "Combien pèse une pièce de 1 euro ?", reponse: 7.5, unite: "g" },

  /* --- Spécial soirée --- */
  { q: "Combien de bouteilles de 75 cl contient un « Jéroboam » de champagne ?", reponse: 4, unite: "bouteilles", info: "3 litres." },
  { q: "Combien de verres de 12,5 cl peut-on servir avec un magnum ?", reponse: 12, unite: "verres", info: "1,5 litre." },
  { q: "Combien de centilitres contient une pinte britannique ?", reponse: 56.8, unite: "cl" },
  { q: "Quelle est la pression à l'intérieur d'une bouteille de champagne ?", reponse: 6, unite: "bars", info: "Environ : trois fois celle d'un pneu de voiture." },
  { q: "À quelle vitesse jaillit un bouchon de champagne ?", reponse: 40, unite: "km/h", info: "Environ." },
  { q: "À quelle température sert-on idéalement le champagne ?", reponse: 9, unite: "°C", info: "Entre 8 et 10 °C." },
];
