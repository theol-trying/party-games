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
- ⚠️ **`render.yaml` n'est PAS la source de vérité de ce service.** Les logs de build
  montrent `Running build command 'yarn'`, alors que le fichier indique `npm install` :
  les réglages réels vivent dans le **dashboard Render**. Modifier `render.yaml` n'a donc
  aucun effet — inutile d'y toucher pour changer le build.
- ⚠️ **Un déploiement prend ~10 min** sur le plan gratuit. Ne pas conclure à un blocage
  avant d'avoir attendu : vérifier plutôt l'onglet Events du dashboard.
- 🚨 **L'auto-déploiement NE FONCTIONNE PAS** (constaté le 2026-09-22). Les logs de build
  affichent « It looks like we don't have access to your repo » : Render n'a pas accès au
  dépôt GitHub, donc aucun webhook n'y a été installé et il n'est jamais prévenu des push.
  Il clone quand même, le dépôt étant public — d'où l'illusion que tout va bien.
  **Ne pas dire à l'utilisateur que « Render redéploie tout seul »** tant que ce n'est pas
  corrigé : il doit déclencher « Manual Deploy » à la main.
  Correctif : Settings → Repository → reconnecter via l'intégration GitHub (installer l'app
  Render et lui donner accès au dépôt), puis vérifier Auto-Deploy = Yes.
- `ALLOWED_ORIGIN` restreint l'API au domaine de prod — vide = pas de restriction.
- `kv-local.*` = persistance de dev du serveur PowerShell, hors dépôt.
- **Ne pas proposer de « Mode Soirée »** : l'utilisateur l'a explicitement refusé.

## Lancer

```
npm start                     # ou preview_start "soiree" (.claude/launch.json, :5178)
```
