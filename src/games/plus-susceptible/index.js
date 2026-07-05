import { el, screenHead } from "../../ui.js";
import { playersCard } from "../../players.js";
import { createDeck } from "../../deck.js";
import { AFFIRMATIONS } from "./data.js";

export function render(container, { game }) {
  container.append(screenHead(game.title, "Vote anonyme · passe le téléphone"));
  const stage = el("div");
  container.append(stage);

  stage.append(
    playersCard({ min: 3, cta: "Lancer les votes", onReady: (names) => startGame(names) })
  );

  function startGame(players) {
    const deck = createDeck(AFFIRMATIONS); // anti-répétition partagée

    function nextRound() {
      runVote(players, deck.next());
    }
    nextRound();

    /* Vote pass-the-phone : chaque joueur désigne secrètement quelqu'un. */
    function runVote(players, statement) {
      const votes = {};
      let voter = 0;

      function showVoter() {
        if (voter >= players.length) return reveal();
        const current = players[voter];
        stage.replaceChildren(
          el("div.card.center", {}, [
            el("p.ps-statement", { text: `Qui est le plus susceptible de ${statement}` }),
            el("p.screen__subtitle", { text: `Au tour de ${current} de voter` }),
            el(
              "div.stack.ps-choices",
              { style: "margin-top:18px" },
              players
                .filter((p) => p !== current)
                .map((p) =>
                  el("button.btn.btn--ghost.btn--full", {
                    text: p,
                    onClick: () => {
                      votes[p] = (votes[p] || 0) + 1;
                      voter++;
                      // écran tampon pour préserver l'anonymat
                      hiddenPass();
                    },
                  })
                )
            ),
          ])
        );
      }

      function hiddenPass() {
        if (voter >= players.length) return reveal();
        stage.replaceChildren(
          el("div.card.center", {}, [
            el("p.big-prompt", { text: "🙈" }),
            el("p", { text: `Passe le téléphone à ${players[voter]}` }),
            el("button.btn.btn--full", { text: "Je suis prêt·e", style: "margin-top:18px", onClick: showVoter }),
          ])
        );
      }

      function reveal() {
        const max = Math.max(0, ...Object.values(votes));
        const winners = Object.keys(votes).filter((p) => votes[p] === max);
        const ranking = players
          .map((p) => ({ p, v: votes[p] || 0 }))
          .sort((a, b) => b.v - a.v);
        stage.replaceChildren(
          el("div.card.center", {}, [
            el("p.ps-statement", { text: `Qui est le plus susceptible de ${statement}` }),
            el("h2.ps-winner", {
              text: winners.length > 1 ? winners.join(" & ") + " 🍻" : winners[0] + " boit ! 🍻",
              style: "margin:14px 0",
            }),
            el(
              "div.ps-ranking",
              {},
              ranking.map((r) =>
                el("div.ps-rank-row", {}, [
                  el("span", { text: r.p }),
                  el("span.ps-rank-bar", { style: `--v:${max ? r.v / max : 0}` }),
                  el("span", { text: String(r.v) }),
                ])
              )
            ),
            el("button.btn.btn--full", { text: "Affirmation suivante →", style: "margin-top:20px", onClick: nextRound }),
          ])
        );
      }

      showVoter();
    }
  }
}
