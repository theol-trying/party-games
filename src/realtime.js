/* =========================================================================
   REALTIME — multi-appareils « chacun son téléphone ».

   Transport principal : WebSocket maison (/ws, voir ws.js + live.js côté
   serveur) → mises à jour instantanées, rôles privés (chaque téléphone ne
   reçoit QUE le sien), reconnexion automatique.
   Repli automatique : polling du store partagé (Upstash) si le WebSocket est
   indisponible (dev local via serve.ps1, réseau capricieux…).

   API (inchangée pour les jeux) :
   liveSession(stage, {
     gameId, title, minPlayers,
     assign(players) -> { roles:{deviceId: payload}, meta? },
     renderMine(payload, {name}) -> Node|Node[],
     renderReveal(live) -> Node,           // live.roles / live.names / live.meta
     lobbyExtra?(players) -> Node,         // réglages hôte
     onExit?()                             // sortie propre du salon
   }) -> stop()
   ========================================================================= */

import { el, showPhase, announce } from "./ui.js";
import { getData, setData } from "./store.js";
import { currentRoom } from "./room.js";

const DEV_KEY = "soiree.device";
const NAME_KEY = "soiree.name";
// Repli polling (identique à l'ancienne version, volontairement économe).
const HEARTBEAT_MS = 8000;
const POLL_MS = 4000;
const STALE_MS = 25000;
const WS_RECONNECT_MS = 3000;
const WS_MAX_RETRIES = 4;

export function deviceId() {
  let id = null;
  try { id = localStorage.getItem(DEV_KEY); } catch {}
  if (!id) {
    id = "d" + Math.random().toString(36).slice(2, 9);
    try { localStorage.setItem(DEV_KEY, id); } catch {}
  }
  return id;
}
const savedName = () => { try { return localStorage.getItem(NAME_KEY) || ""; } catch { return ""; } };

export function liveSession(stage, { gameId, title, minPlayers = 2, assign, renderMine, renderReveal, lobbyExtra, onExit }) {
  const me = deviceId();
  let stopped = false;
  let myName = "";
  let net = null; // transport actif : { mode, start, reveal, leave, destroy }

  // État partagé rendu par les écrans.
  let players = []; // [{id, name}]
  let host = null;
  let round = null; // { n, you, names, meta }
  let shownRound = -1;
  let shownReveal = false;
  let view = "name";
  let status = ""; // ⚡ / 🐢 / reconnexion…

  nameScreen();
  return stop;

  function stop() {
    stopped = true;
    if (net) net.destroy();
    net = null;
  }

  /* =============================== ÉCRANS =============================== */

  function statusLine() {
    return status ? el("p.screen__subtitle", { text: status, style: "margin-top:10px" }) : null;
  }

  function nameScreen() {
    view = "name";
    const input = el("input.input", { placeholder: "Ton prénom", maxlength: "20", value: savedName() });
    const go = el("button.btn.btn--full", {
      text: "Rejoindre la partie",
      style: "margin-top:12px",
      onClick: () => {
        const name = input.value.trim();
        if (!name) return;
        try { localStorage.setItem(NAME_KEY, name); } catch {}
        myName = name;
        connect();
      },
    });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") go.click(); });
    showPhase(stage, el("div.card.center", {}, [
      el("h3", { text: "🌐 Multi-appareils" }),
      el("p.screen__subtitle", { text: `Soirée ${currentRoom()} · chacun sur son téléphone`, style: "margin:6px 0 12px" }),
      input, go,
    ]));
  }

  function lobbyScreen() {
    if (stopped) return;
    view = "lobby";
    const list = players.length
      ? el("div.stack", {}, players.map((p) => el("div.sb-row", {}, [
          el("span", { text: p.name + (p.id === me ? " (toi)" : "") }),
          el("span", { text: p.id === host ? "🎬 hôte" : "" }),
        ])))
      : el("p.screen__subtitle", { text: "En attente de joueurs…" });
    const isHost = host === me;
    const extra = isHost && lobbyExtra ? lobbyExtra(players) : null;
    const action = isHost
      ? el("button.btn.btn--full", { text: `Distribuer les rôles (${players.length})`, disabled: players.length < minPlayers, onClick: distribute })
      : el("p.screen__subtitle", { text: "L'hôte lancera la distribution." });
    showPhase(stage, el("div.card.center", {}, [
      el("h3", { text: title }),
      el("p.screen__subtitle", { text: `Code soirée : ${currentRoom()}`, style: "margin:4px 0 8px" }),
      el("button.chip", { text: "🔗 Partager le lien", onClick: share, style: "margin-bottom:10px" }),
      list,
      extra,
      el("div", { style: "margin-top:14px" }, [action]),
      el("button.chip", { text: "🚪 Quitter le salon", style: "margin-top:12px", onClick: leave }),
      statusLine(),
    ]));
  }

  function roleScreen() {
    if (stopped || !round) return;
    view = "role";
    const body = round.you != null
      ? renderMine(round.you, { name: myName })
      : el("p", { text: "Tu as rejoint après la distribution — attends la prochaine manche." });
    const actions = [];
    if (host === me) {
      actions.push(el("button.btn.btn--full", { text: "Révéler les rôles", onClick: () => net && net.reveal() }));
      actions.push(el("button.btn.btn--full.btn--ghost", { text: "Nouvelle manche", style: "margin-top:10px", onClick: distribute }));
    }
    actions.push(el("button.btn.btn--ghost.btn--full", { text: "Retour au salon", style: "margin-top:10px", onClick: lobbyScreen }));
    showPhase(stage, el("div.card.center", {}, [
      Array.isArray(body) ? el("div", {}, body) : body,
      el("div", { style: "margin-top:16px" }, actions),
      statusLine(),
    ]));
  }

  function revealScreen(revealed) {
    if (stopped) return;
    view = "reveal";
    const actions = [];
    if (host === me) actions.push(el("button.btn.btn--full", { text: "Nouvelle manche", onClick: distribute }));
    actions.push(el("button.btn.btn--ghost.btn--full", { text: "Retour au salon", style: "margin-top:10px", onClick: lobbyScreen }));
    showPhase(stage, el("div.card.center", {}, [
      renderReveal(revealed),
      el("div", { style: "margin-top:16px" }, actions),
      statusLine(),
    ]));
  }

  async function share() {
    const link = `${location.origin}${location.pathname}#/r/${currentRoom()}`;
    try { await navigator.clipboard.writeText(link); announce("Lien copié"); } catch {}
  }

  function distribute() {
    if (!net || players.length < minPlayers) return;
    const { roles, meta } = assign(players.map((p) => ({ id: p.id, name: p.name })));
    net.start(roles, meta);
  }

  function leave() {
    if (net) net.leave();
    stop();
    onExit && onExit();
  }

  /* ========================= ÉVÉNEMENTS RÉSEAU ========================= */

  function onLobby(list, hostId) {
    players = list;
    host = hostId;
    if (view === "lobby" || view === "name") lobbyScreen();
  }
  function onRound(n, you, names, meta) {
    round = { n, you, names, meta };
    if (n !== shownRound) {
      shownRound = n;
      shownReveal = false;
      roleScreen();
    }
  }
  function onRevealed(n, roles, names, meta) {
    if (shownReveal && n === shownRound) return;
    shownReveal = true;
    shownRound = n;
    revealScreen({ roles, names, meta });
  }

  /* ============================ TRANSPORTS ============================= */

  function connect() {
    // WebSocket d'abord ; en cas d'échec initial → repli polling.
    net = wsTransport({
      onFail: () => {
        if (stopped) return;
        status = "🐢 mode compatible (sans temps réel)";
        net = pollTransport();
      },
    });
    lobbyScreen();
  }

  function wsTransport({ onFail }) {
    let sock = null;
    let opened = false;
    let retries = 0;
    let destroyed = false;
    let reconnectTimer = null;

    function open() {
      const proto = location.protocol === "https:" ? "wss:" : "ws:";
      try {
        sock = new WebSocket(`${proto}//${location.host}/ws`);
      } catch {
        return onFail();
      }
      sock.onopen = () => {
        opened = true;
        retries = 0;
        status = "⚡ temps réel";
        sock.send(JSON.stringify({ t: "join", room: currentRoom(), game: gameId, id: me, name: myName }));
      };
      sock.onmessage = (e) => {
        let m;
        try { m = JSON.parse(e.data); } catch { return; }
        if (m.t === "lobby") onLobby(m.players || [], m.host || null);
        else if (m.t === "round") onRound(m.n, m.you, m.names || {}, m.meta ?? null);
        else if (m.t === "revealed") onRevealed(m.n, m.roles || {}, m.names || {}, m.meta ?? null);
      };
      sock.onclose = () => {
        if (destroyed) return;
        if (!opened && retries === 0) return onFail(); // jamais connecté → repli immédiat
        if (retries >= WS_MAX_RETRIES) return onFail();
        retries++;
        status = `⚡ reconnexion… (${retries}/${WS_MAX_RETRIES})`;
        if (view === "lobby") lobbyScreen();
        reconnectTimer = setTimeout(open, WS_RECONNECT_MS);
      };
      sock.onerror = () => { try { sock.close(); } catch {} };
    }
    open();

    return {
      mode: "ws",
      start(roles, meta) { if (sock && sock.readyState === 1) sock.send(JSON.stringify({ t: "start", roles, meta })); },
      reveal() { if (sock && sock.readyState === 1) sock.send(JSON.stringify({ t: "reveal" })); },
      leave() { if (sock && sock.readyState === 1) sock.send(JSON.stringify({ t: "leave" })); },
      destroy() {
        destroyed = true;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        try { sock && sock.close(); } catch {}
      },
    };
  }

  function pollTransport() {
    const LOBBY = "lobby:" + gameId;
    const LIVE = "live:" + gameId;
    let hbTimer = null;
    let pollTimer = null;
    let destroyed = false;

    async function beat() {
      if (destroyed || stopped) return;
      const now = Date.now();
      const l = (await getData(LOBBY, {})) || {};
      for (const k of Object.keys(l)) if (now - ((l[k] && l[k].ts) || 0) > STALE_MS) delete l[k];
      l[me] = { name: myName, ts: now };
      await setData(LOBBY, l);
      const list = Object.keys(l).sort().map((id) => ({ id, name: l[id].name }));
      onLobby(list, Object.keys(l).sort()[0] || null);
    }

    async function poll() {
      if (destroyed || stopped) return;
      const live = await getData(LIVE, null);
      if (!live) return;
      if (live.round !== shownRound) onRound(live.round, (live.roles || {})[me] ?? null, live.names || {}, live.meta ?? null);
      if (live.revealed) onRevealed(live.round, live.roles || {}, live.names || {}, live.meta ?? null);
    }

    beat();
    poll();
    hbTimer = setInterval(beat, HEARTBEAT_MS);
    pollTimer = setInterval(poll, POLL_MS);

    return {
      mode: "poll",
      async start(roles, meta) {
        const prev = (await getData(LIVE, null)) || { round: 0 };
        const names = {};
        players.forEach((p) => (names[p.id] = p.name));
        await setData(LIVE, { round: (prev.round || 0) + 1, roles, names, meta: meta ?? null, revealed: false });
        poll();
      },
      async reveal() {
        const live = (await getData(LIVE, null)) || {};
        live.revealed = true;
        await setData(LIVE, live);
        poll();
      },
      async leave() {
        const l = (await getData(LOBBY, {})) || {};
        delete l[me];
        await setData(LOBBY, l);
      },
      destroy() {
        destroyed = true;
        if (hbTimer) clearInterval(hbTimer);
        if (pollTimer) clearInterval(pollTimer);
      },
    };
  }
}
