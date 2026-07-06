import { el, screenHead } from "../../ui.js";
import { createDeck } from "../../deck.js";
import { levelSelector } from "../../levels.js";
import { PHRASES } from "./data.js";

export function render(container, { game }) {
  let level = "soft";
  let deck = createDeck(PHRASES[level] || []);

  const promptBox = el("div.big-prompt.jj-prompt", {
    text: "Appuie sur « Suivant ». Bois si tu l'as déjà fait !",
  });
  const counter = el("div.jj-counter", { text: "" });

  function next() {
    const phrase = deck.next();
    if (phrase == null) {
      promptBox.textContent = "Aucune phrase à ce niveau — ajoute-en dans data.js.";
      counter.textContent = "";
      return;
    }
    promptBox.textContent = "Je n'ai jamais… " + phrase;
    counter.textContent = `${deck.size() - deck.remaining()} / ${deck.size()}`;
    promptBox.classList.remove("jj-flash");
    void promptBox.offsetWidth;
    promptBox.classList.add("jj-flash");
  }

  const levelUI = levelSelector({
    initial: level,
    onChange: (v) => {
      level = v;
      deck = createDeck(PHRASES[level] || []);
      promptBox.textContent = "Appuie sur « Suivant ». Bois si tu l'as déjà fait !";
      counter.textContent = "";
    },
  });

  container.append(
    screenHead(game.title, "Bois si tu l'as déjà fait"),
    el("div.card.jj-card", {}, [
      el("div", { style: "margin-bottom:18px" }, [levelUI.node]),
      counter,
      promptBox,
      el("button.btn.btn--full.jj-btn", { text: "Suivant →", style: "margin-top:22px", onClick: next }),
    ])
  );
}
