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

/* =========================== Composants visuels =========================== */

const SVG_NS = "http://www.w3.org/2000/svg";
function svg(tag, attrs = {}) {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [a, v] of Object.entries(attrs)) n.setAttribute(a, String(v));
  return n;
}
/** Couleur stable d'un prénom (pastilles sans avatar). */
export function couleurDe(texte) {
  let h = 0;
  for (let i = 0; i < (texte || "").length; i++) h = (h * 31 + texte.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 70% 55%)`;
}
/** Avatar d'un joueur : son émoji, ou l'initiale de son prénom (partie sur un seul téléphone). */
export function pastille(nom, avatar, classe = "av-badge") {
  return el("span." + classe, { text: avatar || String(nom || "?").trim().charAt(0).toUpperCase() || "?", style: `background:${couleurDe(nom)}` });
}

/**
 * ⏱️ Chrono en anneau : l'arc se vide, passe à l'orange à mi-temps puis au
 * rouge (et bat) dans les 5 dernières secondes. Caché tant qu'aucun chrono
 * ne tourne. maj(restant, total) à chaque tic ; les bips restent au jeu.
 */
export function anneauChrono({ taille = 78 } = {}) {
  const C = 2 * Math.PI * 44;
  const arc = svg("circle", { cx: 50, cy: 50, r: 44, class: "chrono__arc", "stroke-dasharray": C.toFixed(2), "stroke-dashoffset": 0 });
  const dessin = svg("svg", { viewBox: "0 0 100 100", width: taille, height: taille, "aria-hidden": "true" });
  dessin.append(svg("circle", { cx: 50, cy: 50, r: 44, class: "chrono__piste" }), arc);
  const chiffre = el("span.chrono__chiffre");
  const node = el("div.chrono", { role: "timer", hidden: true }, [dessin, chiffre]);
  return {
    node,
    maj(restant, total) {
      node.hidden = false;
      const f = total > 0 ? Math.max(0, Math.min(1, restant / total)) : 0;
      arc.setAttribute("stroke-dashoffset", (C * (1 - f)).toFixed(2));
      chiffre.textContent = restant > 0 ? String(restant) : "⏰";
      node.classList.toggle("is-moitie", f <= 0.5 && restant > 5);
      node.classList.toggle("is-urgent", restant <= 5);
      node.setAttribute("aria-label", restant > 0 ? `${restant} secondes` : "Temps écoulé");
    },
  };
}

/** Durée totale d'un chrono vu en cours de route (écran re-rendu) : la 1re
    valeur vue pour cette échéance, mémorisée dans la mémoire de manche. */
export function totalChrono(memo, endsAt, restant) {
  if (memo.chronoFin !== endsAt) { memo.chronoFin = endsAt; memo.chronoTotal = Math.max(1, restant); }
  return memo.chronoTotal;
}

/**
 * 🗳️ Vote en grosses tuiles : avatar + prénom, deux colonnes. Plus rapide à
 * viser au doigt qu'une liste de boutons, et deux homonymes restent
 * distinguables par leur avatar. peindre({ choisi, verrouille, ontVote })
 * met à jour sans reconstruire : ontVote = ceux qui ont déjà voté (✓, sans
 * dévoiler pour qui).
 */
export function tuilesVote(candidats, { onChoisir }) {
  const tuiles = new Map();
  const grille = el("div.vote-grille", { role: "group", "aria-label": "Voter" });
  for (const c of candidats) {
    const t = el("button.vote-tuile", { type: "button", "aria-pressed": "false", onClick: () => onChoisir(c.id) }, [
      pastille(c.nom, c.avatar, "vote-tuile__av"),
      el("span.vote-tuile__nom", { text: c.nom }),
      el("span.vote-tuile__coche", { text: "✓ a voté", hidden: true }),
    ]);
    tuiles.set(c.id, t);
    grille.appendChild(t);
  }
  return {
    node: grille,
    peindre({ choisi = null, verrouille = false, ontVote = [] } = {}) {
      for (const [id, t] of tuiles) {
        t.disabled = verrouille;
        t.classList.toggle("is-choisi", id === choisi);
        t.setAttribute("aria-pressed", String(id === choisi));
        t.querySelector(".vote-tuile__coche").hidden = !ontVote.includes(id);
      }
    },
  };
}
