import { el, screenHead } from "../../ui.js";
import { AMORCES } from "./data.js";

export function render(container, { game }) {
  let steps = 8; // nombre de contributions
  let seePrevious = false; // mode : voir la ligne précédente ou non

  container.append(screenHead(game.title, "Chacun écrit sans voir la suite"));
  const stage = el("div");
  container.append(stage);

  setup();

  function setup() {
    const stepChips = el("div.row", { style: "margin-top:8px" });
    [4, 6, 8, 10, 12].forEach((n) => {
      const c = el("button.chip", { text: `${n}` });
      if (n === steps) c.classList.add("is-active");
      c.addEventListener("click", () => {
        steps = n;
        [...stepChips.children].forEach((x) => x.classList.toggle("is-active", x.textContent === `${n}`));
      });
      stepChips.appendChild(c);
    });

    const modeChips = el("div.row", { style: "margin-top:8px" });
    const mHidden = el("button.chip.is-active", { text: "🙈 Rien voir (classique)" });
    const mPrev = el("button.chip", { text: "👀 Voir la ligne d'avant" });
    mHidden.addEventListener("click", () => { seePrevious = false; mHidden.classList.add("is-active"); mPrev.classList.remove("is-active"); });
    mPrev.addEventListener("click", () => { seePrevious = true; mPrev.classList.add("is-active"); mHidden.classList.remove("is-active"); });
    modeChips.append(mHidden, mPrev);

    stage.replaceChildren(
      el("div.card", {}, [
        el("h3", { text: "Nombre de contributions" }),
        stepChips,
        el("h3", { text: "Mode", style: "margin-top:16px" }),
        modeChips,
        el("button.btn.btn--full", { text: "Écrire l'histoire", style: "margin-top:18px", onClick: play }),
      ])
    );
  }

  function play() {
    const fragments = [];
    let step = 0;

    function passScreen() {
      if (step >= steps) return reveal();
      stage.replaceChildren(
        el("div.card.center", {}, [
          el("p.big-prompt", { text: "✍️" }),
          el("p", { text: `Contribution ${step + 1} / ${steps}` }),
          el("p.screen__subtitle", { text: "Passe le téléphone au joueur suivant" }),
          el("button.btn.btn--full", { text: "À moi d'écrire", style: "margin-top:18px", onClick: writeScreen }),
        ])
      );
    }

    function writeScreen() {
      const amorce = AMORCES[step % AMORCES.length];
      const ta = el("textarea.input.ce-input", { rows: "3", placeholder: "…" });
      const prev = fragments[fragments.length - 1];

      const blocks = [
        el("p.screen__subtitle", { text: `Contribution ${step + 1} / ${steps}` }),
        el("div.ce-amorce", { text: amorce }),
      ];
      if (seePrevious && prev) {
        blocks.push(el("div.ce-prev", {}, [el("span.ce-prev__tag", { text: "Ligne précédente :" }), el("span", { text: prev })]));
      }
      blocks.push(
        ta,
        el("button.btn.btn--full", {
          text: step === steps - 1 ? "Terminer l'histoire" : "Valider & cacher →",
          style: "margin-top:14px",
          onClick: () => {
            const txt = ta.value.trim();
            fragments.push(`${amorce} ${txt}`.trim());
            step++;
            passScreen();
          },
        })
      );
      stage.replaceChildren(el("div.card", {}, blocks));
      ta.focus();
    }

    function reveal() {
      stage.replaceChildren(
        el("div.card", {}, [
          el("h2.center", { text: "📖 Votre chef-d'œuvre", style: "margin-bottom:16px" }),
          el(
            "div.ce-story",
            {},
            fragments.map((f) => el("p.ce-line", { text: f }))
          ),
          el("div.row", { style: "justify-content:center;margin-top:20px" }, [
            el("button.btn", { text: "Nouvelle histoire", onClick: play }),
            el("button.btn.btn--ghost", { text: "Réglages", onClick: setup }),
          ]),
        ])
      );
    }

    passScreen();
  }
}
