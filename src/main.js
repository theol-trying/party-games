/* =========================================================================
   MAIN — routeur (hash) + écran d'accueil.
   Route "#/"            -> accueil
   Route "#/jeu/<id>"    -> charge et monte le jeu correspondant
   ========================================================================= */

import { CATEGORIES, getGame, gamesByCategory } from "./registry.js";
import { el, ensureGameStyle, announce } from "./ui.js";
import { currentRoom, newRoom, setRoom, normalizeCode } from "./room.js";
import { qrCanvas } from "./qr.js";
import { gameArt } from "./art.js";
import { resumeInfo, requestAutoLive } from "./realtime.js";

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
// Préférences de confort, propres à ce téléphone (jamais partagées) : le
// stockage peut être indisponible (navigation privée…), tout marche sans.
const CLE_DERNIER_JEU = "soiree.accueil.dernierJeu";
const CLE_FILTRE = "soiree.accueil.filtre";
const lireLocal = (cle) => { try { return localStorage.getItem(cle); } catch { return null; } };
const ecrireLocal = (cle, v) => { try { localStorage.setItem(cle, v); } catch {} };

/** Tuile d'un jeu sur l'accueil. */
function tuileJeu(g) {
  // Illustration maison quand elle existe, emoji sinon : les dessins sont
  // identiques d'un téléphone à l'autre, contrairement aux emoji système.
  const art = gameArt(g.id, { size: 34 });
  const icone = art
    ? el("div.game-card__icon.game-card__icon--art", {}, [art])
    : el("div.game-card__icon", { text: g.icon });
  return el("a.game-card", { href: `#/jeu/${g.id}`, style: `--card-accent:${g.accent}` }, [
    icone,
    el("div.game-card__title", { text: g.title }),
    el("div.game-card__desc", { text: g.desc }),
  ]);
}

function renderHome() {
  document.title = "Soirée — Jeux à boire & jeux d'ambiance";
  const frag = el("div.screen", { dataset: { game: "home" } });
  const hero = el("section.home-hero", {}, [
    el("h1", {}, ["La soirée commence ", el("span", { text: "ici" }), "."]),
    el("p", {
      text:
        "Choisis un jeu, pose le téléphone au milieu de la table, et laisse-toi guider. " +
        "Chaque jeu est indépendant — enrichis-les à ton rythme.",
    }),
  ]);

  // Filtres par ambiance : une seule grille au lieu d'une section par
  // catégorie — sur téléphone, les 10 jeux tiennent ainsi en un écran et demi.
  const categories = CATEGORIES.filter((c) => gamesByCategory(c.id).length);
  const options = [{ id: "tout", chip: "✨ Tous" }, ...categories];
  let filtre = lireLocal(CLE_FILTRE);
  if (!options.some((o) => o.id === filtre)) filtre = "tout";
  const grid = el("div.game-grid");
  const chips = options.map((o) =>
    el("button.chip", {
      text: o.chip,
      type: "button",
      onClick: () => { filtre = o.id; ecrireLocal(CLE_FILTRE, filtre); remplir(); },
    })
  );
  function remplir() {
    chips.forEach((c, i) => {
      const actif = options[i].id === filtre;
      c.classList.toggle("is-active", actif);
      c.setAttribute("aria-pressed", String(actif));
    });
    const jeux = filtre === "tout" ? categories.flatMap((c) => gamesByCategory(c.id)) : gamesByCategory(filtre);
    grid.replaceChildren(...jeux.map(tuileJeu));
  }
  remplir();

  // Salon multi encore actif cette session ? Retour en un tap (refresh, bouton
  // « retour »… ne coûtent plus une re-saisie complète).
  const resume = resumeInfo();
  const resumeGame = resume && getGame(resume.gameId);

  // ↻ Rejouer au dernier jeu ouvert sur ce téléphone (sauf s'il est déjà
  // proposé juste au-dessus comme partie en cours).
  const dernier = getGame(lireLocal(CLE_DERNIER_JEU));
  const rejouer = dernier && (!resumeGame || resumeGame.id !== dernier.id)
    ? el("a.home-rejouer", { href: `#/jeu/${dernier.id}`, style: `--card-accent:${dernier.accent}` }, [
        gameArt(dernier.id, { size: 22 }) || el("span", { text: dernier.icon || "🎮" }),
        el("span", { text: "Rejouer à " }), // espace : lu « Rejouer à Undercover », pas « àUndercover »
        el("strong", { text: dernier.title }),
        el("span.home-rejouer__fleche", { text: "→", "aria-hidden": "true" }),
      ])
    : null;

  frag.append(
    roomBanner(),
    ...(rejouer ? [rejouer] : []),
    hero,
    el("h2.sr-only", { text: "Les jeux" }),
    el("div.home-filtres", { role: "toolbar", "aria-label": "Filtrer les jeux par ambiance" }, chips),
    grid
  );
  if (resumeGame) {
    frag.prepend(
      el("section.card", { style: "display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;border-color:var(--accent)" }, [
        el("div", {}, [
          el("div", { text: "🎉 Partie en cours", style: "font-weight:800" }),
          el("div.screen__subtitle", { text: `${resumeGame.icon || "🎮"} ${resumeGame.title} · soirée ${currentRoom()}` }),
        ]),
        el("button.btn", {
          text: "Reprendre →",
          onClick: () => { requestAutoLive(); location.hash = "#/jeu/" + resumeGame.id; },
        }),
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
  ecrireLocal(CLE_DERNIER_JEU, game.id); // pour le raccourci « Rejouer à … » de l'accueil

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

/* ---------- Rejoindre la partie en cours d'une soirée ---------- */
// Demande au serveur quel jeu est en cours dans cette soirée. Si une partie
// tourne, on y entre directement en mode multi ; sinon on va à l'accueil.
// Le serveur seul connaît cette information : elle vit dans les salons en
// mémoire, pas dans le stockage partagé.
async function rejoindrePartieEnCours() {
  const code = currentRoom();
  mount(el("div.screen", {}, [el("div.card.center", {}, [
    el("h3", { text: `🎉 Soirée ${code}` }),
    el("p.screen__subtitle", { text: "On regarde si une partie est en cours…", style: "margin-top:8px" }),
  ])]));
  let info = null;
  try {
    const r = await fetch(`/api/room/${encodeURIComponent(code)}`);
    if (r.ok) info = await r.json();
  } catch {}
  if (info && info.game && getGame(info.game)) {
    requestAutoLive(); // le jeu ouvrira son salon sans repasser par le menu
    location.hash = "#/jeu/" + info.game;
  } else {
    location.hash = "#/"; // personne ne joue : accueil classique
  }
}

/* ---------- Écran TV / spectateur ---------- */
async function renderTV(code, token) {
  document.title = "📺 Écran TV — Soirée";
  if (!code) return renderTVEntry();
  mount(el("div.center", {}, [el("p.screen__subtitle", { text: "Chargement de l'écran TV…" })]));
  try {
    const mod = await import("./tv.js");
    if (token !== routeToken) return; // navigation changée pendant l'import
    const container = el("div.screen", { dataset: { game: "tv" } });
    mount(container);
    const cleanup = mod.render(container, { code });
    currentCleanup = typeof cleanup === "function" ? cleanup : null;
  } catch (err) {
    if (token !== routeToken) return;
    console.error(err);
    mount(el("div.screen", {}, [el("div.placeholder", {}, [
      el("p", { text: "Écran TV indisponible." }),
      el("p", { text: String(err.message || err) }),
      el("a.btn.btn--ghost", { href: "#/", text: "Retour à l'accueil", style: "margin-top:14px;display:inline-block" }),
    ])]));
  }
}

// Saisie du code quand on arrive sur #/tv sans code.
function renderTVEntry() {
  const input = el("input.input", {
    placeholder: "CODE DE LA SOIRÉE", maxlength: "8", autocapitalize: "characters", autocomplete: "off",
    style: "text-transform:uppercase;letter-spacing:.25em;text-align:center;font-weight:800",
    "aria-label": "Code de la soirée à afficher",
  });
  const go = () => { const c = normalizeCode(input.value); if (c) location.hash = "#/tv/" + c; else input.focus(); };
  const btn = el("button.btn.btn--full", { text: "Afficher l'écran TV", style: "margin-top:14px", onClick: go });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  mount(el("div.screen", {}, [el("div.card.center", {}, [
    el("h3", { text: "📺 Écran TV / spectateur" }),
    el("p.screen__subtitle", { text: "Pose ce grand écran sur la table : QR d'invitation permanent, salon, manches et palmarès en grand. Entre le code de la soirée pour commencer.", style: "margin:8px 0 12px" }),
    input, btn,
  ])]));
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

  // Lien d'invitation #/r/CODE : rejoint la soirée. Si une partie est DÉJÀ en
  // cours dans cette soirée, on y emmène directement — sinon l'invité
  // atterrissait sur l'accueil et devait deviner quel jeu l'hôte préparait.
  const rm = hash.match(/^#\/r\/([A-Za-z0-9]{1,8})/);
  if (rm) {
    setRoom(rm[1]);
    rejoindrePartieEnCours();
    return;
  }

  // Écran TV / spectateur : #/tv (saisie du code) ou #/tv/CODE.
  const tvm = hash.match(/^#\/tv(?:\/([A-Za-z0-9]{1,8}))?/);
  if (tvm) return renderTV(tvm[1] ? tvm[1].toUpperCase() : null, token);

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

// ☕ Préchauffage : réveille le serveur (Render à froid ≈ 30 s) pendant que
// l'hôte choisit son jeu — la connexion au salon sera déjà chaude.
fetch("/api/health").catch(() => {});
