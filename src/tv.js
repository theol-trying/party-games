/* =========================================================================
   TV — écran spectateur (#/tv, #/tv/<CODE>).

   Un laptop / une tablette posé·e sur la table : affiche EN GRAND le QR
   d'invitation permanent, le salon, la manche en cours, la révélation, la
   cérémonie du Roi et le palmarès. Les téléphones restent les « manettes ».

   Se connecte au salon en SPECTATEUR (message join { spectator:true }) : il ne
   joue pas, ne compte pas comme joueur, ne reçoit aucun rôle — mais reçoit tous
   les broadcasts (lobby, round, progress, timer, reveal, ceremony, goto). Suit
   l'hôte quand il change de jeu (goto → reconnexion sur le nouveau jeu). Si
   aucun jeu n'est actif, le serveur répond « nogame » et la TV réessaie.
   Transport WebSocket uniquement (l'état spectateur vit en mémoire serveur).
   ========================================================================= */

import { el } from "./ui.js";
import { currentRoom, setRoom, normalizeCode } from "./room.js";
import { qrCanvas } from "./qr.js";
import { getGame } from "./registry.js";
import { getData } from "./store.js";
import { colorOf, dedupeNames } from "./realtime.js";
import { openCeremony, crownTotals } from "./crown.js";
import { roundCue, jingle } from "./sound.js";

const MEDALS = ["🥇", "🥈", "🥉"];
const NOGAME_RETRY_MS = 3000;
const RECONNECT_MS = 2500;

export function render(stage, { code } = {}) {
  if (code) setRoom(normalizeCode(code));
  const room = currentRoom();
  const tvId = "tv" + Math.random().toString(36).slice(2, 10); // id spectateur (unique par écran)

  // ------------------------------- état --------------------------------
  let stopped = false;
  let status = "🔌 connexion…";
  let gameId = null; // jeu actuellement regardé
  let phase = "waiting"; // waiting | lobby | round | reveal | ceremony
  let players = []; // [{id,name,avatar}]
  let host = null;
  let avatars = {};
  let round = null; // { n, meta }
  let shownRound = -1; // manche déjà affichée (idempotence sur reconnexion)
  let shownReveal = false; // révélation déjà affichée pour shownRound
  let progress = { n: -1, done: [], total: 0 };
  let revealed = null; // { n, order, names, avatars }
  let timerEndsAt = 0;
  let crown = []; // crownTotals(...)
  let ceremonyCleanup = null;
  let timerInt = null;

  const main = el("div.tv");
  stage.replaceChildren(main);
  refreshCrown();
  draw();

  const net = spectatorSocket(room, tvId, {
    onStatus: (s) => { status = s; if (phase === "waiting" || phase === "lobby") draw(); },
    onWatching: (g) => { gameId = g; if (phase === "waiting") phase = "lobby"; draw(); },
    onFull: () => { cancelCeremony(); stopTimer(); phase = "full"; draw(); },
    onNoGame: () => {
      cancelCeremony(); gameId = null; phase = "waiting"; round = null; revealed = null;
      shownRound = -1; shownReveal = false; timerEndsAt = 0; stopTimer(); draw();
    },
    onLobby: (list, h, avs) => {
      players = list; host = h; if (avs) avatars = avs;
      if (phase === "waiting") phase = "lobby";
      if (phase === "lobby") draw();
    },
    onGoto: (g) => { // l'hôte change de jeu : on bascule (le socket se reconnecte sur g)
      cancelCeremony(); gameId = g; phase = "lobby"; round = null; revealed = null;
      shownRound = -1; shownReveal = false; timerEndsAt = 0;
      progress = { n: -1, done: [], total: 0 }; stopTimer(); draw();
    },
    onRound: (n, meta) => {
      // Idempotent : le serveur rejoue la manche courante à chaque (re)connexion.
      // On ne (re)joue le son / ne réinitialise que sur une manche RÉELLEMENT neuve.
      if (n === shownRound) { round = { n, meta }; if (phase === "round") draw(); return; }
      cancelCeremony();
      shownRound = n; shownReveal = false;
      round = { n, meta }; revealed = null; progress = { n, done: [], total: 0 };
      timerEndsAt = 0; stopTimer(); phase = "round"; roundCue(); draw();
    },
    onProgress: (n, done, total) => {
      progress = { n, done: done || [], total: total || 0 };
      if (phase === "round") draw();
    },
    onTimer: (n, endsAtLocal) => { if (n !== shownRound) return; timerEndsAt = endsAtLocal; if (phase === "round") startTimer(); },
    onRevealed: (n, order, names, avs, meta) => {
      if (shownReveal && n === shownRound) return; // déjà révélée (rejeu sur reconnexion)
      cancelCeremony();
      shownRound = n; shownReveal = true;
      revealed = { n, order: order || [], names: names || {}, avatars: avs || {} };
      if (avs) avatars = { ...avatars, ...avs };
      timerEndsAt = 0; stopTimer(); phase = "reveal"; jingle(); refreshCrown(); draw();
    },
    onCeremony: (top) => playCeremony(top),
  });

  return function cleanup() {
    stopped = true;
    cancelCeremony();
    stopTimer();
    net.destroy();
  };

  /* ----------------------------- helpers ------------------------------ */
  function cancelCeremony() { if (ceremonyCleanup) { try { ceremonyCleanup(); } catch {} ceremonyCleanup = null; } }
  function stopTimer() { if (timerInt) { clearInterval(timerInt); timerInt = null; } }
  function startTimer() {
    if (stopped) return; // un setTimeout(startTimer,0) en vol ne doit pas ressusciter un intervalle après cleanup
    stopTimer();
    const node = main.querySelector(".tv-timer");
    const tick = () => {
      const left = Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000));
      const n2 = main.querySelector(".tv-timer");
      if (n2) n2.textContent = "⏱️ " + left + " s";
      if (left <= 0) stopTimer();
    };
    if (node) { tick(); timerInt = setInterval(tick, 250); }
  }
  async function refreshCrown() {
    try { crown = crownTotals((await getData("crown", {})) || {}); } catch { crown = []; }
    if (!stopped && (phase === "lobby" || phase === "reveal" || phase === "waiting")) draw();
  }
  function playCeremony(top) {
    if (!Array.isArray(top) || !top.length) return;
    cancelCeremony();
    phase = "ceremony";
    // Podium joué dans la zone principale, en même temps que sur les téléphones.
    ceremonyCleanup = openCeremony(main, top, { me: null, onDone: () => { ceremonyCleanup = null; if (!stopped) { phase = "reveal"; refreshCrown(); draw(); } } });
  }

  /* ------------------------------ vues -------------------------------- */
  function inviteUrl() { return `${location.origin}${location.pathname}#/r/${room}`; }
  function bigQR(scale) {
    try {
      const cv = qrCanvas(inviteUrl(), { scale: scale || 6 });
      cv.className = "tv-qr";
      cv.setAttribute("aria-label", "QR code d'invitation");
      return cv;
    } catch { return null; }
  }
  function gameMeta() { return (gameId && getGame(gameId)) || null; }

  function header() {
    const g = gameMeta();
    return el("div.tv-head", {}, [
      el("div.tv-head__room", {}, [
        el("span.tv-head__mark", { text: "🍻" }),
        el("span", { text: "Soirée " }),
        el("span.tv-head__code", { text: room }),
      ]),
      g ? el("div.tv-head__game", { text: `${g.icon || "🎮"} ${g.title}` }) : el("span", {}),
    ]);
  }

  function avatarBadge(id, big) {
    const p = players.find((x) => x.id === id);
    const name = (p && p.name) || (revealed && revealed.names[id]) || "?";
    const av = (p && p.avatar) || avatars[id] || (revealed && revealed.avatars[id]) || "🎲";
    return el("span" + (big ? ".tv-av.tv-av--big" : ".tv-av"), { text: av, style: `background:${colorOf(name)}` });
  }

  function crownPanel() {
    if (!crown.length) return null;
    const rows = crown.slice(0, 5).map((r, i) =>
      el("div.tv-cr__row" + (i === 0 ? ".is-first" : ""), {}, [
        el("span.tv-cr__rank", { text: i < 3 ? MEDALS[i] : `${i + 1}.` }),
        el("span.tv-av", { text: r.avatar || "🎲", style: `background:${colorOf(r.name)}` }),
        el("span.tv-cr__name", { text: r.name + (r.titles && r.titles.length ? " " + r.titles.join(" ") : "") }),
        el("span.tv-cr__pts", { text: `${r.pts} 👑` }),
      ])
    );
    return el("div.tv-cr", {}, [el("div.tv-cr__title", { text: "👑 Roi de la soirée" }), el("div", {}, rows)]);
  }

  function playerGrid() {
    if (!players.length) return el("p.tv-sub", { text: "En attente de joueurs…" });
    const disp = dedupeNames(players);
    return el("div.tv-players", {}, players.map((p) =>
      el("div.tv-player", {}, [
        avatarBadge(p.id, true),
        el("span.tv-player__name", { text: disp[p.id] + (p.id === host ? " 🎬" : "") }),
      ])
    ));
  }

  function draw() {
    if (stopped || phase === "ceremony") return; // la cérémonie possède la zone principale
    const bits = [header()];

    if (phase === "waiting") {
      bits.push(el("div.tv-hero", {}, [
        el("div.tv-hero__title", { text: "En attente d'une partie…" }),
        el("p.tv-sub", { text: "L'hôte n'a pas encore lancé de jeu. Scannez pour rejoindre la soirée !" }),
        bigQR(7),
        el("div.tv-code", { text: room }),
        status ? el("p.tv-status", { text: status }) : null,
      ]));
    } else if (phase === "full") {
      bits.push(el("div.tv-hero", {}, [
        el("div.tv-hero__title", { text: "Trop d'écrans 📺" }),
        el("p.tv-sub", { text: "Cette soirée a déjà le maximum d'écrans TV connectés. Ferme un autre écran puis recharge cette page." }),
      ]));
    } else if (phase === "lobby") {
      bits.push(el("div.tv-lobby", {}, [
        el("div.tv-lobby__left", {}, [
          el("div.tv-hero__title", { text: "Rejoins la soirée 🎉" }),
          bigQR(7),
          el("div.tv-code", { text: room }),
          el("p.tv-sub", { text: "Scanne le QR ou entre le code sur ton téléphone" }),
        ]),
        el("div.tv-lobby__right", {}, [
          el("div.tv-h2", { text: `${players.length} joueur${players.length > 1 ? "s" : ""} dans le salon` }),
          playerGrid(),
          crownPanel(),
        ]),
      ]));
    } else if (phase === "round") {
      const done = progress.done || [];
      const total = progress.total || players.length;
      const pips = players.length
        ? el("div.tv-players", {}, players.map((p) => {
            const rank = done.indexOf(p.id);
            const answered = rank >= 0;
            return el("div.tv-player" + (answered ? ".is-done" : ""), {}, [
              avatarBadge(p.id, true),
              el("span.tv-player__name", { text: (p.name || "?") + (rank >= 0 && rank < 3 ? " " + MEDALS[rank] : "") }),
            ]);
          }))
        : el("p.tv-sub", { text: "…" });
      bits.push(el("div.tv-round", {}, [
        el("div.tv-hero__title", { text: "Ça joue ! 🎮" }),
        el("div.tv-timer", { text: "" }),
        el("div.tv-h2", { text: `${done.length} / ${total} ont répondu` }),
        pips,
      ]));
      // (re)démarre l'affichage du chrono si actif
      if (timerEndsAt > Date.now()) setTimeout(startTimer, 0);
    } else if (phase === "reveal") {
      const order = (revealed && revealed.order) || [];
      const podium = order.length
        ? el("div.tv-buzz", {}, order.slice(0, 3).map((id, i) =>
            el("div.tv-buzz__row", {}, [
              el("span.tv-buzz__medal", { text: MEDALS[i] }),
              avatarBadge(id, true),
              el("span.tv-player__name", { text: (revealed.names[id]) || (players.find((p) => p.id === id) || {}).name || "?" }),
            ])
          ))
        : null;
      bits.push(el("div.tv-reveal", {}, [
        el("div.tv-hero__title", { text: "Résultats 👀" }),
        el("p.tv-sub", { text: "Regardez vos téléphones pour le détail !" }),
        podium ? el("div.tv-h2", { text: "Ordre des buzzers" }) : null,
        podium,
        crownPanel(),
      ]));
    }
    main.replaceChildren(...bits.filter(Boolean));
  }
}

/* ===================== transport spectateur (WS) ====================== */
function spectatorSocket(room, tvId, h) {
  let sock = null;
  let destroyed = false;
  let wantGame = ""; // "" = wildcard (jeu courant) ; sinon jeu spécifique (après goto/watching)
  let reconnectTimer = null;
  let nogameTimer = null;

  function clearTimers() {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    if (nogameTimer) { clearTimeout(nogameTimer); nogameTimer = null; }
  }
  function sendJoin() {
    if (sock && sock.readyState === 1) sock.send(JSON.stringify({ t: "join", spectator: true, room, id: tvId, game: wantGame }));
  }
  function open() {
    if (destroyed) return;
    h.onStatus("🔌 connexion au serveur…");
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    try { sock = new WebSocket(`${proto}//${location.host}/ws`); }
    catch { return scheduleReconnect(); }
    sock.onopen = () => { h.onStatus(""); sendJoin(); };
    sock.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } handle(m); };
    sock.onclose = () => { if (!destroyed) scheduleReconnect(); };
    sock.onerror = () => { try { sock.close(); } catch {} };
  }
  function scheduleReconnect() {
    if (destroyed || reconnectTimer) return;
    h.onStatus("⚡ reconnexion…");
    reconnectTimer = setTimeout(() => { reconnectTimer = null; open(); }, RECONNECT_MS);
  }
  function reconnectNow() {
    // Bascule volontaire (goto) : ferme sans déclencher le retry, rouvre net.
    if (sock) { try { sock.onclose = null; sock.close(); } catch {} }
    sock = null;
    open();
  }
  function handle(m) {
    if (m.t === "watching") { if (nogameTimer) { clearTimeout(nogameTimer); nogameTimer = null; } wantGame = m.game; h.onWatching(m.game); }
    else if (m.t === "full") { destroyed = true; clearTimers(); h.onFull && h.onFull(); } // salon plein : on cesse de réessayer
    else if (m.t === "nogame") {
      wantGame = ""; // re-découvre le jeu courant
      h.onNoGame();
      if (!nogameTimer && !destroyed) nogameTimer = setTimeout(() => { nogameTimer = null; sendJoin(); }, NOGAME_RETRY_MS);
    }
    else if (m.t === "lobby") h.onLobby(m.players || [], m.host || null, m.avatars || {});
    else if (m.t === "round") h.onRound(m.n, m.meta ?? null);
    else if (m.t === "progress") h.onProgress(m.n, m.done || [], m.total || 0);
    else if (m.t === "timer") h.onTimer(m.n, Date.now() + (m.endsAt - m.now));
    else if (m.t === "state") { /* la TV n'affiche pas les états de manche détaillés */ }
    else if (m.t === "revealed") h.onRevealed(m.n, m.order || [], m.names || {}, m.avatars || {}, m.meta ?? null);
    else if (m.t === "ceremony") h.onCeremony(m.top || []);
    else if (m.t === "goto") { wantGame = m.game; h.onGoto(m.game); reconnectNow(); }
  }
  open();
  return {
    destroy() {
      destroyed = true;
      clearTimers();
      if (sock) { try { sock.send(JSON.stringify({ t: "leave" })); } catch {} try { sock.onclose = null; sock.close(); } catch {} }
      sock = null;
    },
  };
}
