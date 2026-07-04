import { el, screenHead, shuffle, pick } from "../../ui.js";
import { QUESTIONS, GAGES } from "./data.js";

export function render(container, { game }) {
  let deck = shuffle(QUESTIONS);
  let i = 0;
  let answered = false;

  container.append(screenHead(game.title, "Mauvaise réponse = gorgée ou gage"));
  const stage = el("div");
  container.append(stage);

  function current() {
    if (i >= deck.length) deck = shuffle(QUESTIONS), (i = 0);
    return deck[i];
  }

  function draw() {
    answered = false;
    const item = current();
    const feedback = el("div.qz-feedback", { style: "min-height:26px;margin-top:14px" });
    const nextBtn = el("button.btn.btn--full", { text: "Question suivante →", style: "display:none;margin-top:14px", onClick: () => { i++; draw(); } });

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
              feedback.innerHTML = `❌ Raté ! <strong>${pick(GAGES)}</strong>`;
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
        el("p.screen__subtitle", { text: `Question ${i + 1}` }),
        el("h2.qz-question", { text: item.q, style: "margin:8px 0 18px" }),
        choices,
        feedback,
        nextBtn,
      ])
    );
  }

  draw();
}
