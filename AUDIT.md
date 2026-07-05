# Rapport d'audit & d'enrichissement — Site « Soirée »

*Audit global (UX/design + backend/persistance) et conception de nouvelles fonctionnalités pour les 10 jeux. Objectif produit : un site modulaire pour un téléphone posé sur la table, avec persistance et partage entre appareils.*

> Sections 1, 2, 4 et les jeux **Action ou Vérité / Je n'ai jamais / Baccalauréat / Cadavre exquis** proviennent d'un audit multi-agents. Les 6 autres jeux ont été conçus en complément (mêmes principes).

---

## 1. État global & santé du projet

### Forces à préserver
- **Architecture modulaire propre** : chaque jeu isolé (`src/games/<id>/{index.js, data.js, style.css}`), registre unique (`src/registry.js`), chargement à la demande par import dynamique. Ajouter/éditer un jeu ne touche rien d'autre.
- **Persistance « local-first »** : `src/store.js` (getData/setData) avec repli `localStorage`, backend Node sans dépendance + Upstash. Pattern sain — à durcir et namespacer.
- **Composants réutilisables** : `players.js`, helpers `ui.js` (`el`, `shuffle`, `pick`, `screenHead`). Bonne base pour factoriser des moteurs transverses.
- **10 jeux fonctionnels** couvrant 4 catégories.

### Problèmes classés par sévérité

| Sév. | Domaine | Problème | Fichier |
|------|---------|----------|---------|
| 🔴 | Sécurité | API `/api/kv/:key` **totalement ouverte** en prod : lecture/écrasement/énumération anonyme de n'importe quelle clé | `server.js` |
| 🔴 | Sécurité | **Aucune validation ni borne de clé** → écriture illimitée → épuisement du quota Upstash free | `server.js` |
| 🔴 | A11y | **Résultats dynamiques jamais annoncés** (buzz, votes, révélations) : aucune région `aria-live` | tous les jeux |
| 🔴 | PWA | **Pas de manifest / icônes / service worker** : le cas « tél sur la table quand le Wi-Fi saute » casse | `index.html` |
| 🔴 | A11y | **Aucun focus visible** (boutons/cards/chips) : navigation clavier aveugle | `assets/css/base.css` |
| 🔴 | UX | **Retour accueil instantané sans confirmation** : un tap accidentel détruit la partie en cours | `src/ui.js` |
| 🔴 | UX | **Cibles tactiles < 44px** (chips ~30px, nav, ✕ de suppression nu) | `base.css`, `players.js` |
| 🟠 | Backend | **Race last-write-wins** sur la clé partagée `players` (pas d'atomicité/merge) | `store.js`, `server.js` |
| 🟠 | Backend | **Aucun timeout** sur le fetch Upstash → requêtes pendantes qui saturent Render free | `server.js` |
| 🟠 | Backend | **Erreurs brutes renvoyées** au client (fuite d'info) ; `getData()` ne gère pas les 5xx | `server.js`, `store.js` |
| 🟠 | Backend | **Aucun TTL** sur les clés Redis → accumulation infinie | `server.js` |
| 🟠 | UX | **Transitions abruptes** (fadeIn jamais rejoué sur `replaceChildren`) + **scroll non réinitialisé** entre phases | `base.css`, `main.js` |
| 🟠 | A11y | Pas de `prefers-reduced-motion` ; toggles sans `aria-pressed` ; `<audio>` sans label | `base.css`, `blind-test` |
| 🟠 | iOS | `viewport-fit=cover` sans `env(safe-area-inset-*)` → header sous l'encoche | `index.html` |
| 🟡 | Contenu | **Blind Test sans audios** (non jouable en l'état) ; data.js très courts (14–23 lignes) | plusieurs |
| 🟡 | UX | Thème par jeu limité à `--accent` → 10 jeux visuellement quasi identiques | `src/games/*/style.css` |
| 🟡 | Maintenab. | `#app-nav` vide jamais peuplé + preconnect Google Fonts mort | `index.html` |

---

## 2. Améliorations & optimisations transverses

**Constat central** : les jeux ré-inventent les mêmes briques (deck, scoring, packs, gages, contenu custom). Construire des **modules partagés une fois**, dont bénéficient les 10 jeux.

### Architecture & données
| Chantier | Ce que ça résout | Effort |
|----------|------------------|--------|
| **Socle « Rooms / Soirée »** — code à 4–5 lettres (`BQ7X`) dans le hash `#/r/BQ7X/…` qui préfixe TOUTES les clés (`kv:soiree:<room>:players`…). Écran Créer/Rejoindre. | Débloque multi-appareils, scoring global, contenu custom **sans collision entre groupes**. Corrige la clé globale `players` + le last-write-wins. **Pivot.** | L |
| **Moteur de deck partagé (`src/deck.js`)** — carte commune `{id, text, tags[], niveau, pack}`, filtres, mélange, anti-répétition. | Élimine la duplication n°1 ; anti-répétition + packs gratuits pour tous. | M |
| **Scoring transverse (`src/scoring.js`) + Mode Soirée** — score par room, bandeau de classement, méta-boucle enchaînant les jeux + podium final. | Transforme 10 jeux atomiques en un **produit « soirée »**. | M |
| **Bibliothèque de gages partagée (`src/gages.js`)** — pool central taggé par intensité. | Cohérence de ton, un seul endroit à enrichir/modérer. | S |

### UX / mobile / accessibilité
| Chantier | Ce que ça résout | Effort |
|----------|------------------|--------|
| **Socle a11y & tactile global** — `announce()` (aria-live persistant), `:focus-visible`, cibles 44/48px, `aria-pressed`, `prefers-reduced-motion`, helper `showPhase()` (replaceChildren + scrollTo + fadeIn). | Regroupe **8 findings** (3 hautes) en un seul chantier propagé partout. **Meilleur ratio impact/effort.** | M |
| **PWA installable + hors-ligne** — manifest, icônes maskables 🍻, service worker (cache-first shell, network-first API), `safe-area-inset`. | Sert le cas d'usage central + plein écran. | L |
| **Garde d'abandon de partie** — `confirm()` sur le retour quand une partie est en cours. | Empêche la destruction d'état par tap accidentel. | S |

### Backend / persistance
| Chantier | Ce que ça résout | Effort |
|----------|------------------|--------|
| **Durcissement backend** — secret partagé `X-Soiree-Token`, allowlist regex des clés (`/^[a-zA-Z0-9:_-]{1,64}$/`), TTL 30j, `AbortController` timeout 4s, erreurs génériques + bons statuts, header nosniff. | Sécurise l'API. **Bloquant avant mise en ligne publique** (un bot scannant onrender.com peut vider le quota). | M |
| **Éditeur de contenu / packs custom par room** — UI « Mes cartes », **sanitation text-only** (jamais `innerHTML`). | Personnalisation = rétention, et ferme le vecteur XSS du contenu re-diffusé. | M |
| **Vrai multi-écran** (undercover / menteur) — chaque joueur reçoit son rôle sur SON tél via rooms + polling. | Corrige le défaut du pass-the-phone (voir le mot du voisin). | L |

> **Dé-priorisé** : i18n. Tout le contenu est FR, aucun besoin multilingue signalé.

---

## 3. Nouvelles fonctionnalités par jeu

### 🎯 Action ou Vérité
| Feature | Apport | Effort | Rejouab. |
|---------|--------|--------|----------|
| **Boucle à joueurs nommés + deck anti-répétition** ⭐ | L'app dit QUI joue (« À toi, Léa »), rythme, plus de doublons. Socle du reste. | M | Fort |
| **Cartes ciblées inter-joueurs** (`{joueur}`, `{gauche}`, `{droite}`) | Contenu spécifique au groupe présent, variété démultipliée. | M | Fort |
| **Packs thématiques + intensité persistée** | Réglage par groupe (potes/couples/coquin/sans alcool) retrouvé à la reprise ; corrige le bug intensité non persistée. | M | Fort |
| **Enjeu « Osera pas » + scoring gorgées** | Chaque tour a une conséquence (Réussi/Raté/Passe), scoreboard « qui a le plus bu ». | M | Moyen |
| **Jauge de chauffe + palier Extreme** | Commence soft, monte tout seul, palier ultime en fin. | M | Moyen |
| **Compteur de deck + fin de manche** | Objectif tangible (« carte 7/40 »), podium de clôture. | S | Moyen |

### 🙅 Je n'ai jamais
| Feature | Apport | Effort | Rejouab. |
|---------|--------|--------|----------|
| **Contenu massif taggé + moteur de deck** ⭐ | 80–120 phrases, 3 niveaux + thèmes ; mélange différent chaque soirée. | M | Fort |
| **Mode « Sur le grill »** ⭐ | Une personne nommée est visée (« Léa, as-tu déjà… ») → vannes et anecdotes, le vrai moteur. | M | Fort |
| **Compteur de gorgées + Palmarès** | But et chute (« vie la plus sulfureuse »). | M | Fort |
| **Cartes défis / gages intercalées** | Pics d'action collective (1 sur N), relance l'énergie. | S | Fort |
| **Phrases custom du groupe** | Inside jokes → contenu illimité et intime. | M | Moyen |
| **Barre nav Précédent/Suivant + écran Fin** | Rattrape les taps accidentels, temps fort de clôture. | S | Moyen |

### 👉 Qui est le plus susceptible de…
| Feature | Apport | Effort | Rejouab. |
|---------|--------|--------|----------|
| **Contenu massif + packs + anti-répétition** ⭐ | La banque actuelle (~14 affirmations) s'épuise en une soirée ; viser 60–100 sur packs (potes/couple/travail/hot). | M | Fort |
| **Scoring cumulé « Roi/Reine de la soirée »** ⭐ | Total des désignations par joueur sur toute la partie → classement persistant, vraie boucle. | M | Fort |
| **Gorgées = nombre de votes reçus** | Le plus désigné boit autant de gorgées qu'il a reçu de votes → enjeu proportionnel. | S | Moyen |
| **Mode « Cash » (révélation des votes)** | Option qui montre qui a voté pour qui (vs anonyme actuel) → débats. | S | Moyen |
| **Mini-duel en cas d'égalité** | Les ex-æquo tranchent (pierre-feuille-ciseaux / vote éclair) au lieu de « tout le monde boit ». | S | Faible |
| **Affirmations custom du groupe** | Inside jokes → forte raison de revenir. | M | Moyen |

### ⚖️ Tu préfères…
| Feature | Apport | Effort | Rejouab. |
|---------|--------|--------|----------|
| **Vote pass-the-phone anonyme** ⭐ | Remplace le comptage manuel par taps (peu fiable) : chacun vote secrètement, révélation dramatique du camp minoritaire. | M | Fort |
| **Contenu massif + packs + anti-répétition** ⭐ | ~12 dilemmes actuels → 60+ sur packs (absurde, malaise/éthique, hot, geek, bouffe). | M | Fort |
| **Stats agrégées « 78% ont préféré X »** | Compteur global cross-parties via Upstash → effet « et le reste du monde ? ». | M | Fort |
| **Mode « Toi vs le groupe »** | Un joueur prédit le vote majoritaire ; se trompe = boit. | M | Moyen |
| **Débat chronométré** | Timer de 30 s de débat obligatoire avant révélation. | S | Moyen |
| **Dilemmes custom / « créez le pire »** | Les joueurs soumettent leurs propres dilemmes. | M | Moyen |

### 🕵️ Undercover / Imposteur
| Feature | Apport | Effort | Rejouab. |
|---------|--------|--------|----------|
| **Boucle complète : indices → vote → élimination → manches** ⭐ | Aujourd'hui = distribution + révélation seulement. Ajouter le cœur du jeu : tours d'indices cadencés, vote d'élimination, manches jusqu'à victoire. | M | Fort |
| **Vrai multi-écran (rooms)** ⭐ | Chaque tél son mot secret → fin du risque de voir le mot du voisin (défaut majeur du pass-the-phone). | L | Fort |
| **Rôle « Mr Blanc » + rôles spéciaux** | Un joueur sans mot qui bluffe et tente de deviner → tension et variété. | M | Fort |
| **Scoring civils/imposteurs + classement soirée** | Points selon l'issue de la manche, podium. | M | Fort |
| **Banque de mots massive + difficulté (paires proches/lointaines)** | ~14 paires actuelles → packs + réglage de difficulté. | M | Fort |
| **Indices guidés + gorgées** | L'app cadence « chacun dit un mot » ; les démasqués boivent. | S | Moyen |

### 🤥 Le Menteur
| Feature | Apport | Effort | Rejouab. |
|---------|--------|--------|----------|
| **Système d'accusation + scoring** ⭐ | Mission réussie = points ; se faire griller = gage ; deviner la mission d'un autre = points. Transforme la distribution en vrai jeu. | M | Fort |
| **Variante « infiltré » (un seul menteur)** ⭐ | Un joueur a une mission secrète, les autres non ; il faut le démasquer → mode tension différent. | M | Fort |
| **Banque de missions massive + packs + anti-répétition** | ~16 missions actuelles → 60+ (verbal/physique/soft/trash). | M | Fort |
| **Multi-écran (rooms)** | Missions vraiment privées, chacun sur son tél. | L | Fort |
| **Missions à difficulté/points + timer de manche** | Missions dures = plus de points ; chrono qui crée l'urgence. | M | Moyen |
| **Missions custom du groupe** | Contenu sur-mesure. | S | Moyen |

### 🎵 Blind Test
| Feature | Apport | Effort | Rejouab. |
|---------|--------|--------|----------|
| **Intégration audio réelle** ⭐⭐ | **Prérequis** : le jeu est non jouable sans son. Recommandé : previews 30 s **Deezer API** (publiques, sans clé) ; alternatives : mp3 locaux dans `assets/audio`, embed YouTube. | M–L | Fort |
| **Playlists / packs thématiques** ⭐ | Années 80/90/2000, rap FR, Disney, génériques, été… → rejouabilité quasi infinie. | M | Fort |
| **Formats de manche variés** | Deviner titre / artiste / année / « paroles suivantes » ; points différenciés. | M | Fort |
| **Buzzer avec pénalité + minuteur d'extrait** | Mauvaise réponse = −1 ou blocage 5 s ; l'extrait a une durée. Plus tendu et équitable. | S | Moyen |
| **Mode équipes + scoring persistant/podium** | Grands groupes ; classement de soirée. | M | Fort |
| **Manche bonus « x2 » / mort subite** | Temps forts, retournements. | S | Faible |

### 🧠 Quiz à gages
| Feature | Apport | Effort | Rejouab. |
|---------|--------|--------|----------|
| **Banque massive + catégories + difficulté + anti-répétition** ⭐ | ~10 questions actuelles → 100+ taggées ; on ne revoit plus les mêmes. | M | Fort |
| **Boucle multijoueur à tour de rôle + scoring** ⭐ | Aujourd'hui = solo. Ajouter joueurs nommés, points, classement → vraie partie. | M | Fort |
| **Mode duel / buzzer** | Question affichée, premier à buzzer répond → nerveux. | M | Fort |
| **Chrono par question + points dégressifs** | Récompense la rapidité. | S | Moyen |
| **Gages gradués + « double ou rien »** | Gage selon la difficulté ratée ; parier ses gorgées. | S | Moyen |
| **Roue des catégories / questions custom** | La table choisit le thème ; le groupe écrit ses propres questions (sur eux). | M | Moyen |

### ✍️ Cadavre exquis
| Feature | Apport | Effort | Rejouab. |
|---------|--------|--------|----------|
| **Refonte data en banques d'amorces + moteur d'assemblage** ⭐ | Corrige le bug `AMORCES[step % 8]` ET le « jamais de vraie fin » ; contenu extensible (ouverture → mid → clôture). | M | Fort |
| **Mode « queue visible »** ⭐ | Le vrai mécanisme : on ne voit que les 3–4 derniers mots (floutés puis révélés) → enchaînements absurdes. | S | Fort |
| **Thèmes / genres sélectionnables** | Conte, polar, télé-réalité, SF beauf, bureau… une soirée = plusieurs ambiances. | S | Fort |
| **Attribution des joueurs + auteurs à la révélation** | « C'est TOI qui as écrit ça ?! » ; corrige le `playersCard` inutilisé. | M | Moyen |
| **Mode « Question / Réponse »** (phrase-Frankenstein Qui/Où/Quoi/Réplique/Conséquence) | 2e format complet et hilarant. | M | Fort |
| **Contraintes de tour + mots imposés** | « contient BANANE », « 5 mots max », mots secrets des copains à caser. | M | Fort |
| **Copie WhatsApp + galerie « Meilleures histoires »** | Partage + palmarès de soirée à battre. | L | Moyen |

---

## 4. Feuille de route priorisée (3 vagues)

### 🌊 Vague 1 — Socles & mise en prod sûre
1. **Socle « Rooms / Soirée »** (L) — namespacing du store par code + écran Créer/Rejoindre. Pivot du scoring, du custom et du multi-appareils.
2. **Durcissement backend** (M) — auth + validation des clés + TTL + timeout + erreurs génériques. **Bloquant avant mise en ligne publique.**
3. **Socle a11y & tactile global** (M) — `announce()`, `:focus-visible`, cibles 44px, `prefers-reduced-motion`, `showPhase()`. Regroupe 8 findings.

### 🌊 Vague 2 — Moteurs partagés & produit « soirée »
4. **Moteur de deck partagé** (`src/deck.js`, M) — bénéficie aux 10 jeux.
5. **Scoring transverse + Mode Soirée** (`src/scoring.js`, M) — fil conducteur + podium global.
6. **Bibliothèque de gages partagée** (`src/gages.js`, S).
7. **PWA installable + hors-ligne** (L) — peut avancer en parallèle.
8. **Garde-fous contenu** (S–M) — consentement packs hot, bouton « passer cette carte », sanitation text-only.

### 🌊 Vague 3 — Enrichissement des jeux
9. **Câbler chaque jeu sur les moteurs** puis dérouler les designs : boucle nommée → contenu massif/packs → scoring → gages → twists.
10. **Rendre Blind Test jouable** (intégration audio Deezer) + prioriser **Undercover** (le plus fragile en pass-the-phone).
11. **Vrai multi-écran** Undercover / Menteur (L) sur le socle rooms.
12. **Identité visuelle par jeu** (M, optionnel) — tinter bg/gradient/bandeau par jeu.

**Fils rouges** : viser un **volume minimal de contenu** par jeu (sinon l'anti-répétition tourne à vide) ; **schéma de carte taggée commun** ; ne **jamais** passer du contenu utilisateur par `innerHTML`.

---

## 5. Audit architecture / cycle de vie (complément)

Verdict : socle sain et cohérent, mais **il manque un contrat de cycle de vie** — c'est la lacune structurelle qui cause le seul vrai bug et qui se reproduira à chaque nouveau jeu.

| Sév. | Problème | Fichier |
|------|----------|---------|
| 🔴 | **Timer du Baccalauréat jamais arrêté** : quitter pendant le chrono laisse un `setInterval` tourner en fond (mute du DOM détaché, double timer au retour) | `baccalaureat/index.js:77` |
| 🔴 | **Aucun contrat de teardown** : `render()` ne renvoie pas de `cleanup()` ; timers/listeners globaux/audio hors-DOM ne meurent pas | `main.js:64-69` |
| 🔴 | **Course de navigation** : `renderGame` async sans jeton de génération → naviguer vite monte un écran par-dessus l'autre | `main.js:55-82` |
| 🟠 | **Duplication massive** : flux pass-the-phone, deck cyclique, scoreboard, chips réimplémentés dans 4-6 jeux | plusieurs |
| 🟠 | **2 conventions de « rejouer »** incohérentes (self-render vs fonction interne) | `undercover/index.js:102` vs autres |
| 🟠 | **Routeur** sans vraie 404 (id inconnu → home silencieuse) ; **réconciliation `players.js`** non annulée au démontage | `main.js:90-95` ; `players.js:99-104` |
| 🟡 | `<audio>` non stoppé (blind-test) ; reflow dupliqué (`void offsetWidth`) ; `ensureGameStyle` jamais retiré (FOUC) ; `el()` avec `innerHTML`/collision `class` ; exports morts (`GAMES`, `isRemoteAvailable`) | divers |

**Reco n°1 (débloque #1, #2, #8)** : `render(container, ctx)` retourne un `cleanup()` optionnel ; le routeur mémorise le cleanup courant et l'appelle avant chaque montage. **Reco n°2** : `routeToken` anti-course + route 404. **Reco n°3** : `src/game-kit.js` (`passThePhone`, `deck`, `scoreboard`, `chipGroup`, `countdown` qui retourne son `stop`) pour tuer la duplication.

---

## 6. Journal des correctifs livrés

- **Durcissement backend** (`server.js`, + miroir dans `serve.ps1`) : allowlist de clés (regex, ≤80 car.), plafond de valeur 32 Ko (413), TTL Redis 30 j, timeout Upstash 4 s (AbortController), rate-limit 120 req/min/IP, contrôle d'origine optionnel (`ALLOWED_ORIGIN`), erreurs génériques + bons statuts, en-têtes `nosniff`/`Referrer-Policy`. *Testé : 400 clé invalide, 413 trop gros, 400 JSON invalide, 404 absent, round-trip OK.*
  > ⚠️ **Rappel** : un front statique ne peut pas détenir de vrai secret (un token dans le JS est public). La protection repose sur allowlist + taille + TTL + rate-limit + origine, **pas** sur un token client.
- **Robustesse `serve.ps1`** : timeout de réception 5 s par socket → une socket de *preconnect* navigateur ne fige plus le serveur mono-thread.
