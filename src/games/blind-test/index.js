import { el, screenHead } from "../../ui.js";
import { playersCard } from "../../players.js";
import { createScores, scoreboard } from "../../scoring.js";
import { createDeck } from "../../deck.js";
import { TRACKS } from "./data.js";

export function render(container, { game }) {
  container.append(screenHead(game.title, "Buzzer + scores en temps réel"));
  const stage = el("div");
  container.append(stage);
  let currentAudio = null; // extrait en cours, pour pouvoir l'arrêter

  stage.append(
    playersCard({ min: 2, cta: "Lancer le blind test", onReady: (names) => startGame(names) })
  );

  // Nettoyage appelé par le routeur : coupe l'extrait si on quitte le jeu.
  return () => {
    if (currentAudio) currentAudio.pause();
    currentAudio = null;
  };

  function startGame(players) {
    const sc = createScores("blind-test", players); // scores persistés par soirée
    const deck = createDeck(TRACKS);
    let round = 0;
    let buzzedBy = null;
    let revealed = false;

    function playRound() {
      buzzedBy = null;
      revealed = false;
      let t = deck.next();
      if (!t) { deck.reset(); t = deck.next(); } // toutes les pistes vues : on recommence

      const audio = t.audioUrl
        ? el("audio.bt-audio", { src: t.audioUrl, controls: "", "aria-label": "Extrait à deviner" })
        : el("div.placeholder", { text: "Pas d'audio branché : lance l'extrait depuis ton téléphone/enceinte, puis buzzez." });

      // Coupe l'extrait précédent et mémorise le nouveau (pour le cleanup).
      if (currentAudio) currentAudio.pause();
      currentAudio = t.audioUrl ? audio : null;

      const buzzers = el(
        "div.bt-buzzers",
        {},
        players.map((p) =>
          el("button.bt-buzzer", {
            text: p,
            onClick: (e) => {
              if (buzzedBy) return;
              buzzedBy = p;
              buzzInfo.textContent = `🔔 ${p} a buzzé !`;
              buzzers.querySelectorAll(".bt-buzzer").forEach((b) => (b.disabled = true));
              e.currentTarget.classList.add("is-buzzed");
              judge.style.display = "";
            },
          })
        )
      );

      const buzzInfo = el("p.bt-buzzinfo.center", { text: "Premier à buzzer !", style: "font-weight:700;margin:14px 0" });

      const judge = el("div.row", { style: "display:none;justify-content:center;margin-top:6px" }, [
        el("button.btn", { text: "✅ Correct (+1)", onClick: () => resolve(true) }),
        el("button.btn.btn--ghost", { text: "❌ Raté", onClick: () => resolve(false) }),
      ]);

      const answer = el("div.bt-answer", { style: "display:none" });

      function resolve(correct) {
        if (correct && buzzedBy) sc.add(buzzedBy);
        revealAnswer();
      }
      function revealAnswer() {
        if (revealed) return;
        revealed = true;
        answer.style.display = "";
        answer.replaceChildren(
          el("div.bt-answer__title", { text: t.title }),
          el("div.bt-answer__artist", { text: t.artist })
        );
        scoreWrap.replaceChildren(scoreboard(sc.scores));
        judge.style.display = "none";
      }

      const scoreWrap = el("div", {}, [scoreboard(sc.scores)]);

      stage.replaceChildren(
        el("div.card", {}, [
          el("p.screen__subtitle.center", { text: `Manche ${round + 1}` }),
          audio,
          buzzInfo,
          buzzers,
          judge,
          answer,
          el("div.row", { style: "justify-content:center;margin-top:18px" }, [
            el("button.btn.btn--ghost", { text: "Révéler la réponse", onClick: revealAnswer }),
            el("button.btn", { text: "Manche suivante →", onClick: () => { round++; playRound(); } }),
          ]),
        ]),
        el("div.card", { style: "margin-top:16px" }, [
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
        ]),
      );
    }

    sc.ready.then(playRound); // affiche d'emblée les scores persistés de la soirée
  }
}
