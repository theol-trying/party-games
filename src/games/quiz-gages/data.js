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

/* Quiz culture générale. correct = index de la bonne réponse (0-based).
   Banque rédigée à la main (90). Les gages sont centralisés dans src/gages.js. */
const BASE = [
  { q: "Quelle est la capitale de l'Australie ?", choices: ["Sydney", "Canberra", "Melbourne", "Perth"], correct: 1 },
  { q: "Combien de côtés a un hexagone ?", choices: ["5", "6", "7", "8"], correct: 1 },
  { q: "Qui a peint la Joconde ?", choices: ["Michel-Ange", "Raphaël", "Léonard de Vinci", "Botticelli"], correct: 2 },
  { q: "Quel est l'élément chimique O ?", choices: ["Or", "Osmium", "Oxygène", "Oganesson"], correct: 2 },
  { q: "En quelle année a eu lieu la chute du mur de Berlin ?", choices: ["1987", "1989", "1991", "1993"], correct: 1 },
  { q: "Quel océan est le plus grand ?", choices: ["Atlantique", "Indien", "Arctique", "Pacifique"], correct: 3 },
  { q: "Combien de joueurs dans une équipe de foot sur le terrain ?", choices: ["9", "10", "11", "12"], correct: 2 },
  { q: "Quelle planète est la plus proche du Soleil ?", choices: ["Vénus", "Mercure", "Mars", "Terre"], correct: 1 },
  { q: "Qui a écrit « Les Misérables » ?", choices: ["Zola", "Balzac", "Hugo", "Flaubert"], correct: 2 },
  { q: "Quel pays a gagné la Coupe du monde 2018 ?", choices: ["Croatie", "France", "Allemagne", "Brésil"], correct: 1 },
  { q: "Quelle est la capitale du Canada ?", choices: ["Toronto", "Vancouver", "Ottawa", "Montréal"], correct: 2 },
  { q: "Combien y a-t-il de continents ?", choices: ["5", "6", "7", "8"], correct: 2 },
  { q: "Quel fleuve traverse Paris ?", choices: ["La Loire", "Le Rhône", "La Seine", "La Garonne"], correct: 2 },
  { q: "Quel est le plus long fleuve du monde ?", choices: ["L'Amazone", "Le Nil", "Le Mississippi", "Le Yangzi"], correct: 1 },
  { q: "Dans quel pays se trouve le Machu Picchu ?", choices: ["Mexique", "Bolivie", "Pérou", "Chili"], correct: 2 },
  { q: "Quelle mer borde Marseille ?", choices: ["Mer du Nord", "Méditerranée", "Atlantique", "Mer Noire"], correct: 1 },
  { q: "Quel désert est le plus grand désert chaud du monde ?", choices: ["Gobi", "Kalahari", "Sahara", "Atacama"], correct: 2 },
  { q: "Combien d'états composent les États-Unis ?", choices: ["48", "50", "52", "54"], correct: 1 },
  { q: "Quelle est la monnaie du Japon ?", choices: ["Le won", "Le yuan", "Le yen", "Le baht"], correct: 2 },
  { q: "Quel pays a la forme d'une botte ?", choices: ["Espagne", "Grèce", "Italie", "Portugal"], correct: 2 },
  { q: "Quelle est la plus haute montagne du monde ?", choices: ["K2", "Mont Blanc", "Everest", "Kilimandjaro"], correct: 2 },
  { q: "En quelle année l'homme a-t-il marché sur la Lune pour la première fois ?", choices: ["1965", "1969", "1971", "1975"], correct: 1 },
  { q: "Qui était surnommé le Roi-Soleil ?", choices: ["Louis XIV", "Louis XVI", "Napoléon", "François Ier"], correct: 0 },
  { q: "En quelle année a commencé la Première Guerre mondiale ?", choices: ["1912", "1914", "1916", "1918"], correct: 1 },
  { q: "Qui a découvert l'Amérique en 1492 ?", choices: ["Magellan", "Vasco de Gama", "Christophe Colomb", "Marco Polo"], correct: 2 },
  { q: "Quelle reine d'Égypte a séduit César ?", choices: ["Néfertiti", "Cléopâtre", "Hatchepsout", "Isis"], correct: 1 },
  { q: "Quel monument parisien a été construit pour l'Exposition de 1889 ?", choices: ["L'Arc de Triomphe", "Le Louvre", "La tour Eiffel", "Le Panthéon"], correct: 2 },
  { q: "Quelle civilisation a construit les pyramides de Gizeh ?", choices: ["Les Mayas", "Les Égyptiens", "Les Aztèques", "Les Grecs"], correct: 1 },
  { q: "En quelle année la Révolution française a-t-elle éclaté ?", choices: ["1789", "1792", "1799", "1804"], correct: 0 },
  { q: "Quel navire « insubmersible » a coulé en 1912 ?", choices: ["Le Lusitania", "Le Britannic", "Le Titanic", "Le Queen Mary"], correct: 2 },
  { q: "Combien d'os compte environ le corps humain adulte ?", choices: ["106", "206", "306", "406"], correct: 1 },
  { q: "Quelle est la vitesse de la lumière (environ) ?", choices: ["300 km/s", "3 000 km/s", "300 000 km/s", "3 millions km/s"], correct: 2 },
  { q: "Quel gaz les plantes absorbent-elles ?", choices: ["Oxygène", "Azote", "CO2", "Hydrogène"], correct: 2 },
  { q: "Combien de cœurs possède une pieuvre ?", choices: ["1", "2", "3", "4"], correct: 2 },
  { q: "Quelle planète est surnommée la planète rouge ?", choices: ["Vénus", "Jupiter", "Mars", "Saturne"], correct: 2 },
  { q: "Quel est l'organe le plus lourd du corps humain ?", choices: ["Le cerveau", "Le foie", "La peau", "Les poumons"], correct: 2 },
  { q: "À quelle température l'eau bout-elle au niveau de la mer ?", choices: ["90 °C", "95 °C", "100 °C", "110 °C"], correct: 2 },
  { q: "Quel animal est le plus rapide au monde en course ?", choices: ["Le lion", "Le guépard", "L'antilope", "Le lévrier"], correct: 1 },
  { q: "Combien de pattes a une araignée ?", choices: ["6", "8", "10", "12"], correct: 1 },
  { q: "Quel est le plus grand mammifère du monde ?", choices: ["L'éléphant", "Le rorqual bleu", "L'orque", "La girafe"], correct: 1 },
  { q: "Les dauphins sont des… ?", choices: ["Poissons", "Mammifères", "Reptiles", "Amphibiens"], correct: 1 },
  { q: "Quel métal est liquide à température ambiante ?", choices: ["Le plomb", "Le mercure", "L'étain", "Le zinc"], correct: 1 },
  { q: "Combien de dents a un adulte (avec les dents de sagesse) ?", choices: ["28", "30", "32", "36"], correct: 2 },
  { q: "Quelle est la formule chimique de l'eau ?", choices: ["CO2", "H2O", "O2", "NaCl"], correct: 1 },
  { q: "Quel sport pratique Teddy Riner ?", choices: ["La boxe", "Le judo", "La lutte", "Le karaté"], correct: 1 },
  { q: "Combien de temps dure un match de foot (hors arrêts de jeu) ?", choices: ["80 min", "90 min", "100 min", "120 min"], correct: 1 },
  { q: "Dans quel sport parle-t-on de « grand chelem » ?", choices: ["Le golf", "Le tennis", "L'escrime", "Le cyclisme"], correct: 1 },
  { q: "Combien d'anneaux sur le drapeau olympique ?", choices: ["4", "5", "6", "7"], correct: 1 },
  { q: "Quelle course cycliste se termine sur les Champs-Élysées ?", choices: ["Paris-Roubaix", "Le Giro", "Le Tour de France", "La Vuelta"], correct: 2 },
  { q: "Au basket, combien de points vaut un panier derrière la ligne ?", choices: ["1", "2", "3", "4"], correct: 2 },
  { q: "Quel pays a inventé le judo ?", choices: ["Chine", "Corée", "Japon", "Thaïlande"], correct: 2 },
  { q: "Combien de joueurs dans une équipe de volley sur le terrain ?", choices: ["5", "6", "7", "8"], correct: 1 },
  { q: "Quelle nage est la plus lente en compétition ?", choices: ["Le crawl", "Le dos", "La brasse", "Le papillon"], correct: 2 },
  { q: "Où se déroule le tournoi de Roland-Garros ?", choices: ["Londres", "New York", "Paris", "Melbourne"], correct: 2 },
  { q: "Qui a chanté « Thriller » ?", choices: ["Prince", "Michael Jackson", "Stevie Wonder", "Lionel Richie"], correct: 1 },
  { q: "Quel groupe a composé « Bohemian Rhapsody » ?", choices: ["The Beatles", "Queen", "Pink Floyd", "The Rolling Stones"], correct: 1 },
  { q: "Quel instrument a 88 touches ?", choices: ["L'orgue", "Le piano", "L'accordéon", "Le clavecin"], correct: 1 },
  { q: "Qui interprète « Alors on danse » ?", choices: ["Maître Gims", "Stromae", "Soprano", "Black M"], correct: 1 },
  { q: "Combien de cordes a une guitare classique ?", choices: ["4", "5", "6", "7"], correct: 2 },
  { q: "Quel film détient le record du box-office mondial ?", choices: ["Titanic", "Avatar", "Avengers: Endgame", "Star Wars VII"], correct: 1 },
  { q: "Qui joue Jack dans « Titanic » ?", choices: ["Brad Pitt", "Johnny Depp", "Leonardo DiCaprio", "Matt Damon"], correct: 2 },
  { q: "Dans « Star Wars », qui est le père de Luke ?", choices: ["Obi-Wan", "Yoda", "Dark Vador", "Palpatine"], correct: 2 },
  { q: "Quel studio a créé « Toy Story » ?", choices: ["DreamWorks", "Pixar", "Ghibli", "Illumination"], correct: 1 },
  { q: "Dans « Harry Potter », quelle est la maison de Harry ?", choices: ["Serpentard", "Poufsouffle", "Gryffondor", "Serdaigle"], correct: 2 },
  { q: "Quel super-héros vient de la planète Krypton ?", choices: ["Batman", "Superman", "Thor", "Flash"], correct: 1 },
  { q: "Combien de saisons compte « Friends » ?", choices: ["8", "9", "10", "12"], correct: 2 },
  { q: "Quel personnage habite dans un ananas sous la mer ?", choices: ["Nemo", "Bob l'éponge", "Dory", "Patrick"], correct: 1 },
  { q: "De quel pays vient la paella ?", choices: ["Italie", "Portugal", "Espagne", "Mexique"], correct: 2 },
  { q: "Quel fromage est traditionnellement utilisé pour la raclette ?", choices: ["Comté", "Raclette", "Reblochon", "Emmental"], correct: 1 },
  { q: "Le sushi est originaire de quel pays ?", choices: ["Chine", "Japon", "Corée", "Vietnam"], correct: 1 },
  { q: "Quel alcool sert de base au mojito ?", choices: ["Vodka", "Rhum", "Gin", "Tequila"], correct: 1 },
  { q: "De quelle région vient le champagne ?", choices: ["Bourgogne", "Champagne", "Alsace", "Provence"], correct: 1 },
  { q: "Qu'est-ce que le guacamole ?", choices: ["Une sauce tomate", "Une purée d'avocat", "Une crème de maïs", "Un fromage fondu"], correct: 1 },
  { q: "Quel est l'ingrédient principal du houmous ?", choices: ["Lentilles", "Pois chiches", "Haricots", "Fèves"], correct: 1 },
  { q: "La tarte Tatin est une tarte… ?", choices: ["Au citron", "Renversée aux pommes", "Au chocolat", "Aux noix"], correct: 1 },
  { q: "Combien de lettres dans l'alphabet français ?", choices: ["24", "25", "26", "27"], correct: 2 },
  { q: "Quelle langue compte le plus de locuteurs natifs ?", choices: ["Anglais", "Espagnol", "Mandarin", "Hindi"], correct: 2 },
  { q: "Que signifie « www » ?", choices: ["World Wide Web", "World Web Wide", "Wide World Web", "Web World Wide"], correct: 0 },
  { q: "Quel réseau social a un fantôme pour logo ?", choices: ["TikTok", "Snapchat", "Twitch", "Discord"], correct: 1 },
  { q: "Qui a fondé Tesla et SpaceX ?", choices: ["Jeff Bezos", "Elon Musk", "Bill Gates", "Steve Jobs"], correct: 1 },
  { q: "Combien font 7 × 8 ?", choices: ["54", "56", "58", "64"], correct: 1 },
  { q: "Quel est le chiffre romain pour 50 ?", choices: ["C", "D", "L", "M"], correct: 2 },
  { q: "Combien de minutes dans une journée ?", choices: ["1 240", "1 440", "1 640", "2 440"], correct: 1 },
  { q: "Quel animal figure sur le logo de Lacoste ?", choices: ["Un requin", "Un crocodile", "Un lézard", "Un serpent"], correct: 1 },
  { q: "De quelle couleur est la boîte noire d'un avion ?", choices: ["Noire", "Orange", "Rouge", "Jaune"], correct: 1 },
  { q: "Quel pays est célèbre pour ses champs de tulipes et ses moulins ?", choices: ["France", "Pays-Bas", "Belgique", "Danemark"], correct: 1 },
  { q: "Combien de zéros dans un million ?", choices: ["5", "6", "7", "9"], correct: 1 },
  { q: "Quelle est la devise de la France ?", choices: ["Unité, Progrès, Justice", "Liberté, Égalité, Fraternité", "Dieu et mon droit", "Paix et Travail"], correct: 1 },
  { q: "Le Colisée se trouve dans quelle ville ?", choices: ["Athènes", "Rome", "Naples", "Milan"], correct: 1 },

  // --- lot 2 : géographie ---
  { q: "Quelle est la capitale de l'Égypte ?", choices: ["Alexandrie", "Le Caire", "Gizeh", "Louxor"], correct: 1 },
  { q: "Quel est le plus petit pays du monde ?", choices: ["Monaco", "Vatican", "Saint-Marin", "Liechtenstein"], correct: 1 },
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
  { q: "Quelle est la plus grande planète du système solaire ?", choices: ["Saturne", "Jupiter", "Neptune", "Uranus"], correct: 1 },
  { q: "Combien de chromosomes possède un être humain ?", choices: ["44", "46", "48", "50"], correct: 1 },
  { q: "Quel est le symbole chimique du fer ?", choices: ["Fe", "Fr", "F", "Fn"], correct: 0 },
  { q: "Quelle est l'unité de mesure de la puissance électrique ?", choices: ["Le volt", "L'ampère", "Le watt", "L'ohm"], correct: 2 },
  { q: "Qui a formulé la théorie de la relativité ?", choices: ["Isaac Newton", "Albert Einstein", "Niels Bohr", "Galilée"], correct: 1 },
  { q: "Combien de temps met la lumière du Soleil pour atteindre la Terre ?", choices: ["8 secondes", "8 minutes", "8 heures", "8 jours"], correct: 1 },
  { q: "Quel est le plus petit os du corps humain ?", choices: ["Le fémur", "L'étrier (oreille)", "Le tibia", "La clavicule"], correct: 1 },
  { q: "Quel gaz représente environ 78 % de l'atmosphère terrestre ?", choices: ["L'oxygène", "L'azote", "Le CO2", "L'hydrogène"], correct: 1 },
  { q: "Quelle est la vitesse du son dans l'air (environ) ?", choices: ["34 m/s", "340 m/s", "3 400 m/s", "34 000 m/s"], correct: 1 },
  { q: "Combien de dents de lait un enfant possède-t-il en général ?", choices: ["16", "20", "24", "32"], correct: 1 },

  // --- lot 2 : sport ---
  { q: "Combien de jeux faut-il gagner pour remporter un set au tennis (en général) ?", choices: ["4", "6", "8", "10"], correct: 1 },
  { q: "Dans quel pays sont nés les Jeux olympiques modernes, en 1896 ?", choices: ["La France", "La Grèce", "L'Italie", "Le Royaume-Uni"], correct: 1 },
  { q: "Quel pays a remporté le plus de Coupes du monde de football ?", choices: ["L'Allemagne", "L'Italie", "Le Brésil", "L'Argentine"], correct: 2 },
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
  { q: "Dans quelle saga entend-on « Que la Force soit avec toi » ?", choices: ["Star Trek", "Star Wars", "Dune", "Interstellar"], correct: 1 },
  { q: "Qui incarne Iron Man dans les films Marvel ?", choices: ["Chris Evans", "Chris Hemsworth", "Robert Downey Jr.", "Mark Ruffalo"], correct: 2 },
  { q: "Quel est le premier long-métrage d'animation des studios Disney ?", choices: ["Pinocchio", "Blanche-Neige et les Sept Nains", "Fantasia", "Bambi"], correct: 1 },
  { q: "Qui a chanté « Billie Jean » ?", choices: ["Prince", "Michael Jackson", "George Michael", "Lionel Richie"], correct: 1 },
  { q: "Quelle actrice joue dans « Pulp Fiction » et « Kill Bill » ?", choices: ["Uma Thurman", "Scarlett Johansson", "Cameron Diaz", "Angelina Jolie"], correct: 0 },
  { q: "Quel opéra de Mozart met en scène le mythe de Don Juan ?", choices: ["La Flûte enchantée", "Don Giovanni", "Les Noces de Figaro", "Cosi fan tutte"], correct: 1 },
  { q: "Quel film a remporté l'Oscar du meilleur film en 2020 ?", choices: ["1917", "Joker", "Parasite", "Once Upon a Time in Hollywood"], correct: 2 },
  { q: "Dans quelle ville fictive vivent Les Simpson ?", choices: ["Springfield", "Shelbyville", "Ogdenville", "Capital City"], correct: 0 },

  // --- lot 2 : gastronomie ---
  { q: "Le croissant est traditionnellement originaire de quel pays ?", choices: ["France", "Autriche", "Italie", "Belgique"], correct: 1 },
  { q: "Quel fromage porte le nom d'une ville normande ?", choices: ["Le Brie", "Le Camembert", "Le Roquefort", "Le Cantal"], correct: 1 },
  { q: "Quelle épice est extraite du pistil d'une fleur de crocus ?", choices: ["Le curcuma", "Le safran", "Le paprika", "Le cumin"], correct: 1 },
  { q: "Quel plat est composé de viande crue hachée et assaisonnée ?", choices: ["Le carpaccio", "Le tartare", "Le ceviche", "Le steak"], correct: 1 },
  { q: "De quel pays vient le kimchi ?", choices: ["La Chine", "La Corée", "Le Japon", "Le Vietnam"], correct: 1 },
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
  { q: "Que signifie « HTML » ?", choices: ["HyperText Markup Language", "High Tech Modern Language", "Home Tool Markup Language", "Hyperlink Text Model Language"], correct: 0 },
  { q: "Quelle entreprise possède YouTube ?", choices: ["Meta", "Google", "Amazon", "Microsoft"], correct: 1 },
  { q: "Quelle entreprise a créé le système Android ?", choices: ["Apple", "Google", "Samsung", "Microsoft"], correct: 1 },
  { q: "Combien de bits y a-t-il dans un octet ?", choices: ["4", "8", "16", "32"], correct: 1 },
  { q: "Quel navigateur web est développé par Google ?", choices: ["Firefox", "Safari", "Chrome", "Edge"], correct: 2 },
  { q: "Quelle application est symbolisée par une icône d'appareil photo colorée ?", choices: ["Snapchat", "Instagram", "Pinterest", "TikTok"], correct: 1 },

  // --- lot 2 : littérature / art ---
  { q: "Qui a écrit « Roméo et Juliette » ?", choices: ["Molière", "Shakespeare", "Victor Hugo", "Racine"], correct: 1 },
  { q: "Quel auteur français a écrit « Le Petit Prince » ?", choices: ["Albert Camus", "Antoine de Saint-Exupéry", "Jean-Paul Sartre", "Marcel Proust"], correct: 1 },
  { q: "Qui a peint « La Nuit étoilée » ?", choices: ["Claude Monet", "Vincent Van Gogh", "Paul Cézanne", "Edgar Degas"], correct: 1 },
  { q: "Quel mouvement artistique est associé à Salvador Dalí ?", choices: ["Le cubisme", "Le surréalisme", "L'impressionnisme", "Le fauvisme"], correct: 1 },
  { q: "Qui a écrit le roman « 1984 » ?", choices: ["Aldous Huxley", "George Orwell", "Ray Bradbury", "H.G. Wells"], correct: 1 },
  { q: "Quel poète français a écrit « Les Fleurs du mal » ?", choices: ["Arthur Rimbaud", "Charles Baudelaire", "Paul Verlaine", "Victor Hugo"], correct: 1 },
  { q: "Quel roman de Victor Hugo se déroule pendant les émeutes de 1832 à Paris ?", choices: ["Notre-Dame de Paris", "Les Misérables", "Les Contemplations", "Quatrevingt-treize"], correct: 1 },
  { q: "Qui a sculpté « Le Penseur » ?", choices: ["Camille Claudel", "Auguste Rodin", "Antoine Bourdelle", "Aristide Maillol"], correct: 1 },
  { q: "Quel musée parisien abrite la Joconde ?", choices: ["Le musée d'Orsay", "Le Louvre", "Le Centre Pompidou", "Le Grand Palais"], correct: 1 },
  { q: "Quel écrivain britannique a créé le personnage de Sherlock Holmes ?", choices: ["Agatha Christie", "Arthur Conan Doyle", "Edgar Allan Poe", "Charles Dickens"], correct: 1 },

  // --- lot 2 : nature / animaux ---
  { q: "Quel est le plus grand félin du monde ?", choices: ["Le lion", "Le tigre", "Le jaguar", "Le léopard"], correct: 1 },
  { q: "Combien de pattes a un insecte ?", choices: ["4", "6", "8", "10"], correct: 1 },
  { q: "Quel animal change de couleur pour se camoufler ?", choices: ["Le lézard", "Le caméléon", "L'iguane", "Le gecko"], correct: 1 },
  { q: "Quel est le seul mammifère capable de voler activement ?", choices: ["L'écureuil volant", "La chauve-souris", "La roussette", "Le vampire"], correct: 1 },
  { q: "Quelle est la durée de gestation d'un éléphant (environ) ?", choices: ["9 mois", "15 mois", "22 mois", "30 mois"], correct: 2 },
  { q: "Quel oiseau incapable de voler est un excellent nageur ?", choices: ["L'autruche", "Le manchot", "Le kiwi", "Le dindon"], correct: 1 },
  { q: "Quelle plante carnivore referme ses feuilles sur ses proies ?", choices: ["Le nénuphar", "La dionée (attrape-mouche)", "Le cactus", "L'orchidée"], correct: 1 },
  { q: "Quel est le plus grand animal terrestre ?", choices: ["Le rhinocéros", "L'éléphant d'Afrique", "La girafe", "L'hippopotame"], correct: 1 },
  { q: "Combien de cœurs a, selon la culture populaire, un lombric (ver de terre) ?", choices: ["1", "5", "10", "20"], correct: 1 },
  { q: "Quel animal est le symbole de la sagesse dans de nombreuses cultures ?", choices: ["Le renard", "La chouette", "Le corbeau", "Le loup"], correct: 1 },
];

/* Agregation de toutes les banques + deduplication par enonce (insensible casse/espaces). */
const ALL_QUIZ = [].concat(BASE, Q_GEO, Q_HISTOIRE, Q_SCIENCES, Q_CULTURE, Q_SPORT, Q_NATURE, Q_GASTRO, Q_CINEMA, Q_SERIES, Q_MUSIQUE, Q_JEUXVIDEO, Q_BDMANGA, Q_TECHWEB, Q_MARQUES, Q_FRANCE, Q_INSTITUTIONS, Q_ECONOMIE, Q_RELIGIONS, Q_SANTE, Q_RECORDS, Q_INVENTIONS, Q_LANGUE, Q_CITATIONS, Q_INSOLITE);
const _seen = new Set();
export const QUESTIONS = ALL_QUIZ.filter((x) => {
  const k = (x.q || "").trim().toLowerCase();
  if (!x.q || !Array.isArray(x.choices) || x.choices.length !== 4) return false;
  if (x.correct < 0 || x.correct > 3) return false;
  if (_seen.has(k)) return false;
  _seen.add(k);
  return true;
});
