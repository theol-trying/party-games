/* =========================================================================
   GAME-KIT — briques partagées entre jeux, pour éviter la duplication.
   ========================================================================= */

import { el, showPhase } from "./ui.js";
import { loadContent, loadConfig, activeCards } from "./content.js";
import { createDeck } from "./deck.js";

/**
 * Source de contenu d'un jeu : contenu intégré + cartes perso, filtré par la
 * config de sélection (source « perso uniquement », cartes désactivées).
 * Évite de répéter le trio loadContent/loadConfig/activeCards dans chaque jeu.
 *
 * @param {string} gameId
 * @param {object} opts  { builtIn, keyOf?, toValue? } — builtIn : tableau, ou fonction qui
 *        le renvoie (contenu chargé en différé, comme les questions du quiz)
 * @returns {{ reload:()=>Promise<void>, cards:()=>any[], version:()=>number }}
 */
export function contentSource(gameId, { builtIn, keyOf = (x) => x, toValue = (e) => e.text }) {
  let custom = [];
  let config = { onlyCustom: false, disabled: {} };
  let version = 0; // +1 à chaque rechargement (voir paquetSuivi)
  return {
    async reload() {
      [custom, config] = await Promise.all([loadContent(gameId), loadConfig(gameId)]);
      version++;
    },
    cards: () => activeCards({ builtIn: typeof builtIn === "function" ? builtIn() : builtIn, custom, config, keyOf, customToValue: toValue }),
    version: () => version,
  };
}

/**
 * Paquet qui suit sa source de contenu : il est (re)construit au premier tirage
 * qui suit un rechargement de la source. Le salon multi s'ouvre souvent AVANT
 * que les cartes perso ne soient arrivées (« Changer de jeu », tournoi,
 * « Reprendre ») : un paquet construit à l'ouverture ignorait alors, pour toute
 * la partie, les cartes perso, les cartes désactivées et « seulement les nôtres ».
 * Même interface que createDeck ; le filtre éventuel est conservé.
 */
export function paquetSuivi(src, options = {}) {
  let deck = null;
  let vue = -1;
  let filtre = null;
  const paquet = () => {
    if (!deck || vue !== src.version()) {
      deck = createDeck(src.cards(), options);
      vue = src.version();
      if (filtre) deck.setFilter(filtre);
    }
    return deck;
  };
  return {
    next: () => paquet().next(),
    remaining: () => paquet().remaining(),
    size: () => paquet().size(),
    reset: () => paquet().reset(),
    setFilter(fn) { filtre = fn || null; paquet().setFilter(filtre); },
  };
}

/**
 * Sélecteur de thèmes repliable (multi-sélection), partagé par le quiz et
 * Estimations. `selected` est un Set d'ids muté en place ; onChange() est
 * rappelé après chaque changement. Au moins un thème reste toujours actif.
 * Les cartes perso (sans thème) restent incluses : c'est au filtre du jeu d'y veiller.
 *
 * @param {Array<{id:string,label:string}>} themes
 * @param {Set<string>} selected
 * @param {()=>void} onChange
 * @param {object} [opts]  { titre } — libellé du résumé (déf. « 🗂️ Catégories »)
 */
export function themeSelector(themes, selected, onChange, { titre = "🗂️ Catégories" } = {}) {
  const chips = {};
  const summary = el("summary");
  const row = el("div.row", { style: "flex-wrap:wrap;justify-content:center;gap:6px;margin-top:8px" });
  const refreshSummary = () => { summary.textContent = `${titre} (${selected.size}/${themes.length})`; };
  const paint = () => { for (const t of themes) chips[t.id].classList.toggle("is-active", selected.has(t.id)); refreshSummary(); };
  themes.forEach((t) => {
    const chip = el("button.chip", { text: t.label, type: "button" });
    chip.addEventListener("click", () => {
      if (selected.has(t.id)) { if (selected.size <= 1) return; selected.delete(t.id); } // garder ≥ 1
      else selected.add(t.id);
      paint();
      onChange();
    });
    chips[t.id] = chip;
    row.appendChild(chip);
  });
  const quick = el("div.row", { style: "justify-content:center;gap:8px;margin-top:8px" }, [
    el("button.chip", { text: "Tout", type: "button", onClick: () => { themes.forEach((t) => selected.add(t.id)); paint(); onChange(); } }),
    el("button.chip", { text: "Rien sauf 1", type: "button", onClick: () => { selected.clear(); selected.add(themes[0].id); paint(); onChange(); } }),
  ]);
  paint();
  return el("details.ed-bulk", { style: "margin-top:10px" }, [summary, row, quick]);
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
