import { el, screenHead, announce, showPhase } from "../../ui.js";
import { createDeck } from "../../deck.js";
import { playersCard } from "../../players.js";
import { openEditor, loadContent, loadConfig, activeCards } from "../../content.js";
import { MISSIONS } from "./data.js";

const SCHEMA = {
  title: "Le Menteur",
  fields: [{ key: "text", label: "Mission à glisser dans la conversation", type: "text" }],
  summary: (e) => e.text,
};

export function render(container, { game }) {
  let custom = [];
  let config = { onlyCustom: false, disabled: {} };
  let deck = createDeck(missions());
  container.append(screenHead(game.title, "Une mission secrète à glisser dans la conversation"));
  const stage = el("div");
  container.append(stage);

  introScreen();
  reload();

  async function reload() {
    [custom, config] = await Promise.all([loadContent("menteur"), loadConfig("menteur")]);
    deck = createDeck(missions());
  }
  function missions() {
    return activeCards({ builtIn: MISSIONS, custom, config, keyOf: (t) => t, customToValue: (e) => e.text });
  }
  function builtInList() { return MISSIONS.map((t) => ({ key: t, label: t })); }
  function introScreen() {
    showPhase(stage,
      playersCard({ min: 2, cta: "Distribuer les missions", onReady: (names) => distribute(names) }),
      el("div.row", { style: "justify-content:center;margin-top:14px" }, [el("button.chip", { text: "✏️ Mes cartes", onClick: openEd })])
    );
  }
  function openEd() {
    openEditor(stage, { gameId: "menteur", schema: SCHEMA, builtInList: builtInList(), onDone: async () => { await reload(); introScreen(); } });
  }

  function distribute(players) {
    if (!missions().length) {
      showPhase(stage, el("div.card.center", {}, [
        el("p", { text: "Aucune mission active — ajoute-en ou change la source via ✏️ Mes cartes." }),
        el("button.btn", { text: "✏️ Mes cartes", style: "margin-top:12px", onClick: openEd }),
      ]));
      return;
    }
    const roles = players.map((name) => ({ name, mission: deck.next() }));

    let idx = 0;
    function pass() {
      if (idx >= roles.length) return discussion(roles);
      showPhase(stage,
        el("div.card.center", {}, [
          el("p.big-prompt", { text: "🤫" }),
          el("p", { text: `Passe le téléphone à ${roles[idx].name}` }),
          el("button.btn.btn--full", { text: "Voir ma mission", style: "margin-top:18px", onClick: showMission }),
        ])
      );
    }
    function showMission() {
      const r = roles[idx];
      showPhase(stage,
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
    showPhase(stage,
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
    showPhase(stage,
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
        el("button.btn.btn--full", { text: "Rejouer", style: "margin-top:20px", onClick: introScreen }),
      ])
    );
  }
}
