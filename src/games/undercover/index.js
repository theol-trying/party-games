import { el, screenHead, shuffle, announce, showPhase } from "../../ui.js";
import { playersCard } from "../../players.js";
import { createDeck } from "../../deck.js";
import { openEditor, loadContent, loadConfig, activeCards } from "../../content.js";
import { PAIRES } from "./data.js";

const SCHEMA = {
  title: "Undercover",
  fields: [
    { key: "civils", label: "Mot des civils", type: "text" },
    { key: "imposteur", label: "Mot de l'imposteur", type: "text" },
  ],
  summary: (e) => `${e.civils} / ${e.imposteur}`,
};

export function render(container, { game }) {
  container.append(screenHead(game.title, "Distribution secrète · imposteurs & Mr White"));
  const stage = el("div");
  container.append(stage);

  let custom = [];
  let config = { onlyCustom: false, disabled: {} };
  let deck = createDeck(pairs()); // paires intégrées + perso, anti-répétition
  let currentPair = null;

  showSetupIntro();
  reload();

  async function reload() {
    [custom, config] = await Promise.all([loadContent("undercover"), loadConfig("undercover")]);
    deck = createDeck(pairs());
  }
  function pairs() {
    return activeCards({ builtIn: PAIRES, custom, config, keyOf: (p) => `${p.civils}|${p.imposteur}`, customToValue: (e) => ({ civils: e.civils, imposteur: e.imposteur }) });
  }
  function builtInList() { return PAIRES.map((p) => ({ key: `${p.civils}|${p.imposteur}`, label: `${p.civils} / ${p.imposteur}` })); }
  function showSetupIntro() {
    showPhase(stage,
      playersCard({ min: 3, cta: "Distribuer les mots", onReady: (names) => setup(names) }),
      el("div.row", { style: "justify-content:center;margin-top:14px" }, [el("button.chip", { text: "✏️ Mes cartes", onClick: openEd })])
    );
  }
  function openEd() {
    openEditor(stage, { gameId: "undercover", schema: SCHEMA, builtInList: builtInList(), onDone: async () => { await reload(); showSetupIntro(); } });
  }

  /* ---------- Réglage des rôles (imposteurs + Mr White) ---------- */
  function setup(players) {
    const n = players.length;
    let imp = 1;
    let white = 0;

    const impVal = el("span.uc-step__val", { text: String(imp) });
    const whiteVal = el("span.uc-step__val", { text: String(white) });
    const summary = el("p.uc-summary");
    const startBtn = el("button.btn.btn--full", { text: "C'est parti" });

    function clamp(v) {
      return Math.max(0, Math.min(n - 1, v));
    }
    function refresh() {
      impVal.textContent = imp;
      whiteVal.textContent = white;
      const civ = n - imp - white;
      const special = imp + white;
      summary.textContent = `${civ} civil${civ > 1 ? "s" : ""} · ${imp} imposteur${imp > 1 ? "s" : ""} · ${white} Mr White`;
      startBtn.disabled = !(special >= 1 && civ >= 1);
      summary.classList.toggle("is-bad", !(special >= 1 && civ >= 1));
    }

    function stepper(label, get, set) {
      const dec = el("button.btn.btn--ghost.uc-step__btn", { text: "−", onClick: () => { set(clamp(get() - 1)); refresh(); }, "aria-label": `Moins ${label}` });
      const inc = el("button.btn.btn--ghost.uc-step__btn", { text: "+", onClick: () => { set(clamp(get() + 1)); refresh(); }, "aria-label": `Plus ${label}` });
      const valEl = label === "imposteurs" ? impVal : whiteVal;
      return el("div.uc-step", {}, [
        el("span.uc-step__label", { text: label }),
        el("div.uc-step__ctrl", {}, [dec, valEl, inc]),
      ]);
    }

    startBtn.addEventListener("click", () => distribute(players, imp, white));
    refresh();

    showPhase(stage,
      el("div.card.center", {}, [
        el("h3", { text: "Composition de la partie" }),
        el("div.stack", { style: "margin:14px 0" }, [
          stepper("imposteurs", () => imp, (v) => (imp = v)),
          stepper("Mr White", () => white, (v) => (white = v)),
        ]),
        summary,
        el("div", { style: "margin-top:16px" }, [startBtn]),
      ])
    );
  }

  /* ---------- Distribution secrète ---------- */
  function distribute(players, impostorCount, whiteCount) {
    currentPair = deck.next();
    if (!currentPair) {
      showPhase(stage, el("div.card.center", {}, [
        el("p", { text: "Aucune paire de mots active — ajoute-en ou change la source via ✏️ Mes cartes." }),
        el("button.btn", { text: "✏️ Mes cartes", style: "margin-top:12px", onClick: openEd }),
      ]));
      return;
    }
    const order = shuffle(players.map((_, i) => i));
    const impostors = new Set(order.slice(0, impostorCount));
    const whites = new Set(order.slice(impostorCount, impostorCount + whiteCount));
    const roles = players.map((name, i) => {
      if (whites.has(i)) return { name, role: "blanc", word: null };
      if (impostors.has(i)) return { name, role: "imposteur", word: currentPair.imposteur };
      return { name, role: "civil", word: currentPair.civils };
    });

    let idx = 0;
    function pass() {
      if (idx >= roles.length) return discussion(roles);
      showPhase(stage,
        el("div.card.center", {}, [
          el("p.big-prompt", { text: "📱" }),
          el("p", { text: `Passe le téléphone à ${roles[idx].name}` }),
          el("button.btn.btn--full", { text: "Voir mon rôle", style: "margin-top:18px", onClick: showWord }),
        ])
      );
    }
    function showWord() {
      const r = roles[idx];
      const body =
        r.role === "blanc"
          ? [
              el("div.uc-word.uc-blanc", { text: "Mr White" }),
              el("p.screen__subtitle", { text: "Tu n'as pas de mot ! Écoute, bluffe, et devine celui des civils." }),
            ]
          : [
              el("div.uc-word", { text: r.word }),
              el("p.screen__subtitle", { text: "Retiens-le. Ne le montre à personne." }),
            ];
      showPhase(stage,
        el("div.card.center.uc-reveal", {}, [
          el("p.screen__subtitle", { text: r.name + ", ton rôle :" }),
          ...body,
          el("button.btn.btn--full", { text: "J'ai vu, cacher →", style: "margin-top:18px", onClick: () => { idx++; pass(); } }),
        ])
      );
    }
    pass();
  }

  /* ---------- Discussion + actions ---------- */
  function discussion(roles) {
    const hasWhite = roles.some((r) => r.role === "blanc");
    const actions = [];
    if (hasWhite) {
      actions.push(el("button.btn.btn--full", { text: "🎤 Mr White devine le mot", onClick: () => whiteGuess(roles) }));
    }
    actions.push(
      el("button.btn.btn--full.btn--ghost", { text: "Révéler tous les rôles", style: "margin-top:10px", onClick: () => reveal(roles) })
    );
    showPhase(stage,
      el("div.card.center", {}, [
        el("h3", { text: "À vous de jouer 🗣️" }),
        el("p", {
          text:
            "Chacun décrit son mot avec UN mot, sans le dire. Débattez et votez à l'oral pour éliminer un suspect. " +
            (hasWhite ? "Si Mr White est éliminé, il tente de deviner le mot des civils." : ""),
          style: "color:var(--text-dim);margin:12px 0 20px",
        }),
        ...actions,
      ])
    );
  }

  /* ---------- Devinette de Mr White ---------- */
  function whiteGuess(roles) {
    showPhase(stage,
      el("div.card.center", {}, [
        el("h3", { text: "🎤 Mr White devine" }),
        el("p", { text: "Mr White annonce à voix haute le mot qu'il pense être celui des civils.", style: "color:var(--text-dim);margin:12px 0" }),
        el("button.btn.btn--full", { text: "Révéler le vrai mot des civils", onClick: showTruth }),
      ])
    );
    function showTruth() {
      announce("Le mot des civils était " + currentPair.civils);
      showPhase(stage,
        el("div.card.center", {}, [
          el("p.screen__subtitle", { text: "Le mot des civils était :" }),
          el("div.uc-word", { text: currentPair.civils }),
          el("p", { text: "Mr White a-t-il trouvé ?", style: "margin:14px 0" }),
          el("div.row", { style: "justify-content:center" }, [
            el("button.btn", { text: "🎉 Oui, il gagne !", onClick: () => whiteResult(true, roles) }),
            el("button.btn.btn--ghost", { text: "😢 Non", onClick: () => whiteResult(false, roles) }),
          ]),
        ])
      );
    }
  }

  function whiteResult(win, roles) {
    showPhase(stage,
      el("div.card.center", {}, [
        el("h2", { text: win ? "🎉 Mr White gagne !" : "😢 Mr White éliminé" }),
        el("p", {
          text: win ? "Il a deviné le mot des civils." : "Mauvaise réponse — la partie continue sans lui.",
          style: "color:var(--text-dim);margin:12px 0 20px",
        }),
        el("button.btn.btn--full", { text: "Révéler tous les rôles", onClick: () => reveal(roles) }),
      ])
    );
  }

  /* ---------- Révélation ---------- */
  function reveal(roles) {
    const tag = (r) =>
      r.role === "blanc" ? "🎭 Mr White (sans mot)" : r.role === "imposteur" ? "🕵️ Imposteur — " + r.word : "😇 " + r.word;
    showPhase(stage,
      el("div.card.center", {}, [
        el("h3", { text: "Résultat", style: "margin-bottom:14px" }),
        el(
          "div.stack",
          {},
          roles.map((r) =>
            el("div.uc-role-row" + (r.role === "imposteur" ? ".is-imp" : r.role === "blanc" ? ".is-blanc" : ""), {}, [
              el("span", { text: r.name }),
              el("span", { text: tag(r) }),
            ])
          )
        ),
        el("button.btn.btn--full", { text: "Rejouer", style: "margin-top:20px", onClick: showSetupIntro }),
      ])
    );
  }
}
