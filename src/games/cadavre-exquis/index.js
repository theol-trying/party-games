import { el, screenHead, announce, showPhase, shuffle, pick } from "../../ui.js";
import { openEditor } from "../../content.js";
import { contentSource } from "../../game-kit.js";
import { AMORCES, OUVERTURES, CLOTURES } from "./data.js";

const SCHEMA = {
  title: "Cadavre exquis",
  fields: [{ key: "text", label: "Amorce (début de phrase)", type: "text" }],
  summary: (e) => e.text,
};

export function render(container, { game }) {
  let steps = 8; // nombre de contributions
  let seePrevious = false; // mode : voir la ligne précédente ou non
  const src = contentSource("cadavre-exquis", { builtIn: AMORCES });

  container.append(screenHead(game.title, "Chacun écrit sans voir la suite"));
  const stage = el("div");
  container.append(stage);

  setup();
  src.reload();

  const amorces = () => src.cards();
  const builtInList = () => AMORCES.map((t) => ({ key: t, label: t }));

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

    showPhase(stage,
      el("div.card", {}, [
        el("h3", { text: "Nombre de contributions" }),
        stepChips,
        el("h3", { text: "Mode", style: "margin-top:16px" }),
        modeChips,
        el("button.btn.btn--full", { text: "Écrire l'histoire", style: "margin-top:18px", onClick: play }),
        el("div.row", { style: "justify-content:center;margin-top:12px" }, [el("button.chip", { text: "✏️ Mes amorces", onClick: openEd })]),
      ])
    );
  }

  function openEd() {
    openEditor(stage, {
      gameId: "cadavre-exquis",
      schema: SCHEMA,
      builtInList: builtInList(),
      onDone: async () => { await src.reload(); setup(); },
    });
  }

  function play() {
    const fragments = [];
    let step = 0;
    // Une ouverture, des connecteurs de milieu mélangés (intégrés + perso), une clôture.
    const mids = shuffle(amorces());

    function passScreen() {
      if (step >= steps) return reveal();
      showPhase(stage,
        el("div.card.center", {}, [
          el("p.big-prompt", { text: "✍️" }),
          el("p", { text: `Contribution ${step + 1} / ${steps}` }),
          el("p.screen__subtitle", { text: "Passe le téléphone au joueur suivant" }),
          el("button.btn.btn--full", { text: "À moi d'écrire", style: "margin-top:18px", onClick: writeScreen }),
        ])
      );
    }

    function writeScreen() {
      const amorce =
        step === 0 ? pick(OUVERTURES)
        : step === steps - 1 ? pick(CLOTURES)
        : mids.length ? mids[(step - 1) % mids.length]
        : pick(AMORCES);
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
      showPhase(stage,el("div.card", {}, blocks));
      ta.focus();
    }

    function reveal() {
      announce("Histoire terminée, lisez-la à voix haute");
      showPhase(stage,
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
