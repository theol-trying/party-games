/* =========================================================================
   CROWN — 👑 Roi de la soirée : classement agrégé multi-jeux.

   Chaque jeu à score (quiz, blind-test, plus susceptible, tu préfères) appelle
   awardStanding(gameId, rankedIds, names, avatars) à la révélation (HÔTE
   uniquement) avec le classement COURANT de ce jeu (meilleur d'abord). On
   convertit en points de couronne (1er=5, 2e=3, 3e=2, participation=1) — ainsi
   aucun jeu (ni le quiz, ni ses nombreuses manches) n'écrase les autres : chaque
   jeu ne pèse qu'une seule contribution, remplacée à chaque mise à jour.

   Stockage : clé KV « crown » room-scopée (store.js) → partagée par tout le salon.
   { [deviceId]: { name, avatar, byGame:{gameId:pts} } }
   ========================================================================= */

import { el } from "./ui.js";
import { getData, setData } from "./store.js";
import { celebrate, confettiRain, confettiBurst } from "./fx.js";
import { jingle, roundCue, pop } from "./sound.js";

const KEY = "crown";
const RANK_PTS = [5, 3, 2]; // 1er, 2e, 3e ; au-delà = participation (1)

// Titres décernés au meilleur de chaque jeu.
const TITLES = {
  "quiz-gages": "🧠 Cerveau",
  "blind-test": "🎧 Oreille d'or",
  "plus-susceptible": "👀 Star",
  "tu-preferes": "🔮 Prophète",
};

function colorOf(text) {
  let h = 0;
  for (let i = 0; i < (text || "").length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 70% 55%)`;
}

/** Contribution d'un jeu au classement (appelée par l'HÔTE à la révélation).
    rankedIds : deviceIds classés (meilleur d'abord). Remplace la contribution
    précédente de ce jeu → idempotent, converge vers le classement final. */
export async function awardStanding(gameId, rankedIds, names = {}, avatars = {}) {
  if (!Array.isArray(rankedIds) || !rankedIds.length) return;
  const crown = (await getData(KEY, {})) || {};
  rankedIds.forEach((id, i) => {
    if (!id) return;
    const e = crown[id] || (crown[id] = { name: names[id] || "?", avatar: avatars[id] || "", byGame: {} });
    if (names[id]) e.name = names[id];
    if (avatars[id]) e.avatar = avatars[id];
    e.byGame = e.byGame || {};
    e.byGame[gameId] = RANK_PTS[i] != null ? RANK_PTS[i] : 1; // participation = 1
  });
  await setData(KEY, crown);
}

export async function getCrown() {
  return (await getData(KEY, {})) || {};
}
export async function resetCrown() {
  await setData(KEY, {});
}

/** Classement agrégé trié + titres par jeu. */
export function crownTotals(crown) {
  const rows = Object.keys(crown || {}).map((id) => {
    const e = crown[id] || {};
    const byGame = e.byGame || {};
    const pts = Object.values(byGame).reduce((a, b) => a + (b || 0), 0);
    return { id, name: e.name || "?", avatar: e.avatar || "🎲", pts, byGame, titles: [] };
  });
  // Titre du jeu : au joueur qui y a le plus de points (≥ points d'un podium).
  for (const gameId of Object.keys(TITLES)) {
    let best = null;
    rows.forEach((r) => { const p = r.byGame[gameId] || 0; if (p >= 2 && (!best || p > best.byGame[gameId])) best = r; });
    if (best) best.titles.push(TITLES[gameId]);
  }
  return rows.sort((a, b) => b.pts - a.pts);
}

/* ============================== ÉCRAN 👑 ============================== */

function medalFor(i) { return i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`; }

function rankRow(r, i, me) {
  return el("div.cr-row" + (i === 0 ? ".is-first" : ""), {}, [
    el("span.cr-rank", { text: medalFor(i) }),
    el("span.av-badge", { text: r.avatar, style: `background:${colorOf(r.name)}` }),
    el("span.cr-name", { text: r.name + (r.id === me ? " (toi)" : "") + (r.titles.length ? " " + r.titles.join(" ") : "") }),
    el("span.cr-pts", { text: `${r.pts} 👑` }),
  ]);
}

/** Rendu du palmarès dans `stage`. { onBack, isHost, me }. */
export async function openCrown(stage, { onBack, isHost, me }) {
  const crown = await getCrown();
  const totals = crownTotals(crown);
  const wrap = el("div.card", {});

  function renderList() {
    const bits = [el("h3.center", { text: "👑 Roi de la soirée", style: "margin-bottom:4px" })];
    if (!totals.length) {
      bits.push(el("p.screen__subtitle.center", { text: "Aucun score pour l'instant — jouez quelques manches à score (Quiz, Blind Test, Plus susceptible, Tu préfères) !", style: "margin:10px 0" }));
    } else {
      bits.push(el("p.screen__subtitle.center", { text: "Cumul des jeux à score de la soirée.", style: "margin-bottom:12px" }));
      bits.push(el("div.stack", {}, totals.map((r, i) => rankRow(r, i, me))));
      if (isHost && totals.length >= 2) {
        bits.push(el("button.btn.btn--full", { text: "👑 Couronner le Roi ! (cérémonie)", style: "margin-top:16px", onClick: () => playCeremony(wrap, totals, me, renderList) }));
      }
    }
    const row = el("div.row", { style: "justify-content:center;margin-top:14px;flex-wrap:wrap" }, [
      el("button.chip", { text: "← Retour au salon", onClick: () => onBack && onBack() }),
      isHost && totals.length ? el("button.chip", { text: "🔄 Remettre à zéro", onClick: async () => { if (window.confirm("Effacer le classement de la soirée ?")) { await resetCrown(); totals.length = 0; renderList(); } } }) : null,
    ]);
    bits.push(row);
    wrap.replaceChildren(...bits);
  }
  renderList();
  stage.replaceChildren(wrap);
}

/** Cérémonie animée : podium 3e → 2e → 1er + confettis + roulement. */
function playCeremony(wrap, totals, me, onDone) {
  const top = totals.slice(0, 3);
  const podium = el("div.cr-podium");
  // 3 marches : 2e (gauche), 1er (centre), 3e (droite).
  const slots = { 0: null, 1: null, 2: null };
  const stepFor = (rank) => {
    const r = top[rank];
    if (!r) return null;
    const cls = rank === 0 ? "cr-step--1" : rank === 1 ? "cr-step--2" : "cr-step--3";
    const node = el("div.cr-step." + cls + " is-hidden", {}, [
      el("div.cr-step__crown", { text: rank === 0 ? "👑" : "" }),
      el("span.av-badge.cr-step__av", { text: r.avatar, style: `background:${colorOf(r.name)}` }),
      el("div.cr-step__name", { text: r.name + (r.id === me ? " (toi)" : "") }),
      el("div.cr-step__pts", { text: `${r.pts} 👑` }),
      el("div.cr-step__base", { text: rank === 0 ? "1" : rank === 1 ? "2" : "3" }),
    ]);
    slots[rank] = node;
    return node;
  };
  // Ordre visuel : 2e, 1er, 3e.
  [stepFor(1), stepFor(0), stepFor(2)].forEach((n) => n && podium.appendChild(n));

  const title = el("h2.center", { text: "🥁 Roulement de tambour…", style: "margin-bottom:12px" });
  const skip = el("button.chip", { text: "Passer", style: "margin-top:14px" });
  wrap.replaceChildren(el("div", {}, [title, podium, el("div.row", { style: "justify-content:center" }, [skip])]));

  const timers = [];
  let done = false;
  const reveal = (rank, delay, label) => timers.push(setTimeout(() => {
    if (done) return;
    if (slots[rank]) slots[rank].classList.remove("is-hidden");
    title.textContent = label;
    if (rank === 0) { celebrate(); jingle(); const rect = podium.getBoundingClientRect(); confettiBurst(rect.left + rect.width / 2, rect.top + rect.height / 3, 140); }
    else { pop(); }
  }, delay));
  roundCue();
  if (top[2]) reveal(2, 900, "🥉 En 3e place…");
  reveal(1, 2000, "🥈 En 2e place…");
  reveal(0, 3400, `👑 Le Roi de la soirée : ${top[0].name} !`);
  timers.push(setTimeout(() => { if (!done) confettiRain(1200); }, 3600));

  const finish = () => {
    if (done) return; done = true;
    timers.forEach(clearTimeout);
    // Affiche tout le podium d'un coup si on passe.
    Object.values(slots).forEach((n) => n && n.classList.remove("is-hidden"));
    title.textContent = top[0] ? `👑 ${top[0].name}, Roi de la soirée !` : "👑";
    skip.textContent = "← Retour au classement";
    skip.onclick = () => onDone && onDone();
  };
  skip.addEventListener("click", finish);
  timers.push(setTimeout(finish, 4200));
}
