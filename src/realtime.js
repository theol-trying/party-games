/* =========================================================================
   REALTIME — multi-appareils « chacun son téléphone ».

   Transport principal : WebSocket maison (/ws, voir ws.js + live.js côté
   serveur) → mises à jour instantanées, rôles privés (chaque téléphone ne
   reçoit QUE le sien), reconnexion automatique.
   Repli automatique : polling du store partagé (Upstash) si le WebSocket est
   indisponible (dev local via serve.ps1, réseau capricieux…).

   API :
   liveSession(stage, {
     gameId, title, minPlayers,
     assign(players) -> { roles:{deviceId: payload}, meta? },  // hôte : prépare la manche
     renderMine(payload, {name, api, meta, n}) -> Node|Node[], // écran privé du joueur
     renderReveal(live, {api}) -> Node,     // live.roles/names/meta/inputs/order
     lobbyExtra?(players) -> Node,          // réglages hôte (niveau, options…)
     onExit?(),                             // sortie propre du salon
     revealLabel?, newRoundLabel?, startLabel?,  // libellés des boutons hôte
   }) -> stop()

   api (passé à renderMine/renderReveal pour les manches interactives) :
     me, isHost(), players(),
     submit(data)      -> envoie ma réponse (l'ordre d'arrivée = buzzer),
     startTimer(sec)   -> hôte : chrono synchronisé pour tous,
     sendState(data)   -> hôte : diffuse un état en cours de manche,
     reveal(), newRound(),
     on("progress"|"state"|"timer", cb)   -> abonnements (remis à zéro à chaque manche)
   Helper exporté : syncCountdown(endsAtClient, {onTick, onEnd}) -> stop()
   ========================================================================= */

import { el, showPhase, announce } from "./ui.js";
import { getData, setData } from "./store.js";
import { currentRoom, setRoom, normalizeCode } from "./room.js";
import { pop, roundCue, jingle } from "./sound.js";
import { qrCanvas } from "./qr.js";
import { GAMES } from "./registry.js";

const DEV_KEY = "soiree.device";
const NAME_KEY = "soiree.name";
const AUTO_KEY = "soiree.autolive"; // « suivre l'hôte » : le prochain jeu ouvre direct son salon
const JOINED_KEY = "soiree.joined"; // déjà connecté cette session : plus de re-saisie du prénom
const LASTGAME_KEY = "soiree.lastgame"; // dernier salon rejoint (bannière « Reprendre » de l'accueil)
// Repli polling (identique à l'ancienne version, volontairement économe).
const HEARTBEAT_MS = 8000;
const POLL_MS = 4000;
const STALE_MS = 25000;
const WS_RECONNECT_MS = 3000;
const WS_MAX_RETRIES = 4;
// En repli polling, on re-tente le WebSocket régulièrement : dès que le serveur
// répond (réveil Render…), TOUS les téléphones convergent dans le salon temps réel.
const WS_UPGRADE_MS = 8000;

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

/** Le jeu qui se charge doit-il ouvrir directement son salon multi ?
    (posé par « Changer de jeu » avant la navigation ; lu par chaque jeu). */
export function peekAutoLive() {
  try { return sessionStorage.getItem(AUTO_KEY) === "1"; } catch { return false; }
}
function consumeAutoLive() {
  const v = peekAutoLive();
  try { sessionStorage.removeItem(AUTO_KEY); } catch {}
  return v;
}
export function requestAutoLive() {
  try { sessionStorage.setItem(AUTO_KEY, "1"); } catch {}
}
const hasJoined = () => { try { return sessionStorage.getItem(JOINED_KEY) === "1"; } catch { return false; } };

/** Salon encore actif cette session ? -> { gameId } pour la bannière
    « Reprendre la partie » de l'accueil (null sinon). */
export function resumeInfo() {
  try {
    if (sessionStorage.getItem(JOINED_KEY) !== "1") return null;
    const gameId = sessionStorage.getItem(LASTGAME_KEY);
    return gameId ? { gameId } : null;
  } catch { return null; }
}
function forgetSession() {
  try { sessionStorage.removeItem(JOINED_KEY); sessionStorage.removeItem(LASTGAME_KEY); } catch {}
}

/** Compte à rebours synchronisé : endsAtClient vient de api.on("timer", …).
    onTick(secondesRestantes) à chaque seconde, onEnd() une seule fois à zéro.
    Renvoie stop() — à appeler quand l'écran est remplacé. */
export function syncCountdown(endsAtClient, { onTick, onEnd }) {
  let stopped = false;
  let ended = false;
  function tick() {
    if (stopped) return;
    const left = Math.max(0, Math.ceil((endsAtClient - Date.now()) / 1000));
    onTick && onTick(left);
    if (left <= 0) {
      if (!ended) { ended = true; onEnd && onEnd(); }
      return;
    }
    timer = setTimeout(tick, 250);
  }
  let timer = setTimeout(tick, 0);
  return () => { stopped = true; clearTimeout(timer); };
}

export function liveSession(stage, {
  gameId, title, minPlayers = 2, assign, renderMine, renderReveal, lobbyExtra, onExit,
  revealLabel = "Révéler les rôles", // libellé du bouton hôte (jeux interactifs : « Révéler les réponses »)
  newRoundLabel = "Nouvelle manche", // libellé « manche suivante » (ex : « Question suivante »)
  startLabel, // libellé du bouton de lancement dans le lobby (défaut : « Distribuer les rôles »)
}) {
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
  let listeners = { progress: [], state: [], timer: [] }; // abonnements de la manche en cours

  function emit(ev, ...args) {
    if (ev === "state") { lastStateData = args[0]; hasLastState = true; } // mémorisé pour les abonnés tardifs
    for (const cb of listeners[ev] || []) {
      try { cb(...args); } catch (e) { console.error(e); }
    }
  }

  // API donnée aux jeux (renderMine) pour les manches synchronisées.
  const api = {
    me,
    isHost: () => host === me,
    players: () => players.slice(),
    submit: (data) => net && net.input(data), // ma réponse (l'ordre d'arrivée sert de buzzer)
    startTimer: (s) => net && net.timer(s), // hôte : chrono synchronisé pour tous
    sendState: (d) => net && net.state(d), // hôte : update diffusé en cours de manche
    reveal: () => net && net.reveal(),
    newRound: () => distribute(),
    on: (ev, cb) => {
      (listeners[ev] || (listeners[ev] = [])).push(cb); // progress | state | timer
      // Un écran (re)rendu APRÈS le dernier state de la manche le rejoue aussitôt :
      // retardataire sur un reveal contesté, retour via « Revenir à la manche »…
      if (ev === "state" && hasLastState) {
        try { cb(lastStateData); } catch (e) { console.error(e); }
      }
    },
  };

  // ⚠️ TOUTE variable `let/const` de session doit être déclarée ICI, avant le
  // `return stop` — plus bas, son initialisation ne s'exécuterait jamais (TDZ).
  let upgradeTimer = null; // sonde de retour au temps réel
  let lastCount = 0; // taille du salon au dernier rendu (son « pop » à l'arrivée)
  let lastStateData = null; // dernier state reçu (rejoué aux abonnés tardifs)
  let hasLastState = false;
  let lastRevealed = null; // dernier reveal reçu (bouton « Revenir » depuis le salon)
  let wakeLock = null; // anti-mise en veille pendant le salon/les manches

  // Au retour au premier plan (téléphone déverrouillé) : reconnexion immédiate
  // au lieu d'attendre les timers de retry, et ré-acquisition du wake lock
  // (libéré automatiquement par le navigateur quand la page est masquée).
  const onVisibility = () => {
    if (stopped || document.visibilityState !== "visible") return;
    acquireWakeLock();
    if (net && net.nudge) net.nudge();
    if (net && net.mode === "poll") tryUpgrade();
  };
  document.addEventListener("visibilitychange", onVisibility);

  // Salon persistant : déjà connecté cette session (ou « suivre l'hôte ») → entrée directe.
  if ((consumeAutoLive() || hasJoined()) && savedName()) {
    myName = savedName();
    connect();
  } else {
    nameScreen();
  }
  return stop;

  function stop() {
    stopped = true;
    document.removeEventListener("visibilitychange", onVisibility);
    if (wakeLock) { try { wakeLock.release(); } catch {} wakeLock = null; }
    if (upgradeTimer) clearTimeout(upgradeTimer);
    if (net) net.destroy();
    net = null;
  }

  // Wake lock d'écran (API native, silencieux si non supporté) : le téléphone
  // posé sur la table — surtout celui de l'hôte — ne se verrouille plus en pleine manche.
  async function acquireWakeLock() {
    if (stopped || wakeLock || !("wakeLock" in navigator)) return;
    try {
      const wl = await navigator.wakeLock.request("screen");
      if (stopped) { try { wl.release(); } catch {} return; }
      wakeLock = wl;
      wl.addEventListener("release", () => { if (wakeLock === wl) wakeLock = null; });
    } catch { wakeLock = null; }
  }

  /* =============================== ÉCRANS =============================== */

  function statusLine() {
    return status ? el("p.screen__subtitle", { text: status, style: "margin-top:10px" }) : null;
  }

  function nameScreen() {
    view = "name";
    const input = el("input.input", { placeholder: "Ton prénom", maxlength: "20", value: savedName() });
    const codeInput = el("input.input", {
      placeholder: "CODE", maxlength: "8", value: currentRoom(),
      autocapitalize: "characters", autocomplete: "off",
      style: "text-transform:uppercase;letter-spacing:.25em;font-weight:800;text-align:center",
      "aria-label": "Code de la soirée",
    });
    const go = el("button.btn.btn--full", {
      text: "Rejoindre la partie",
      style: "margin-top:14px",
      onClick: () => {
        const name = input.value.trim();
        if (!name) return;
        const code = normalizeCode(codeInput.value);
        if (!code) { codeInput.focus(); return; }
        setRoom(code); // rejoint la soirée saisie (ou garde la sienne)
        try { localStorage.setItem(NAME_KEY, name); } catch {}
        myName = name;
        if (net) { try { net.leave(); } catch {} net.destroy(); net = null; } // re-saisie depuis le salon
        connect();
      },
    });
    [input, codeInput].forEach((f) => f.addEventListener("keydown", (e) => { if (e.key === "Enter") go.click(); }));
    showPhase(stage, el("div.card.center", {}, [
      el("h3", { text: "🌐 Multi-appareils" }),
      el("p.screen__subtitle", { text: "Chacun sur son téléphone", style: "margin:6px 0 12px" }),
      input,
      el("p.screen__subtitle", { text: "Code de la soirée — le MÊME pour tous les joueurs :", style: "margin:14px 0 6px" }),
      codeInput,
      go,
    ]));
  }

  function lobbyScreen() {
    if (stopped) return;
    view = "lobby";
    const isHost = host === me;
    const list = players.length
      ? el("div.stack", {}, players.map((p) => el("div.sb-row", {}, [
          el("span", { text: p.name + (p.id === me ? " (toi)" : "") }),
          p.id === host
            ? el("span", { text: "🎬 hôte" })
            : isHost
              ? el("div.row", { style: "gap:6px" }, [
                  el("button.chip", {
                    text: "🎬", title: "Passer la main", "aria-label": `Donner le rôle d'hôte à ${p.name}`,
                    onClick: () => {
                      if (window.confirm(`Donner le rôle d'hôte à ${p.name} ?`)) net && net.host(p.id);
                    },
                  }),
                  el("button.chip", { text: "✕", "aria-label": `Retirer ${p.name} du salon`, onClick: () => net && net.kick(p.id) }),
                ])
              : el("span", { text: "" }),
        ])))
      : el("p.screen__subtitle", { text: "En attente de joueurs…" });
    const extra = isHost && lobbyExtra ? lobbyExtra(players) : null;
    const action = isHost
      ? el("button.btn.btn--full", { text: `${startLabel || "Distribuer les rôles"} (${players.length})`, disabled: players.length < minPlayers, onClick: distribute })
      : el("p.screen__subtitle", { text: "L'hôte lancera la partie." });
    // Une manche est en cours ? Chemin de retour (sinon un joueur revenu au
    // salon restait coincé jusqu'à la manche suivante).
    const backToRound = round && shownRound === round.n
      ? el("button.btn.btn--full.btn--ghost", {
          text: shownReveal ? "▶ Revoir la révélation" : "▶ Revenir à la manche en cours",
          style: "margin-top:10px",
          onClick: () => { if (shownReveal && lastRevealed) revealScreen(lastRevealed); else roleScreen(); },
        })
      : null;
    // QR d'invitation : scanner = rejoindre la soirée (généré en local, zéro réseau).
    let qr = null;
    try {
      qr = qrCanvas(`${location.origin}${location.pathname}#/r/${currentRoom()}`, { scale: 3 });
      qr.style.cssText = "display:block;margin:0 auto 10px;border-radius:10px;max-width:140px";
      qr.setAttribute("aria-label", "QR code d'invitation à la soirée");
    } catch {}
    showPhase(stage, el("div.card.center", {}, [
      el("h3", { text: title }),
      el("p.screen__subtitle", { text: `Code soirée : ${currentRoom()}`, style: "margin:4px 0 8px" }),
      qr,
      el("button.chip", { text: "🔗 Partager le lien", onClick: share, style: "margin-bottom:10px" }),
      list,
      extra,
      el("div", { style: "margin-top:14px" }, [action, backToRound]),
      el("div.row", { style: "justify-content:center;margin-top:12px" }, [
        isHost ? el("button.chip", { text: "🎮 Changer de jeu", onClick: switchScreen }) : null,
        el("button.chip", { text: "👤 Prénom / code", onClick: nameScreen }),
        el("button.chip", { text: "🚪 Quitter", onClick: leave }),
      ]),
      statusLine(),
    ]));
  }

  // L'hôte choisit un autre jeu : toute la soirée y est emmenée (message goto).
  function switchScreen() {
    view = "switch";
    const choices = GAMES.filter((g) => g.id !== gameId && g.id !== "blind-test"); // blind test : playlist DJ à préparer
    showPhase(stage, el("div.card.center", {}, [
      el("h3", { text: "🎮 Changer de jeu" }),
      el("p.screen__subtitle", { text: "Tous les téléphones du salon suivront automatiquement.", style: "margin:6px 0 12px" }),
      el("div.stack", {}, choices.map((g) =>
        el("button.btn.btn--ghost.btn--full", { text: `${g.emoji ? g.emoji + " " : ""}${g.title}`, style: "margin-top:8px", onClick: () => net && net.goto(g.id) })
      )),
      el("button.chip", { text: "← Retour au salon", style: "margin-top:14px", onClick: lobbyScreen }),
    ]));
  }

  function roleScreen() {
    if (stopped || !round) return;
    view = "role";
    const body = round.you != null
      ? renderMine(round.you, { name: myName, api, meta: round.meta, n: round.n })
      : el("p", { text: "Tu as rejoint après la distribution — attends la prochaine manche." });
    const actions = [];
    if (host === me) {
      actions.push(el("button.btn.btn--full", { text: revealLabel, onClick: () => net && net.reveal() }));
      actions.push(el("button.btn.btn--full.btn--ghost", { text: newRoundLabel, style: "margin-top:10px", onClick: distribute }));
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
    if (host === me) actions.push(el("button.btn.btn--full", { text: newRoundLabel, onClick: distribute }));
    actions.push(el("button.btn.btn--ghost.btn--full", { text: "Retour au salon", style: "margin-top:10px", onClick: lobbyScreen }));
    showPhase(stage, el("div.card.center", {}, [
      // n : identité de manche stable → les jeux keyent leurs FX dessus (une seule
      // salve par manche, pas de re-tir à « Revoir la révélation »).
      renderReveal(revealed, { api, n: revealed && revealed.n }),
      el("div", { style: "margin-top:16px" }, actions),
      statusLine(),
    ]));
  }

  async function share() {
    const code = currentRoom();
    const link = `${location.origin}${location.pathname}#/r/${code}`;
    if (navigator.share) {
      try { await navigator.share({ title: "Soirée 🎉", text: `Rejoins ma soirée — code ${code}`, url: link }); return; } catch {}
    }
    try { await navigator.clipboard.writeText(link); announce("Lien copié"); }
    catch { window.prompt("Copie ce lien pour inviter :", link); }
  }

  function distribute() {
    if (!net || players.length < minPlayers) return;
    const { roles, meta, open } = assign(players.map((p) => ({ id: p.id, name: p.name })));
    net.start(roles, meta, open === true);
  }

  function leave() {
    if (net) net.leave();
    forgetSession(); // départ volontaire : plus de bannière « Reprendre » ni d'entrée directe
    stop();
    onExit && onExit();
  }

  /* ========================= ÉVÉNEMENTS RÉSEAU ========================= */

  function onLobby(list, hostId) {
    if (view === "lobby" && list.length > lastCount && lastCount > 0) pop(); // un joueur arrive
    lastCount = list.length;
    players = list;
    host = hostId;
    if (view === "lobby" || view === "name") lobbyScreen();
  }
  function onRound(n, you, names, meta) {
    round = { n, you, names, meta };
    if (n !== shownRound) {
      shownRound = n;
      shownReveal = false;
      listeners = { progress: [], state: [], timer: [] }; // nouvelle manche : abonnements frais
      lastStateData = null;
      hasLastState = false;
      lastRevealed = null;
      roundCue();
      roleScreen();
    }
  }
  function onRevealed(n, roles, names, meta, inputs, order) {
    if (shownReveal && n === shownRound) return;
    shownReveal = true;
    shownRound = n;
    lastRevealed = { n, roles, names, meta, inputs: inputs || {}, order: order || [] };
    jingle();
    revealScreen(lastRevealed);
  }
  // L'hôte a choisi un autre jeu : on suit (le jeu cible ouvrira direct son salon).
  function onGoto(game) {
    if (stopped || !game || game === gameId) return;
    requestAutoLive();
    stop();
    announce("Changement de jeu !");
    location.hash = "#/jeu/" + game;
  }
  // L'hôte nous a retirés du salon : arrêt propre + écran d'information.
  function onKicked() {
    if (stopped) return;
    forgetSession();
    stop();
    announce("Tu as été retiré du salon");
    showPhase(stage, el("div.card.center", {}, [
      el("h3", { text: "🚪 Retiré du salon" }),
      el("p.screen__subtitle", { text: "L'hôte t'a retiré de la partie.", style: "margin:8px 0 14px" }),
      el("button.btn.btn--full", { text: "OK", onClick: () => { onExit && onExit(); } }),
    ]));
  }

  /* ============================ TRANSPORTS ============================= */

  function connect() {
    // WebSocket d'abord ; en cas d'échec → repli polling + retour auto au temps réel.
    try {
      sessionStorage.setItem(JOINED_KEY, "1"); // salon persistant inter-jeux
      sessionStorage.setItem(LASTGAME_KEY, gameId); // bannière « Reprendre » de l'accueil
    } catch {}
    status = "🔌 connexion au serveur…";
    acquireWakeLock();
    net = wsTransport({ onFail: fallbackToPoll });
    lobbyScreen();
  }

  function fallbackToPoll() {
    if (stopped) return;
    status = "☕ serveur en train de se réveiller ou réseau lent — la partie continue en mode compatible, retour au temps réel dès que possible…";
    net = pollTransport();
    if (view === "lobby") lobbyScreen();
    scheduleUpgrade();
  }

  function scheduleUpgrade() {
    if (upgradeTimer) clearTimeout(upgradeTimer);
    if (stopped) return;
    upgradeTimer = setTimeout(tryUpgrade, WS_UPGRADE_MS);
  }

  // Depuis le repli polling : sonde le WebSocket ; s'il répond, on bascule
  // (quitte le salon polling, rejoint le salon temps réel avec le même socket).
  function tryUpgrade() {
    if (stopped || !net || net.mode !== "poll") return;
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    let probe;
    try { probe = new WebSocket(`${proto}//${location.host}/ws`); } catch { return scheduleUpgrade(); }
    const abort = setTimeout(() => { try { probe.close(); } catch {} }, 5000);
    probe.onopen = () => {
      clearTimeout(abort);
      if (stopped || !net || net.mode !== "poll") { try { probe.close(); } catch {} return; }
      const old = net;
      try { old.leave(); } catch {}
      old.destroy();
      net = wsTransport({ onFail: fallbackToPoll, adopt: probe });
    };
    probe.onclose = () => { clearTimeout(abort); if (!stopped && net && net.mode === "poll") scheduleUpgrade(); };
    probe.onerror = () => { try { probe.close(); } catch {} };
  }

  function wsTransport({ onFail, adopt = null }) {
    let sock = null;
    let opened = false;
    let retries = 0;
    let destroyed = false;
    let reconnectTimer = null;

    function onOpen() {
      opened = true;
      retries = 0;
      status = "⚡ temps réel";
      if (view === "lobby") lobbyScreen();
      sock.send(JSON.stringify({ t: "join", room: currentRoom(), game: gameId, id: me, name: myName }));
    }

    function open() {
      const proto = location.protocol === "https:" ? "wss:" : "ws:";
      try {
        sock = new WebSocket(`${proto}//${location.host}/ws`);
      } catch {
        return onFail();
      }
      wire();
    }

    function wire() {
      sock.onopen = onOpen;
      sock.onmessage = (e) => {
        let m;
        try { m = JSON.parse(e.data); } catch { return; }
        if (m.t === "lobby") onLobby(m.players || [], m.host || null);
        else if (m.t === "round") onRound(m.n, m.you, m.names || {}, m.meta ?? null);
        else if (m.t === "progress") { if (round && m.n === round.n) emit("progress", m.done || [], m.total || 0, m.inputs || null); }
        else if (m.t === "timer") {
          // Convertit l'échéance serveur en horloge locale (compense l'offset).
          if (round && m.n === round.n) emit("timer", Date.now() + (m.endsAt - m.now));
        }
        else if (m.t === "state") { if (round && m.n === round.n) emit("state", m.data ?? null); }
        else if (m.t === "goto") onGoto(m.game);
        else if (m.t === "kicked") onKicked();
        else if (m.t === "revealed") onRevealed(m.n, m.roles || {}, m.names || {}, m.meta ?? null, m.inputs, m.order);
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

    if (adopt) { sock = adopt; wire(); onOpen(); } else open();

    const sendJson = (o) => { if (sock && sock.readyState === 1) sock.send(JSON.stringify(o)); };
    return {
      mode: "ws",
      start(roles, meta, open) { sendJson({ t: "start", roles, meta, open: open === true }); },
      input(data) { sendJson({ t: "input", data }); },
      timer(seconds) { sendJson({ t: "timer", seconds }); },
      state(data) { sendJson({ t: "state", data }); },
      goto(game) { sendJson({ t: "goto", game }); },
      kick(id) { sendJson({ t: "kick", id }); },
      host(id) { sendJson({ t: "host", id }); },
      reveal() { sendJson({ t: "reveal" }); },
      leave() { sendJson({ t: "leave" }); },
      // Retour au premier plan : si le socket est fermé, on se reconnecte tout
      // de suite au lieu d'attendre le timer de retry (reprise < 500 ms).
      nudge() {
        if (destroyed) return;
        if (sock && sock.readyState <= 1) return; // déjà ouvert ou en cours de connexion
        if (reconnectTimer) clearTimeout(reconnectTimer);
        retries = Math.min(retries, WS_MAX_RETRIES - 1);
        status = "⚡ reconnexion…";
        open();
      },
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
      // Éjecté par l'hôte ? On s'arrête AVANT de se réinscrire.
      const kick = l.__kick || {};
      if (kick[me] && now - kick[me] < 60000) return onKicked();
      for (const k of Object.keys(kick)) if (now - kick[k] > 60000) delete kick[k]; // amnistie
      // Purge des joueurs muets (les clés techniques __ sont préservées).
      for (const k of Object.keys(l)) {
        if (k.startsWith("__")) continue;
        if (now - ((l[k] && l[k].ts) || 0) > STALE_MS) delete l[k];
      }
      l[me] = { name: myName, ts: now, since: (l[me] && l[me].since) || now };
      await setData(LOBBY, l);
      // Hôte = transfert volontaire (__host) s'il est encore là, sinon le plus
      // ancien joueur présent (parité avec le serveur WS : premier arrivé).
      const ids = Object.keys(l).filter((k) => !k.startsWith("__"));
      ids.sort((a, b) => (((l[a] && l[a].since) || 0) - ((l[b] && l[b].since) || 0)) || (a < b ? -1 : 1));
      const hostPick = l.__host && ids.includes(l.__host) ? l.__host : ids[0] || null;
      onLobby(ids.map((id) => ({ id, name: l[id].name })), hostPick);
    }

    let seenOrder = 0;
    let seenTimer = 0;
    let seenState = "";
    let seenGoto; // undefined = pas encore lu (ignore une valeur périmée d'une partie passée)

    async function poll() {
      if (destroyed || stopped) return;
      const live = await getData(LIVE, null);
      // Garde goto AVANT le retour anticipé : une clé absente compte comme
      // initialisation (sinon le premier goto légitime serait avalé).
      const g = (live && live.gotoGame) || null;
      if (seenGoto === undefined) seenGoto = g;
      else if (g && g !== seenGoto) { seenGoto = g; return onGoto(g); }
      if (!live) return;
      if (typeof live.round === "number" && live.round !== shownRound) {
        seenOrder = 0; seenTimer = 0; seenState = "";
        onRound(live.round, (live.roles || {})[me] ?? null, live.names || {}, live.meta ?? null);
      }
      const order = live.order || [];
      // En mode open, une re-soumission change les inputs sans changer l'ordre :
      // on compare une signature complète pour ne rien rater.
      const sig = order.length + (live.open ? "|" + JSON.stringify(live.inputs || {}) : "");
      if (sig !== seenOrder) {
        seenOrder = sig;
        emit("progress", order, players.length || Object.keys(live.names || {}).length, live.open ? live.inputs || {} : null);
      }
      if (live.timerEndsAt && live.timerEndsAt !== seenTimer) {
        seenTimer = live.timerEndsAt;
        emit("timer", live.timerEndsAt); // horloges clients supposées proches (mode dégradé)
      }
      const st = JSON.stringify(live.state ?? null);
      if (st !== seenState) {
        seenState = st;
        if (live.state !== undefined && live.state !== null) emit("state", live.state);
      }
      if (live.revealed) onRevealed(live.round, live.roles || {}, live.names || {}, live.meta ?? null, live.inputs, live.order);
    }

    beat();
    poll();
    hbTimer = setInterval(beat, HEARTBEAT_MS);
    pollTimer = setInterval(poll, POLL_MS);

    return {
      mode: "poll",
      async start(roles, meta, open) {
        const prev = (await getData(LIVE, null)) || { round: 0 };
        const names = {};
        players.forEach((p) => (names[p.id] = p.name));
        await setData(LIVE, {
          round: (prev.round || 0) + 1, roles, names, meta: meta ?? null,
          revealed: false, inputs: {}, order: [], state: null, timerEndsAt: null,
          open: open === true,
        });
        poll();
      },
      async input(data) {
        // Lecture-modification-écriture : suffisant pour le mode dégradé.
        const live = (await getData(LIVE, null)) || {};
        live.inputs = live.inputs || {};
        live.order = live.order || [];
        if (!(me in live.inputs)) live.order.push(me);
        live.inputs[me] = data === undefined ? true : data;
        await setData(LIVE, live);
        poll();
      },
      async timer(seconds) {
        const live = (await getData(LIVE, null)) || {};
        live.timerEndsAt = Date.now() + Math.max(1, seconds) * 1000;
        await setData(LIVE, live);
        poll();
      },
      async state(data) {
        const live = (await getData(LIVE, null)) || {};
        live.state = data ?? null;
        await setData(LIVE, live);
        poll();
      },
      async goto(game) {
        const live = (await getData(LIVE, null)) || {};
        live.gotoGame = game;
        live.gotoTs = Date.now();
        await setData(LIVE, live);
        poll();
      },
      async kick(id) {
        const l = (await getData(LOBBY, {})) || {};
        delete l[id];
        l.__kick = l.__kick || {};
        l.__kick[id] = Date.now();
        await setData(LOBBY, l);
        beat();
      },
      async host(id) {
        const l = (await getData(LOBBY, {})) || {};
        l.__host = id; // transfert volontaire, lu par tous les beats
        await setData(LOBBY, l);
        beat();
      },
      // Retour au premier plan : resynchronisation immédiate (les intervalles
      // ont pu être gelés par le navigateur pendant la mise en veille).
      nudge() {
        if (destroyed || stopped) return;
        beat();
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
