import { el, screenHead } from "../../ui.js";
import { createDeck } from "../../deck.js";
import { pickGage } from "../../gages.js";
import { QUESTIONS } from "./data.js";

export function render(container, { game }) {
  const deck = createDeck(QUESTIONS); // anti-répétition partagée
  let count = 0;
  let answered = false;

  container.append(screenHead(game.title, "Mauvaise réponse = gorgée ou gage"));
  const stage = el("div");
  container.append(stage);

  function draw() {
    answered = false;
    const item = deck.next();
    count++;
    const feedback = el("div.qz-feedback", { style: "min-height:26px;margin-top:14px" });
    const nextBtn = el("button.btn.btn--full", { text: "Question suivante →", style: "display:none;margin-top:14px", onClick: draw });

    const choices = el(
      "div.stack.qz-choices",
      {},
      item.choices.map((c, idx) =>
        el("button.btn.btn--ghost.btn--full.qz-choice", {
          text: c,
          onClick: (e) => {
            if (answered) return;
            answered = true;
            const correct = idx === item.correct;
            choices.querySelectorAll(".qz-choice").forEach((b, bi) => {
              b.disabled = true;
              if (bi === item.correct) b.classList.add("is-correct");
            });
            if (!correct) {
              e.currentTarget.classList.add("is-wrong");
              // Contenu construit en nœuds DOM (jamais innerHTML).
              feedback.replaceChildren("❌ Raté ! ", el("strong", { text: pickGage() }));
            } else {
              feedback.textContent = "✅ Bien joué !";
            }
            nextBtn.style.display = "";
          },
        })
      )
    );

    stage.replaceChildren(
      el("div.card", {}, [
        el("p.screen__subtitle", { text: `Question ${count}` }),
        el("h2.qz-question", { text: item.q, style: "margin:8px 0 18px" }),
        choices,
        feedback,
        nextBtn,
      ])
    );
  }

  draw();
}
