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

  /* ====== Mode multi : aveux secrets (classique) ou pièges écrits (grill) ====== */
  function startLive() {
    if (liveStop) liveStop();
    const liveDecks = {}; // un deck par niveau, construit à la demande
    const deckFor = (lv) => (liveDecks[lv] ||= createDeck(pool(lv)));
    let liveMode = "classic"; // classique : phrase de la banque · grill : la table piège une cible
    let grillTurn = -1; // rotation équitable de la cible du grill

    liveStop = liveSession(stage, {
      gameId: "jamais-jamais",
      title: "Je n'ai jamais — multi",
      minPlayers: 2,
      startLabel: "Lancer la manche",
      revealLabel: "🔎 Révéler",
      newRoundLabel: "Manche suivante →",
      onExit: modeSelect,
      lobbyExtra: () => {
        const ui = levelSelector({ initial: level, onChange: (v) => (level = v) });
        const mkMode = (id, label) => {
          const c = el("button.chip" + (liveMode === id ? ".is-active" : ""), { text: label });
          c.addEventListener("click", () => { liveMode = id; [...c.parentNode.children].forEach((x) => x.classList.toggle("is-active", x === c)); });
          return c;
        };
        return el("div", { style: "margin:10px 0" }, [
          el("p.screen__subtitle", { text: "Mode", style: "margin-bottom:8px" }),
          el("div.row", { style: "justify-content:center;margin-bottom:10px" }, [
            mkMode("classic", "🎲 Classique"),
            mkMode("grill", "🔥 Grill (piégez une cible)"),
          ]),
          el("p.screen__subtitle", { text: "Niveau", style: "margin-bottom:8px" }),
          ui.node,
        ]);
      },
      assign: (ps) => {
        const roles = {};
        ps.forEach((pl) => (roles[pl.id] = true));
        if (liveMode === "grill" && ps.length >= 3) {
          grillTurn = (grillTurn + 1) % ps.length;
          const target = ps[grillTurn];
          return { roles, meta: { mode: "grill", target: target.id, targetName: target.name, level } };
        }
        let p = deckFor(level).next();
        if (p == null) { deckFor(level).reset(); p = deckFor(level).next(); }
        return { roles, meta: { phrase: p || "…", level } };
      },
      renderMine: (mine, { api, meta }) => {
        if (meta && meta.mode === "grill") return grillRound(api, meta);
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
        if (live.meta && live.meta.mode === "grill") return grillReveal(live, api);
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

    // 🔥 Grill : chacun écrit en secret un « je n'ai jamais » pour piéger la cible.
    function grillRound(api, meta) {
      const isTarget = api.me === meta.target;
      const others = api.players().filter((p) => p.id !== meta.target).length;
      const prog = el("p.screen__subtitle", { text: `0 / ${others} pièges écrits`, style: "margin-top:10px" });
      api.on("progress", (done) => { prog.textContent = `${done.length} / ${others} pièges écrits`; });
      if (isTarget) {
        return [
          el("h3", { text: "🔥 C'est TOI qu'on grille !" }),
          el("p", { text: "Les autres écrivent des « je n'ai jamais » sur mesure pour te faire boire. Prépare-toi…", style: "color:var(--text-dim);margin-top:10px" }),
          prog,
        ];
      }
      let sent = false;
      const ta = el("input.input", { placeholder: `… (piège pour ${meta.targetName})`, maxlength: "120" });
      const status = el("p.screen__subtitle", { text: "Ta phrase restera secrète jusqu'à la révélation 🤫", style: "margin-top:8px" });
      const send = el("button.btn.btn--full", {
        text: "😈 Envoyer mon piège",
        style: "margin-top:10px",
        onClick: () => {
          const t = ta.value.trim();
          if (!t || sent) return;
          sent = true;
          ta.disabled = true;
          api.submit({ phrase: t });
          status.textContent = "✅ Piège envoyé — en attente des autres…";
        },
      });
      ta.addEventListener("keydown", (e) => { if (e.key === "Enter") send.click(); });
      return [
        el("h3", { text: `🔥 On grille ${meta.targetName} !` }),
        el("p.screen__subtitle", { text: "Complète : « Je n'ai jamais… » — vise juste !", style: "margin:8px 0" }),
        ta, send, status, prog,
      ];
    }

    function grillReveal(live, api) {
      const names = live.names || {};
      const inputs = live.inputs || {};
      const phrases = Object.keys(inputs)
        .filter((id) => id !== live.meta.target && inputs[id] && inputs[id].phrase)
        .map((id) => ({ author: names[id] || "?", phrase: inputs[id].phrase }));
      return el("div", {}, [
        el("h3", { text: `🔥 Le grill de ${live.meta.targetName}` }),
        el("p.screen__subtitle", { text: `${live.meta.targetName} répond à voix haute à chaque piège : il/elle boit si c'est déjà arrivé !`, style: "margin:8px 0 12px" }),
        el("div.stack", {}, phrases.length
          ? phrases.map((p) => el("div.uc-role-row", {}, [
              el("span", { text: "Je n'ai jamais… " + p.phrase }),
              el("span", { text: "😈 " + p.author, style: "opacity:.6" }),
            ]))
          : [el("p.screen__subtitle", { text: "Personne n'a écrit de piège 😅" })]),
      ]);
    }
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
