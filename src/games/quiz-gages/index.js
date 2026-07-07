import { el, screenHead, announce, showPhase } from "../../ui.js";
import { playersCard } from "../../players.js";
import { createDeck } from "../../deck.js";
import { createScores, scoreboard } from "../../scoring.js";
import { pickGage } from "../../gages.js";
import { levelSelector } from "../../levels.js";
import { teamBuilder } from "../../teams.js";
import { QUESTIONS } from "./data.js";

export function render(container, { game }) {
  container.append(screenHead(game.title, "Chacun son tour · bonne réponse = point, sinon gage"));
  const stage = el("div");
  container.append(stage);

  stage.append(
    playersCard({ min: 2, cta: "Suite →", onReady: (names) => modeScreen(names) })
  );

  // Choix : chacun pour soi ou en équipes.
  function modeScreen(names) {
    showPhase(stage,
      el("div.card.center", {}, [
        el("h3", { text: "Mode de jeu" }),
        el("p.screen__subtitle", { text: `${names.length} joueurs`, style: "margin:6px 0 14px" }),
        el("button.btn.btn--full", { text: "🙋 Chacun pour soi", onClick: () => startGame(names, "quiz-gages") }),
        el("button.btn.btn--full.btn--ghost", {
          text: "👥 En équipes",
          style: "margin-top:10px",
          onClick: () => showPhase(stage, teamBuilder({ players: names, onReady: (teams) => startGame(teams.map((t) => t.name), "quiz-gages:teams") })),
        }),
      ])
    );
  }

  function startGame(players, scoreKey = "quiz-gages") {
    const deck = createDeck(QUESTIONS); // anti-répétition partagée
    const sc = createScores(scoreKey, players); // scores persistés par soirée (par joueur ou par équipe)
    let count = 0;
    let turn = 0;
    let answered = false;
    let level = "soft"; // niveau des gages

    const levelUI = levelSelector({ initial: level, onChange: (v) => (level = v) });
    const qArea = el("div");
    const scoreWrap = el("div", {}, [scoreboard(sc.scores)]);

    function draw() {
      answered = false;
      const item = deck.next();
      count++;
      const player = players[turn % players.length];

      const feedback = el("div.qz-feedback", { style: "min-height:26px;margin-top:14px" });
      const nextBtn = el("button.btn.btn--full", {
        text: "Question suivante →",
        style: "display:none;margin-top:14px",
        onClick: () => { turn++; draw(); },
      });

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
              if (correct) {
                sc.add(player);
                feedback.textContent = `✅ Bien joué, ${player} ! +1`;
                announce(`Bonne réponse pour ${player}`);
              } else {
                e.currentTarget.classList.add("is-wrong");
                const gage = pickGage(level);
                feedback.replaceChildren(`❌ Raté, ${player} ! `, el("strong", { text: gage }));
                announce(`Raté pour ${player}. ${gage}`);
              }
              scoreWrap.replaceChildren(scoreboard(sc.scores));
              nextBtn.style.display = "";
            },
          })
        )
      );

      showPhase(qArea,
        el("div.card", {}, [
          el("p.screen__subtitle", { text: `Question ${count} · 🎯 au tour de ${player}` }),
          el("h2.qz-question", { text: item.q, style: "margin:8px 0 18px" }),
          choices,
          feedback,
          nextBtn,
        ])
      );
    }

    stage.replaceChildren(
      el("div.card", { style: "margin-bottom:14px" }, [
        el("p.screen__subtitle", { text: "Niveau des gages", style: "margin-bottom:8px" }),
        levelUI.node,
      ]),
      qArea,
      el("div.card", { style: "margin-top:14px" }, [
        el("div.row", { style: "justify-content:space-between;align-items:center;margin-bottom:10px" }, [
          el("h3", { text: "Scores" }),
          el("button.chip", {
            text: "↺ Réinitialiser",
            onClick: () => {
              sc.reset();
              scoreWrap.replaceChildren(scoreboard(sc.scores));
            },
          }),
        ]),
        scoreWrap,
      ])
    );

    sc.ready.then(draw); // charge les scores persistés avant la 1re question
  }
}
