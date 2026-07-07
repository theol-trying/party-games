import { el, screenHead, announce } from "../../ui.js";
import { createDeck } from "../../deck.js";
import { playersCard } from "../../players.js";
import { MISSIONS } from "./data.js";

export function render(container, { game }) {
  const deck = createDeck(MISSIONS);
  container.append(screenHead(game.title, "Une mission secrète à glisser dans la conversation"));
  const stage = el("div");
  container.append(stage);

  stage.append(
    playersCard({ min: 2, cta: "Distribuer les missions", onReady: (names) => distribute(names) })
  );

  function distribute(players) {
    const roles = players.map((name) => ({ name, mission: deck.next() }));

    let idx = 0;
    function pass() {
      if (idx >= roles.length) return discussion(roles);
      stage.replaceChildren(
        el("div.card.center", {}, [
          el("p.big-prompt", { text: "🤫" }),
          el("p", { text: `Passe le téléphone à ${roles[idx].name}` }),
          el("button.btn.btn--full", { text: "Voir ma mission", style: "margin-top:18px", onClick: showMission }),
        ])
      );
    }
    function showMission() {
      const r = roles[idx];
      stage.replaceChildren(
        el("div.card.center", {}, [
          el("p.screen__subtitle", { text: r.name + ", ta mission :" }),
          el("div.mt-mission", { text: r.mission }),
          el("p.screen__subtitle", { text: "Accomplis-la sans te faire griller. Ne montre à personne." }),
          el("button.btn.btn--full", { text: "Compris, cacher →", style: "margin-top:18px", onClick: () => { idx++; pass(); } }),
        ])
      );
    }
    pass();
  }

  function discussion(roles) {
    stage.replaceChildren(
      el("div.card.center", {}, [
        el("h3", { text: "Lancez la conversation 🗣️" }),
        el("p", {
          text:
            "Discutez normalement. Chacun tente d'accomplir sa mission sans se faire repérer. " +
            "Si tu penses avoir démasqué quelqu'un, accuse-le ! À la fin :",
          style: "color:var(--text-dim);margin:12px 0 20px",
        }),
        el("button.btn.btn--full", { text: "Révéler les missions", onClick: () => reveal(roles) }),
      ])
    );
  }

  function reveal(roles) {
    announce("Les missions sont révélées");
    stage.replaceChildren(
      el("div.card", {}, [
        el("h3.center", { text: "Les missions étaient…", style: "margin-bottom:16px" }),
        el(
          "div.stack",
          {},
          roles.map((r) =>
            el("div.mt-reveal-row", {}, [
              el("strong", { text: r.name }),
              el("span", { text: r.mission }),
            ])
          )
        ),
        el("button.btn.btn--full", { text: "Rejouer", style: "margin-top:20px", onClick: () => {
          stage.replaceChildren(
            playersCard({ min: 2, cta: "Distribuer les missions", onReady: (names) => distribute(names) })
          );
        } }),
      ])
    );
  }
}
