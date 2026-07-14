/* =========================================================================
   QR — générateur de QR codes maison, zéro dépendance.
   Mode octets (UTF-8), correction d'erreur L, versions 1 à 5 (jusqu'à
   106 caractères — largement assez pour un lien d'invitation), masque
   choisi par pénalité comme le veut la spec. Rendu sur <canvas>.
   ========================================================================= */

// Capacités niveau L : mots de données / mots de correction (1 seul bloc RS).
const DATA_CW = [0, 19, 34, 55, 80, 108];
const ECC_CW = [0, 7, 10, 15, 20, 26];
const ALIGN_CENTER = [0, 0, 18, 22, 26, 30]; // v>=2 : un seul motif à (c,c)

/* ---------- Galois GF(256), polynôme 0x11D ---------- */
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

function rsEcc(data, n) {
  // Polynôme générateur de degré n.
  let g = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      next[j] ^= g[j] === 0 ? 0 : EXP[(LOG[g[j]] + i) % 255];
      next[j + 1] ^= g[j];
    }
    g = next;
  }
  g.reverse(); // coefficients du terme dominant vers la constante
  const work = [...data, ...new Array(n).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const f = work[i];
    if (f === 0) continue;
    const lf = LOG[f];
    for (let j = 0; j < g.length; j++) work[i + j] ^= EXP[(lf + LOG[g[j]]) % 255];
  }
  return work.slice(data.length);
}

/* ---------- Encodage des données ---------- */
function dataBits(text) {
  const bytes = new TextEncoder().encode(text);
  let version = 0;
  for (let v = 1; v <= 5; v++) if (bytes.length <= DATA_CW[v] - 2) { version = v; break; }
  if (!version) throw new Error("QR : texte trop long (max 106 caractères)");
  const cap = DATA_CW[version];

  const bits = [];
  const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  push(0b0100, 4); // mode octets
  push(bytes.length, 8); // compteur (8 bits en v1-9)
  bytes.forEach((b) => push(b, 8));
  push(0, Math.min(4, cap * 8 - bits.length)); // terminateur
  while (bits.length % 8) bits.push(0);

  const cw = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    cw.push(b);
  }
  const PAD = [0xec, 0x11];
  for (let i = 0; cw.length < cap; i++) cw.push(PAD[i % 2]);

  const all = [...cw, ...rsEcc(cw, ECC_CW[version])];
  const out = [];
  all.forEach((b) => { for (let i = 7; i >= 0; i--) out.push((b >> i) & 1); });
  return { version, bits: out };
}

/* ---------- Matrice ---------- */
const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (((r / 2) | 0) + ((c / 3) | 0)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

export function qrMatrix(text) {
  const { version, bits } = dataBits(text);
  const size = 17 + 4 * version;
  const m = Array.from({ length: size }, () => new Array(size).fill(0));
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (r, c, v) => { m[r][c] = v ? 1 : 0; fn[r][c] = true; };

  // Motifs de repérage (3 coins) + séparateurs.
  for (const [fr, fc] of [[0, 0], [0, size - 7], [size - 7, 0]]) {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const rr = fr + r, cc = fc + c;
      if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
      if (r === -1 || r === 7 || c === -1 || c === 7) set(rr, cc, 0); // séparateur
      else set(rr, cc, Math.max(Math.abs(r - 3), Math.abs(c - 3)) !== 2);
    }
  }
  // Lignes de synchronisation.
  for (let i = 8; i < size - 8; i++) {
    if (!fn[6][i]) set(6, i, i % 2 === 0);
    if (!fn[i][6]) set(i, 6, i % 2 === 0);
  }
  // Motif d'alignement (un seul en v2-5).
  const a = ALIGN_CENTER[version];
  if (a) for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++)
    set(a + r, a + c, Math.max(Math.abs(r), Math.abs(c)) !== 1);
  // Module sombre + zones réservées au format.
  set(4 * version + 9, 8, 1);
  for (let i = 0; i <= 8; i++) {
    if (!fn[8][i]) set(8, i, 0);
    if (!fn[i][8]) set(i, 8, 0);
    if (i < 8) {
      if (!fn[8][size - 1 - i]) set(8, size - 1 - i, 0);
      if (!fn[size - 1 - i][8]) set(size - 1 - i, 8, 0);
    }
  }

  // Zigzag des bits de données (deux colonnes, en évitant la colonne 6).
  let idx = 0, up = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let k = 0; k < size; k++) {
      const row = up ? size - 1 - k : k;
      for (const c of [col, col - 1]) {
        if (fn[row][c]) continue;
        m[row][c] = idx < bits.length ? bits[idx] : 0;
        idx++;
      }
    }
    up = !up;
  }

  // Choix du masque par pénalité (spec ISO 18004).
  let best = null, bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const g = m.map((row, r) => row.map((v, c) => (fn[r][c] ? v : v ^ (MASKS[mask](r, c) ? 1 : 0))));
    placeFormat(g, size, mask);
    const s = penalty(g, size);
    if (s < bestScore) { bestScore = s; best = g; }
  }
  return { size, grid: best };
}

function placeFormat(g, size, mask) {
  const f5 = (0b01 << 3) | mask; // niveau L
  let r = f5 << 10;
  for (let i = 14; i >= 10; i--) if ((r >> i) & 1) r ^= 0b10100110111 << (i - 10);
  const fmt = ((f5 << 10) | r) ^ 0b101010000010010;
  const b = [];
  for (let i = 14; i >= 0; i--) b.push((fmt >> i) & 1);
  const A = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]];
  A.forEach(([rr, cc], i) => (g[rr][cc] = b[i]));
  for (let i = 0; i <= 6; i++) g[size - 1 - i][8] = b[i];
  for (let i = 7; i <= 14; i++) g[8][size - 15 + i] = b[i];
}

function penalty(g, size) {
  let score = 0;
  // N1 : séries >= 5 de même couleur (lignes et colonnes).
  for (let axis = 0; axis < 2; axis++) {
    for (let i = 0; i < size; i++) {
      let run = 1;
      for (let j = 1; j < size; j++) {
        const cur = axis ? g[j][i] : g[i][j];
        const prev = axis ? g[j - 1][i] : g[i][j - 1];
        if (cur === prev) { run++; if (run === 5) score += 3; else if (run > 5) score++; }
        else run = 1;
      }
    }
  }
  // N2 : blocs 2x2 uniformes.
  for (let r = 0; r < size - 1; r++) for (let c = 0; c < size - 1; c++) {
    const v = g[r][c];
    if (v === g[r][c + 1] && v === g[r + 1][c] && v === g[r + 1][c + 1]) score += 3;
  }
  // N3 : motifs 1011101 flanqués de 4 modules clairs.
  const P1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], P2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  const match = (get, i, p) => p.every((v, k) => get(i + k) === v);
  for (let i = 0; i < size; i++) {
    for (let j = 0; j <= size - 11; j++) {
      if (match((k) => g[i][k], j, P1) || match((k) => g[i][k], j, P2)) score += 40;
      if (match((k) => g[k][i], j, P1) || match((k) => g[k][i], j, P2)) score += 40;
    }
  }
  // N4 : écart à 50 % de modules sombres.
  let dark = 0;
  for (const row of g) for (const v of row) dark += v;
  score += Math.floor(Math.abs((dark * 100) / (size * size) - 50) / 5) * 10;
  return score;
}

/** Rend le QR sur un canvas (fond blanc + zone de silence, prêt à scanner). */
export function qrCanvas(text, { scale = 4, margin = 4 } = {}) {
  const { size, grid } = qrMatrix(text);
  const px = (size + margin * 2) * scale;
  const cv = document.createElement("canvas");
  cv.width = cv.height = px;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, px, px);
  ctx.fillStyle = "#000";
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++)
    if (grid[r][c]) ctx.fillRect((c + margin) * scale, (r + margin) * scale, scale, scale);
  return cv;
}
