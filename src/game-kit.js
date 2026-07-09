/* =========================================================================
   GAME-KIT — briques partagées entre jeux, pour éviter la duplication.
   ========================================================================= */

import { el, showPhase } from "./ui.js";
import { loadContent, loadConfig, activeCards } from "./content.js";

/**
 * Source de contenu d'un jeu : contenu intégré + cartes perso, filtré par la
 * config de sélection (source « perso uniquement », cartes désactivées).
 * Évite de répéter le trio loadContent/loadConfig/activeCards dans chaque jeu.
 *
 * @param {string} gameId
 * @param {object} opts  { builtIn, keyOf?, toValue? }
 * @returns {{ reload:()=>Promise<void>, cards:()=>any[] }}
 */
export function contentSource(gameId, { builtIn, keyOf = (x) => x, toValue = (e) => e.text }) {
  let custom = [];
  let config = { onlyCustom: false, disabled: {} };
  return {
    async reload() {
      [custom, config] = await Promise.all([loadContent(gameId), loadConfig(gameId)]);
    },
    cards: () => activeCards({ builtIn, custom, config, keyOf, customToValue: toValue }),
  };
}

/**
 * Boucle « passe le téléphone » : pour chaque joueur, un écran tampon
 * « Passe le téléphone à X », puis SON écran privé rendu par onPlayer.
 *
 * @param {HTMLElement} stage
 * @param {string[]} players
 * @param {object} opts
 * @param {(player:string, index:number, next:()=>void)=>void} opts.onPlayer
 *        rend l'écran privé du joueur ; appelle next() quand il a terminé.
 * @param {()=>void} opts.onDone  appelé après le dernier joueur.
 * @param {string} [opts.icon]  emoji de l'écran tampon (def. 📱).
 * @param {string} [opts.cta]   libellé du bouton de l'écran tampon (def. "Voir").
 */
export function passThePhone(stage, players, { onPlayer, onDone, icon = "📱", cta = "Voir" }) {
  let i = 0;
  function step() {
    if (i >= players.length) return onDone();
    const p = players[i];
    showPhase(stage,
      el("div.card.center", {}, [
        el("p.big-prompt", { text: icon }),
        el("p", { text: `Passe le téléphone à ${p}` }),
        el("button.btn.btn--full", { text: `${p} · ${cta}`, style: "margin-top:18px", onClick: () => onPlayer(p, i, () => { i++; step(); }) }),
      ])
    );
  }
  step();
}
