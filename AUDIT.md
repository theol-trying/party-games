# État du projet — Site « Soirée »

*Document d'état. Remplace l'audit initial de conception, dont tous les points bloquants ont
été corrigés depuis (il induisait en erreur : il décrivait l'API comme ouverte, le site comme
non installable et sans focus clavier, ce qui n'est plus vrai).*

Dernière vérification complète : **2026-09-21**.

---

## 1. Ce que fait le site

10 jeux, chacun jouable de deux façons :

- **Sur un seul téléphone** posé au milieu de la table ;
- **Multi-appareils** — chacun son téléphone, synchronisé en temps réel.

Autour des jeux : salon avec code de soirée + QR d'invitation, avatars, hôte transférable,
exclusion d'un joueur, changement de jeu pour tout le groupe, chrono synchronisé, buzzer avec
ordre d'arrivée, reconnexion automatique, anti-répétition du contenu entre soirées, cartes
personnalisables, **Roi de la soirée** (classement agrégé multi-jeux + cérémonie podium jouée
en même temps sur tous les appareils), **écran TV / spectateur** (`#/tv`), PWA installable,
support hors-ligne, sons et confettis.

## 2. Contenu (mesuré, pas estimé)

| Jeu | Contenu |
|---|---|
| Quiz à gages | 2492 questions · 25 catégories · 0 malformée · 0 doublon |
| Je n'ai jamais | 720 phrases (360 soft / 240 soirée / 120 18+) |
| Action ou Vérité | 687 cartes (348 actions + 339 vérités) |
| Qui est le plus susceptible | 245 affirmations |
| Undercover | 213 paires |
| Tu préfères | 209 dilemmes |
| Le Menteur | 189 missions |
| Cadavre exquis | 27 ouvertures · 95 amorces · 25 clôtures · 6 thèmes |
| Baccalauréat | 8 catégories · 20 lettres |
| Blind Test | 8 pistes — **aucune avec audio** (voir §4) |

Gages partagés : 178.

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

## 4. Points ouverts

| Sujet | État |
|---|---|
| **Blind Test** | Les 8 pistes ont un `audioUrl` vide : le jeu n'est pas jouable tel quel. Soit fournir des playlists, soit assumer le « apporte ta musique » et le dire dans l'UI. |
| **Mode équipes** | `teams.js` existe mais n'est branché que sur 2 jeux sur 10. |
| **Couverture de tests** | `live.js` est du Node pur, donc testable sans navigateur — c'est là qu'ont vécu la plupart des bugs. |
| **Modèle de confiance** | Le code de soirée (4 caractères) est le seul secret protégeant les données d'un salon. Acceptable pour des prénoms et des votes ; à savoir. |
| **Durcissement HTTP** | Pas de CSP ni de `X-Frame-Options` ; `/api/health` expose la version de Node. |

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
- Les 10 jeux se chargent sans erreur console.
