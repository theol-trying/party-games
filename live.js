/* =========================================================================
   LIVE — salons multi-appareils en mémoire (source de vérité côté serveur).

   Un salon = un couple (code de soirée, jeu). Protocole JSON :
   Client → serveur :
     { t:"join", room, game, id, name }
     { t:"start", roles:{deviceId:payload}, meta? }   (hôte uniquement)
     { t:"reveal" }                                    (hôte uniquement)
     { t:"leave" }
   Serveur → client :
     { t:"lobby", players:[{id,name}], host }
     { t:"round", n, you, names, meta }               (rôle PRIVÉ du joueur)
     { t:"revealed", n, roles, names, meta }
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

const rooms = new Map(); // "ROOM|game" -> { players: Map<id,{name,ws}>, round }

function roomKey(room, game) {
  return room + "|" + game;
}

function hostId(r) {
  return [...r.players.keys()].sort()[0] || null;
}

function lobbyMessage(r) {
  return JSON.stringify({
    t: "lobby",
    players: [...r.players.entries()].map(([id, p]) => ({ id, name: p.name })),
    host: hostId(r),
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

function sendRoundTo(r, id) {
  const p = r.players.get(id);
  if (!p || !r.round) return;
  const { n, roles, names, meta, revealed } = r.round;
  p.ws.send(JSON.stringify({ t: "round", n, you: roles[id] ?? null, names, meta }));
  if (revealed) p.ws.send(JSON.stringify({ t: "revealed", n, roles, names, meta }));
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
      if (!ROOM_RE.test(room) || !GAME_RE.test(game) || !ID_RE.test(id) || !name) {
        ws.send(JSON.stringify({ t: "error", error: "join invalide" }));
        return ws.close();
      }
      const k = roomKey(room, game);
      let r = rooms.get(k);
      if (!r) {
        if (rooms.size >= MAX_ROOMS) return ws.close();
        r = { players: new Map(), round: null };
        rooms.set(k, r);
      }
      if (!r.players.has(id) && r.players.size >= MAX_PLAYERS) return ws.close();
      const old = r.players.get(id);
      if (old && old.ws !== ws) old.ws.close(); // reconnexion : remplace l'ancien socket
      r.players.set(id, { name, ws });
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
      if (myId !== hostId(r)) return;
      const roles = msg.roles && typeof msg.roles === "object" ? msg.roles : {};
      r.round = {
        n: (r.round ? r.round.n : 0) + 1,
        roles,
        names: namesOf(r),
        meta: msg.meta ?? null,
        revealed: false,
      };
      for (const id of r.players.keys()) sendRoundTo(r, id);
    } else if (msg.t === "reveal") {
      if (myId !== hostId(r) || !r.round) return;
      r.round.revealed = true;
      const { n, roles, names, meta } = r.round;
      broadcast(r, JSON.stringify({ t: "revealed", n, roles, names, meta }));
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
