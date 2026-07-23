/* =========================================================================
   LIVE — salons multi-appareils en mémoire (source de vérité côté serveur).

   Un salon = un couple (code de soirée, jeu). Protocole JSON :
   Client → serveur :
     { t:"join", room, game, id, name, avatar? }
     { t:"join", room, id, spectator:true, game? }    (écran TV : regarde sans jouer ;
                       game absent/inconnu → jeu courant de la room, sinon "nogame")
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
     { t:"watching", game }                            (au spectateur : jeu qu'il regarde, à sa connexion)
     { t:"nogame" }                                    (au spectateur : aucun jeu actif dans la room → réessayer)
     { t:"full" }                                      (au spectateur : trop d'écrans TV → ne pas réessayer)
     { t:"error", error }

   L'état vit en mémoire (une seule instance Render) ; les scores durables
   restent dans Upstash via /api/kv. Un redéploiement vide les salons : les
   clients se reconnectent et le salon se reforme.
   ========================================================================= */

const MAX_PLAYERS = 32;
const MAX_SPECTATORS = 8; // écrans TV par salon (ne comptent pas comme joueurs)
const MAX_ROOMS = 500;
const ROOM_RE = /^[A-Z0-9]{1,8}$/;
const GAME_RE = /^[a-z0-9-]{1,32}$/;
const ID_RE = /^[a-zA-Z0-9]{1,20}$/;

const rooms = new Map(); // "ROOM|game" -> { players: Map<id,{name,avatar,ws}>, spectators: Map<id,{ws}>, hostId, round, room, game }
const roomGame = new Map(); // "ROOM" -> dernier jeu où un joueur est entré (pour router un spectateur « wildcard »)

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
  if (r.spectators) for (const s of r.spectators.values()) s.ws.send(text); // écrans TV : reçoivent tout
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

// Rejoue la manche en cours à un membre (joueur ou spectateur). Pour un
// spectateur, on passe son ws (il n'est pas dans r.players) ; roles[id] est
// alors absent → you:null (aucun rôle privé).
function sendRoundTo(r, id, ws) {
  const sock = ws || (r.players.get(id) && r.players.get(id).ws);
  if (!sock || !r.round) return;
  const { n, roles, names, meta, revealed, inputs, order, timerEndsAt, open, lastState, avatars } = r.round;
  sock.send(JSON.stringify({ t: "round", n, you: roles[id] ?? null, names, meta, avatars }));
  if (order.length)
    sock.send(JSON.stringify({ t: "progress", n, done: order, total: r.players.size, ...(open ? { inputs } : {}) }));
  if (timerEndsAt && timerEndsAt > Date.now())
    sock.send(JSON.stringify({ t: "timer", n, endsAt: timerEndsAt, now: Date.now() }));
  if (revealed) sock.send(JSON.stringify({ t: "revealed", n, roles, inputs, order, names, meta, avatars }));
  // Le state part APRÈS revealed : l'écran de révélation du retardataire est
  // ainsi déjà abonné quand l'état (verdict, contestation…) lui parvient.
  if (lastState !== undefined && lastState !== null)
    sock.send(JSON.stringify({ t: "state", n, data: lastState }));
}

function removePlayer(key, id, ws) {
  const r = rooms.get(key);
  if (!r) return;
  // Spectateur (écran TV) : départ silencieux, ne change pas la liste des joueurs.
  const s = r.spectators && r.spectators.get(id);
  if (s && (!ws || s.ws === ws)) {
    r.spectators.delete(id);
    if (r.players.size === 0 && r.spectators.size === 0) rooms.delete(key);
    return;
  }
  const p = r.players.get(id);
  if (!p || (ws && p.ws !== ws)) return; // une reconnexion a déjà remplacé ce socket
  r.players.delete(id);
  if (r.players.size === 0) {
    // Plus de joueurs : les écrans TV re-cherchent le jeu courant de la room
    // (nouveau jeu choisi via le menu, sans « goto »…).
    if (r.spectators) {
      for (const sp of r.spectators.values()) { try { sp.ws.send(JSON.stringify({ t: "nogame" })); } catch {} }
      r.spectators.clear();
    }
    rooms.delete(key);
    if (roomGame.get(r.room) === r.game) roomGame.delete(r.room); // pas de fuite : purge le routage du salon disparu
  } else {
    broadcast(r, lobbyMessage(r));
  }
}

/** Branche un socket WebSocket sur le protocole des salons. */
function handleSocket(ws) {
  let key = null;
  let myId = null;
  let isSpectator = false;

  ws.onmessage = (text) => {
    let msg;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }

    if (msg.t === "join") {
      const room = String(msg.room || "").toUpperCase();
      const id = String(msg.id || "");

      // ---- Spectateur (écran TV) : regarde le salon sans jouer -------------
      if (msg.spectator === true) {
        if (!ROOM_RE.test(room) || !ID_RE.test(id)) {
          ws.send(JSON.stringify({ t: "error", error: "join invalide" }));
          return ws.close();
        }
        const wanted = String(msg.game || "");
        // Jeu voulu explicitement (suivi d'un goto), sinon jeu courant de la room.
        const game = GAME_RE.test(wanted) ? wanted : roomGame.get(room);
        const r = game && rooms.get(roomKey(room, game));
        if (!game || !r) { ws.send(JSON.stringify({ t: "nogame" })); return; } // aucun jeu actif → la TV réessaiera
        if (!r.spectators.has(id) && r.spectators.size >= MAX_SPECTATORS) {
          ws.send(JSON.stringify({ t: "full" })); // trop d'écrans TV : message explicite → la TV cesse de réessayer
          return ws.close();
        }
        const oldS = r.spectators.get(id);
        if (oldS && oldS.ws !== ws) oldS.ws.close();
        r.spectators.set(id, { ws });
        key = roomKey(room, game);
        myId = id;
        isSpectator = true;
        ws.send(JSON.stringify({ t: "watching", game })); // dit à la TV quel jeu elle regarde (≠ goto → pas de reconnexion)
        ws.send(lobbyMessage(r));
        sendRoundTo(r, id, ws); // état de la manche en cours
        return;
      }

      // ---- Joueur normal ---------------------------------------------------
      const game = String(msg.game || "");
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
        r = { players: new Map(), spectators: new Map(), hostId: null, round: null, room, game };
        rooms.set(k, r);
      }
      if (!r.players.has(id) && r.players.size >= MAX_PLAYERS) return ws.close();
      const old = r.players.get(id);
      if (old && old.ws !== ws) old.ws.close(); // reconnexion : remplace l'ancien socket
      r.players.set(id, { name, avatar, ws });
      ensureHost(r); // premier arrivé = hôte
      roomGame.set(room, game); // ce salon devient le « jeu courant » de la room (routage des spectateurs)
      key = k;
      myId = id;
      broadcast(r, lobbyMessage(r));
      sendRoundTo(r, id); // un retardataire reçoit la manche en cours
      return;
    }

    if (!key || !myId) return;
    const r = rooms.get(key);
    if (!r) return;

    // Un spectateur (écran TV) est purement passif : seul « leave » est accepté.
    if (isSpectator) {
      if (msg.t === "leave") { removePlayer(key, myId, null); key = null; myId = null; isSpectator = false; }
      return;
    }

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
