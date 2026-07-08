import { el, screenHead, announce } from "../../ui.js";
import { createDeck } from "../../deck.js";
import { levelSelector, LEVELS } from "../../levels.js";
import { openEditor, loadContent, loadConfig, activeCards } from "../../content.js";
import { VERITES, ACTIONS } from "./data.js";

const LEVEL_LABEL = { soft: "Soft", soiree: "Soirée", x18: "18+" };

const EDIT_SCHEMA = {
  title: "Action ou Vérité",
  fields: [
    { key: "type", label: "Type", type: "select", options: [{ v: "verite", l: "Vérité" }, { v: "action", l: "Action" }] },
    { key: "niveau", label: "Niveau", type: "select", options: [{ v: "soft", l: "Soft" }, { v: "soiree", l: "Soirée" }, { v: "x18", l: "18+" }] },
    { key: "text", label: "Texte de la carte", type: "text" },
  ],
  summary: (e) => `${e.type === "verite" ? "🗣️" : "🔥"} ${LEVEL_LABEL[e.niveau] || e.niveau} · ${e.text}`,
};

export function render(container, { game }) {
  let level = "soft";
  let custom = [];
  let config = { onlyCustom: false, disabled: {} };
  const decks = { verite: {}, action: {} };

  container.append(screenHead(game.title, "Niveau réglable · ajoute tes propres cartes"));
  const stage = el("div");
  container.append(stage);

  buildDecks();
  mainScreen();
  reload();

  async function reload() {
    [custom, config] = await Promise.all([loadContent("action-verite"), loadConfig("action-verite")]);
    buildDecks();
  }

  function buildDecks() {
    for (const lv of LEVELS.map((l) => l.id)) {
      decks.verite[lv] = createDeck(activeCards({
        builtIn: VERITES[lv] || [],
        custom: custom.filter((e) => e.type === "verite" && e.niveau === lv),
        config,
        keyOf: (t) => `v|${lv}|${t}`,
        customToValue: (e) => e.text,
      }));
      decks.action[lv] = createDeck(activeCards({
        builtIn: ACTIONS[lv] || [],
        custom: custom.filter((e) => e.type === "action" && e.niveau === lv),
        config,
        keyOf: (t) => `a|${lv}|${t}`,
        customToValue: (e) => e.text,
      }));
    }
  }

  function builtInList() {
    const out = [];
    for (const lv of LEVELS.map((l) => l.id)) {
      (VERITES[lv] || []).forEach((t) => out.push({ key: `v|${lv}|${t}`, label: `🗣️ ${LEVEL_LABEL[lv]} · ${t}` }));
      (ACTIONS[lv] || []).forEach((t) => out.push({ key: `a|${lv}|${t}`, label: `🔥 ${LEVEL_LABEL[lv]} · ${t}` }));
    }
    return out;
  }

  function mainScreen() {
    const promptBox = el("div.big-prompt.av-prompt", { text: "Prêt·e ? Choisis Action ou Vérité." });
    const tag = el("div.av-tag");

    function draw(kind) {
      const card = decks[kind][level].next();
      promptBox.textContent = card || "Aucune carte à ce niveau — ajoute-en ou active-en via ✏️ Mes cartes.";
      if (card) announce((kind === "verite" ? "Vérité : " : "Action : ") + card);
      promptBox.classList.remove("av-flash");
      void promptBox.offsetWidth;
      promptBox.classList.add("av-flash");
      tag.textContent = kind === "verite" ? "🗣️ Vérité" : "🔥 Action";
      tag.dataset.kind = kind;
    }

    const levelUI = levelSelector({ initial: level, onChange: (v) => (level = v) });

    stage.replaceChildren(
      el("div.card.av-card", {}, [
        el("div", { style: "margin-bottom:18px" }, [levelUI.node]),
        tag,
        promptBox,
        el("div.row", { style: "justify-content:center;margin-top:22px" }, [
          el("button.btn.av-btn-verite", { text: "Vérité", onClick: () => draw("verite") }),
          el("button.btn.av-btn-action", { text: "Action", onClick: () => draw("action") }),
        ]),
        el("div.row", { style: "justify-content:center;margin-top:14px" }, [
          el("button.chip", { text: "✏️ Mes cartes", onClick: openEd }),
        ]),
      ])
    );
  }

  function openEd() {
    openEditor(stage, {
      gameId: "action-verite",
      schema: EDIT_SCHEMA,
      builtInList: builtInList(),
      onDone: async () => { await reload(); mainScreen(); },
    });
  }
}
