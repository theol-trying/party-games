/* =========================================================================
   ICÔNE PNG — dessinée par le serveur, sans aucun fichier binaire dans le dépôt.

   iOS n'accepte que du PNG pour l'icône d'écran d'accueil (apple-touch-icon) :
   avec notre seul SVG, l'iPhone affichait une capture de la page. On redessine
   donc ici les formes de assets/icon.svg (dégradé rose → cyan, verre à
   cocktail blanc, olive jaune) dans un tampon de pixels, anti-crénelé par
   sur-échantillonnage, puis on l'encode en PNG avec le zlib de Node.
   Fond plein cadre : l'icône convient aussi au « maskable » d'Android.
   ========================================================================= */

const zlib = require("zlib");

const SUR = 4; // 4 × 4 échantillons par pixel

/* ---------- Géométrie, dans le repère 512 × 512 du SVG ---------- */
const VERRE = [[156, 168], [356, 168], [256, 300]]; // coupe (triangle)
const PIED = { x: 249, y: 292, w: 14, h: 86, r: 4 };
const SOCLE = { x: 196, y: 372, w: 120, h: 16, r: 8 };
const OLIVE = { cx: 256, cy: 232, r: 16 };
const PIQUE = { x1: 256, y1: 232, x2: 330, y2: 150, e: 6 }; // épaisseur 6, bouts ronds

function dansTriangle(px, py, [a, b, c]) {
  const s = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
  const pt = [px, py];
  const d1 = s(pt, a, b), d2 = s(pt, b, c), d3 = s(pt, c, a);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}
function dansRectArrondi(px, py, { x, y, w, h, r }) {
  if (px < x || px > x + w || py < y || py > y + h) return false;
  const cx = Math.min(Math.max(px, x + r), x + w - r);
  const cy = Math.min(Math.max(py, y + r), y + h - r);
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
}
function dansCercle(px, py, { cx, cy, r }) {
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
}
function dansSegment(px, py, { x1, y1, x2, y2, e }) {
  const dx = x2 - x1, dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  const qx = x1 + t * dx, qy = y1 + t * dy;
  return (px - qx) ** 2 + (py - qy) ** 2 <= (e / 2) ** 2;
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const FOND = hex("#0f0f1a");
const ROSE = hex("#ff4d6d");
const CYAN = hex("#4dd0e1");
const BLANC = [255, 255, 255];
const JAUNE = hex("#ffd43b");

/** Couleur d'un point (repère 512) : les formes du SVG, de dessous en dessus. */
function couleur(px, py) {
  if (dansCercle(px, py, OLIVE) || dansSegment(px, py, PIQUE)) return JAUNE;
  if (dansTriangle(px, py, VERRE) || dansRectArrondi(px, py, PIED) || dansRectArrondi(px, py, SOCLE)) return BLANC;
  // Dégradé diagonal à 90 % d'opacité sur le fond sombre.
  const t = Math.max(0, Math.min(1, (px + py) / 1024));
  return [0, 1, 2].map((i) => {
    const g = ROSE[i] + (CYAN[i] - ROSE[i]) * t;
    return FOND[i] * 0.1 + g * 0.9;
  });
}

/** Pixels RVB (Uint8Array, ligne par ligne) d'une icône de `taille` px de côté. */
function pixels(taille) {
  const out = new Uint8Array(taille * taille * 3);
  const echelle = 512 / taille;
  for (let y = 0; y < taille; y++) {
    for (let x = 0; x < taille; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SUR; sy++) {
        for (let sx = 0; sx < SUR; sx++) {
          const c = couleur((x + (sx + 0.5) / SUR) * echelle, (y + (sy + 0.5) / SUR) * echelle);
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const i = (y * taille + x) * 3;
      const n = SUR * SUR;
      out[i] = Math.round(r / n);
      out[i + 1] = Math.round(g / n);
      out[i + 2] = Math.round(b / n);
    }
  }
  return out;
}

/* ---------- Encodage PNG (RVB 8 bits, sans filtre) ---------- */
const TABLE_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TABLE_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function bloc(type, donnees) {
  const long = Buffer.alloc(4);
  long.writeUInt32BE(donnees.length);
  const corps = Buffer.concat([Buffer.from(type, "ascii"), donnees]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corps));
  return Buffer.concat([long, corps, crc]);
}
function encoderPng(taille, rvb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(taille, 0);
  ihdr.writeUInt32BE(taille, 4);
  ihdr[8] = 8; // bits par composante
  ihdr[9] = 2; // RVB
  const brut = Buffer.alloc(taille * (taille * 3 + 1));
  for (let y = 0; y < taille; y++) {
    brut[y * (taille * 3 + 1)] = 0; // filtre « aucun »
    Buffer.from(rvb.buffer, y * taille * 3, taille * 3).copy(brut, y * (taille * 3 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloc("IHDR", ihdr),
    bloc("IDAT", zlib.deflateSync(brut, { level: 9 })),
    bloc("IEND", Buffer.alloc(0)),
  ]);
}

// Tailles servies : 180 (iPhone), 192 et 512 (manifeste Android / PWA).
const TAILLES = [180, 192, 512];
const cache = new Map();
/** PNG (Buffer) de l'icône, calculé une fois puis gardé en mémoire. null si taille inconnue. */
function iconePng(taille) {
  if (!TAILLES.includes(taille)) return null;
  if (!cache.has(taille)) cache.set(taille, encoderPng(taille, pixels(taille)));
  return cache.get(taille);
}

module.exports = { iconePng, TAILLES, crc32 };
