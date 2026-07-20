/* =========================================================================
   SEEN — mémoire anti-répétition ENTRE soirées.

   createDeck() évite déjà les répétitions dans une session, mais tout est
   oublié au rechargement. makeSeen(gameId) tient un registre des cartes déjà
   vues (clé "seen:<jeu>", room-scopée via store.js), plafonné aux N dernières,
   pour que le deck pioche d'abord le jamais-vu à la soirée suivante.

   Amorçage SYNCHRONE depuis le cache local (getLocal) → le tout premier
   reshuffle du deck est déjà biaisé. Persistance débouncée (localStorage
   immédiat + push serveur en tâche de fond via setData).
   ========================================================================= */

import { getLocal, setData } from "./store.js";

const CAP = 300; // on ne retient que les 300 dernières cartes vues par jeu

export function makeSeen(gameId) {
  const key = "seen:" + gameId;
  const init = getLocal(key, []);
  const order = Array.isArray(init) ? init.slice(-CAP) : []; // FIFO
  const set = new Set(order);
  let timer = null;

  function persist() {
    if (timer) return;
    timer = setTimeout(() => { timer = null; setData(key, order.slice(-CAP)); }, 1000);
  }

  return {
    has: (k) => set.has(k),
    add(k) {
      if (k == null || set.has(k)) return;
      set.add(k);
      order.push(k);
      while (order.length > CAP) set.delete(order.shift());
      persist();
    },
    /** « Tout remélanger » : oublie l'historique (le contenu redevient neuf). */
    clear() {
      set.clear();
      order.length = 0;
      if (timer) { clearTimeout(timer); timer = null; }
      setData(key, []);
    },
    size: () => set.size,
  };
}
