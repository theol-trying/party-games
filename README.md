# 🍻 Soirée — Jeux à boire & jeux d'ambiance

Ébauche d'un site regroupant 10 jeux de soirée. **Architecture modulaire** : chaque jeu
est isolé dans son dossier et peut être édité, enrichi et re-stylisé indépendamment.

## Lancer le site en local

Le site utilise des modules ES → il faut un petit serveur (pas d'ouverture en `file://`).

**Sans rien installer (Windows)** : double-clique **`Lancer le site.bat`**, puis ouvre
http://localhost:5178. (Le script `serve.ps1` sert le site *et* l'API de persistance en local.)

**Avec Node** (comme en production) :

```bash
npm start          # démarre server.js sur http://localhost:5178
```

## Mise en ligne (GitHub → Render → Upstash)

Le site tourne en statique, mais un petit backend Node (`server.js`, **sans dépendance**)
le sert et expose une API clé/valeur `/api/kv/:key` persistée dans **Upstash Redis**.
Sans Redis configuré, tout fonctionne quand même (repli `localStorage` côté client,
mémoire côté serveur).

### 1. Pousser sur GitHub

```bash
cd Documents/party-games
git add .
git commit -m "Site Soirée : jeux + backend de persistance"
# crée un dépôt vide sur github.com (ex. "soiree-jeux"), puis :
git remote add origin https://github.com/<ton-compte>/soiree-jeux.git
git branch -M main
git push -u origin main
```

### 2. Créer la base Upstash Redis

1. Va sur https://upstash.com → crée une base **Redis** (région proche, ex. `eu-west`).
2. Dans la base → section **REST API**, copie `UPSTASH_REDIS_REST_URL` et
   `UPSTASH_REDIS_REST_TOKEN`.

### 3. Déployer sur Render

1. https://render.com → **New → Web Service** → connecte ton dépôt GitHub.
2. Render détecte `render.yaml` (runtime Node, `npm start`). Sinon, règle à la main :
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
3. Onglet **Environment** → ajoute les deux variables copiées depuis Upstash :
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
4. Déploie. Vérifie `https://<ton-app>.onrender.com/api/health` → doit renvoyer
   `{"ok":true,"redis":true}`.

> ⚠️ Ne commite jamais tes tokens. Ils vont dans les variables d'environnement Render
> (le `.env` local est ignoré par git).

## Structure

```
party-games/
├── index.html
├── server.js                  ← backend Node (statique + API /api/kv, → Upstash)
├── serve.ps1                  ← équivalent local sans install (Windows/PowerShell)
├── package.json / render.yaml ← config de déploiement (Render)
├── .env.example               ← variables Upstash à renseigner
├── assets/css/base.css        ← thème global + composants réutilisables
└── src/
    ├── main.js                ← routeur (hash) + accueil
    ├── registry.js            ← LISTE DES JEUX (à éditer pour ajouter/retirer)
    ├── ui.js                  ← helpers partagés (el, shuffle, pick…)
    ├── store.js               ← persistance client (API + repli localStorage)
    ├── players.js             ← composant de saisie des joueurs (réutilisable)
    └── games/
        └── <id-du-jeu>/
            ├── index.js       ← logique + écrans du jeu (export render())
            ├── data.js        ← contenu éditable (questions, mots, gages…)
            └── style.css      ← style propre au jeu (surcharge le thème)
```

## Persister des données depuis un jeu

Importe le store et utilise deux fonctions asynchrones (clé libre) :

```js
import { getData, setData } from "../../store.js";

await setData("scores:blind-test", { Théo: 12, Marie: 9 }); // écrit local + serveur
const scores = await getData("scores:blind-test", {});      // lit serveur, sinon local
```

Ça marche partout : en statique ça reste local, sur Render + Upstash c'est partagé
et conservé. La liste de joueurs (`players.js`) l'utilise déjà comme exemple.

## Enrichir un jeu

- **Ajouter du contenu** : édite le `data.js` du jeu. Rien d'autre à toucher.
- **Changer le style d'un jeu** : édite son `style.css`. Le sélecteur
  `.screen[data-game="<id>"]` permet de redéfinir les variables (`--accent`, etc.)
  sans impacter les autres jeux.
- **Modifier le gameplay** : édite l'`index.js` du jeu. Chaque jeu expose une seule
  fonction `render(container, { game })`.

## Ajouter un nouveau jeu

1. Crée `src/games/mon-jeu/` avec `index.js`, `data.js`, `style.css`.
2. Dans `index.js`, exporte `export function render(container, { game }) { … }`.
3. Ajoute une entrée dans `src/registry.js` (`id`, `title`, `icon`, `accent`,
   `category`, `desc`, `load`).

## Jeux inclus

| Jeu | Statut ébauche |
|-----|----------------|
| Action ou Vérité | ✅ soft/hot, tirage aléatoire |
| Je n'ai jamais | ✅ deck mélangé, soft/hot |
| Qui est le plus susceptible de… | ✅ vote anonyme pass-the-phone + classement |
| Tu préfères… | ✅ vote à 2 camps, minoritaire boit |
| Undercover / Imposteur | ✅ distribution secrète des mots + révélation |
| Le Menteur | ✅ missions secrètes + révélation |
| Blind Test | ✅ buzzer + scores (⚠️ brancher tes propres audios dans `data.js`) |
| Quiz à gages | ✅ QCM + gage aléatoire si faux |
| Baccalauréat | ✅ lettre + catégories + chrono |
| Cadavre exquis | ✅ écriture en aveugle + lecture finale |

## Pistes d'évolution

- Blind test : intégration audio (fichiers locaux, extraits, ou API musicale).
- Scores persistants inter-jeux / profils de joueurs.
- Mode multi-appareils (chaque téléphone son écran) — pertinent pour Undercover.
- Thèmes visuels complets par jeu (déjà amorcé via les `style.css`).
