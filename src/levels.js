/* =========================================================================
   LEVELS — système de niveaux d'intensité unifié, partagé par tous les jeux.
   Trois niveaux EXCLUSIFS : soft · soirée · 18+.
   Le 18+ est verrouillé derrière une case de consentement (contenu explicite).

   levelSelector({ initial, onChange }) -> { node, get() }
     - node : l'élément à insérer (chips + case 18+)
     - get() : le niveau courant ("soft" | "soiree" | "x18")
     - onChange(level) : appelé à chaque changement
   ========================================================================= */

import { el } from "./ui.js";

export const LEVELS = [
  { id: "soft", label: "😇 Soft" },
  { id: "soiree", label: "🥳 Soirée" },
  { id: "x18", label: "🔥 18+" },
];

export const DEFAULT_LEVEL = "soft";

export function levelSelector({ initial = DEFAULT_LEVEL, onChange } = {}) {
  let current = initial === "x18" ? DEFAULT_LEVEL : initial; // 18+ verrouillé au départ
  let unlocked = false;
  const chips = {};

  const row = el("div.row.lvl-row", { style: "justify-content:center;flex-wrap:wrap" });
  LEVELS.forEach((lv) => {
    const chip = el("button.chip", { text: lv.label, "aria-pressed": "false" });
    chip.dataset.level = lv.id;
    if (lv.id === "x18") chip.hidden = true; // masqué tant que non déverrouillé
    chip.addEventListener("click", () => select(lv.id));
    chips[lv.id] = chip;
    row.appendChild(chip);
  });

  const check = el("input", { type: "checkbox", "aria-label": "Activer le contenu 18+" });
  check.addEventListener("change", () => {
    unlocked = check.checked;
    chips.x18.hidden = !unlocked;
    if (!unlocked && current === "x18") select("soft");
  });
  const consent = el("label.lvl-consent", {}, [check, el("span", { text: "🔞 Activer le 18+ (explicite, adultes avertis)" })]);

  function select(id) {
    if (id === "x18" && !unlocked) return;
    current = id;
    for (const [lid, chip] of Object.entries(chips)) {
      const active = lid === current;
      chip.classList.toggle("is-active", active);
      chip.setAttribute("aria-pressed", active ? "true" : "false");
    }
    onChange && onChange(current);
  }

  select(current);

  return { node: el("div.lvl", {}, [row, consent]), get: () => current };
}
