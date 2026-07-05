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
   ========================================================================= */

import { shuffle } from "./ui.js";

export function createDeck(cards, opts = {}) {
  let filter = opts.filter || null;
  let pool = [];
  let order = [];
  let cursor = 0;
  let last = null;

  function rebuild() {
    pool = filter ? cards.filter(filter) : [...cards];
    reshuffle();
  }

  function reshuffle() {
    order = shuffle(pool);
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
