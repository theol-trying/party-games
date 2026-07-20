/* =========================================================================
   FX — effets de fête zéro-dépendance, partagés par tous les jeux.
   - confettiBurst / confettiRain / celebrate : canvas plein écran (particules).
   - stampGage : tampon « GAGE » plein écran (le moment le plus théâtral).
   - flipReveal : carte 3D qui se retourne (révélation d'un rôle).
   Tout respecte prefers-reduced-motion (dégrade en version calme) et échoue
   en silence si le navigateur ne suit pas.
   ========================================================================= */

import { el } from "./ui.js";
import { buzz } from "./sound.js";

const reduced = (() => {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  catch { return false; }
})();

const COLORS = ["#ff4d6d", "#4dd0e1", "#ffd43b", "#69db7c", "#b197fc", "#ffa94d", "#ff8787", "#63e6be"];
const MAX_PARTICLES = 320;

let canvas = null;
let cctx = null;
let dpr = 1;
let particles = [];
let raf = null;
let watchdog = null; // force le nettoyage même si rAF est gelé (onglet en arrière-plan)

function ensureCanvas() {
  if (canvas) return;
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9998";
  sizeCanvas();
  document.body.appendChild(canvas);
  cctx = canvas.getContext("2d");
  window.addEventListener("resize", sizeCanvas);
}

function sizeCanvas() {
  if (!canvas) return;
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
}

function teardownCanvas() {
  if (raf) cancelAnimationFrame(raf);
  if (watchdog) { clearTimeout(watchdog); watchdog = null; }
  window.removeEventListener("resize", sizeCanvas);
  if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
  canvas = null;
  cctx = null;
  particles = [];
  raf = null;
}

function loop() {
  if (!cctx) return;
  cctx.clearRect(0, 0, canvas.width, canvas.height);
  const g = 0.16 * dpr; // gravité
  particles.forEach((p) => {
    p.vy += g;
    p.vx *= 0.995;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vrot;
    p.life--;
    const alpha = Math.max(0, Math.min(1, p.life / 26));
    cctx.save();
    cctx.globalAlpha = alpha;
    cctx.translate(p.x, p.y);
    cctx.rotate(p.rot);
    cctx.fillStyle = p.color;
    cctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.62);
    cctx.restore();
  });
  particles = particles.filter((p) => p.life > 0 && p.y < canvas.height + 40);
  if (particles.length) raf = requestAnimationFrame(loop);
  else teardownCanvas();
}

function spawn(list) {
  if (reduced || !list.length) return;
  ensureCanvas();
  particles.push(...list);
  if (particles.length > MAX_PARTICLES) particles = particles.slice(-MAX_PARTICLES);
  if (!raf) raf = requestAnimationFrame(loop);
  // Filet de sécurité : si rAF est gelé (onglet caché, veille), on nettoie quand même.
  if (watchdog) clearTimeout(watchdog);
  watchdog = setTimeout(teardownCanvas, 4500);
}

/** Explosion de confettis depuis un point (coordonnées écran, en CSS px). */
export function confettiBurst(x, y, count = 90) {
  const cx = x * dpr;
  const cy = y * dpr;
  const list = [];
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const speed = (4 + Math.random() * 7) * dpr;
    list.push({
      x: cx, y: cy,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed - 3 * dpr, // léger biais vers le haut
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.4,
      size: (6 + Math.random() * 7) * dpr,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      life: 70 + (Math.random() * 40) | 0,
    });
  }
  spawn(list);
}

/** Pluie de confettis depuis le haut de l'écran pendant `ms` millisecondes. */
export function confettiRain(ms = 1200) {
  if (reduced) return;
  const started = Date.now();
  const w = window.innerWidth;
  (function drop() {
    if (Date.now() - started > ms) return;
    const list = [];
    for (let i = 0; i < 8; i++) {
      list.push({
        x: Math.random() * w * dpr,
        y: -10 * dpr,
        vx: (Math.random() - 0.5) * 2 * dpr,
        vy: (2 + Math.random() * 3) * dpr,
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 0.3,
        size: (6 + Math.random() * 6) * dpr,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        life: 120,
      });
    }
    spawn(list);
    setTimeout(drop, 90);
  })();
}

/** Célébration standard : gerbe depuis le bas-centre + courte pluie. */
export function celebrate() {
  if (reduced) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  confettiBurst(w * 0.5, h * 0.62, 120);
  confettiRain(900);
}

/** Tampon « GAGE » plein écran : le mot s'écrase, l'écran tremble, buzz sonore,
    puis le texte du gage. Se ferme au toucher (repli auto après 7 s). */
export function stampGage(text, { onDone } = {}) {
  try { buzz(); } catch {}
  let closed = false;
  const hint = el("p.fx-stamp__hint", { text: "Touche pour continuer" });
  const overlay = el("div.fx-stamp" + (reduced ? ".fx-stamp--calm" : ""), { role: "alertdialog", "aria-label": "Gage" }, [
    el("div.fx-stamp__mark", { text: "GAGE" }),
    el("div.fx-stamp__card", { text: text || "Gage !" }),
    hint,
  ]);
  function close() {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    overlay.removeEventListener("click", close);
    document.removeEventListener("keydown", onKey);
    document.body.classList.remove("fx-shake");
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    if (onDone) try { onDone(); } catch {}
  }
  const onKey = (e) => { if (e.key === "Escape" || e.key === "Enter") close(); };
  overlay.addEventListener("click", close);
  document.addEventListener("keydown", onKey);
  document.body.appendChild(overlay);
  if (!reduced) {
    document.body.classList.add("fx-shake");
    setTimeout(() => document.body.classList.remove("fx-shake"), 360);
  }
  const timer = setTimeout(close, 7000);
  return close;
}

/** Carte 3D qui se retourne pour révéler `backContent`.
    variant : "danger" (rouge, tremble), "gold" (doré, brille), "" (neutre).
    Renvoie le nœud à insérer ; il se retourne tout seul juste après le montage. */
export function flipReveal(backContent, { variant = "", front = "🕵️", height = 132 } = {}) {
  const inner = el("div.fx-flip__inner", {}, [
    el("div.fx-flip__face.fx-flip__front", {}, [el("span.fx-flip__q", { text: front })]),
    el("div.fx-flip__face.fx-flip__back" + (variant ? ".is-" + variant : ""), {}, [
      typeof backContent === "string" ? el("span", { text: backContent }) : backContent,
    ]),
  ]);
  const node = el("div.fx-flip", { style: `height:${height}px` }, [inner]);
  if (reduced) {
    inner.classList.add("is-flipped");
  } else {
    // setTimeout (et non rAF, gelé si l'onglet est en arrière-plan) : laisse peindre
    // la face avant, puis lance la transition de retournement.
    setTimeout(() => inner.classList.add("is-flipped"), 60);
  }
  return node;
}
