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
