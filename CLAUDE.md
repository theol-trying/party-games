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
- ✅ **Déploiement automatique à chaque push sur `main`** (depuis le 2026-09-23), mais PAS
  par l'intégration GitHub de Render : c'est **GitHub Actions** (`.github/workflows/deploy.yml`)
  qui lance les tests puis appelle le Deploy Hook de Render (secret `RENDER_DEPLOY_HOOK`).
  Un push dont les tests échouent n'est donc **pas** déployé. Les workflows prennent ~10 s ;
  la mise en ligne, de **moins d'une minute** (build en cache) à ~10 min.
  - Suivi sans dashboard : l'API publique `api.github.com/repos/theol-trying/party-games/actions/runs`
    donne le résultat des workflows ; l'ETag de `/index.html` change à chaque mise en ligne
    (Render reclone le dépôt → nouvelles dates de fichiers). ⚠️ Relever l'ETag de référence
    **AVANT** le push : relevé après, il peut déjà être le nouveau (le 2026-09-24, une sonde
    a ainsi attendu en vain un déploiement déjà en ligne). La partie après le tiret de
    l'ETag est la date de dépôt des fichiers en base 36 : `new Date(parseInt(x, 36))`.
  - La ligne « It looks like we don't have access to your repo » reste dans les logs de
    build : elle est **sans conséquence** (dépôt public, cloné quand même). Ne pas la « corriger ».
- ⚠️ **Render relaie la fermeture d'un WebSocket vers Node avec ~10 s de retard** (mesuré
  le 2026-09-23 ; en local c'est instantané). Toute sortie volontaire doit donc envoyer
  `{ t: "leave" }` AVANT de couper — c'est ce que fait `stop()` dans `src/realtime.js`.
  Une sonde qui vérifie un départ en prod doit attendre plus de 10 s avant de conclure.
- **Tester dans le navigateur intégré de Claude : `http://127.0.0.1:5178`, pas `localhost`.**
  Sur `localhost`, le service worker n'y atteint pas le réseau : il répond « hors-ligne »
  (503) pour tout module non précaché et l'accueil reste vide — faux bug.
- `ALLOWED_ORIGIN` restreint l'API au domaine de prod — vide = pas de restriction.
- `kv-local.*` = persistance de dev du serveur PowerShell, hors dépôt.
- **Ne pas proposer de « Mode Soirée »** : l'utilisateur l'a explicitement refusé.

## Lancer

```
npm start                     # ou preview_start "soiree" (.claude/launch.json, :5178)
```
