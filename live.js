/* =========================================================================
   LIVE — salons multi-appareils en mémoire (source de vérité côté serveur).

   Un salon = un couple (code de soirée, jeu). Protocole JSON :
   Client → serveur :
     { t:"join", room, game, id, name, avatar? }
     { t:"start", roles:{deviceId:payload}, meta?, open? }  (hôte ; open=true →
                       les inputs sont diffusés en cours de manche via progress)
     { t:"input", data }                               (réponse du joueur, manche en cours)
     { t:"timer", seconds }                            (hôte : chrono synchronisé)
     { t:"state", data }                               (hôte : update diffusé en cours de manche,
                                                        mémorisé pour resynchroniser les reconnectés)
     { t:"goto", game }                                (hôte : toute la soirée change de jeu)
     { t:"kick", id }                                  (hôte : éjecte un joueur du salon)
     { t:"host", id }                                  (hôte : passe la main à un autre joueur)
     { t:"ceremony", top }                             (hôte : cérémonie du Roi jouée en même temps partout)
     { t:"reveal" }                                    (hôte uniquement)
     { t:"leave" }
   Serveur → client :
     { t:"lobby", players:[{id,name,avatar}], host, avatars }
     { t:"round", n, you, names, meta, avatars }      (rôle PRIVÉ du joueur)
     { t:"progress", n, done:[ids], total, inputs? }  (ordre = buzzer ; inputs si open)
     { t:"timer", n, endsAt, now }                    (horloge serveur pour compenser l'offset)
     { t:"state", n, data }
     { t:"revealed", n, roles, inputs, order, names, meta, avatars }
     { t:"kicked" }                                   (à la cible d'un kick, avant fermeture)
     { t:"ceremony", top:[{id,name,avatar,pts}] }      (tous : lance la cérémonie du Roi, podium identique)
     { t:"error", error }

   L'état vit en mémoire (une seule instance Render) ; les scores durables
   restent dans Upstash via /api/kv. Un redéploiement vide les salons : les
   clients se reconnectent et le salon se reforme.
   ========================================================================= */

const MAX_PLAYERS = 32;
const MAX_ROOMS = 500;
const ROOM_RE = /^[A-Z0-9]{1,8}$/;
const GAME_RE = /^[a-z0-9-]{1,32}$/;
const ID_RE = /^[a-zA-Z0-9]{1,20}$/;

const rooms = new Map(); // "ROOM|game" -> { players: Map<id,{name,ws}>, hostId, round }

function roomKey(room, game) {
  return room + "|" + game;
}

/* Hôte = premier arrivé dans le salon (pas le plus petit id, forgeable) ;
   s'il part, la main passe au joueur présent le plus ancien (ordre d'insertion
   de la Map). Transfert volontaire possible via le message "host". */
function ensureHost(r) {
  if (!r.hostId || !r.players.has(r.hostId))
    r.hostId = r.players.keys().next().value || null;
  return r.hostId;
}

function lobbyMessage(r) {
  return JSON.stringify({
    t: "lobby",
    players: [...r.players.entries()].map(([id, p]) => ({ id, name: p.name, avatar: p.avatar })),
    host: ensureHost(r),
    avatars: avatarsOf(r),
  });
}

function broadcast(r, text) {
  for (const p of r.players.values()) p.ws.send(text);
}

function namesOf(r) {
  const names = {};
  for (const [id, p] of r.players.entries()) names[id] = p.name;
  return names;
}

function avatarsOf(r) {
  const avatars = {};
  for (const [id, p] of r.players.entries()) if (p.avatar) avatars[id] = p.avatar;
  return avatars;
}

function sendRoundTo(r, id) {
  const p = r.players.get(id);
  if (!p || !r.round) return;
  const { n, roles, names, meta, revealed, inputs, order, timerEndsAt, open, lastState, avatars } = r.round;
  p.ws.send(JSON.stringify({ t: "round", n, you: roles[id] ?? null, names, meta, avatars }));
  if (order.length)
    p.ws.send(JSON.stringify({ t: "progress", n, done: order, total: r.players.size, ...(open ? { inputs } : {}) }));
  if (timerEndsAt && timerEndsAt > Date.now())
    p.ws.send(JSON.stringify({ t: "timer", n, endsAt: timerEndsAt, now: Date.now() }));
  if (revealed) p.ws.send(JSON.stringify({ t: "revealed", n, roles, inputs, order, names, meta, avatars }));
  // Le state part APRÈS revealed : l'écran de révélation du retardataire est
  // ainsi déjà abonné quand l'état (verdict, contestation…) lui parvient.
  if (lastState !== undefined && lastState !== null)
    p.ws.send(JSON.stringify({ t: "state", n, data: lastState }));
}

function removePlayer(key, id, ws) {
  const r = rooms.get(key);
  if (!r) return;
  const p = r.players.get(id);
  if (!p || (ws && p.ws !== ws)) return; // une reconnexion a déjà remplacé ce socket
  r.players.delete(id);
  if (r.players.size === 0) rooms.delete(key);
  else broadcast(r, lobbyMessage(r));
}

/** Branche un socket WebSocket sur le protocole des salons. */
function handleSocket(ws) {
  let key = null;
  let myId = null;

  ws.onmessage = (text) => {
    let msg;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }

    if (msg.t === "join") {
      const room = String(msg.room || "").toUpperCase();
      const game = String(msg.game || "");
      const id = String(msg.id || "");
      const name = String(msg.name || "").trim().slice(0, 20);
      const avatar = String(msg.avatar || "").slice(0, 8); // emoji d'avatar (optionnel)
      if (!ROOM_RE.test(room) || !GAME_RE.test(game) || !ID_RE.test(id) || !name) {
        ws.send(JSON.stringify({ t: "error", error: "join invalide" }));
        return ws.close();
      }
      const k = roomKey(room, game);
      let r = rooms.get(k);
      if (!r) {
        if (rooms.size >= MAX_ROOMS) return ws.close();
        r = { players: new Map(), hostId: null, round: null };
        rooms.set(k, r);
      }
      if (!r.players.has(id) && r.players.size >= MAX_PLAYERS) return ws.close();
      const old = r.players.get(id);
      if (old && old.ws !== ws) old.ws.close(); // reconnexion : remplace l'ancien socket
      r.players.set(id, { name, avatar, ws });
      ensureHost(r); // premier arrivé = hôte
      key = k;
      myId = id;
      broadcast(r, lobbyMessage(r));
      sendRoundTo(r, id); // un retardataire reçoit la manche en cours
      return;
    }

    if (!key || !myId) return;
    const r = rooms.get(key);
    if (!r) return;

    if (msg.t === "start") {
      if (myId !== ensureHost(r)) return;
      const roles = msg.roles && typeof msg.roles === "object" ? msg.roles : {};
      r.round = {
        n: (r.round ? r.round.n : 0) + 1,
        roles,
        names: namesOf(r),
        avatars: avatarsOf(r),
        meta: msg.meta ?? null,
        revealed: false,
        inputs: {}, // deviceId -> réponse soumise
        order: [], // ordre d'arrivée des premières soumissions (fait office de buzzer)
        timerEndsAt: null,
        open: msg.open === true, // inputs publics en cours de manche (votes visibles, choix…)
      };
      for (const id of r.players.keys()) sendRoundTo(r, id);
    } else if (msg.t === "input") {
      if (!r.round || r.round.revealed) return;
      const data = msg.data === undefined ? true : msg.data;
      if (JSON.stringify(data).length > 4096) return; // réponse anormalement grosse
      if (!(myId in r.round.inputs)) r.round.order.push(myId); // 1re soumission : rang conservé
      r.round.inputs[myId] = data; // re-soumettre remplace la réponse, pas le rang
      broadcast(r, JSON.stringify({
        t: "progress", n: r.round.n, done: r.round.order, total: r.players.size,
        ...(r.round.open ? { inputs: r.round.inputs } : {}),
      }));
    } else if (msg.t === "timer") {
      if (myId !== ensureHost(r) || !r.round) return;
      const seconds = Math.max(1, Math.min(600, Number(msg.seconds) || 0));
      r.round.timerEndsAt = Date.now() + seconds * 1000;
      broadcast(r, JSON.stringify({ t: "timer", n: r.round.n, endsAt: r.round.timerEndsAt, now: Date.now() }));
    } else if (msg.t === "state") {
      if (myId !== ensureHost(r) || !r.round) return;
      r.round.lastState = msg.data ?? null; // mémorisé pour les reconnexions
      broadcast(r, JSON.stringify({ t: "state", n: r.round.n, data: msg.data ?? null }));
    } else if (msg.t === "goto") {
      // L'hôte emmène toute la soirée vers un autre jeu (pas besoin de manche en cours).
      if (myId !== ensureHost(r)) return;
      const game = String(msg.game || "");
      if (!GAME_RE.test(game)) return;
      broadcast(r, JSON.stringify({ t: "goto", game }));
    } else if (msg.t === "kick") {
      // L'hôte éjecte un joueur (fantôme, doublon…) : notifié puis déconnecté.
      if (myId !== ensureHost(r)) return;
      const target = String(msg.id || "");
      if (target === myId) return;
      const p = r.players.get(target);
      if (!p) return;
      p.ws.send(JSON.stringify({ t: "kicked" }));
      p.ws.close();
      removePlayer(key, target, null);
    } else if (msg.t === "host") {
      // L'hôte passe volontairement la main à un autre joueur du salon.
      if (myId !== ensureHost(r)) return;
      const target = String(msg.id || "");
      if (target === myId || !r.players.has(target)) return;
      r.hostId = target;
      broadcast(r, lobbyMessage(r));
    } else if (msg.t === "ceremony") {
      // Cérémonie du Roi : l'hôte la déclenche, tous les téléphones la jouent
      // en même temps avec le MÊME podium. Transitoire (pas mémorisée dans la
      // manche) : un retardataire ne rejoue pas une cérémonie déjà passée.
      if (myId !== ensureHost(r)) return;
      const top = (Array.isArray(msg.top) ? msg.top : []).slice(0, 3).map((e) => ({
        id: String((e && e.id) || "").slice(0, 20),
        name: String((e && e.name) || "?").slice(0, 24),
        avatar: String((e && e.avatar) || "").slice(0, 8),
        pts: Number(e && e.pts) || 0,
      }));
      broadcast(r, JSON.stringify({ t: "ceremony", top }));
    } else if (msg.t === "reveal") {
      if (myId !== ensureHost(r) || !r.round) return;
      r.round.revealed = true;
      const { n, roles, inputs, order, names, meta, avatars } = r.round;
      broadcast(r, JSON.stringify({ t: "revealed", n, roles, inputs, order, names, meta, avatars }));
    } else if (msg.t === "leave") {
      removePlayer(key, myId, null);
      key = null;
      myId = null;
    }
  };

  ws.onclose = () => {
    if (key && myId) removePlayer(key, myId, ws);
  };
}

module.exports = { handleSocket };
