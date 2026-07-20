import { el, screenHead, announce, showPhase, shuffle } from "../../ui.js";
import { playersCard } from "../../players.js";
import { createDeck } from "../../deck.js";
import { createScores, scoreboard } from "../../scoring.js";
import { pickGage } from "../../gages.js";
import { levelSelector } from "../../levels.js";
import { teamBuilder } from "../../teams.js";
import { openEditor } from "../../content.js";
import { contentSource } from "../../game-kit.js";
import { liveSession, syncCountdown, peekAutoLive } from "../../realtime.js";
import { tick, vibrate } from "../../sound.js";
import { confettiBurst, celebrate, stampGage } from "../../fx.js";
import { QUESTIONS } from "./data.js";

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
  if (peekAutoLive()) startLive(); else modeSelect(); // « suivre l'hôte » : salon direct
  src.reload();

  // Cleanup routeur : stoppe les timers/socket du mode multi si actif.
  return () => { if (liveStop) liveStop(); };

  function questions() { return src.cards(); }
  function builtInList() { return QUESTIONS.map((q) => ({ key: q.q, label: `${q.q} → ${q.choices[q.correct]}` })); }

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
    openEditor(stage, { gameId: "quiz-gages", schema: SCHEMA, builtInList: builtInList(), onDone: async () => { await src.reload(); modeSelect(); } });
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
    const deck = createDeck(questions());
    const scores = {}; // deviceId -> total cumulé (converge sur tous les clients)
    let level = "soft"; // niveau des gages, réglé par l'hôte

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
        ]);
      },
      assign: (ps) => {
        const item = deck.next() || { q: "?", choices: ["?"], correct: 0 };
        const base = {};
        ps.forEach((p) => (base[p.id] = scores[p.id] || 0));
        const roles = {};
        ps.forEach((p) => (roles[p.id] = true)); // tout le monde reçoit la même question
        return { roles, meta: { q: item.q, choices: item.choices, correct: item.correct, level, base } };
      },
      renderMine: (mine, ctx) => liveRound(ctx),
      renderReveal: (live, ctx) => liveReveal(live, scores, ctx), // ctx porte n (manche)
    });
  }

  // Écran de réponse (identique sur chaque téléphone).
  function liveRound({ api, meta, n }) {
    let answered = false;
    const total = api.players().length;
    const prog = el("p.screen__subtitle", { text: `0 / ${total} ont répondu`, style: "margin-top:14px" });
    const timerLine = el("p", { style: "min-height:22px;font-weight:800;font-size:1.2rem;margin-top:10px" });
    const feedback = el("div.qz-feedback", { style: "min-height:24px;margin-top:8px" });

    const btns = meta.choices.map((c, idx) =>
      el("button.btn.btn--ghost.btn--full.qz-choice", {
        text: c,
        style: "margin-top:8px",
        onClick: () => {
          if (answered) return;
          answered = true;
          api.submit({ choice: idx });
          btns.forEach((b) => (b.disabled = true));
          btns[idx].style.borderColor = "var(--accent)";
          btns[idx].style.color = "var(--accent)";
          feedback.textContent = "✅ Réponse envoyée — en attente des autres…";
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
      el("p.screen__subtitle", { text: `Question ${n}` }),
      el("h2.qz-question", { text: meta.q, style: "margin:8px 0 8px" }),
      el("div.stack", {}, btns),
      timerLine,
      feedback,
      prog,
      hostCtrl,
    ];
  }

  // Résultats de la manche + classement (calcul déterministe partagé).
  function liveReveal(live, scores, { api, n }) {
    const { choices, correct, base = {}, level = "soft" } = live.meta || {};
    const inputs = live.inputs || {};
    const order = live.order || [];
    const names = live.names || {};

    // Delta de la manche : bonne réponse + bonus au rang d'arrivée (déterministe).
    const delta = {};
    let rank = 0;
    order.forEach((id) => {
      if (inputs[id] && inputs[id].choice === correct) delta[id] = roundPoints(rank++);
    });
    // Totaux recalculés depuis la base autoritative → aucune dérive entre appareils.
    const ids = Object.keys(names);
    ids.forEach((id) => (scores[id] = (base[id] || 0) + (delta[id] || 0)));

    const rows = ids
      .map((id) => ({ id, name: names[id], total: scores[id], d: delta[id] || 0, choice: inputs[id] ? inputs[id].choice : null }))
      .sort((a, b) => b.total - a.total);

    const me = api.me;
    const myChoice = inputs[me] ? inputs[me].choice : null;
    const myGage = myChoice === correct ? null : pickGage(level);
    const myCallout = myChoice === correct
      ? el("div.qz-feedback", { text: `✅ Bravo ! +${delta[me] || 0} points`, style: "margin:6px 0 14px" })
      : el("div.qz-feedback", { style: "margin:6px 0 14px" }, [`❌ Raté. Ton gage : `, el("strong", { text: myGage })]);

    // FX personnels : une seule fois par manche (n identifie la manche → pas de
    // re-tir à « Revoir la révélation » ni au replay du state, ni de collision de clé).
    if (n != null && n !== quizFxRound) {
      quizFxRound = n;
      if (myChoice === correct) celebrate();
      else if (myChoice != null) stampGage(myGage);
    }

    return el("div", {}, [
      el("h3", { text: "Résultats", style: "margin-bottom:6px" }),
      el("p.screen__subtitle", { text: "Bonne réponse :", style: "margin-bottom:4px" }),
      el("div", { text: choices ? choices[correct] : "?", style: "font-weight:800;font-size:1.15rem;margin-bottom:12px;color:var(--accent)" }),
      myCallout,
      el("div.stack", {}, rows.map((r, i) =>
        el("div.uc-role-row", {}, [
          el("span", { text: `${i + 1}. ${r.name}${r.id === me ? " (toi)" : ""}` }),
          el("span", { text: `${r.total} pts${r.d ? ` (+${r.d})` : ""} ${r.choice === correct ? "✅" : r.choice == null ? "⏳" : "❌"}` }),
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
    const deck = createDeck(questions()); // intégré + perso, anti-répétition
    const sc = createScores(scoreKey, players); // scores persistés par soirée (par joueur ou par équipe)
    let count = 0;
    let turn = 0;
    let answered = false;
    let level = "soft"; // niveau des gages

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
                const gage = pickGage(level);
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
