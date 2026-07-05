/* =========================================================================
   MAIN — routeur (hash) + écran d'accueil.
   Route "#/"            -> accueil
   Route "#/jeu/<id>"    -> charge et monte le jeu correspondant
   ========================================================================= */

import { CATEGORIES, GAMES, getGame, gamesByCategory } from "./registry.js";
import { el, ensureGameStyle } from "./ui.js";

const app = document.getElementById("app");

// Cycle de vie : jeton de génération (anti-course) + nettoyage de l'écran courant.
let routeToken = 0;
let currentCleanup = null;

function teardown() {
  if (currentCleanup) {
    try {
      currentCleanup();
    } catch (e) {
      console.error("cleanup:", e);
    }
    currentCleanup = null;
  }
}

/* ---------- Accueil ---------- */
function renderHome() {
  document.title = "Soirée — Jeux à boire & jeux d'ambiance";
  const frag = el("div.screen", { dataset: { game: "home" } }, [
    el("section.home-hero", {}, [
      el("h1", { html: 'La soirée commence <span>ici</span>.' }),
      el("p", {
        text:
          "Choisis un jeu, pose le téléphone au milieu de la table, et laisse-toi guider. " +
          "Chaque jeu est indépendant — enrichis-les à ton rythme.",
      }),
    ]),
  ]);

  for (const cat of CATEGORIES) {
    const games = gamesByCategory(cat.id);
    if (!games.length) continue;
    const grid = el("div.game-grid");
    for (const g of games) {
      grid.appendChild(
        el(
          "a.game-card",
          { href: `#/jeu/${g.id}`, style: `--card-accent:${g.accent}` },
          [
            el("div.game-card__icon", { text: g.icon }),
            el("div.game-card__title", { text: g.title }),
            el("div.game-card__desc", { text: g.desc }),
          ]
        )
      );
    }
    frag.appendChild(
      el("section.category", {}, [
        el("h2.category__title", { text: cat.label }),
        grid,
      ])
    );
  }

  mount(frag);
}

/* ---------- Écran d'un jeu ---------- */
async function renderGame(id, token) {
  const game = getGame(id);
  if (!game) return renderNotFound();

  document.title = `${game.title} — Soirée`;
  ensureGameStyle(game.id);

  mount(el("div.center", {}, [el("p.screen__subtitle", { text: "Chargement…" })]));

  try {
    const mod = await game.load();
    if (token !== routeToken) return; // navigation changée pendant l'import : on abandonne
    const container = el("div.screen", { dataset: { game: game.id } });
    mount(container);
    // Un jeu peut retourner une fonction de nettoyage (timers, listeners, audio…).
    const cleanup = mod.render(container, { game });
    currentCleanup = typeof cleanup === "function" ? cleanup : null;
  } catch (err) {
    if (token !== routeToken) return;
    console.error(err);
    mount(
      el("div.screen", { dataset: { game: game.id } }, [
        el("div.placeholder", {}, [
          el("p", { text: `« ${game.title} » n'est pas encore prêt.` }),
          el("p", { text: String(err.message || err) }),
          el("a.btn.btn--ghost", { href: "#/", text: "Retour à l'accueil", style: "margin-top:14px;display:inline-block" }),
        ]),
      ])
    );
  }
}

/* ---------- Écran « jeu introuvable » ---------- */
function renderNotFound() {
  document.title = "Introuvable — Soirée";
  mount(
    el("div.screen", {}, [
      el("div.placeholder", {}, [
        el("p", { text: "Ce jeu est introuvable." }),
        el("a.btn.btn--ghost", { href: "#/", text: "Retour à l'accueil", style: "margin-top:14px;display:inline-block" }),
      ]),
    ])
  );
}

/* ---------- Utilitaires ---------- */
function mount(node) {
  app.replaceChildren(node);
  window.scrollTo(0, 0);
}

function router() {
  const token = ++routeToken; // invalide tout render asynchrone en cours
  teardown(); // nettoie l'écran précédent (timers, audio…)
  const hash = location.hash || "#/";
  const m = hash.match(/^#\/jeu\/([\w-]+)/);
  if (m) renderGame(m[1], token);
  else renderHome();
}

window.addEventListener("hashchange", router);
window.addEventListener("DOMContentLoaded", router);
router();
