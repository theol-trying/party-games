/* =========================================================================
   WS — mini-serveur WebSocket RFC 6455 écrit à la main (zéro dépendance),
   sur le modèle du projet de référence (PONG). S'attache à l'événement
   `upgrade` du serveur HTTP existant.

   Limites volontaires : messages texte JSON uniquement, taille max 32 Ko,
   ping serveur toutes les 30 s (déconnexion si silence > 75 s).
   ========================================================================= */

const crypto = require("crypto");

const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const MAX_MESSAGE = 32 * 1024;
const PING_INTERVAL_MS = 30000;
const DEAD_AFTER_MS = 75000;

/** Attache le support WebSocket au serveur HTTP. onConnection(conn, req). */
function attachWebSocket(server, { path = "/ws", onConnection }) {
  server.on("upgrade", (req, socket) => {
    const url = (req.url || "").split("?")[0];
    if (url !== path || (req.headers.upgrade || "").toLowerCase() !== "websocket") {
      socket.destroy();
      return;
    }
    const key = req.headers["sec-websocket-key"];
    if (!key) {
      socket.destroy();
      return;
    }
    const accept = crypto.createHash("sha1").update(key + GUID).digest("base64");
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
        "Upgrade: websocket\r\n" +
        "Connection: Upgrade\r\n" +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );
    socket.setNoDelay(true);
    onConnection(makeConnection(socket), req);
  });
}

/* ---------- Encodage / décodage de frames ---------- */

function encodeFrame(opcode, payload) {
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x80 | opcode, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

// Renvoie { frame:{fin,opcode,payload}, rest } ou null si incomplet, ou "oversize".
function parseFrame(buf) {
  if (buf.length < 2) return null;
  const fin = (buf[0] & 0x80) !== 0;
  const opcode = buf[0] & 0x0f;
  const masked = (buf[1] & 0x80) !== 0;
  let len = buf[1] & 0x7f;
  let off = 2;
  if (len === 126) {
    if (buf.length < 4) return null;
    len = buf.readUInt16BE(2);
    off = 4;
  } else if (len === 127) {
    if (buf.length < 10) return null;
    const big = buf.readBigUInt64BE(2);
    if (big > BigInt(MAX_MESSAGE)) return "oversize";
    len = Number(big);
    off = 10;
  }
  if (len > MAX_MESSAGE) return "oversize";
  let mask = null;
  if (masked) {
    if (buf.length < off + 4) return null;
    mask = buf.subarray(off, off + 4);
    off += 4;
  }
  if (buf.length < off + len) return null;
  let payload = Buffer.from(buf.subarray(off, off + len));
  if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
  return { frame: { fin, opcode, payload }, rest: buf.subarray(off + len) };
}

/* ---------- Connexion ---------- */

function makeConnection(socket) {
  const conn = {
    onmessage: null, // (texte) => void
    onclose: null, // () => void
    closed: false,
    send(text) {
      if (conn.closed || !socket.writable) return;
      try {
        socket.write(encodeFrame(0x1, Buffer.from(String(text), "utf8")));
      } catch {}
    },
    close() {
      if (conn.closed) return;
      try {
        socket.write(encodeFrame(0x8, Buffer.from([0x03, 0xe8]))); // 1000 normal
      } catch {}
      socket.end();
    },
  };

  let buffer = Buffer.alloc(0);
  let fragments = null; // { chunks: [], size }
  let lastSeen = Date.now();

  function fail() {
    conn.close();
    socket.destroy();
  }

  function deliver(payload) {
    lastSeen = Date.now();
    if (conn.onmessage) {
      try {
        conn.onmessage(payload.toString("utf8"));
      } catch {}
    }
  }

  function handleFrame(f) {
    lastSeen = Date.now();
    switch (f.opcode) {
      case 0x8: // close
        finish();
        conn.close();
        break;
      case 0x9: // ping -> pong
        if (!conn.closed && socket.writable) socket.write(encodeFrame(0xa, f.payload));
        break;
      case 0xa: // pong
        break;
      case 0x1: // texte
      case 0x2: // binaire (traité comme texte utf8)
        if (f.fin) deliver(f.payload);
        else fragments = { chunks: [f.payload], size: f.payload.length };
        break;
      case 0x0: // continuation
        if (!fragments) return fail();
        fragments.size += f.payload.length;
        if (fragments.size > MAX_MESSAGE) return fail();
        fragments.chunks.push(f.payload);
        if (f.fin) {
          deliver(Buffer.concat(fragments.chunks));
          fragments = null;
        }
        break;
      default:
        fail();
    }
  }

  socket.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (true) {
      const parsed = parseFrame(buffer);
      if (parsed === null) break;
      if (parsed === "oversize") return fail();
      buffer = parsed.rest;
      handleFrame(parsed.frame);
    }
  });

  // Ping périodique + détection de connexion morte (téléphone verrouillé, etc.)
  const pinger = setInterval(() => {
    if (conn.closed) return clearInterval(pinger);
    if (Date.now() - lastSeen > DEAD_AFTER_MS) {
      clearInterval(pinger);
      return fail();
    }
    if (socket.writable) {
      try {
        socket.write(encodeFrame(0x9, Buffer.alloc(0)));
      } catch {}
    }
  }, PING_INTERVAL_MS);

  let finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    conn.closed = true;
    clearInterval(pinger);
    if (conn.onclose) {
      try {
        conn.onclose();
      } catch {}
    }
  }

  socket.on("close", finish);
  socket.on("error", finish);
  socket.on("end", finish);

  return conn;
}

module.exports = { attachWebSocket };
