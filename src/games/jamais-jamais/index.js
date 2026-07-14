import { el, screenHead, announce, showPhase } from "../../ui.js";
import { createDeck } from "../../deck.js";
import { levelSelector } from "../../levels.js";
import { openEditor, loadContent, loadConfig, activeCards } from "../../content.js";
import { liveSession, peekAutoLive } from "../../realtime.js";
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
  let config = { onlyCustom: false, disabled: {} };
  let deck = createDeck(pool(level));

  container.append(screenHead(game.title, "Bois si tu l'as déjà fait"));
  const stage = el("div");
  container.append(stage);
  let liveStop = null;

  if (peekAutoLive()) startLive(); else modeSelect(); // « suivre l'hôte » : salon direct
  reload();

  // Cleanup routeur : stoppe le salon multi si actif (les déclarations suivantes sont hissées).
  return () => { if (liveStop) liveStop(); };

  function modeSelect() {
    if (liveStop) { liveStop(); liveStop = null; }
    showPhase(stage,
      el("div.card.center", {}, [
        el("h3", { text: "Comment jouer ?" }),
        el("button.btn.btn--full", { text: "📱 Sur ce téléphone", onClick: mainScreen }),
        el("button.btn.btn--full.btn--ghost", { text: "🌐 Multi-appareils (aveux secrets)", style: "margin-top:10px", onClick: startLive }),
      ]),
      el("div.row", { style: "justify-content:center;margin-top:14px" }, [el("button.chip", { text: "✏️ Mes cartes", onClick: openEd })])
    );
  }

  /* ====== Mode multi : chacun avoue en secret, révélation collective ====== */
  function startLive() {
    if (liveStop) liveStop();
    const liveDecks = {}; // un deck par niveau, construit à la demande
    const deckFor = (lv) => (liveDecks[lv] ||= createDeck(pool(lv)));

    liveStop = liveSession(stage, {
      gameId: "jamais-jamais",
      title: "Je n'ai jamais — multi",
      minPlayers: 2,
      startLabel: "Lancer la 1re phrase",
      revealLabel: "Révéler les aveux",
      newRoundLabel: "Phrase suivante →",
      onExit: modeSelect,
      lobbyExtra: () => {
        const ui = levelSelector({ initial: level, onChange: (v) => (level = v) });
        return el("div", { style: "margin:10px 0" }, [
          el("p.screen__subtitle", { text: "Niveau", style: "margin-bottom:8px" }),
          ui.node,
        ]);
      },
      assign: (ps) => {
        let p = deckFor(level).next();
        if (p == null) { deckFor(level).reset(); p = deckFor(level).next(); }
        const roles = {};
        ps.forEach((pl) => (roles[pl.id] = true));
        return { roles, meta: { phrase: p || "…", level } };
      },
      renderMine: (mine, { api, meta }) => {
        let done = false;
        const status = el("p.screen__subtitle", { text: "Réponds en secret 🤫", style: "margin-top:12px" });
        const bYes = el("button.btn.btn--full", { text: "🙋 Je l'ai fait", style: "margin-top:14px" });
        const bNo = el("button.btn.btn--full.btn--ghost", { text: "😇 Jamais", style: "margin-top:10px" });
        const answer = (val, btn) => {
          if (done) return;
          done = true;
          api.submit({ done: val });
          [bYes, bNo].forEach((b) => (b.disabled = true));
          btn.style.borderColor = "var(--accent)";
          status.textContent = "✅ Réponse envoyée — en attente des autres…";
        };
        bYes.addEventListener("click", () => answer(true, bYes));
        bNo.addEventListener("click", () => answer(false, bNo));
        api.on("progress", (d, total) => {
          if (done) status.textContent = `✅ Répondu · ${d.length} / ${total}`;
        });
        return [
          el("p.screen__subtitle", { text: "Je n'ai jamais…" }),
          el("div.big-prompt.jj-prompt", { text: meta.phrase }),
          bYes, bNo, status,
        ];
      },
      renderReveal: (live, { api }) => {
        const names = live.names || {};
        const inputs = live.inputs || {};
        const ids = Object.keys(names);
        const did = ids.filter((id) => inputs[id] && inputs[id].done === true);
        const not = ids.filter((id) => inputs[id] && inputs[id].done === false);
        let verdict;
        if (!did.length && not.length) verdict = "Personne ne l'a fait… tables d'anges 😇";
        else if (did.length === ids.length) verdict = "TOUT LE MONDE l'a fait 😱 Santé générale !";
        else verdict = `${did.length} coupable${did.length > 1 ? "s" : ""} → ils boivent ! 🍻`;
        const row = (id, tag) =>
          el("div.uc-role-row", {}, [
            el("span", { text: names[id] + (id === api.me ? " (toi)" : "") }),
            el("span", { text: tag }),
          ]);
        return el("div", {}, [
          el("p.screen__subtitle", { text: "Je n'ai jamais…" }),
          el("p", { text: (live.meta || {}).phrase || "…", style: "font-weight:800;margin:6px 0 12px" }),
          el("p", { text: verdict, style: "font-weight:700;margin-bottom:12px" }),
          el("div.stack", {}, [
            ...did.map((id) => row(id, "🙋🍺")),
            ...not.map((id) => row(id, "😇")),
            ...ids.filter((id) => !inputs[id]).map((id) => row(id, "⏳")),
          ]),
        ]);
      },
    });
  }

  async function reload() {
    [custom, config] = await Promise.all([loadContent("jamais-jamais"), loadConfig("jamais-jamais")]);
    deck = createDeck(pool(level));
  }
  function pool(lv) {
    return activeCards({
      builtIn: PHRASES[lv] || [],
      custom: custom.filter((e) => e.niveau === lv),
      config,
      keyOf: (t) => `${lv}|${t}`,
      customToValue: (e) => e.text,
    });
  }
  function builtInList() {
    const out = [];
    for (const lv of ["soft", "soiree", "x18"]) (PHRASES[lv] || []).forEach((t) => out.push({ key: `${lv}|${t}`, label: `${LEVEL_LABEL[lv]} · ${t}` }));
    return out;
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
      builtInList: builtInList(),
      onDone: async () => { await reload(); mainScreen(); },
    });
  }
}
