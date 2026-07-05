/* =========================================================================
   ROOM — « soirée » identifiée par un code court.
   Le code sert à NAMESPACER toutes les clés de persistance (store.js) :
   - deux groupes différents ne se marchent pas dessus,
   - deux appareils qui saisissent le MÊME code partagent les données (via Upstash).

   Le choix du code est local à l'appareil (localStorage), pas dans le store
   partagé — sinon on ne pourrait jamais en changer.
   ========================================================================= */

const KEY = "soiree.room";
// Alphabet sans caractères ambigus (pas de I, O, 0, 1).
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Génère un code aléatoire (4 caractères par défaut). */
export function generateCode(len = 4) {
  let s = "";
  for (let i = 0; i < len; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return s;
}

/** Nettoie une saisie utilisateur en code valide (majuscules, alphanum). */
export function normalizeCode(input) {
  return (input || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

/** Code de la soirée courante ; en crée un au premier appel. */
export function currentRoom() {
  let r = null;
  try {
    r = localStorage.getItem(KEY);
  } catch {}
  if (!r) {
    r = generateCode();
    setRoom(r);
  }
  return r;
}

/** Fixe le code de la soirée courante. */
export function setRoom(code) {
  const c = normalizeCode(code) || generateCode();
  try {
    localStorage.setItem(KEY, c);
  } catch {}
  return c;
}

/** Crée une nouvelle soirée (nouveau code) et la sélectionne. */
export function newRoom() {
  return setRoom(generateCode());
}
