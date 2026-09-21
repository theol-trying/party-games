# Soirée — jeux à boire et jeux d'ambiance

> Conventions communes aux deux sites de jeux (zéro dépendance, identité git, déploiement
> GitHub → Render, pièges Upstash) : **charger le skill `jeux-web`** avant de committer,
> pousser ou déployer. Ce fichier ne contient que ce qui est propre à ce repo.

Site **modulaire** : les jeux s'enrichissent un par un. Audit et état : `AUDIT.md`, `README.md`.

## Spécifique à ce repo

- **CommonJS** (pas de `"type": "module"`), contrairement au projet frère On-line.
- Repo GitHub : `theol-trying/party-games` · prod : https://party-games-w2c3.onrender.com
  (le `name: soiree-jeux` du `render.yaml` est un **piège** : `soiree-jeux.onrender.com` est
  un projet tiers sans rapport. Toujours tester sur `party-games-w2c3`.)
- **Web Service** Node, pas un Static Site : `server.js` sert le site *et* l'API de
  persistance. En Static Site les jeux s'afficheraient sans sauvegarde partagée.
- Santé du déploiement : **`/api/health`** (indique notamment si Upstash est branché).
- `ALLOWED_ORIGIN` restreint l'API au domaine de prod — vide = pas de restriction.
- `kv-local.*` = persistance de dev du serveur PowerShell, hors dépôt.
- **Ne pas proposer de « Mode Soirée »** : l'utilisateur l'a explicitement refusé.

## Lancer

```
npm start                     # ou preview_start "soiree" (.claude/launch.json, :5178)
```
