import { el, screenHead, announce } from "../../ui.js";
import { createDeck } from "../../deck.js";
import { levelSelector } from "../../levels.js";
import { openEditor, loadContent } from "../../content.js";
import { PHRASES } from "./data.js";

const LEVEL_LABEL = { soft: "Soft", soiree: "Soirée", x18: "18+" };
const SCHEMA = {
  title: "Je n'ai jamais",
  fields: [
    { key: "niveau", label: "Niveau", type: "select", options: [{ v: "soft", l: "Soft" }, { v: "soiree", l: "Soirée" }, { v: "x18", l: "18+" }] },
    { key: "text", label: "… (sans « Je n'ai jamais »)", type: "text" },
  ],
  summary: (e) => `${LEVEL_LABEL[e.niveau] || e.niveau} · ${e.text}`,
};

export function render(container, { game }) {
  let level = "soft";
  let custom = [];
  let deck = createDeck(pool(level));

  container.append(screenHead(game.title, "Bois si tu l'as déjà fait"));
  const stage = el("div");
  container.append(stage);

  mainScreen();
  loadContent("jamais-jamais").then((list) => { custom = list; deck = createDeck(pool(level)); });

  function pool(lv) {
    return [...(PHRASES[lv] || []), ...custom.filter((e) => e.niveau === lv).map((e) => e.text)];
  }

  function mainScreen() {
    const promptBox = el("div.big-prompt.jj-prompt", { text: "Appuie sur « Suivant ». Bois si tu l'as déjà fait !" });
    const counter = el("div.jj-counter", { text: "" });

    function next() {
      const p = deck.next();
      if (p == null) {
        promptBox.textContent = "Aucune phrase à ce niveau — ajoute-en via ✏️ Mes cartes.";
        counter.textContent = "";
        return;
      }
      promptBox.textContent = "Je n'ai jamais… " + p;
      announce("Je n'ai jamais " + p);
      counter.textContent = `${deck.size() - deck.remaining()} / ${deck.size()}`;
      promptBox.classList.remove("jj-flash");
      void promptBox.offsetWidth;
      promptBox.classList.add("jj-flash");
    }

    const levelUI = levelSelector({
      initial: level,
      onChange: (v) => {
        level = v;
        deck = createDeck(pool(level));
        promptBox.textContent = "Appuie sur « Suivant ». Bois si tu l'as déjà fait !";
        counter.textContent = "";
      },
    });

    stage.replaceChildren(
      el("div.card.jj-card", {}, [
        el("div", { style: "margin-bottom:18px" }, [levelUI.node]),
        counter,
        promptBox,
        el("button.btn.btn--full.jj-btn", { text: "Suivant →", style: "margin-top:22px", onClick: next }),
        el("div.row", { style: "justify-content:center;margin-top:14px" }, [el("button.chip", { text: "✏️ Mes cartes", onClick: openEd })]),
      ])
    );
  }

  function openEd() {
    openEditor(stage, {
      gameId: "jamais-jamais",
      schema: SCHEMA,
      onDone: async () => {
        custom = await loadContent("jamais-jamais");
        deck = createDeck(pool(level));
        mainScreen();
      },
    });
  }
}
