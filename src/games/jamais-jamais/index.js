import { el, screenHead, shuffle } from "../../ui.js";
import { PHRASES } from "./data.js";

export function render(container, { game }) {
  let intensity = "soft";
  let deck = [];
  let index = -1;

  const promptBox = el("div.big-prompt.jj-prompt", {
    text: "Appuie sur « Suivant ». Bois si tu l'as déjà fait !",
  });
  const counter = el("div.jj-counter", { text: "" });

  function reshuffle() {
    deck = shuffle(PHRASES[intensity]);
    index = -1;
  }

  function next() {
    if (!deck.length || index >= deck.length - 1) reshuffle();
    index++;
    promptBox.textContent = "Je n'ai jamais… " + deck[index];
    counter.textContent = `${index + 1} / ${deck.length}`;
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
    reshuffle();
    promptBox.textContent = "Appuie sur « Suivant ». Bois si tu l'as déjà fait !";
    counter.textContent = "";
  }
  softChip.addEventListener("click", () => setIntensity("soft"));
  hotChip.addEventListener("click", () => setIntensity("hot"));

  reshuffle();

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
