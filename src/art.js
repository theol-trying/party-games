/* =========================================================================
   ART — illustrations des jeux, en SVG inline.

   Les emoji système font le travail mais n'appartiennent à personne : ils
   changent d'un téléphone à l'autre et donnent au site l'air d'un dossier de
   raccourcis. Ces dessins sont écrits à la main, donc cohérents partout, et
   restent du TEXTE : aucun fichier binaire n'entre dans le dépôt.

   Parti pris graphique commun : trait épais aux extrémités arrondies, formes
   géométriques simples, et une seule couleur — celle du jeu, héritée via
   currentColor. Les aplats secondaires utilisent l'opacité, jamais une
   deuxième teinte, pour que chaque vignette reste lisible en petit.
   ========================================================================= */

const T = 'fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"';

/* Chaque dessin tient dans une grille 48×48. */
const DESSINS = {
  // Cible + flèche plantée.
  "action-verite": `<circle cx="22" cy="26" r="16" ${T}/><circle cx="22" cy="26" r="8" ${T}/>
    <circle cx="22" cy="26" r="2" fill="currentColor"/>
    <path d="M32 16 L43 5" ${T}/><path d="M38 5h5v5" ${T}/>`,

  // Main levée (on ne boit pas) + petite croix.
  "jamais-jamais": `<path d="M16 30V14a3 3 0 0 1 6 0v12" ${T}/><path d="M22 26V11a3 3 0 0 1 6 0v15" ${T}/>
    <path d="M28 26v-9a3 3 0 0 1 6 0v13c0 7-5 12-12 12s-12-5-12-12v-4" ${T}/>
    <path d="M38 8l6 6M44 8l-6 6" ${T} opacity=".5"/>`,

  // Doigt qui désigne, sortant d'une bulle.
  "plus-susceptible": `<rect x="5" y="8" width="26" height="20" rx="6" ${T}/><path d="M12 28l-3 7 9-7" ${T}/>
    <path d="M30 34v-9a3 3 0 0 1 6 0v6" ${T}/><path d="M36 31v-3a3 3 0 0 1 6 0v10c0 3-3 5-7 5h-6l-5-5" ${T}/>`,

  // Balance à deux plateaux.
  "tu-preferes": `<path d="M24 8v32" ${T}/><path d="M10 16h28" ${T}/><path d="M24 40h-8m8 0h8" ${T}/>
    <path d="M4 30a6 6 0 0 0 12 0l-6-14z" ${T}/><path d="M32 26a6 6 0 0 0 12 0l-6-10z" ${T}/>`,

  // Chapeau + lunettes de l'imposteur.
  undercover: `<path d="M8 24h32" ${T}/><path d="M14 24c0-10 3-14 10-14s10 4 10 14" ${T}/>
    <circle cx="16" cy="35" r="6" ${T}/><circle cx="33" cy="35" r="6" ${T}/><path d="M22 35h5" ${T}/>`,

  // Nez qui s'allonge.
  menteur: `<path d="M18 12a14 14 0 1 0 0 26" ${T}/><path d="M18 24h24" ${T}/><path d="M36 19l6 5-6 5" ${T}/>
    <circle cx="13" cy="20" r="2" fill="currentColor"/>`,

  // Note de musique + ondes.
  "blind-test": `<path d="M18 34V10l16-4v24" ${T}/><ellipse cx="13" cy="34" rx="6" ry="5" ${T}/>
    <ellipse cx="29" cy="30" rx="6" ry="5" ${T}/>
    <path d="M40 14a9 9 0 0 1 0 12" ${T} opacity=".5"/><path d="M44 9a16 16 0 0 1 0 22" ${T} opacity=".3"/>`,

  // Ampoule (l'idée) sur socle.
  "quiz-gages": `<path d="M24 6a13 13 0 0 0-8 23c1.5 1.5 2 3 2 5h12c0-2 .5-3.5 2-5a13 13 0 0 0-8-23z" ${T}/>
    <path d="M18 40h12M20 44h8" ${T}/><path d="M24 18v6" ${T} opacity=".55"/>`,

  // Chronomètre.
  baccalaureat: `<circle cx="24" cy="27" r="16" ${T}/><path d="M24 27V17" ${T}/><path d="M24 27l7 5" ${T}/>
    <path d="M18 6h12" ${T}/><path d="M24 6v5" ${T}/><path d="M38 13l4-4" ${T} opacity=".5"/>`,

  // Feuille pliée + plume.
  "cadavre-exquis": `<path d="M12 6h16l8 8v28H12z" ${T}/><path d="M28 6v8h8" ${T}/>
    <path d="M18 24h12M18 32h8" ${T} opacity=".55"/><path d="M40 20l6 6-10 10-6-6z" ${T}/>`,
};

/** Illustration d'un jeu, en SVG inline. `null` si le jeu n'en a pas (on
    retombe alors sur son emoji, qui reste une valeur de repli honorable). */
export function gameArt(id, { size = 48 } = {}) {
  const d = DESSINS[id];
  if (!d) return null;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 48 48");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.classList.add("game-art");
  svg.innerHTML = d; // contenu strictement interne à ce module, jamais une saisie
  return svg;
}

export function aDessin(id) {
  return !!DESSINS[id];
}
