/* Liste de secours du blind test — titres très connus, SANS extrait audio.
   Elle sert au mode « je lance la musique moi-même » : l'écran annonce le tour,
   l'hôte joue le morceau depuis son appli, les joueurs buzzent.

   Pour jouer avec de vrais extraits de 30 s, utilise plutôt la recherche
   intégrée (Apple Music / Deezer) : elle remplit la playlist en un tap.

   audioUrl : laisse vide pour le mode manuel, ou mets un lien direct .mp3
   (ou un chemin local type "assets/audio/xxx.mp3") pour une lecture auto. */
export const TRACKS = [
  // — Incontournables internationaux —
  { title: "Bohemian Rhapsody", artist: "Queen", audioUrl: "" },
  { title: "Billie Jean", artist: "Michael Jackson", audioUrl: "" },
  { title: "Sweet Child o' Mine", artist: "Guns N' Roses", audioUrl: "" },
  { title: "Smells Like Teen Spirit", artist: "Nirvana", audioUrl: "" },
  { title: "Wonderwall", artist: "Oasis", audioUrl: "" },
  { title: "Like a Prayer", artist: "Madonna", audioUrl: "" },
  { title: "I Will Survive", artist: "Gloria Gaynor", audioUrl: "" },
  { title: "Y.M.C.A.", artist: "Village People", audioUrl: "" },
  { title: "Dancing Queen", artist: "ABBA", audioUrl: "" },
  { title: "Don't Stop Me Now", artist: "Queen", audioUrl: "" },

  // — Années 2000-2010 —
  { title: "Get Lucky", artist: "Daft Punk", audioUrl: "" },
  { title: "Hey Ya!", artist: "OutKast", audioUrl: "" },
  { title: "Seven Nation Army", artist: "The White Stripes", audioUrl: "" },
  { title: "Mr. Brightside", artist: "The Killers", audioUrl: "" },
  { title: "Rolling in the Deep", artist: "Adele", audioUrl: "" },
  { title: "Levels", artist: "Avicii", audioUrl: "" },
  { title: "Wake Me Up", artist: "Avicii", audioUrl: "" },
  { title: "Uptown Funk", artist: "Mark Ronson & Bruno Mars", audioUrl: "" },
  { title: "Shape of You", artist: "Ed Sheeran", audioUrl: "" },
  { title: "Blinding Lights", artist: "The Weeknd", audioUrl: "" },

  // — Chanson française & variété —
  { title: "Alors on danse", artist: "Stromae", audioUrl: "" },
  { title: "Papaoutai", artist: "Stromae", audioUrl: "" },
  { title: "Je veux", artist: "Zaz", audioUrl: "" },
  { title: "La Bohème", artist: "Charles Aznavour", audioUrl: "" },
  { title: "Ne me quitte pas", artist: "Jacques Brel", audioUrl: "" },
  { title: "Voyage voyage", artist: "Desireless", audioUrl: "" },
  { title: "Joe le taxi", artist: "Vanessa Paradis", audioUrl: "" },
  { title: "Belle", artist: "Notre-Dame de Paris", audioUrl: "" },
  { title: "Dernière danse", artist: "Indila", audioUrl: "" },
  { title: "Tous les mêmes", artist: "Stromae", audioUrl: "" },

  // — Rap & urbain FR —
  { title: "Djadja", artist: "Aya Nakamura", audioUrl: "" },
  { title: "Bande organisée", artist: "13 Organisé", audioUrl: "" },
  { title: "Ma direction", artist: "Sexion d'Assaut", audioUrl: "" },
  { title: "Dommage", artist: "Bigflo & Oli", audioUrl: "" },
  { title: "Balance ton quoi", artist: "Angèle", audioUrl: "" },

  // — Soirée / dancefloor —
  { title: "Danse avec moi (Freed from Desire)", artist: "Gala", audioUrl: "" },
  { title: "Around the World", artist: "Daft Punk", audioUrl: "" },
  { title: "Le Sirop Typhon", artist: "Richard Anthony", audioUrl: "" },
  { title: "Macarena", artist: "Los del Río", audioUrl: "" },
  { title: "Bella Ciao", artist: "Traditionnel", audioUrl: "" },

  // — Génériques & culture pop —
  { title: "Libérée, délivrée", artist: "La Reine des Neiges", audioUrl: "" },
  { title: "Hakuna Matata", artist: "Le Roi Lion", audioUrl: "" },
  { title: "Ghostbusters", artist: "Ray Parker Jr.", audioUrl: "" },
  { title: "Eye of the Tiger", artist: "Survivor", audioUrl: "" },
  { title: "Les Démons de minuit", artist: "Images", audioUrl: "" },
];
