import { el, screenHead, announce, showPhase } from "../../ui.js";
import { createDeck } from "../../deck.js";
import { playersCard } from "../../players.js";
import { openEditor } from "../../content.js";
import { passThePhone, contentSource } from "../../game-kit.js";
import { liveSession } from "../../realtime.js";
import { MISSIONS } from "./data.js";

const SCHEMA = {
  title: "Le Menteur",
  fields: [{ key: "text", label: "Mission à glisser dans la conversation", type: "text" }],
  summary: (e) => e.text,
};

export function render(container, { game }) {
  const src = contentSource("menteur", { builtIn: MISSIONS });
  let deck = createDeck(missions());
  let liveStop = null;
  container.append(screenHead(game.title, "Une mission secrète à glisser dans la conversation"));
  const stage = el("div");
  container.append(stage);

  modeSelect();
  reload();

  // Cleanup appelé par le routeur : stoppe les timers du mode multi si actif.
  return () => { if (liveStop) liveStop(); };

  function modeSelect() {
    showPhase(stage,
      el("div.card.center", {}, [
        el("h3", { text: "Comment jouer ?" }),
        el("button.btn.btn--full", { text: "📱 Sur ce téléphone", onClick: introScreen }),
        el("button.btn.btn--full.btn--ghost", { text: "🌐 Multi-appareils", style: "margin-top:10px", onClick: startLive }),
      ])
    );
  }
  function startLive() {
    if (liveStop) liveStop();
    liveStop = liveSession(stage, {
      gameId: "menteur",
      title: "Le Menteur — multi",
      minPlayers: 2,
      onExit: modeSelect,
      assign: (ps) => {
        const roles = {};
        ps.forEach((p) => (roles[p.id] = { mission: deck.next() }));
        return { roles };
      },
      renderMine: (mine) =>
        el("div", {}, [
          el("p.screen__subtitle", { text: "Ta mission :" }),
          el("div.mt-mission", { text: mine.mission }),
          el("p.screen__subtitle", { text: "Accomplis-la sans te faire griller." }),
        ]),
      renderReveal: (live) =>
        el("div", {}, [
          el("h3.center", { text: "Les missions", style: "margin-bottom:10px" }),
          el("div.stack", {},
            Object.keys(live.roles).map((id) =>
              el("div.mt-reveal-row", {}, [el("strong", { text: live.names[id] || "?" }), el("span", { text: live.roles[id].mission })])
            )
          ),
        ]),
    });
  }

  async function reload() {
    await src.reload();
    deck = createDeck(missions());
  }
  function missions() { return src.cards(); }
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
    passThePhone(stage, players, {
      icon: "🤫",
      cta: "Voir ma mission",
      onPlayer: (name, i, next) =>
        showPhase(stage,
          el("div.card.center", {}, [
            el("p.screen__subtitle", { text: name + ", ta mission :" }),
            el("div.mt-mission", { text: roles[i].mission }),
            el("p.screen__subtitle", { text: "Accomplis-la sans te faire griller. Ne montre à personne." }),
            el("button.btn.btn--full", { text: "Compris, cacher →", style: "margin-top:18px", onClick: next }),
          ])
        ),
      onDone: () => discussion(roles),
    });
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
