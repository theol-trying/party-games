/* =========================================================================
   REALTIME — multi-appareils « temps réel » par polling du stockage partagé.

   Pas de WebSocket : on s'appuie sur store.js (Upstash, room-scopé). Chaque
   téléphone maintient une présence (heartbeat) dans un lobby, l'hôte (plus petit
   deviceId présent) distribue les rôles, et chaque appareil lit LE SIEN.

   liveSession(stage, {
     gameId, title, minPlayers,
     assign(players) -> { roles:{deviceId: payload}, meta? },
     renderMine(payload, {name}) -> Node|Node[],
     renderReveal(live) -> Node,           // live.roles / live.names
   }) -> stop()   // à appeler dans le cleanup du jeu (stoppe les timers)

   ⚠️ Le heartbeat génère des écritures régulières : intervalles volontairement
   larges pour ménager le quota Upstash.
   ========================================================================= */

import { el, showPhase, announce } from "./ui.js";
import { getData, setData } from "./store.js";
import { currentRoom } from "./room.js";

const DEV_KEY = "soiree.device";
const NAME_KEY = "soiree.name";
const HEARTBEAT_MS = 8000;
const POLL_MS = 4000;
const STALE_MS = 25000;

export function deviceId() {
  let id = null;
  try { id = localStorage.getItem(DEV_KEY); } catch {}
  if (!id) { id = "d" + Math.random().toString(36).slice(2, 9); try { localStorage.setItem(DEV_KEY, id); } catch {} }
  return id;
}
const savedName = () => { try { return localStorage.getItem(NAME_KEY) || ""; } catch { return ""; } };

export function liveSession(stage, { gameId, title, minPlayers = 2, assign, renderMine, renderReveal, lobbyExtra, onExit }) {
  const me = deviceId();
  const LOBBY = "lobby:" + gameId;
  const LIVE = "live:" + gameId;
  let hbTimer = null, pollTimer = null, stopped = false;
  let lobby = {};
  let shownRound = -1, shownReveal = false, view = "name";

  nameScreen();
  return stop;

  function stop() {
    stopped = true;
    if (hbTimer) clearInterval(hbTimer);
    if (pollTimer) clearInterval(pollTimer);
  }

  // Quitte proprement : retire sa présence du salon (sinon elle expire en ~25 s).
  async function leave() {
    stop();
    const l = (await getData(LOBBY, {})) || {};
    delete l[me];
    await setData(LOBBY, l);
    onExit && onExit();
  }

  function nameScreen() {
    view = "name";
    const input = el("input.input", { placeholder: "Ton prénom", maxlength: "20", value: savedName() });
    const go = el("button.btn.btn--full", { text: "Rejoindre la partie", style: "margin-top:12px", onClick: () => {
      const name = input.value.trim();
      if (!name) return;
      try { localStorage.setItem(NAME_KEY, name); } catch {}
      startPresence(name);
    } });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") go.click(); });
    showPhase(stage, el("div.card.center", {}, [
      el("h3", { text: "🌐 Multi-appareils" }),
      el("p.screen__subtitle", { text: `Soirée ${currentRoom()} · chacun sur son téléphone`, style: "margin:6px 0 12px" }),
      input, go,
    ]));
  }

  function startPresence(name) {
    beat(name);
    hbTimer = setInterval(() => beat(name), HEARTBEAT_MS);
    pollTimer = setInterval(pollLive, POLL_MS);
    pollLive();
    lobbyScreen();
  }

  async function beat(name) {
    if (stopped) return;
    const now = Date.now();
    const l = (await getData(LOBBY, {})) || {};
    for (const k of Object.keys(l)) if (now - (l[k] && l[k].ts || 0) > STALE_MS) delete l[k];
    l[me] = { name, ts: now };
    lobby = l;
    await setData(LOBBY, l);
    if (view === "lobby") lobbyScreen();
  }

  function playersList() { return Object.keys(lobby).sort().map((id) => ({ id, name: lobby[id].name })); }
  function hostId() { return Object.keys(lobby).sort()[0]; }
  function isHost() { return hostId() === me; }

  function lobbyScreen() {
    view = "lobby";
    const ps = playersList();
    const list = ps.length
      ? el("div.stack", {}, ps.map((p) => el("div.sb-row", {}, [
          el("span", { text: p.name + (p.id === me ? " (toi)" : "") }),
          el("span", { text: p.id === hostId() ? "🎬 hôte" : "" }),
        ])))
      : el("p.screen__subtitle", { text: "En attente de joueurs…" });
    const action = isHost()
      ? el("button.btn.btn--full", { text: `Distribuer les rôles (${ps.length})`, disabled: ps.length < minPlayers, onClick: distribute })
      : el("p.screen__subtitle", { text: "L'hôte lancera la distribution." });
    // Réglages spécifiques au jeu, visibles par l'hôte uniquement.
    const extra = isHost() && lobbyExtra ? lobbyExtra(ps) : null;
    showPhase(stage, el("div.card.center", {}, [
      el("h3", { text: title }),
      el("p.screen__subtitle", { text: `Code soirée : ${currentRoom()}`, style: "margin:4px 0 8px" }),
      el("button.chip", { text: "🔗 Partager le lien", onClick: share, style: "margin-bottom:10px" }),
      list,
      extra,
      el("div", { style: "margin-top:14px" }, [action]),
      el("button.chip", { text: "🚪 Quitter le salon", style: "margin-top:12px", onClick: leave }),
    ]));
  }

  async function share() {
    const link = `${location.origin}${location.pathname}#/r/${currentRoom()}`;
    try { await navigator.clipboard.writeText(link); announce("Lien copié"); } catch {}
  }

  async function distribute() {
    const ps = playersList();
    if (ps.length < minPlayers) return;
    const prev = (await getData(LIVE, null)) || { round: 0 };
    const { roles, meta } = assign(ps);
    const names = {};
    ps.forEach((p) => (names[p.id] = p.name));
    await setData(LIVE, { round: (prev.round || 0) + 1, roles, names, meta: meta || null, revealed: false });
    pollLive();
  }

  async function pollLive() {
    if (stopped) return;
    const live = await getData(LIVE, null);
    if (!live) return;
    if (live.round !== shownRound) {
      shownRound = live.round;
      shownReveal = false;
      roleScreen(live);
    } else if (live.revealed && !shownReveal) {
      shownReveal = true;
      revealScreen(live);
    }
  }

  function roleScreen(live) {
    view = "role";
    const mine = live.roles && live.roles[me];
    const body = mine ? renderMine(mine, { name: lobby[me] && lobby[me].name }) : el("p", { text: "Tu as rejoint après la distribution — attends la prochaine manche." });
    const actions = [];
    if (isHost()) {
      actions.push(el("button.btn.btn--full", { text: "Révéler les rôles", onClick: revealNow }));
      actions.push(el("button.btn.btn--full.btn--ghost", { text: "Nouvelle manche", style: "margin-top:10px", onClick: distribute }));
    }
    actions.push(el("button.btn.btn--ghost.btn--full", { text: "Retour au salon", style: "margin-top:10px", onClick: () => { shownRound = live.round; lobbyScreen(); } }));
    showPhase(stage, el("div.card.center", {}, [Array.isArray(body) ? el("div", {}, body) : body, el("div", { style: "margin-top:16px" }, actions)]));
  }

  async function revealNow() {
    const live = (await getData(LIVE, null)) || {};
    live.revealed = true;
    await setData(LIVE, live);
    pollLive();
  }
  function revealScreen(live) {
    view = "reveal";
    const actions = [];
    if (isHost()) actions.push(el("button.btn.btn--full", { text: "Nouvelle manche", onClick: distribute }));
    actions.push(el("button.btn.btn--ghost.btn--full", { text: "Retour au salon", style: "margin-top:10px", onClick: () => { shownRound = live.round; shownReveal = true; lobbyScreen(); } }));
    showPhase(stage, el("div.card.center", {}, [renderReveal(live), el("div", { style: "margin-top:16px" }, actions)]));
  }
}
