/* =========================================================================
   GAME-KIT — briques partagées entre jeux, pour éviter la duplication.
   ========================================================================= */

import { el, showPhase } from "./ui.js";

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
