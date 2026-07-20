/* =========================================================================
   DECK — paquet cyclique anti-répétition, partagé par tous les jeux.

   Résout la lassitude n°1 : on ne revoit pas deux fois la même carte tant que
   le paquet n'est pas épuisé, et jamais deux fois de suite au changement de tour.
   Gère aussi le filtrage par pack / intensité.

   Usage :
     const deck = createDeck(CARTES, { filter: c => c.niveau === "soft" });
     deck.next();        // carte suivante (ou null si vide)
     deck.remaining();   // cartes restantes avant re-mélange
     deck.setFilter(fn); // change le filtre (packs/intensité) et repart à zéro

   Anti-répétition ENTRE soirées (optionnel) :
     createDeck(CARTES, { seen: makeSeen("jeu"), keyOf: c => c.id })
   → le jamais-vu est pioché en premier, et chaque tirage est mémorisé.
   ========================================================================= */

import { shuffle } from "./ui.js";

export function createDeck(cards, opts = {}) {
  let filter = opts.filter || null;
  const seen = opts.seen || null;       // registre inter-soirées (makeSeen), ou null
  const keyOf = opts.keyOf || ((c) => c);
  let pool = [];
  let order = [];
  let cursor = 0;
  let last = null;

  function rebuild() {
    pool = filter ? cards.filter(filter) : [...cards];
    reshuffle();
  }

  function reshuffle() {
    if (seen) {
      // Jamais-vu d'abord (mélangé), puis le déjà-vu (mélangé).
      const fresh = [], old = [];
      for (const c of pool) (seen.has(keyOf(c)) ? old : fresh).push(c);
      order = shuffle(fresh).concat(shuffle(old));
    } else {
      order = shuffle(pool);
    }
    // Évite que la 1re carte d'un nouveau tour soit la dernière déjà vue.
    if (order.length > 1 && last != null && order[0] === last) {
      order.push(order.shift());
    }
    cursor = 0;
  }

  function next() {
    if (!pool.length) return null;
    if (cursor >= order.length) reshuffle();
    last = order[cursor++];
    if (seen) seen.add(keyOf(last));
    return last;
  }

  rebuild();

  return {
    next,
    remaining: () => Math.max(0, order.length - cursor),
    size: () => pool.length,
    reset: rebuild,
    setFilter(fn) {
      filter = fn || null;
      last = null;
      rebuild();
    },
  };
}
