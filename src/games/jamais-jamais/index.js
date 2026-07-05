import { el, screenHead } from "../../ui.js";
import { createDeck } from "../../deck.js";
import { PHRASES } from "./data.js";

export function render(container, { game }) {
  let intensity = "soft";
  let deck = createDeck(PHRASES[intensity]);

  const promptBox = el("div.big-prompt.jj-prompt", {
    text: "Appuie sur « Suivant ». Bois si tu l'as déjà fait !",
  });
  const counter = el("div.jj-counter", { text: "" });

  function next() {
    const phrase = deck.next();
    if (phrase == null) return;
    promptBox.textContent = "Je n'ai jamais… " + phrase;
    counter.textContent = `${deck.size() - deck.remaining()} / ${deck.size()}`;
    promptBox.classList.remove("jj-flash");
    void promptBox.offsetWidth;
    promptBox.classList.add("jj-flash");
  }

  const softChip = el("button.chip.is-active", { text: "😇 Soft" });
  const hotChip = el("button.chip", { text: "🌶️ Hot" });
  function setIntensity(v) {
    intensity = v;
    softChip.classList.toggle("is-active", v === "soft");
    hotChip.classList.toggle("is-active", v === "hot");
    deck = createDeck(PHRASES[intensity]);
    promptBox.textContent = "Appuie sur « Suivant ». Bois si tu l'as déjà fait !";
    counter.textContent = "";
  }
  softChip.addEventListener("click", () => setIntensity("soft"));
  hotChip.addEventListener("click", () => setIntensity("hot"));

  container.append(
    screenHead(game.title, "Bois si tu l'as déjà fait"),
    el("div.card.jj-card", {}, [
      el("div.row", { style: "justify-content:center;margin-bottom:18px" }, [softChip, hotChip]),
      counter,
      promptBox,
      el("button.btn.btn--full.jj-btn", { text: "Suivant →", style: "margin-top:22px", onClick: next }),
    ])
  );
}
