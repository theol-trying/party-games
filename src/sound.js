/* =========================================================================
   SOUND — petits sons & vibrations, sans fichier audio (WebAudio).
   L'AudioContext est créé/réveillé au premier geste (clic), conforme aux
   politiques navigateur. Tout échoue en silence si indisponible.
   ========================================================================= */

let ctx = null;

function audioCtx() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Bip court paramétrable. */
export function beep(freq = 660, ms = 120, type = "sine", gain = 0.05) {
  const a = audioCtx();
  if (!a) return;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(g);
  g.connect(a.destination);
  const t = a.currentTime;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
  osc.start(t);
  osc.stop(t + ms / 1000);
}

/** Vibration (mobile) — pattern en ms. */
export function vibrate(pattern = 40) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch {}
}

/** Son de buzzer (blind test) + vibration. */
export function buzz() {
  beep(760, 140, "square", 0.06);
  vibrate(60);
}

/** « Pop » discret : un joueur rejoint le salon. */
export function pop() {
  beep(520, 60, "sine", 0.04);
}

/** Tic de compte à rebours (3 dernières secondes). */
export function tick() {
  beep(980, 45, "square", 0.04);
}

/** Début de manche : signal bref + vibration. */
export function roundCue() {
  beep(660, 80, "triangle", 0.05);
  vibrate(70);
}

/** Jingle de révélation (3 notes montantes) + vibration. */
export function jingle() {
  beep(523, 90);
  setTimeout(() => beep(659, 90), 100);
  setTimeout(() => beep(784, 150, "sine", 0.06), 200);
  vibrate([50, 40, 90]);
}
