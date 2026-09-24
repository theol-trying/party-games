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
];
