import { el, screenHead } from "../../ui.js";
import { createDeck } from "../../deck.js";
import { levelSelector, LEVELS } from "../../levels.js";
import { VERITES, ACTIONS } from "./data.js";

export function render(container, { game }) {
  let level = "soft";

  // Un paquet anti-répétition par combinaison (type × niveau).
  const decks = { verite: {}, action: {} };
  for (const lv of LEVELS.map((l) => l.id)) {
    decks.verite[lv] = createDeck(VERITES[lv] || []);
    decks.action[lv] = createDeck(ACTIONS[lv] || []);
  }

  const promptBox = el("div.big-prompt.av-prompt", { text: "Prêt·e ? Choisis Action ou Vérité." });
  const tag = el("div.av-tag");

  function draw(kind) {
    const card = decks[kind][level].next();
    promptBox.textContent =
      card || "Aucune carte à ce niveau pour l'instant — ajoute-en dans data.js.";
    promptBox.classList.remove("av-flash");
    void promptBox.offsetWidth; // reflow pour rejouer l'anim
    promptBox.classList.add("av-flash");
    tag.textContent = kind === "verite" ? "🗣️ Vérité" : "🔥 Action";
    tag.dataset.kind = kind;
  }

  const levelUI = levelSelector({ initial: level, onChange: (v) => (level = v) });

  container.append(
    screenHead(game.title, "Niveau réglable · appuie sur un bouton"),
    el("div.card.av-card", {}, [
      el("div", { style: "margin-bottom:18px" }, [levelUI.node]),
      tag,
      promptBox,
      el("div.row", { style: "justify-content:center;margin-top:22px" }, [
        el("button.btn.av-btn-verite", { text: "Vérité", onClick: () => draw("verite") }),
        el("button.btn.av-btn-action", { text: "Action", onClick: () => draw("action") }),
      ]),
    ])
  );
}
