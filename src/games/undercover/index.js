import { el, screenHead, shuffle, announce, showPhase } from "../../ui.js";
import { playersCard } from "../../players.js";
import { createDeck } from "../../deck.js";
import { openEditor } from "../../content.js";
import { passThePhone, contentSource } from "../../game-kit.js";
import { liveSession, peekAutoLive } from "../../realtime.js";
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

  const src = contentSource("undercover", { builtIn: PAIRES, keyOf: (p) => `${p.civils}|${p.imposteur}`, toValue: (e) => ({ civils: e.civils, imposteur: e.imposteur }) });
  let deck = createDeck(pairs()); // paires intégrées + perso, anti-répétition
  let currentPair = null;
  let liveStop = null;

  if (peekAutoLive()) startLive(); else modeSelect(); // « suivre l'hôte » : salon direct
  reload();

  // Cleanup appelé par le routeur : stoppe les timers du mode multi si actif.
  return () => { if (liveStop) liveStop(); };

  function modeSelect() {
    showPhase(stage,
      el("div.card.center", {}, [
        el("h3", { text: "Comment jouer ?" }),
        el("button.btn.btn--full", { text: "📱 Sur ce téléphone", onClick: showSetupIntro }),
        el("button.btn.btn--full.btn--ghost", { text: "🌐 Multi-appareils", style: "margin-top:10px", onClick: startLive }),
      ])
    );
  }
  function startLive() {
    if (liveStop) liveStop();
    let liveImp = 1, liveWhite = 0; // réglages de l'hôte
    // Autorité de l'hôte pour la partie en cours (dépouillement, éliminations).
    let hostGame = null; // { roles:{id:{role,word}}, pair, alive:[ids], k }
    liveStop = liveSession(stage, {
      gameId: "undercover",
      title: "Undercover — multi",
      minPlayers: 3,
      startLabel: "Distribuer les mots",
      revealLabel: "Révéler tous les rôles",
      newRoundLabel: "Nouvelle partie (nouveaux mots)",
      onExit: modeSelect,
      lobbyExtra: (ps) => {
        const n = ps.length;
        const wrap = el("div.stack", { style: "margin:10px 0" });
        function build() {
          const mk = (label, get, set) =>
            el("div.uc-step", {}, [
              el("span.uc-step__label", { text: label }),
              el("div.uc-step__ctrl", {}, [
                el("button.btn.btn--ghost.uc-step__btn", { text: "−", onClick: () => { set(Math.max(0, get() - 1)); build(); } }),
                el("span.uc-step__val", { text: String(get()) }),
                el("button.btn.btn--ghost.uc-step__btn", { text: "+", onClick: () => { set(Math.min(Math.max(0, n - 1), get() + 1)); build(); } }),
              ]),
            ]);
          wrap.replaceChildren(
            mk("imposteurs", () => liveImp, (x) => (liveImp = x)),
            mk("Mr White", () => liveWhite, (x) => (liveWhite = x))
          );
        }
        build();
        return wrap;
      },
      assign: (ps) => {
        const pair = deck.next() || { civils: "?", imposteur: "?" };
        const n = ps.length;
        // Clamp : au moins 1 civil ; si aucun rôle spécial, on force 1 imposteur.
        let impN = Math.min(liveImp, n - 1);
        const whiteN = Math.min(liveWhite, n - 1 - impN);
        if (impN + whiteN === 0) impN = 1;
        const order = shuffle(ps.map((_, i) => i));
        const imp = new Set(order.slice(0, impN));
        const whites = new Set(order.slice(impN, impN + whiteN));
        const roles = {};
        ps.forEach((p, i) => {
          if (whites.has(i)) roles[p.id] = { role: "blanc", word: null };
          else if (imp.has(i)) roles[p.id] = { role: "imposteur", word: pair.imposteur };
          else roles[p.id] = { role: "civil", word: pair.civils };
        });
        // Autorité hôte : la paire ne circule PAS dans meta (anti-triche).
        hostGame = { roles, pair, alive: ps.map((p) => p.id), k: 0 };
        return { roles, meta: { count: n }, open: true }; // open : votes visibles pour le dépouillement
      },
      renderMine: (mine, { api }) => liveGame(mine, api),
      renderReveal: (live) =>
        el("div", {}, [
          el("h3", { text: "Rôles", style: "margin-bottom:10px" }),
          el("div.stack", {},
            Object.keys(live.roles).map((id) => {
              const r = live.roles[id];
              const cls = r.role === "imposteur" ? ".is-imp" : r.role === "blanc" ? ".is-blanc" : "";
              const tag = r.role === "imposteur" ? "🕵️ " + r.word : r.role === "blanc" ? "🎭 Mr White" : "😇 " + r.word;
              return el("div.uc-role-row" + cls, {}, [el("span", { text: live.names[id] || "?" }), el("span", { text: tag })]);
            })
          ),
        ]),
    });

    const ROLE_TAG = { imposteur: "🕵️ Imposteur", blanc: "🎭 Mr White", civil: "😇 Civil" };

    /* ----- Arbitrage côté hôte (hostGame n'existe que sur son téléphone) ----- */
    function hostVote(api) {
      if (!hostGame) return;
      hostGame.k++;
      api.sendState({ phase: "vote", k: hostGame.k, alive: hostGame.alive.slice() });
    }
    function hostEvaluate(api, out, outRole, tally) {
      const alive = hostGame.alive;
      const specials = alive.filter((id) => hostGame.roles[id].role !== "civil").length;
      const civils = alive.length - specials;
      if (specials === 0) api.sendState({ phase: "over", winner: "civils", out, outRole, tally });
      else if (specials >= civils) api.sendState({ phase: "over", winner: "imposteurs", out, outRole, tally });
      else api.sendState({ phase: "result", k: hostGame.k, out, outRole, tally });
    }
    function hostResolve(api, cur, inputsCache) {
      if (!hostGame || !cur || cur.phase !== "vote") return;
      const { k, alive } = cur;
      const allIn = alive.every((id) => inputsCache[id] && inputsCache[id].k === k);
      if (!allIn) return;
      const tally = {};
      alive.forEach((t) => (tally[t] = 0));
      alive.forEach((v) => { const t = inputsCache[v].vote; if (t in tally) tally[t]++; });
      const max = Math.max(...Object.values(tally));
      const tied = alive.filter((t) => tally[t] === max);
      const out = tied[Math.floor(Math.random() * tied.length)]; // égalité : l'hôte tranche au hasard
      hostGame.alive = hostGame.alive.filter((x) => x !== out);
      const role = hostGame.roles[out].role;
      if (role === "blanc") api.sendState({ phase: "whiteGuess", k, out, tally });
      else hostEvaluate(api, out, role, tally);
    }

    /* ----- Écran de partie (état piloté par les messages state/progress) ----- */
    function liveGame(mine, api) {
      let cur = null; // dernier état reçu
      let inputsCache = {}; // votes visibles (mode open)
      let myVoteK = 0; // manche de vote où j'ai déjà voté
      const nameOf = (id) => (api.players().find((p) => p.id === id) || {}).name || "?";

      const myCard =
        mine.role === "blanc"
          ? el("div", {}, [
              el("div.uc-word.uc-blanc", { text: "Mr White" }),
              el("p.screen__subtitle", { text: "Tu n'as pas de mot ! Écoute, bluffe, et devine celui des civils." }),
            ])
          : el("div", {}, [
              el("p.screen__subtitle", { text: "Ton mot :" }),
              el("div.uc-word", { text: mine.word }),
              el("p.screen__subtitle", { text: "Décris-le sans le dire. Démasquez l'intrus !" }),
            ]);
      const phaseArea = el("div", { style: "margin-top:16px" });

      function tallyRows(tally) {
        if (!tally) return null;
        const rows = Object.keys(tally).sort((a, b) => tally[b] - tally[a])
          .map((t) => el("div.uc-role-row", {}, [el("span", { text: nameOf(t) }), el("span", { text: `${tally[t]} voix` })]));
        return el("div.stack", { style: "margin-top:10px" }, rows);
      }

      function renderPhase() {
        const bits = [];
        if (!cur) {
          bits.push(el("p", { text: "🗣️ Discussion : chacun décrit son mot en UN mot, sans le dire.", style: "color:var(--text-dim)" }));
          if (api.isHost()) bits.push(el("button.btn.btn--full", { text: "🗳️ Lancer le vote", style: "margin-top:12px", onClick: () => hostVote(api) }));
          else bits.push(el("p.screen__subtitle", { text: "L'hôte lancera le vote.", style: "margin-top:8px" }));
        } else if (cur.phase === "vote") {
          const voted = cur.alive.filter((id) => inputsCache[id] && inputsCache[id].k === cur.k).length;
          bits.push(el("h3", { text: `🗳️ Vote ${cur.k} — qui est l'intrus ?` }));
          bits.push(el("p.screen__subtitle", { text: `${voted} / ${cur.alive.length} ont voté` }));
          if (!cur.alive.includes(api.me)) {
            bits.push(el("p", { text: "☠️ Tu es éliminé — spectateur.", style: "margin-top:10px" }));
          } else if (myVoteK === cur.k) {
            bits.push(el("p", { text: "✅ Vote envoyé — en attente des autres…", style: "margin-top:10px" }));
          } else {
            cur.alive.filter((id) => id !== api.me).forEach((id) =>
              bits.push(el("button.btn.btn--ghost.btn--full", {
                text: nameOf(id), style: "margin-top:8px",
                onClick: () => { myVoteK = cur.k; api.submit({ k: cur.k, vote: id }); renderPhase(); },
              }))
            );
          }
        } else if (cur.phase === "result") {
          bits.push(el("h3", { text: `❌ ${nameOf(cur.out)} est éliminé !` }));
          bits.push(el("p", { text: `C'était : ${ROLE_TAG[cur.outRole] || cur.outRole}`, style: "font-weight:700;margin:8px 0" }));
          if (cur.out === api.me) bits.push(el("p", { text: "☠️ Tu deviens spectateur.", style: "color:var(--text-dim)" }));
          bits.push(tallyRows(cur.tally));
          if (api.isHost()) bits.push(el("button.btn.btn--full", { text: "🗳️ Vote suivant", style: "margin-top:12px", onClick: () => hostVote(api) }));
        } else if (cur.phase === "whiteGuess") {
          bits.push(el("h3", { text: `🎭 ${nameOf(cur.out)} était Mr White !` }));
          bits.push(el("p", { text: "Il annonce à voix haute le mot qu'il pense être celui des civils.", style: "color:var(--text-dim);margin:8px 0" }));
          bits.push(tallyRows(cur.tally));
          if (api.isHost()) {
            bits.push(el("button.btn.btn--full", { text: "✅ Il a trouvé — Mr White gagne", style: "margin-top:12px", onClick: () => api.sendState({ phase: "over", winner: "white", out: cur.out, outRole: "blanc" }) }));
            bits.push(el("button.btn.btn--full.btn--ghost", { text: "❌ Raté — la partie continue", style: "margin-top:10px", onClick: () => hostEvaluate(api, cur.out, "blanc", cur.tally) }));
          }
        } else if (cur.phase === "over") {
          const label = cur.winner === "civils" ? "😇 Les civils gagnent !" : cur.winner === "white" ? "🎭 Mr White gagne !" : "🕵️ Les imposteurs gagnent !";
          if (cur.out) bits.push(el("p", { text: `${nameOf(cur.out)} éliminé — c'était ${ROLE_TAG[cur.outRole] || cur.outRole}.`, style: "margin-bottom:8px" }));
          bits.push(el("h2", { text: label }));
          bits.push(el("p.screen__subtitle", { text: "L'hôte peut révéler tous les rôles.", style: "margin-top:8px" }));
        }
        phaseArea.replaceChildren(...bits.filter(Boolean));
      }

      api.on("state", (s) => { cur = s; renderPhase(); });
      api.on("progress", (done, total, inputs) => {
        inputsCache = inputs || {};
        if (cur && cur.phase === "vote") renderPhase();
        if (api.isHost()) hostResolve(api, cur, inputsCache);
      });

      renderPhase();
      return [myCard, phaseArea];
    }
  }

  async function reload() {
    await src.reload();
    deck = createDeck(pairs());
  }
  function pairs() { return src.cards(); }
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

    passThePhone(stage, players, {
      icon: "📱",
      cta: "Voir mon rôle",
      onPlayer: (name, i, next) => {
        const r = roles[i];
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
            el("p.screen__subtitle", { text: name + ", ton rôle :" }),
            ...body,
            el("button.btn.btn--full", { text: "J'ai vu, cacher →", style: "margin-top:18px", onClick: next }),
          ])
        );
      },
      onDone: () => discussion(roles),
    });
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
