import { el, screenHead, announce, showPhase, shuffle } from "../../ui.js";
import { playersCard } from "../../players.js";
import { createDeck } from "../../deck.js";
import { makeSeen } from "../../seen.js";
import { createScores, scoreboard } from "../../scoring.js";
import { pickGage } from "../../gages.js";
import { levelSelector } from "../../levels.js";
import { teamBuilder } from "../../teams.js";
import { openEditor } from "../../content.js";
import { contentSource } from "../../game-kit.js";
import { liveSession, syncCountdown, peekAutoLive } from "../../realtime.js";
import { tick, vibrate } from "../../sound.js";
import { confettiBurst, celebrate, stampGage } from "../../fx.js";
import { awardStanding } from "../../crown.js";
import { QUESTIONS, CATEGORIES } from "./data.js";

// Points d'une bonne réponse : base + bonus de rapidité selon le rang d'arrivée.
const SPEED_BONUS = [50, 30, 20, 10];
function roundPoints(correctRank) {
  return 100 + (correctRank < SPEED_BONUS.length ? SPEED_BONUS[correctRank] : 5);
}

const SCHEMA = {
  title: "Quiz à gages",
  fields: [
    { key: "q", label: "Question", type: "text" },
    { key: "bonne", label: "Bonne réponse", type: "text" },
    { key: "m1", label: "Mauvaise réponse 1", type: "text" },
    { key: "m2", label: "Mauvaise réponse 2", type: "text" },
    { key: "m3", label: "Mauvaise réponse 3", type: "text" },
  ],
  summary: (e) => `${e.q} → ${e.bonne}`,
};
function toQuestion(e) {
  const choices = shuffle([e.bonne, e.m1, e.m2, e.m3]);
  return { q: e.q, choices, correct: choices.indexOf(e.bonne) };
}

export function render(container, { game }) {
  container.append(screenHead(game.title, "Bonne réponse = point, sinon gage"));
  const stage = el("div");
  container.append(stage);

  const src = contentSource("quiz-gages", { builtIn: QUESTIONS, keyOf: (q) => q.q, toValue: toQuestion });
  let liveStop = null;
  let quizFxRound = -1; // manche dont les FX du reveal ont déjà été joués (anti-refire)
  const seen = makeSeen("quiz-gages"); // anti-répétition entre soirées
  const qKey = (q) => q.q; // identité d'une question
  if (peekAutoLive()) startLive(); else modeSelect(); // « suivre l'hôte » : salon direct
  src.reload();

  // Cleanup routeur : stoppe les timers/socket du mode multi si actif.
  return () => { if (liveStop) liveStop(); };

  function questions() { return src.cards(); }
  function builtInList() { return QUESTIONS.map((q) => ({ key: q.q, label: `${q.q} → ${q.choices[q.correct]}` })); }

  /* Sélecteur de catégories (multi-sélection). `selected` : Set d'ids muté en
     place ; onChange() rappelé après chaque changement (au moins 1 catégorie
     reste toujours active). Les cartes perso (sans cat) sont toujours incluses. */
  function categorySelector(selected, onChange) {
    const chips = {};
    const summary = el("summary");
    const row = el("div.row", { style: "flex-wrap:wrap;justify-content:center;gap:6px;margin-top:8px" });
    function refreshSummary() { summary.textContent = `🗂️ Catégories (${selected.size}/${CATEGORIES.length})`; }
    function paint() { for (const c of CATEGORIES) chips[c.id].classList.toggle("is-active", selected.has(c.id)); refreshSummary(); }
    CATEGORIES.forEach((c) => {
      const chip = el("button.chip", { text: c.label });
      chip.addEventListener("click", () => {
        if (selected.has(c.id)) { if (selected.size <= 1) return; selected.delete(c.id); } // garder ≥1
        else selected.add(c.id);
        paint();
        onChange();
      });
      chips[c.id] = chip;
      row.appendChild(chip);
    });
    const quick = el("div.row", { style: "justify-content:center;gap:8px;margin-top:8px" }, [
      el("button.chip", { text: "Tout", onClick: () => { CATEGORIES.forEach((c) => selected.add(c.id)); paint(); onChange(); } }),
      el("button.chip", { text: "Rien sauf 1", onClick: () => { selected.clear(); selected.add(CATEGORIES[0].id); paint(); onChange(); } }),
    ]);
    paint();
    return el("details.ed-bulk", { style: "margin-top:10px" }, [summary, row, quick]);
  }

  // Choix du mode : sur ce téléphone (passe-le) ou chacun sur le sien.
  function modeSelect() {
    if (liveStop) { liveStop(); liveStop = null; }
    showPhase(stage,
      el("div.card.center", {}, [
        el("h3", { text: "Comment jouer ?" }),
        el("button.btn.btn--full", { text: "📱 Sur ce téléphone", onClick: introScreen }),
        el("button.btn.btn--full.btn--ghost", { text: "🌐 Multi-appareils", style: "margin-top:10px", onClick: startLive }),
      ]),
      el("div.row", { style: "justify-content:center;margin-top:14px" }, [el("button.chip", { text: "✏️ Mes cartes", onClick: openEd })])
    );
  }

  function introScreen() {
    showPhase(stage,
      playersCard({ min: 2, cta: "Suite →", onReady: (names) => modeScreen(names) }),
      el("div.row", { style: "justify-content:center;margin-top:14px" }, [
        el("button.chip", { text: "← Mode", onClick: modeSelect }),
        el("button.chip", { text: "✏️ Mes cartes", onClick: openEd }),
      ])
    );
  }
  function openEd() {
    openEditor(stage, { gameId: "quiz-gages", schema: SCHEMA, builtInList: builtInList(), onDone: async () => { await src.reload(); modeSelect(); }, onReshuffle: () => seen.clear() });
  }

  // Choix : chacun pour soi ou en équipes.
  function modeScreen(names) {
    showPhase(stage,
      el("div.card.center", {}, [
        el("h3", { text: "Mode de jeu" }),
        el("p.screen__subtitle", { text: `${names.length} joueurs`, style: "margin:6px 0 14px" }),
        el("button.btn.btn--full", { text: "🙋 Chacun pour soi", onClick: () => startGame(names, "quiz-gages") }),
        el("button.btn.btn--full.btn--ghost", {
          text: "👥 En équipes",
          style: "margin-top:10px",
          onClick: () => showPhase(stage, teamBuilder({ players: names, onReady: (teams) => startGame(teams.map((t) => t.name), "quiz-gages:teams") })),
        }),
      ])
    );
  }

  /* ================= Mode multi-appareils (chacun son téléphone) =================
     La même question s'affiche sur tous les téléphones ; chacun répond chez soi.
     Points = bonne réponse + bonus de rapidité (ordre d'arrivée = buzzer).
     Scores autoritatifs via meta.base + delta déterministe → aucun décalage entre
     appareils, même pour un retardataire. (meta.correct transite dès l'ouverture de
     la manche : l'UI ne l'affiche jamais avant la révélation — acceptable pour un
     jeu de soirée.) */
  function startLive() {
    if (!questions().length) {
      showPhase(stage, el("div.card.center", {}, [
        el("p", { text: "Aucune question active — ajoute-en ou change la source via ✏️ Mes cartes." }),
        el("button.btn", { text: "✏️ Mes cartes", style: "margin-top:12px", onClick: openEd }),
        el("button.btn.btn--ghost", { text: "← Mode", style: "margin-top:10px", onClick: modeSelect }),
      ]));
      return;
    }
    if (liveStop) liveStop();
    const deck = createDeck(questions(), { seen, keyOf: qKey });
    const scores = {}; // deviceId -> total cumulé (converge sur tous les clients)
    const streaks = {}; // deviceId -> série de bonnes réponses consécutives (autorité meta)
    let level = "soft"; // niveau des gages, réglé par l'hôte
    // Catégories filtrées par l'hôte (deck côté hôte : c'est lui qui tire les questions).
    const cats = new Set(CATEGORIES.map((c) => c.id));
    const catFilter = (c) => !c.cat || cats.has(c.cat);
    deck.setFilter(catFilter);

    liveStop = liveSession(stage, {
      gameId: "quiz-gages",
      title: "Quiz — multi",
      minPlayers: 2,
      startLabel: "Lancer la 1re question",
      revealLabel: "Révéler les réponses",
      newRoundLabel: "Question suivante →",
      onExit: modeSelect,
      lobbyExtra: () => {
        const ui = levelSelector({ initial: level, onChange: (v) => (level = v) });
        return el("div", { style: "margin:10px 0" }, [
          el("p.screen__subtitle", { text: "Niveau des gages", style: "margin-bottom:8px" }),
          ui.node,
          categorySelector(cats, () => deck.setFilter(catFilter)),
        ]);
      },
      assign: (ps) => {
        const item = deck.next() || { q: "?", choices: ["?"], correct: 0 };
        const base = {};
        const strk = {};
        ps.forEach((p) => { base[p.id] = scores[p.id] || 0; strk[p.id] = streaks[p.id] || 0; });
        const roles = {};
        ps.forEach((p) => (roles[p.id] = true)); // tout le monde reçoit la même question
        return { roles, meta: { q: item.q, choices: item.choices, correct: item.correct, level, base, streaks: strk } };
      },
      renderMine: (mine, ctx) => liveRound(ctx),
      renderReveal: (live, ctx) => liveReveal(live, scores, streaks, ctx), // ctx porte n (manche)
    });
  }

  // Écran de réponse (identique sur chaque téléphone).
  function liveRound({ api, meta, n }) {
    let answered = false;
    let myX2 = false; // « Tout ou rien » : la réponse compte double (ou -100 si fausse)
    const total = api.players().length;
    const prog = el("p.screen__subtitle", { text: `0 / ${total} ont répondu`, style: "margin-top:14px" });
    const timerLine = el("p", { style: "min-height:22px;font-weight:800;font-size:1.2rem;margin-top:10px" });
    const feedback = el("div.qz-feedback", { style: "min-height:24px;margin-top:8px" });

    // 🎯 Tout ou rien : à activer AVANT de répondre.
    const myStreak = (meta.streaks && meta.streaks[api.me]) || 0;
    const x2Btn = el("button.chip", {
      text: "🔥 Je double (risqué : faux = −100 + gage)",
      style: "margin-top:12px",
      onClick: () => {
        if (answered) return;
        myX2 = !myX2;
        x2Btn.classList.toggle("is-active", myX2);
        x2Btn.textContent = myX2 ? "🔥 DOUBLÉ ! (faux = −100 + gage)" : "🔥 Je double (risqué : faux = −100 + gage)";
      },
    });

    const btns = meta.choices.map((c, idx) =>
      el("button.btn.btn--ghost.btn--full.qz-choice", {
        text: c,
        style: "margin-top:8px",
        onClick: () => {
          if (answered) return;
          answered = true;
          api.submit({ choice: idx, x2: myX2 || undefined });
          btns.forEach((b) => (b.disabled = true));
          x2Btn.disabled = true;
          btns[idx].style.borderColor = "var(--accent)";
          btns[idx].style.color = "var(--accent)";
          feedback.textContent = (myX2 ? "🔥 Doublé ! " : "✅ ") + "Réponse envoyée — en attente des autres…";
        },
      })
    );

    function lockOut() {
      if (answered) return;
      answered = true;
      btns.forEach((b) => (b.disabled = true));
      feedback.textContent = "⏰ Temps écoulé !";
    }

    api.on("progress", (done) => { prog.textContent = `${done.length} / ${total} ont répondu`; });
    api.on("timer", (endsAt) =>
      syncCountdown(endsAt, {
        onTick: (s) => {
          timerLine.textContent = s > 0 ? `⏱️ ${s}` : "⏰";
          if (s <= 3 && s > 0 && !answered) tick(); // tension des dernières secondes
        },
        onEnd: () => { if (!answered) vibrate(150); lockOut(); },
      })
    );

    const hostCtrl = api.isHost()
      ? el("button.chip", { text: "⏱️ Lancer un chrono (20 s)", style: "margin-top:14px", onClick: () => api.startTimer(20) })
      : null;

    return [
      el("p.screen__subtitle", { text: `Question ${n}${myStreak >= 2 ? ` · série ${myStreak} 🔥` : ""}` }),
      el("h2.qz-question", { text: meta.q, style: "margin:8px 0 8px" }),
      el("div.stack", {}, btns),
      el("div.row", { style: "justify-content:center" }, [x2Btn]),
      timerLine,
      feedback,
      prog,
      hostCtrl,
    ];
  }

  // Résultats de la manche + classement (calcul déterministe partagé).
  function liveReveal(live, scores, streaks, { api, n }) {
    const { choices, correct, base = {}, level = "soft", streaks: metaStreaks = {} } = live.meta || {};
    const inputs = live.inputs || {};
    const order = live.order || [];
    const names = live.names || {};

    // Delta de la manche : bonne réponse + bonus rapidité, ×2 si « Je double »,
    // + bonus de série (déterministe, autorité meta.streaks). Faux + doublé = −100.
    const delta = {};
    let rank = 0;
    order.forEach((id) => {
      const inp = inputs[id];
      if (inp && inp.choice === correct) {
        let pts = roundPoints(rank++);
        if (inp.x2) pts *= 2;
        const st = (metaStreaks[id] || 0) + 1;
        if (st >= 3) pts += Math.min(40, (st - 2) * 20); // série ≥3 : +20, +40 (cap)
        delta[id] = pts;
      }
    });
    // Totaux (base autoritative + delta, plancher 0) + mise à jour des séries.
    const ids = Object.keys(names);
    ids.forEach((id) => {
      const inp = inputs[id];
      const ok = inp && inp.choice === correct;
      if (ok) streaks[id] = (metaStreaks[id] || 0) + 1;
      else { streaks[id] = 0; if (inp && inp.x2) delta[id] = -100; } // doublé raté
      scores[id] = Math.max(0, (base[id] || 0) + (delta[id] || 0));
    });

    const rows = ids
      .map((id) => ({ id, name: names[id], total: scores[id], d: delta[id] || 0, choice: inputs[id] ? inputs[id].choice : null }))
      .sort((a, b) => b.total - a.total);

    const me = api.me;
    const myInp = inputs[me];
    const myChoice = myInp ? myInp.choice : null;
    const myOk = myChoice === correct;
    const others = Object.keys(names).filter((id) => id !== me).map((id) => names[id]);
    const myGage = myOk ? null : pickGage(level, others);
    let myCallout;
    if (myOk) {
      const st = streaks[me] || 0;
      myCallout = el("div.qz-feedback", { text: `✅ Bravo ! +${delta[me] || 0}${myInp.x2 ? " 🔥 DOUBLÉ" : ""}${st >= 3 ? ` · série ${st} 🔥` : ""}`, style: "margin:6px 0 14px" });
    } else if (myInp && myInp.x2) {
      myCallout = el("div.qz-feedback", { style: "margin:6px 0 14px" }, [`💥 Doublé raté : −100 ! Ton gage : `, el("strong", { text: myGage })]);
    } else if (myInp) {
      myCallout = el("div.qz-feedback", { style: "margin:6px 0 14px" }, [`❌ Raté. Ton gage : `, el("strong", { text: myGage })]);
    } else {
      myCallout = el("div.qz-feedback", { text: "⏳ Pas de réponse cette manche.", style: "margin:6px 0 14px" });
    }

    // FX personnels : une seule fois par manche (n identifie la manche → pas de
    // re-tir à « Revoir la révélation » ni au replay du state, ni de collision de clé).
    if (n != null && n !== quizFxRound) {
      quizFxRound = n;
      if (myOk) celebrate();
      else if (myInp != null) stampGage(myGage);
      // 👑 Contribue au Roi de la soirée (classement courant du quiz).
      if (api.isHost()) awardStanding("quiz-gages", rows.map((r) => r.id), names, live.avatars || {});
    }

    return el("div", {}, [
      el("h3", { text: "Résultats", style: "margin-bottom:6px" }),
      el("p.screen__subtitle", { text: "Bonne réponse :", style: "margin-bottom:4px" }),
      el("div", { text: choices ? choices[correct] : "?", style: "font-weight:800;font-size:1.15rem;margin-bottom:12px;color:var(--accent)" }),
      myCallout,
      el("div.stack", {}, rows.map((r, i) =>
        el("div.uc-role-row", {}, [
          el("span", { text: `${i + 1}. ${r.name}${r.id === me ? " (toi)" : ""}` }),
          el("span", { text: `${r.total} pts${r.d ? ` (${r.d > 0 ? "+" : ""}${r.d})` : ""} ${r.choice === correct ? "✅" : r.choice == null ? "⏳" : "❌"}` }),
        ])
      )),
    ]);
  }

  function startGame(players, scoreKey = "quiz-gages") {
    if (!questions().length) {
      showPhase(stage, el("div.card.center", {}, [
        el("p", { text: "Aucune question active — ajoute-en ou change la source via ✏️ Mes cartes." }),
        el("button.btn", { text: "✏️ Mes cartes", style: "margin-top:12px", onClick: openEd }),
      ]));
      return;
    }
    const deck = createDeck(questions(), { seen, keyOf: qKey }); // anti-répétition intra + inter-soirées
    const sc = createScores(scoreKey, players); // scores persistés par soirée (par joueur ou par équipe)
    let count = 0;
    let turn = 0;
    let answered = false;
    let level = "soft"; // niveau des gages

    // Catégories : toutes actives par défaut ; le filtre garde aussi les perso (sans cat).
    const cats = new Set(CATEGORIES.map((c) => c.id));
    const catFilter = (c) => !c.cat || cats.has(c.cat);
    deck.setFilter(catFilter);
    const catUI = categorySelector(cats, () => deck.setFilter(catFilter));

    const levelUI = levelSelector({ initial: level, onChange: (v) => (level = v) });
    const qArea = el("div");
    const scoreWrap = el("div", {}, [scoreboard(sc.scores)]);

    function draw() {
      answered = false;
      const item = deck.next();
      count++;
      const player = players[turn % players.length];

      const feedback = el("div.qz-feedback", { style: "min-height:26px;margin-top:14px" });
      const nextBtn = el("button.btn.btn--full", {
        text: "Question suivante →",
        style: "display:none;margin-top:14px",
        onClick: () => { turn++; draw(); },
      });

      const choices = el(
        "div.stack.qz-choices",
        {},
        item.choices.map((c, idx) =>
          el("button.btn.btn--ghost.btn--full.qz-choice", {
            text: c,
            onClick: (e) => {
              if (answered) return;
              answered = true;
              const correct = idx === item.correct;
              choices.querySelectorAll(".qz-choice").forEach((b, bi) => {
                b.disabled = true;
                if (bi === item.correct) b.classList.add("is-correct");
              });
              if (correct) {
                sc.add(player);
                feedback.textContent = `✅ Bien joué, ${player} ! +1`;
                announce(`Bonne réponse pour ${player}`);
                const r = e.currentTarget.getBoundingClientRect();
                confettiBurst(r.left + r.width / 2, r.top + r.height / 2, 70);
              } else {
                e.currentTarget.classList.add("is-wrong");
                const gage = pickGage(level, players.filter((p) => p !== player));
                feedback.replaceChildren(`❌ Raté, ${player} ! `, el("strong", { text: gage }));
                announce(`Raté pour ${player}. ${gage}`);
                stampGage(gage);
              }
              scoreWrap.replaceChildren(scoreboard(sc.scores));
              nextBtn.style.display = "";
            },
          })
        )
      );

      showPhase(qArea,
        el("div.card", {}, [
          el("p.screen__subtitle", { text: `Question ${count} · 🎯 au tour de ${player}` }),
          el("h2.qz-question", { text: item.q, style: "margin:8px 0 18px" }),
          choices,
          feedback,
          nextBtn,
        ])
      );
    }

    stage.replaceChildren(
      el("div.card", { style: "margin-bottom:14px" }, [
        el("p.screen__subtitle", { text: "Niveau des gages", style: "margin-bottom:8px" }),
        levelUI.node,
        catUI,
      ]),
      qArea,
      el("div.card", { style: "margin-top:14px" }, [
        el("div.row", { style: "justify-content:space-between;align-items:center;margin-bottom:10px" }, [
          el("h3", { text: "Scores" }),
          el("button.chip", {
            text: "↺ Réinitialiser",
            onClick: () => {
              sc.reset();
              scoreWrap.replaceChildren(scoreboard(sc.scores));
            },
          }),
        ]),
        scoreWrap,
      ])
    );

    sc.ready.then(draw); // charge les scores persistés avant la 1re question
  }
}
