# État du projet — Site « Soirée »

*Document d'état. Remplace l'audit initial de conception, dont tous les points bloquants ont
été corrigés depuis (il induisait en erreur : il décrivait l'API comme ouverte, le site comme
non installable et sans focus clavier, ce qui n'est plus vrai).*

Dernière vérification complète : **2026-09-28** (audit : serveur, moteur multi, 11 jeux, contenu).

---

## 1. Ce que fait le site

11 jeux, chacun jouable de deux façons :

- **Sur un seul téléphone** posé au milieu de la table ;
- **Multi-appareils** — chacun son téléphone, synchronisé en temps réel.

Autour des jeux : salon avec code de soirée + QR d'invitation, avatars, hôte transférable,
exclusion d'un joueur, changement de jeu pour tout le groupe, chrono synchronisé, buzzer avec
ordre d'arrivée, reconnexion automatique, anti-répétition du contenu entre soirées, cartes
personnalisables, **Roi de la soirée** (classement agrégé multi-jeux, parties sur un seul
téléphone comprises, + cérémonie podium jouée en même temps sur tous les appareils ; accessible
depuis l'accueil : 👑 Palmarès), **compteur de gorgées** de la soirée et option **sans alcool**
(mêmes jeux, gorgées de soft), **écran TV / spectateur** (`#/tv`), PWA installable,
support hors-ligne, sons et confettis.

## 2. Contenu (mesuré, pas estimé)

| Jeu | Contenu |
|---|---|
| Quiz à gages | 2546 questions · 26 catégories · 0 malformée · 0 doublon (même à la ponctuation près, testé) |
| Je n'ai jamais | 738 phrases (369 soft / 249 soirée / 120 18+), dont 23 d'actu 2025-2026 |
| Action ou Vérité | 701 cartes (360 actions + 341 vérités), dont 20 d'actu 2025-2026 |
| Qui est le plus susceptible | 261 affirmations, dont 21 d'actu 2025-2026 |
| Undercover | 239 paires, dont 26 d'actu 2025-2026 |
| Tu préfères | 232 dilemmes, dont 23 d'actu 2025-2026 |
| Le Menteur | 207 missions, dont 18 d'actu 2025-2026 |
| Cadavre exquis | 27 ouvertures · 95 amorces · 25 clôtures · 6 thèmes |
| Estimations | 212 questions « combien de… ? » en 8 thèmes au choix (réponses numériques et positives, testées) |
| Baccalauréat | 8 catégories · 20 lettres |
| Blind Test | 45 pistes pour « joue-la toi-même » + recherche d'extraits de 30 s (Apple Music / Deezer) |

Gages partagés : 178, plus les gages du groupe (🎭 Mes gages : ajout, désactivation, « seulement les nôtres »).

## 3. Architecture

- **Zéro dépendance, zéro build.** Les fichiers sont servis tels quels.
- `server.js` (Node) : statique + `/api/kv` (proxy Upstash) + `/api/music` + `/ws`.
- `ws.js` : implémentation WebSocket RFC 6455 écrite à la main.
- `live.js` : salons en mémoire, clés par `(code de soirée, jeu)` — **source de vérité**.
- `src/realtime.js` : client joueur, avec repli automatique en polling si le WebSocket échoue.
- `src/tv.js` : client spectateur (ne joue pas, ne compte pas comme joueur).
- `src/games/<id>/{index.js, data.js, style.css}` : un jeu = un module isolé.

**Invariant à respecter** : tout état ou effet ponctuel doit vivre au scope du jeu et être
indexé sur le numéro de manche — jamais dans une closure de rendu. Les écrans sont re-rendus
(boutons « Revenir à la manche » / « Revoir la révélation »), ce qui réinitialise sinon l'état
et re-déclenche les effets. C'est la source de la majorité des bugs passés.

En multi, deux outils du moteur (`src/realtime.js`) servent précisément à cela :
- `api.memo()` : un objet qui survit aux re-rendus de la manche en cours (réponse
  choisie, vote, brouillon…) et repart à neuf à la manche suivante ;
- `api.on("progress" | "state" | "timer")` rejoue le dernier événement reçu à tout
  nouvel abonné : un écran re-rendu sait qui a répondu, où en est le chrono, etc.
  Les abonnements sont remis à zéro à chaque écran de manche ou de révélation.
- Les envois d'un écran portent le numéro de sa manche : le serveur ignore ceux qui
  visent une autre manche (décompte oublié d'un ancien écran).

## 4. Points ouverts

| Sujet | État |
|---|---|
| **Blind Test** | Jouable via la recherche d'extraits ; la liste manuelle (sans audio) sert au mode « joue-la toi-même », et l'UI le dit. |
| **Mode équipes** | `teams.js` est branché sur 4 jeux sur 11 (Quiz, Bac, Blind Test, Plus susceptible), en mode un seul téléphone. |
| **Couverture de tests** | 63 tests : protocole des salons (`live.js`), vrai serveur (`serveur.test.mjs`), et le moteur multi des téléphones lui-même, sous un DOM simulé contre le vrai serveur (`moteur.test.mjs` : re-rendus, nouvel hôte, réglages, envois périmés). |
| **Modèle de confiance** | Le code de soirée (4 caractères) est le seul secret protégeant les données d'un salon. Acceptable pour des prénoms et des votes ; à savoir. |
| **Durcissement HTTP** | Fait : CSP, `X-Frame-Options`, contrôle d'origine sur l'API **et** sur `/ws` (`ALLOWED_ORIGIN`) ; `/api/health` n'expose que la version majeure de Node. |

## 5. Vérifié et sain

- Path traversal bloqué ; seuls `index.html`, `sw.js`, `manifest.webmanifest`, `assets/` et
  `src/` sont servis (le reste du dépôt ne l'est pas).
- API de persistance : validation des clés, plafond de 32 Ko, expiration, timeout, rate-limit,
  méthodes non autorisées rejetées.
- Fichiers statiques servis avec un ETag → un rechargement renvoie des 304 (~14 Ko au lieu
  de ~566 Ko sur le quiz).
- Service worker : ne met en cache que les réponses saines, précache l'ensemble des modules
  transverses.
- Aucun module mort ; aucun écouteur global laissé en place par les jeux.
- Les 11 jeux se chargent sans erreur console.
