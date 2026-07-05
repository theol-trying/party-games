# Déploiement — GitHub → Render → Upstash

Guide adapté à un **upload manuel** du dossier sur GitHub.

---

## ⚠️ Règle d'or n°1 : uploader le CONTENU, pas le dossier

Sur github.com, quand tu fais **Add file → Upload files**, glisse **le contenu** du dossier
`party-games` (les fichiers `index.html`, `server.js`… et les dossiers `src/`, `assets/`),
**PAS** le dossier `party-games` lui-même.

À la racine de ton dépôt GitHub, tu dois voir **directement** :

```
index.html   server.js   package.json   render.yaml   .node-version
src/   assets/   README.md   ...
```

❌ Si tu vois un seul dossier `party-games/` à la racine → **c'est le bug**. Le site
s'affiche « en texte sur fond blanc » parce que `assets/css/base.css` et `src/main.js`
ne sont pas là où `index.html` les cherche. Supprime ce dossier sur GitHub et
re-dépose le **contenu** à la racine.

> Astuce : l'upload manuel **n'applique pas `.gitignore`** et rate parfois les fichiers
> commençant par `.` (ex. `.node-version`). Vérifie qu'ils sont bien présents sur GitHub.

---

## Configuration Render

Le site fonctionne en **Web Service** (Node) — c'est lui qui sert le site ET l'API de
persistance. (Un « Static Site » afficherait les jeux mais sans sauvegarde partagée.)

1. **New → Web Service** → connecte ton dépôt GitHub.
2. Réglages :
   - **Root Directory** : *(laisser vide)* — la racine du repo.
   - **Runtime** : Node
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
3. Onglet **Environment**, ajoute (noms EXACTS, sinon Upstash échoue en silence) :
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `ALLOWED_ORIGIN` *(optionnel ; laisser vide au début)*

---

## ✅ Tester en 3 vérifications

Une fois déployé, ouvre `https://<ton-app>.onrender.com` :

### 1. Le site s'affiche-t-il stylé (fond sombre, cartes de jeux) ?
- **Oui** → les fichiers statiques sont bien servis. 👍
- **Non (texte sur fond blanc)** → problème de structure (voir Règle d'or n°1).
  Confirme avec **F12 → onglet Réseau → recharge** : clique sur `main.js` et `base.css`.
  S'ils sont en **404**, les fichiers ne sont pas à la bonne place sur GitHub.

### 2. La persistance / Upstash est-elle branchée ?
Ouvre `https://<ton-app>.onrender.com/api/health` :
```json
{ "ok": true, "redis": true, "node": "v20.x", "fetch": true, "originRestricted": false }
```
- `redis: false` → les variables Upstash ne sont **pas vues** par Render (absentes ou mal nommées).
- `node` < v18 ou `fetch: false` → version Node trop vieille (le `.node-version` corrige ça).

### 3. Upstash répond-il vraiment ?
Ouvre `https://<ton-app>.onrender.com/api/health?deep=1` :
- `"redisPing": "PONG"` → tout est bon, la persistance marche. 🎉
- `"redisError": "..."` → les variables sont présentes mais **erronées** (mauvais token/URL) :
  recopie-les depuis Upstash → section **REST API**.

---

## 💡 Méthode recommandée (plus fiable) : `git push`

L'upload manuel est fragile (imbrication, fichiers `.` oubliés, `.gitignore` ignoré).
Le projet de référence (PONG) déploie par `git push`, ce qui garantit la bonne structure
et redéploie tout seul. Depuis `Documents/party-games` :

```bash
git remote add origin https://github.com/<ton-compte>/<ton-repo>.git
git branch -M main
git push -u origin main
```

Ensuite, chaque correctif = `git add . && git commit -m "..." && git push` → Render
redéploie automatiquement. Plus aucun risque d'imbrication.
