import { el, screenHead, announce, showPhase } from "../../ui.js";
import { createDeck } from "../../deck.js";
import { openEditor } from "../../content.js";
import { contentSource } from "../../game-kit.js";
import { DILEMMES } from "./data.js";

const SCHEMA = {
  title: "Tu préfères…",
  fields: [
    { key: "a", label: "Option A", type: "text" },
    { key: "b", label: "Option B", type: "text" },
  ],
  summary: (e) => `${e.a}  /  ${e.b}`,
};

export function render(container, { game }) {
  const src = contentSource("tu-preferes", { builtIn: DILEMMES, keyOf: (d) => `${d.a}|${d.b}`, toValue: (e) => ({ a: e.a, b: e.b }) });
  let deck = createDeck(dilemmes());
  let counts = { a: 0, b: 0 };
  let revealed = false;

  container.append(screenHead(game.title, "Tape ton camp · le camp minoritaire boit"));
  const stage = el("div");
  container.append(stage);

  src.reload().then(() => (deck = createDeck(dilemmes())));

  function dilemmes() { return src.cards(); }
  function builtInList() { return DILEMMES.map((d) => ({ key: `${d.a}|${d.b}`, label: `${d.a} / ${d.b}` })); }
  function openEd() {
    openEditor(stage, { gameId: "tu-preferes", schema: SCHEMA, builtInList: builtInList(), onDone: async () => { await src.reload(); deck = createDeck(dilemmes()); draw(); } });
  }

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
    if (!d) {
      showPhase(stage, el("div.card.center", {}, [
        el("p", { text: "Aucun dilemme actif — ajoute-en ou change la source via ✏️ Mes cartes." }),
        el("button.btn", { text: "✏️ Mes cartes", style: "margin-top:12px", onClick: openEd }),
      ]));
      return;
    }
    showPhase(stage,
      el("div.tp-board", {}, [optionBtn("a", d.a), el("div.tp-or", { text: "OU" }), optionBtn("b", d.b)]),
      el("p.tp-verdict.center", { style: "min-height:22px;margin:16px 0;font-weight:700" }),
      el("button.btn.btn--full.tp-reveal", { text: "Révéler le résultat", onClick: reveal }),
      el("button.btn.btn--full.tp-next", { text: "Dilemme suivant →", style: "display:none", onClick: draw }),
      el("div.row", { style: "justify-content:center;margin-top:12px" }, [el("button.chip", { text: "✏️ Mes cartes", onClick: openEd })])
    );
  }

  draw();
}
