import { CATEGORIES as CATS } from "./categories.js";
import { Q_GEO } from "./data2-geo.js";
import { Q_HISTOIRE } from "./data2-histoire.js";
import { Q_SCIENCES } from "./data2-sciences.js";
import { Q_CULTURE } from "./data2-culture.js";
import { Q_SPORT } from "./data2-sport.js";
import { Q_NATURE } from "./data2-nature.js";
import { Q_GASTRO } from "./data2-gastro.js";
import { Q_CINEMA } from "./data2-cinema.js";
import { Q_SERIES } from "./data2-series.js";
import { Q_MUSIQUE } from "./data2-musique.js";
import { Q_JEUXVIDEO } from "./data2-jeuxvideo.js";
import { Q_BDMANGA } from "./data2-bdmanga.js";
import { Q_TECHWEB } from "./data2-techweb.js";
import { Q_MARQUES } from "./data2-marques.js";
import { Q_FRANCE } from "./data2-france.js";
import { Q_INSTITUTIONS } from "./data2-institutions.js";
import { Q_ECONOMIE } from "./data2-economie.js";
import { Q_RELIGIONS } from "./data2-religions.js";
import { Q_SANTE } from "./data2-sante.js";
import { Q_RECORDS } from "./data2-records.js";
import { Q_INVENTIONS } from "./data2-inventions.js";
import { Q_LANGUE } from "./data2-langue.js";
import { Q_CITATIONS } from "./data2-citations.js";
import { Q_INSOLITE } from "./data2-insolite.js";
import { Q_ACTU } from "./data2-actu.js";
// 2e vague (2026-10) : nouveaux thèmes (data2-*) et compléments des thèmes existants
// (data3-*), au format compact [question, bonne réponse, leurres…] — voir chaque fichier.
import { Q_MYTHOLOGIE } from "./data2-mythologie.js";
import { Q_ESPACE } from "./data2-espace.js";
import { Q_TERRE } from "./data2-terre.js";
import { Q_MATHS } from "./data2-maths.js";
import { Q_LITTERATURE } from "./data2-litterature.js";
import { Q_PEINTURE } from "./data2-peinture.js";
import { Q_MONUMENTS } from "./data2-monuments.js";
import { Q_PHILO } from "./data2-philo.js";
import { Q_DRAPEAUX } from "./data2-drapeaux.js";
import { Q_MONDE } from "./data2-monde.js";
import { Q_ANIMATION } from "./data2-animation.js";
import { Q_TELE } from "./data2-tele.js";
import { Q_NOSTALGIE } from "./data2-nostalgie.js";
import { Q_MODE } from "./data2-mode.js";
import { Q_TRANSPORTS } from "./data2-transports.js";
import { Q3_GEO } from "./data3-geo.js";
import { Q3_HISTOIRE } from "./data3-histoire.js";
import { Q3_SCIENCES } from "./data3-sciences.js";
import { Q3_SPORT } from "./data3-sport.js";
import { Q3_NATURE } from "./data3-nature.js";
import { Q3_GASTRO } from "./data3-gastro.js";
import { Q3_CINEMA } from "./data3-cinema.js";
import { Q3_MUSIQUE } from "./data3-musique.js";
import { Q3_SERIES } from "./data3-series.js";
import { Q3_JEUXVIDEO } from "./data3-jeuxvideo.js";
import { Q3_FRANCE } from "./data3-france.js";
import { Q3_SANTE } from "./data3-sante.js";

/* Quiz culture générale. correct = index de la bonne réponse (0-based).
   Banque rédigée à la main (90). Les gages sont centralisés dans src/gages.js. */
const BASE = [
  { q: "Quelle est la capitale de l'Australie ?", choices: ["Sydney", "Canberra", "Melbourne", "Perth"], correct: 1 },
  { q: "Combien de côtés a un hexagone ?", choices: ["5", "6", "7", "8"], correct: 1 },
  { q: "Quel est l'élément chimique O ?", choices: ["Or", "Osmium", "Oxygène", "Oganesson"], correct: 2 },
  { q: "En quelle année a eu lieu la chute du mur de Berlin ?", choices: ["1987", "1989", "1991", "1993"], correct: 1 },
  { q: "Quelle planète est la plus proche du Soleil ?", choices: ["Vénus", "Mercure", "Mars", "Terre"], correct: 1 },
  { q: "Qui a écrit « Les Misérables » ?", choices: ["Zola", "Balzac", "Hugo", "Flaubert"], correct: 2 },
  { q: "Quel pays a gagné la Coupe du monde 2018 ?", choices: ["Croatie", "France", "Allemagne", "Brésil"], correct: 1 },
  { q: "Quelle est la capitale du Canada ?", choices: ["Toronto", "Vancouver", "Ottawa", "Montréal"], correct: 2 },
  { q: "Combien y a-t-il de continents ?", choices: ["5", "6", "7", "8"], correct: 2 },
  { q: "Quel fleuve traverse Paris ?", choices: ["La Loire", "Le Rhône", "La Seine", "La Garonne"], correct: 2 },
  { q: "Dans quel pays se trouve le Machu Picchu ?", choices: ["Mexique", "Bolivie", "Pérou", "Chili"], correct: 2 },
  { q: "Combien d'états composent les États-Unis ?", choices: ["48", "50", "52", "54"], correct: 1 },
  { q: "Quelle est la plus haute montagne du monde ?", choices: ["K2", "Mont Blanc", "Everest", "Kilimandjaro"], correct: 2 },
  { q: "En quelle année l'homme a-t-il marché sur la Lune pour la première fois ?", choices: ["1965", "1969", "1971", "1975"], correct: 1 },
  { q: "Qui était surnommé le Roi-Soleil ?", choices: ["Louis XIV", "Louis XVI", "Napoléon", "François Ier"], correct: 0 },
  { q: "En quelle année a commencé la Première Guerre mondiale ?", choices: ["1912", "1914", "1916", "1918"], correct: 1 },
  { q: "Qui a découvert l'Amérique en 1492 ?", choices: ["Magellan", "Vasco de Gama", "Christophe Colomb", "Marco Polo"], correct: 2 },
  { q: "Quelle civilisation a construit les pyramides de Gizeh ?", choices: ["Les Mayas", "Les Égyptiens", "Les Aztèques", "Les Grecs"], correct: 1 },
  { q: "En quelle année la Révolution française a-t-elle éclaté ?", choices: ["1789", "1792", "1799", "1804"], correct: 0 },
  { q: "Quel navire « insubmersible » a coulé en 1912 ?", choices: ["Le Lusitania", "Le Britannic", "Le Titanic", "Le Queen Mary"], correct: 2 },
  { q: "Combien d'os compte environ le corps humain adulte ?", choices: ["106", "206", "306", "406"], correct: 1 },
  { q: "Quel gaz les plantes absorbent-elles ?", choices: ["Oxygène", "Azote", "CO2", "Hydrogène"], correct: 2 },
  { q: "Combien de cœurs possède une pieuvre ?", choices: ["1", "2", "3", "4"], correct: 2 },
  { q: "À quelle température l'eau bout-elle au niveau de la mer ?", choices: ["90 °C", "95 °C", "100 °C", "110 °C"], correct: 2 },
  { q: "Quel est le plus grand mammifère du monde ?", choices: ["L'éléphant", "Le rorqual bleu", "L'orque", "La girafe"], correct: 1 },
  { q: "Les dauphins sont des… ?", choices: ["Poissons", "Mammifères", "Reptiles", "Amphibiens"], correct: 1 },
  { q: "Quelle est la formule chimique de l'eau ?", choices: ["CO2", "H2O", "O2", "NaCl"], correct: 1 },
  { q: "Quel sport pratique Teddy Riner ?", choices: ["La boxe", "Le judo", "La lutte", "Le karaté"], correct: 1 },
  { q: "Dans quel sport parle-t-on de « grand chelem » ?", choices: ["Le golf", "Le tennis", "L'escrime", "Le cyclisme"], correct: 1 },
  { q: "Combien d'anneaux sur le drapeau olympique ?", choices: ["4", "5", "6", "7"], correct: 1 },
  { q: "Quelle course cycliste se termine sur les Champs-Élysées ?", choices: ["Paris-Roubaix", "Le Giro", "Le Tour de France", "La Vuelta"], correct: 2 },
  { q: "Quel pays a inventé le judo ?", choices: ["Chine", "Corée", "Japon", "Thaïlande"], correct: 2 },
  { q: "Combien de joueurs dans une équipe de volley sur le terrain ?", choices: ["5", "6", "7", "8"], correct: 1 },
  { q: "Quelle nage est la plus lente en compétition ?", choices: ["Le crawl", "Le dos", "La brasse", "Le papillon"], correct: 2 },
  { q: "Où se déroule le tournoi de Roland-Garros ?", choices: ["Londres", "New York", "Paris", "Melbourne"], correct: 2 },
  { q: "Qui a chanté « Thriller » ?", choices: ["Prince", "Michael Jackson", "Stevie Wonder", "Lionel Richie"], correct: 1 },
  { q: "Dans « Harry Potter », quelle est la maison de Harry ?", choices: ["Serpentard", "Poufsouffle", "Gryffondor", "Serdaigle"], correct: 2 },
  { q: "Quel super-héros vient de la planète Krypton ?", choices: ["Batman", "Superman", "Thor", "Flash"], correct: 1 },
  { q: "Combien de saisons compte « Friends » ?", choices: ["8", "9", "10", "12"], correct: 2 },
  { q: "Quel personnage habite dans un ananas sous la mer ?", choices: ["Nemo", "Bob l'éponge", "Dory", "Patrick"], correct: 1 },
  { q: "Dans quel pays la raclette est-elle née ?", choices: ["La France", "La Suisse", "L'Italie", "L'Autriche"], correct: 1 },
  { q: "Quel moine bénédictin est traditionnellement associé à l'essor du champagne ?", choices: ["Dom Pérignon", "Saint Benoît", "Frère Tuck", "Dom Bosco"], correct: 0 },
  { q: "Qu'est-ce que le guacamole ?", choices: ["Une sauce tomate", "Une purée d'avocat", "Une crème de maïs", "Un fromage fondu"], correct: 1 },
  { q: "Quel est l'ingrédient principal du houmous ?", choices: ["Lentilles", "Pois chiches", "Haricots", "Fèves"], correct: 1 },
  { q: "La tarte Tatin est une tarte… ?", choices: ["Au citron", "Renversée aux pommes", "Au chocolat", "Aux noix"], correct: 1 },
  { q: "Quel réseau social a un fantôme pour logo ?", choices: ["TikTok", "Snapchat", "Twitch", "Discord"], correct: 1 },
  { q: "Combien font 7 × 8 ?", choices: ["54", "56", "58", "64"], correct: 1 },
  { q: "Quel est le chiffre romain pour 50 ?", choices: ["C", "D", "L", "M"], correct: 2 },
  { q: "Combien de minutes dans une journée ?", choices: ["1 240", "1 440", "1 640", "2 440"], correct: 1 },
  { q: "Quel animal figure sur le logo de Lacoste ?", choices: ["Un requin", "Un crocodile", "Un lézard", "Un serpent"], correct: 1 },
  { q: "Quel pays est célèbre pour ses champs de tulipes et ses moulins ?", choices: ["France", "Pays-Bas", "Belgique", "Danemark"], correct: 1 },
  { q: "Quelle est la devise de la France ?", choices: ["Unité, Progrès, Justice", "Liberté, Égalité, Fraternité", "Dieu et mon droit", "Paix et Travail"], correct: 1 },
  { q: "Le Colisée se trouve dans quelle ville ?", choices: ["Athènes", "Rome", "Naples", "Milan"], correct: 1 },

  // --- lot 2 : géographie ---
  { q: "Quelle est la capitale de l'Égypte ?", choices: ["Alexandrie", "Le Caire", "Gizeh", "Louxor"], correct: 1 },
  { q: "Quel pays a pour capitale Bangkok ?", choices: ["Vietnam", "Cambodge", "Thaïlande", "Laos"], correct: 2 },
  { q: "Quel continent abrite le désert du Sahara ?", choices: ["Asie", "Afrique", "Australie", "Amérique du Sud"], correct: 1 },
  { q: "Quel détroit sépare l'Espagne du Maroc ?", choices: ["Le Bosphore", "Gibraltar", "Malacca", "Ormuz"], correct: 1 },
  { q: "Quelle est la plus grande île du monde ?", choices: ["Madagascar", "Groenland", "Bornéo", "Nouvelle-Guinée"], correct: 1 },
  { q: "Dans quel pays se trouve la Grande Barrière de corail ?", choices: ["Indonésie", "Philippines", "Australie", "Thaïlande"], correct: 2 },
  { q: "Quelle chaîne de montagnes sépare traditionnellement l'Europe et l'Asie ?", choices: ["Les Alpes", "L'Oural", "Les Carpates", "Le Caucase"], correct: 1 },
  { q: "Quelle est la capitale de la Norvège ?", choices: ["Stockholm", "Oslo", "Helsinki", "Copenhague"], correct: 1 },
  { q: "Quel fleuve traverse Le Caire ?", choices: ["Le Tigre", "Le Nil", "L'Euphrate", "Le Jourdain"], correct: 1 },

  // --- lot 2 : histoire ---
  { q: "Qui a été le premier président de la République française ?", choices: ["Adolphe Thiers", "Louis-Napoléon Bonaparte", "Jules Grévy", "Sadi Carnot"], correct: 1 },
  { q: "En quelle année a eu lieu la révolution russe d'Octobre ?", choices: ["1905", "1917", "1921", "1930"], correct: 1 },
  { q: "Quel empereur romain a instauré la Tétrarchie, divisant l'Empire ?", choices: ["Auguste", "Dioclétien", "Constantin", "Néron"], correct: 1 },
  { q: "Quel roi de France a été guillotiné en 1793 ?", choices: ["Louis XIV", "Louis XV", "Louis XVI", "Napoléon"], correct: 2 },
  { q: "Quelle guerre a opposé le Nord et le Sud des États-Unis ?", choices: ["La guerre d'indépendance", "La guerre de Sécession", "La guerre du Vietnam", "La guerre hispano-américaine"], correct: 1 },
  { q: "En quelle année le mur de Berlin a-t-il été construit ?", choices: ["1945", "1961", "1975", "1989"], correct: 1 },
  { q: "Qui a été le premier homme envoyé dans l'espace ?", choices: ["Neil Armstrong", "Youri Gagarine", "Buzz Aldrin", "John Glenn"], correct: 1 },
  { q: "Quel traité a officiellement mis fin à la Première Guerre mondiale ?", choices: ["Le traité de Rome", "Le traité de Versailles", "Le traité de Vienne", "Le traité de Paris"], correct: 1 },
  { q: "Qui a peint le plafond de la chapelle Sixtine ?", choices: ["Léonard de Vinci", "Raphaël", "Michel-Ange", "Donatello"], correct: 2 },
  { q: "Quelle civilisation a inventé l'écriture cunéiforme ?", choices: ["Les Égyptiens", "Les Sumériens", "Les Phéniciens", "Les Perses"], correct: 1 },

  // --- lot 2 : sciences ---
  { q: "Combien de chromosomes possède un être humain ?", choices: ["44", "46", "48", "50"], correct: 1 },
  { q: "Quel est le symbole chimique du fer ?", choices: ["Fe", "Fr", "F", "Fn"], correct: 0 },
  { q: "Combien de temps met la lumière du Soleil pour atteindre la Terre ?", choices: ["8 secondes", "8 minutes", "8 heures", "8 jours"], correct: 1 },
  { q: "Quel est le plus petit os du corps humain ?", choices: ["Le fémur", "L'étrier (oreille)", "Le tibia", "La clavicule"], correct: 1 },
  { q: "Quelle est la vitesse du son dans l'air (environ) ?", choices: ["34 m/s", "340 m/s", "3 400 m/s", "34 000 m/s"], correct: 1 },
  { q: "Combien de dents de lait un enfant possède-t-il en général ?", choices: ["16", "20", "24", "32"], correct: 1 },

  // --- lot 2 : sport ---
  { q: "Combien de jeux faut-il gagner pour remporter un set au tennis (en général) ?", choices: ["4", "6", "8", "10"], correct: 1 },
  { q: "Dans quel pays sont nés les Jeux olympiques modernes, en 1896 ?", choices: ["La France", "La Grèce", "L'Italie", "Le Royaume-Uni"], correct: 1 },
  { q: "Quel sport se joue avec un « volant » ?", choices: ["Le tennis", "Le squash", "Le badminton", "Le tennis de table"], correct: 2 },
  { q: "Combien de médailles d'or olympiques Usain Bolt a-t-il remportées en carrière ?", choices: ["6", "8", "10", "12"], correct: 1 },
  { q: "Quel est le stade de Manchester United ?", choices: ["Anfield", "Old Trafford", "Stamford Bridge", "Emirates"], correct: 1 },
  { q: "Dans quel sport utilise-t-on le terme « ippon » ?", choices: ["Le karaté", "Le judo", "L'aïkido", "Le taekwondo"], correct: 1 },
  { q: "Quelle est la distance officielle d'un marathon ?", choices: ["21 km", "42,195 km", "50 km", "100 km"], correct: 1 },
  { q: "Dans quel pays se déroule le tournoi de Wimbledon ?", choices: ["La France", "Les États-Unis", "Le Royaume-Uni", "L'Australie"], correct: 2 },
  { q: "Combien de trous compte un parcours de golf standard ?", choices: ["9", "18", "24", "36"], correct: 1 },

  // --- lot 2 : cinéma / musique ---
  { q: "Qui a réalisé la trilogie « Le Seigneur des Anneaux » ?", choices: ["James Cameron", "Peter Jackson", "Ridley Scott", "Steven Spielberg"], correct: 1 },
  { q: "Quel groupe britannique a chanté « Hey Jude » ?", choices: ["The Rolling Stones", "The Beatles", "Queen", "Pink Floyd"], correct: 1 },
  { q: "Qui incarne Iron Man dans les films Marvel ?", choices: ["Chris Evans", "Chris Hemsworth", "Robert Downey Jr.", "Mark Ruffalo"], correct: 2 },
  { q: "Quel est le premier long-métrage d'animation des studios Disney ?", choices: ["Pinocchio", "Blanche-Neige et les Sept Nains", "Fantasia", "Bambi"], correct: 1 },
  { q: "Quel opéra de Mozart met en scène le mythe de Don Juan ?", choices: ["La Flûte enchantée", "Don Giovanni", "Les Noces de Figaro", "Cosi fan tutte"], correct: 1 },
  { q: "Dans quelle ville fictive vivent Les Simpson ?", choices: ["Springfield", "Shelbyville", "Ogdenville", "Capital City"], correct: 0 },

  // --- lot 2 : gastronomie ---
  { q: "Le croissant est traditionnellement originaire de quel pays ?", choices: ["France", "Autriche", "Italie", "Belgique"], correct: 1 },
  { q: "Quel fromage porte le nom d'une ville normande ?", choices: ["Le Brie", "Le Camembert", "Le Roquefort", "Le Cantal"], correct: 1 },
  { q: "Quel plat est composé de viande crue hachée et assaisonnée ?", choices: ["Le carpaccio", "Le tartare", "Le ceviche", "Le steak"], correct: 1 },
  { q: "Quel fruit est utilisé pour produire le vin ?", choices: ["La pomme", "Le raisin", "La poire", "La prune"], correct: 1 },
  { q: "Quelle boisson est obtenue par fermentation du houblon et du malt ?", choices: ["Le cidre", "La bière", "L'hydromel", "Le saké"], correct: 1 },
  { q: "Quel est l'ingrédient principal du tofu ?", choices: ["Le riz", "Le soja", "Le blé", "Le maïs"], correct: 1 },
  { q: "Quelle sauce italienne se compose de basilic, pignons et parmesan ?", choices: ["La bolognaise", "Le pesto", "La carbonara", "L'arrabbiata"], correct: 1 },
  { q: "Quel pays est le plus grand producteur mondial de café ?", choices: ["La Colombie", "Le Brésil", "Le Vietnam", "L'Éthiopie"], correct: 1 },

  // --- lot 2 : technologie / internet ---
  { q: "Quelle entreprise a créé l'iPhone ?", choices: ["Samsung", "Apple", "Google", "Microsoft"], correct: 1 },
  { q: "Que signifie l'acronyme « GIF » ?", choices: ["General Image File", "Graphics Interchange Format", "Global Internet Format", "Graphic Info File"], correct: 1 },
  { q: "Quel réseau social a popularisé le format « tweet » ?", choices: ["Instagram", "X (ex-Twitter)", "TikTok", "LinkedIn"], correct: 1 },
  { q: "Qui a cofondé Facebook ?", choices: ["Bill Gates", "Mark Zuckerberg", "Elon Musk", "Steve Jobs"], correct: 1 },
  { q: "Quelle entreprise possède YouTube ?", choices: ["Meta", "Google", "Amazon", "Microsoft"], correct: 1 },
  { q: "Quelle entreprise a créé le système Android ?", choices: ["Apple", "Google", "Samsung", "Microsoft"], correct: 1 },
  { q: "Quel navigateur web est développé par Google ?", choices: ["Firefox", "Safari", "Chrome", "Edge"], correct: 2 },
  { q: "Quelle application est symbolisée par une icône d'appareil photo colorée ?", choices: ["Snapchat", "Instagram", "Pinterest", "TikTok"], correct: 1 },

  // --- lot 2 : littérature / art ---
  { q: "Qui a peint « La Nuit étoilée » ?", choices: ["Claude Monet", "Vincent Van Gogh", "Paul Cézanne", "Edgar Degas"], correct: 1 },
  { q: "Quel mouvement artistique est associé à Salvador Dalí ?", choices: ["Le cubisme", "Le surréalisme", "L'impressionnisme", "Le fauvisme"], correct: 1 },
  { q: "Quel roman de Victor Hugo se déroule pendant les émeutes de 1832 à Paris ?", choices: ["Notre-Dame de Paris", "Les Misérables", "Les Contemplations", "Quatrevingt-treize"], correct: 1 },
  { q: "Qui a sculpté « Le Penseur » ?", choices: ["Camille Claudel", "Auguste Rodin", "Antoine Bourdelle", "Aristide Maillol"], correct: 1 },
  { q: "Quel musée parisien abrite la Joconde ?", choices: ["Le musée d'Orsay", "Le Louvre", "Le Centre Pompidou", "Le Grand Palais"], correct: 1 },
  { q: "Quel écrivain britannique a créé le personnage de Sherlock Holmes ?", choices: ["Agatha Christie", "Arthur Conan Doyle", "Edgar Allan Poe", "Charles Dickens"], correct: 1 },

  // --- lot 2 : nature / animaux ---
  { q: "Quel est le plus grand félin du monde ?", choices: ["Le lion", "Le tigre", "Le jaguar", "Le léopard"], correct: 1 },
  { q: "Combien de pattes a un insecte ?", choices: ["4", "6", "8", "10"], correct: 1 },
  { q: "Quel animal change de couleur pour se camoufler ?", choices: ["Le lézard", "Le caméléon", "L'iguane", "Le gecko"], correct: 1 },
  { q: "Quelle est la durée de gestation d'un éléphant (environ) ?", choices: ["9 mois", "15 mois", "22 mois", "30 mois"], correct: 2 },
  { q: "Quel oiseau incapable de voler est un excellent nageur ?", choices: ["L'autruche", "Le manchot", "Le kiwi", "Le dindon"], correct: 1 },
  { q: "Combien de cœurs a, selon la culture populaire, un lombric (ver de terre) ?", choices: ["1", "5", "10", "20"], correct: 1 },
  { q: "Quel animal est le symbole de la sagesse dans de nombreuses cultures ?", choices: ["Le renard", "La chouette", "Le corbeau", "Le loup"], correct: 1 },
];

/* Banques par catégorie : chaque question est taguée avec sa catégorie (cat)
   pour permettre à l'hôte de filtrer les thèmes. BASE = mélange rédigé main. */
const LIBELLES = Object.fromEntries(CATS.map((c) => [c.id, c.label]));
const BANKS = [
  /* En tête de liste : la déduplication garde la 1re occurrence d'un énoncé,
     donc une question d'actu l'emporte sur son homologue périmée d'un autre
     thème (ex. le vainqueur de Roland-Garros). */
  { cat: "actu", q: Q_ACTU },
  { cat: "melange", q: BASE },
  { cat: "geo", q: Q_GEO },
  { cat: "histoire", q: Q_HISTOIRE },
  { cat: "sciences", q: Q_SCIENCES },
  { cat: "culture", q: Q_CULTURE },
  { cat: "sport", q: Q_SPORT },
  { cat: "nature", q: Q_NATURE },
  { cat: "gastro", q: Q_GASTRO },
  { cat: "cinema", q: Q_CINEMA },
  { cat: "series", q: Q_SERIES },
  { cat: "musique", q: Q_MUSIQUE },
  { cat: "jeuxvideo", q: Q_JEUXVIDEO },
  { cat: "bdmanga", q: Q_BDMANGA },
  { cat: "techweb", q: Q_TECHWEB },
  { cat: "marques", q: Q_MARQUES },
  { cat: "france", q: Q_FRANCE },
  { cat: "institutions", q: Q_INSTITUTIONS },
  { cat: "economie", q: Q_ECONOMIE },
  { cat: "religions", q: Q_RELIGIONS },
  { cat: "sante", q: Q_SANTE },
  { cat: "records", q: Q_RECORDS },
  { cat: "inventions", q: Q_INVENTIONS },
  { cat: "langue", q: Q_LANGUE },
  { cat: "citations", q: Q_CITATIONS },
  { cat: "insolite", q: Q_INSOLITE },
  { cat: "mythologie", q: Q_MYTHOLOGIE },
  { cat: "espace", q: Q_ESPACE },
  { cat: "terre", q: Q_TERRE },
  { cat: "maths", q: Q_MATHS },
  { cat: "litterature", q: Q_LITTERATURE },
  { cat: "peinture", q: Q_PEINTURE },
  { cat: "monuments", q: Q_MONUMENTS },
  { cat: "philo", q: Q_PHILO },
  { cat: "drapeaux", q: Q_DRAPEAUX },
  { cat: "monde", q: Q_MONDE },
  { cat: "animation", q: Q_ANIMATION },
  { cat: "tele", q: Q_TELE },
  { cat: "nostalgie", q: Q_NOSTALGIE },
  { cat: "mode", q: Q_MODE },
  { cat: "transports", q: Q_TRANSPORTS },
  { cat: "geo", q: Q3_GEO },
  { cat: "histoire", q: Q3_HISTOIRE },
  { cat: "sciences", q: Q3_SCIENCES },
  { cat: "sport", q: Q3_SPORT },
  { cat: "nature", q: Q3_NATURE },
  { cat: "gastro", q: Q3_GASTRO },
  { cat: "cinema", q: Q3_CINEMA },
  { cat: "musique", q: Q3_MUSIQUE },
  { cat: "series", q: Q3_SERIES },
  { cat: "jeuxvideo", q: Q3_JEUXVIDEO },
  { cat: "france", q: Q3_FRANCE },
  { cat: "sante", q: Q3_SANTE },
];

/* Agrégation + déduplication par énoncé (insensible casse/espaces) ; chaque
   question conserve sa catégorie (cat). La 1re occurrence gagne (garde sa cat). */
const _seen = new Set();
export const QUESTIONS = [];
const _catCount = {};
for (const b of BANKS) {
  for (const x of b.q || []) {
    const k = (x.q || "").trim().toLowerCase();
    if (!x.q || !Array.isArray(x.choices) || x.choices.length !== 4) continue;
    if (x.correct < 0 || x.correct > 3) continue;
    if (_seen.has(k)) continue;
    _seen.add(k);
    QUESTIONS.push({ q: x.q, choices: x.choices, correct: x.correct, cat: b.cat });
    _catCount[b.cat] = (_catCount[b.cat] || 0) + 1;
  }
}

/* Catégories réellement disponibles (au moins 1 question), pour le sélecteur hôte. */
export const CATEGORIES = CATS
  .filter((c) => _catCount[c.id] > 0)
  .map((c) => ({ id: c.id, label: LIBELLES[c.id], count: _catCount[c.id] }));
