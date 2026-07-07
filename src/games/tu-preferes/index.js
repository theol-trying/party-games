import { el, screenHead, announce } from "../../ui.js";
import { createDeck } from "../../deck.js";
import { DILEMMES } from "./data.js";

export function render(container, { game }) {
  const deck = createDeck(DILEMMES); // anti-répétition partagée
  let counts = { a: 0, b: 0 };
  let revealed = false;

  container.append(screenHead(game.title, "Tape ton camp · le camp minoritaire boit"));
  const stage = el("div");
  container.append(stage);

  function optionBtn(side, label) {
    const btn = el("button.tp-option", {}, [
      el("div.tp-option__label", { text: label }),
      el("div.tp-option__count", { text: String(counts[side]) }),
    ]);
    btn.dataset.side = side;
    btn.addEventListener("click", () => {
      if (revealed) return;
      counts[side]++;
      btn.querySelector(".tp-option__count").textContent = counts[side];
    });
    return btn;
  }

  function reveal() {
    revealed = true;
    const { a, b } = counts;
    let verdict;
    if (a === b) verdict = "Égalité parfaite… tout le monde boit ! 🍻";
    else {
      const loser = a < b ? "A" : "B";
      verdict = `Camp ${loser} minoritaire → il boit ! 🍻`;
    }
    stage.querySelector(".tp-verdict").textContent = verdict;
    announce(verdict);
    stage.querySelectorAll(".tp-option").forEach((n) => {
      const side = n.dataset.side;
      const isMin = (side === "a" && a < b) || (side === "b" && b < a);
      n.classList.toggle("is-loser", isMin);
    });
    stage.querySelector(".tp-reveal").style.display = "none";
    stage.querySelector(".tp-next").style.display = "";
  }

  function draw() {
    revealed = false;
    counts = { a: 0, b: 0 };
    const d = deck.next();
    stage.replaceChildren(
      el("div.tp-board", {}, [optionBtn("a", d.a), el("div.tp-or", { text: "OU" }), optionBtn("b", d.b)]),
      el("p.tp-verdict.center", { style: "min-height:22px;margin:16px 0;font-weight:700" }),
      el("button.btn.btn--full.tp-reveal", { text: "Révéler le résultat", onClick: reveal }),
      el("button.btn.btn--full.tp-next", { text: "Dilemme suivant →", style: "display:none", onClick: draw })
    );
  }

  draw();
}
