/* =========================================================================
   LEVELS — système de niveaux d'intensité unifié, partagé par tous les jeux.
   Trois niveaux EXCLUSIFS, tous directement sélectionnables : soft · soirée · 18+.

   levelSelector({ initial, onChange }) -> { node, get() }
     - node : l'élément à insérer (les 3 chips)
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
  let current = initial;
  const chips = {};

  const row = el("div.row.lvl-row", { style: "justify-content:center;flex-wrap:wrap" });
  LEVELS.forEach((lv) => {
    const chip = el("button.chip", { text: lv.label, "aria-pressed": "false" });
    chip.dataset.level = lv.id;
    chip.addEventListener("click", () => select(lv.id));
    chips[lv.id] = chip;
    row.appendChild(chip);
  });

  function select(id) {
    current = id;
    for (const [lid, chip] of Object.entries(chips)) {
      const active = lid === current;
      chip.classList.toggle("is-active", active);
      chip.setAttribute("aria-pressed", active ? "true" : "false");
    }
    onChange && onChange(current);
  }

  select(current);

  return { node: el("div.lvl", {}, [row]), get: () => current };
}
