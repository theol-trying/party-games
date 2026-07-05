import { el, screenHead, pick } from "../../ui.js";
import { CATEGORIES_DEFAUT, LETTRES, DUREE_DEFAUT } from "./data.js";

export function render(container, { game }) {
  let duree = DUREE_DEFAUT;
  let categories = [...CATEGORIES_DEFAUT];
  let activeTimer = null; // chrono en cours, réf. au niveau du jeu pour pouvoir l'arrêter

  container.append(screenHead(game.title, "Une lettre, des catégories, le chrono tourne"));
  const stage = el("div");
  container.append(stage);

  setup();

  // Nettoyage appelé par le routeur quand on quitte le jeu : stoppe le chrono.
  return () => {
    if (activeTimer) clearInterval(activeTimer);
    activeTimer = null;
  };

  function setup() {
    const catText = el("textarea.input", {
      rows: "6",
      style: "resize:vertical",
      value: categories.join("\n"),
    });
    const dureeChips = el("div.row", { style: "margin-top:8px" });
    [60, 90, 120, 180].forEach((d) => {
      const c = el("button.chip", { text: `${d}s` });
      if (d === duree) c.classList.add("is-active");
      c.addEventListener("click", () => {
        duree = d;
        [...dureeChips.children].forEach((x) => x.classList.toggle("is-active", x.textContent === `${d}s`));
      });
      dureeChips.appendChild(c);
    });

    stage.replaceChildren(
      el("div.card", {}, [
        el("h3", { text: "Catégories (une par ligne)" }),
        catText,
        el("h3", { text: "Durée", style: "margin-top:16px" }),
        dureeChips,
        el("button.btn.btn--full", {
          text: "Tirer une lettre & démarrer",
          style: "margin-top:18px",
          onClick: () => {
            categories = catText.value.split("\n").map((s) => s.trim()).filter(Boolean);
            play();
          },
        }),
      ])
    );
  }

  function play() {
    const lettre = pick(LETTRES);
    let remaining = duree;

    const timeEl = el("div.bc-timer", { text: fmt(remaining) });
    const bar = el("div.bc-bar__fill");

    const inputs = categories.map((cat) =>
      el("label.bc-field", {}, [
        el("span.bc-field__label", { text: cat }),
        el("input.input", { placeholder: `en ${lettre}…`, maxlength: "30" }),
      ])
    );

    function tick() {
      remaining--;
      timeEl.textContent = fmt(remaining);
      bar.style.transform = `scaleX(${remaining / duree})`;
      if (remaining <= 10) timeEl.classList.add("is-low");
      if (remaining <= 0) stop(true);
    }
    function stop(timeUp) {
      if (activeTimer) clearInterval(activeTimer);
      activeTimer = null;
      finish(timeUp);
    }

    if (activeTimer) clearInterval(activeTimer); // sécurité : pas deux chronos à la fois
    activeTimer = setInterval(tick, 1000);

    stage.replaceChildren(
      el("div.card.center.bc-header", {}, [
        el("p.screen__subtitle", { text: "Lettre" }),
        el("div.bc-letter", { text: lettre }),
        timeEl,
        el("div.bc-bar", {}, [bar]),
      ]),
      el("div.card", { style: "margin-top:14px" }, [
        el("div.stack", {}, inputs),
        el("button.btn.btn--full", { text: "STOP ! J'ai fini", style: "margin-top:16px", onClick: () => stop(false) }),
      ])
    );

    function finish(timeUp) {
      const answers = categories.map((cat, idx) => ({ cat, val: inputs[idx].querySelector("input").value.trim() }));
      stage.replaceChildren(
        el("div.card.center", {}, [
          el("h2", { text: timeUp ? "⏰ Temps écoulé !" : "✋ Terminé !" }),
          el("p.screen__subtitle", { text: `Lettre : ${lettre}` }),
          el(
            "div.stack.bc-recap",
            { style: "margin-top:14px;text-align:left" },
            answers.map((a) =>
              el("div.bc-recap-row", {}, [
                el("span.bc-field__label", { text: a.cat }),
                el("strong", { text: a.val || "—", class: a.val ? "" : "bc-empty" }),
              ])
            )
          ),
          el("p.screen__subtitle", { text: "Comparez à voix haute : réponse unique = 2 pts, partagée = 1 pt.", style: "margin-top:14px" }),
          el("div.row", { style: "justify-content:center;margin-top:16px" }, [
            el("button.btn", { text: "Nouvelle manche", onClick: play }),
            el("button.btn.btn--ghost", { text: "Réglages", onClick: setup }),
          ]),
        ])
      );
    }
  }

  function fmt(s) {
    s = Math.max(0, s);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }
}
