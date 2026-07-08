import { el, screenHead, announce, showPhase } from "../../ui.js";
import { playersCard } from "../../players.js";
import { createDeck } from "../../deck.js";
import { createScores, scoreboard } from "../../scoring.js";
import { openEditor, loadContent, loadConfig, activeCards } from "../../content.js";
import { passThePhone } from "../../game-kit.js";
import { AFFIRMATIONS } from "./data.js";

const SCHEMA = {
  title: "Qui est le plus susceptible de…",
  fields: [{ key: "text", label: "… (commence par un verbe : « finir la soirée… »)", type: "text" }],
  summary: (e) => e.text,
};

export function render(container, { game }) {
  let custom = [];
  let config = { onlyCustom: false, disabled: {} };
  container.append(screenHead(game.title, "Vote anonyme · roi/reine de la soirée"));
  const stage = el("div");
  container.append(stage);

  introScreen();
  reload();

  async function reload() {
    [custom, config] = await Promise.all([loadContent("plus-susceptible"), loadConfig("plus-susceptible")]);
  }
  function affirmations() {
    return activeCards({ builtIn: AFFIRMATIONS, custom, config, keyOf: (t) => t, customToValue: (e) => e.text });
  }
  function builtInList() {
    return AFFIRMATIONS.map((t) => ({ key: t, label: t }));
  }

  function introScreen() {
    stage.replaceChildren(
      playersCard({ min: 3, cta: "Lancer les votes", onReady: (names) => startGame(names) }),
      el("div.row", { style: "justify-content:center;margin-top:14px" }, [el("button.chip", { text: "✏️ Mes cartes", onClick: openEd })])
    );
  }

  function openEd() {
    openEditor(stage, {
      gameId: "plus-susceptible",
      schema: SCHEMA,
      builtInList: builtInList(),
      onDone: async () => { await reload(); introScreen(); },
    });
  }

  function startGame(players) {
    if (!affirmations().length) {
      showPhase(stage, el("div.card.center", {}, [
        el("p", { text: "Aucune affirmation active — ajoute-en ou change la source via ✏️ Mes cartes." }),
        el("button.btn", { text: "✏️ Mes cartes", style: "margin-top:12px", onClick: openEd }),
      ]));
      return;
    }
    const deck = createDeck(affirmations()); // intégré + perso, anti-répétition
    const sc = createScores("plus-susceptible", players); // couronnes cumulées, persistées

    function nextRound() {
      runVote(players, deck.next());
    }

    /* Vote pass-the-phone : chaque joueur désigne secrètement quelqu'un. */
    function runVote(players, statement) {
      const votes = {};

      function reveal() {
        const max = Math.max(0, ...Object.values(votes));
        const winners = Object.keys(votes).filter((p) => votes[p] === max);
        announce(winners.length > 1 ? winners.join(" et ") + " boivent" : winners[0] + " boit");
        winners.forEach((w) => sc.add(w)); // +1 couronne pour le/les plus désigné(s)

        const ranking = players.map((p) => ({ p, v: votes[p] || 0 })).sort((a, b) => b.v - a.v);
        const scoreWrap = el("div", {}, [scoreboard(sc.scores)]);

        showPhase(stage,
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
          ]),
          el("div.card", { style: "margin-top:14px" }, [
            el("div.row", { style: "justify-content:space-between;align-items:center;margin-bottom:10px" }, [
              el("h3", { text: "👑 Roi / Reine de la soirée" }),
              el("button.chip", {
                text: "↺ Réinitialiser",
                onClick: () => {
                  sc.reset();
                  scoreWrap.replaceChildren(scoreboard(sc.scores));
                },
              }),
            ]),
            scoreWrap,
          ]),
          el("button.btn.btn--full", { text: "Affirmation suivante →", style: "margin-top:14px", onClick: nextRound })
        );
      }

      passThePhone(stage, players, {
        icon: "🙈",
        cta: "voter",
        onPlayer: (current, i, next) =>
          showPhase(stage,
            el("div.card.center", {}, [
              el("p.ps-statement", { text: `Qui est le plus susceptible de ${statement}` }),
              el("p.screen__subtitle", { text: `Au tour de ${current} de voter` }),
              el("div.stack.ps-choices", { style: "margin-top:18px" },
                players.filter((p) => p !== current).map((p) =>
                  el("button.btn.btn--ghost.btn--full", { text: p, onClick: () => { votes[p] = (votes[p] || 0) + 1; next(); } })
                )
              ),
            ])
          ),
        onDone: reveal,
      });
    }

    sc.ready.then(nextRound); // charge les couronnes persistées avant la 1re manche
  }
}
