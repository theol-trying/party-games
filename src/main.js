/* =========================================================================
   MAIN — routeur (hash) + écran d'accueil.
   Route "#/"            -> accueil
   Route "#/jeu/<id>"    -> charge et monte le jeu correspondant
   ========================================================================= */

import { CATEGORIES, getGame, gamesByCategory } from "./registry.js";
import { el, ensureGameStyle, announce } from "./ui.js";
import { currentRoom, newRoom, setRoom, normalizeCode } from "./room.js";
import { qrCanvas } from "./qr.js";

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

/* ---------- Bandeau « soirée » (code de room) ---------- */
function roomBanner() {
  const code = currentRoom();

  const info = el("div.room-banner__info", {}, [
    el("span.room-banner__label", { text: "Soirée" }),
    el("span.room-banner__code", { text: code }),
  ]);

  const shareBtn = el("button.chip", { text: "🔗 Partager", "aria-label": "Copier le lien de la soirée" });
  shareBtn.addEventListener("click", async () => {
    const link = `${location.origin}${location.pathname}#/r/${code}`;
    if (navigator.share) {
      // Mobile : feuille de partage native (WhatsApp, SMS…), bien plus fiable.
      try { await navigator.share({ title: "Soirée 🎉", text: `Rejoins ma soirée — code ${code}`, url: link }); return; } catch {}
    }
    try {
      await navigator.clipboard.writeText(link);
      shareBtn.textContent = "Copié ✓";
      announce("Lien de la soirée copié");
      setTimeout(() => (shareBtn.textContent = "🔗 Partager"), 1500);
    } catch {
      window.prompt("Copie ce lien pour inviter :", link);
    }
  });

  const joinBtn = el("button.chip", { text: "Rejoindre" });
  const newBtn = el("button.chip", { text: "Nouvelle" });

  // QR d'invitation : déplié/replié à la demande (scanner = rejoindre).
  const qrWrap = el("div", { style: "text-align:center" });
  const qrBtn = el("button.chip", { text: "📱 QR", "aria-label": "Afficher le QR code d'invitation" });
  qrBtn.addEventListener("click", () => {
    if (qrWrap.childElementCount) { qrWrap.replaceChildren(); return; }
    try {
      const cv = qrCanvas(`${location.origin}${location.pathname}#/r/${code}`, { scale: 4 });
      cv.style.cssText = "margin:10px auto 2px;border-radius:12px;max-width:180px";
      cv.setAttribute("aria-label", "QR code d'invitation à la soirée");
      qrWrap.replaceChildren(cv, el("p.screen__subtitle", { text: `Scanne-moi pour rejoindre la soirée ${code}` }));
    } catch {}
  });
  newBtn.addEventListener("click", () => {
    newRoom();
    announce("Nouvelle soirée créée");
    renderHome();
  });

  const actions = el("div.room-banner__actions", {}, [shareBtn, qrBtn, joinBtn, newBtn]);

  joinBtn.addEventListener("click", () => {
    const input = el("input.input.room-banner__input", { placeholder: "CODE", maxlength: "8", "aria-label": "Code de la soirée à rejoindre" });
    const ok = el("button.chip.is-active", { text: "OK" });
    const join = () => {
      const c = normalizeCode(input.value);
      if (!c) return;
      setRoom(c);
      renderHome();
    };
    ok.addEventListener("click", join);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") join();
    });
    actions.replaceChildren(input, ok);
    input.focus();
  });

  return el("div", {}, [el("section.room-banner", {}, [info, actions]), qrWrap]);
}

/* ---------- Accueil ---------- */
function renderHome() {
  document.title = "Soirée — Jeux à boire & jeux d'ambiance";
  const frag = el("div.screen", { dataset: { game: "home" } }, [
    el("section.home-hero", {}, [
      el("h1", {}, ["La soirée commence ", el("span", { text: "ici" }), "."]),
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

  frag.prepend(roomBanner());
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

  // Lien d'invitation #/r/CODE : rejoint la soirée puis renvoie à l'accueil.
  const rm = hash.match(/^#\/r\/([A-Za-z0-9]{1,8})/);
  if (rm) {
    setRoom(rm[1]);
    location.hash = "#/"; // déclenche un nouveau routage vers l'accueil
    return;
  }

  const m = hash.match(/^#\/jeu\/([\w-]+)/);
  if (m) renderGame(m[1], token);
  else renderHome();
}

window.addEventListener("hashchange", router);
window.addEventListener("DOMContentLoaded", router);
router();

// Service worker : installe le support hors-ligne (échoue en silence si indispo).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
