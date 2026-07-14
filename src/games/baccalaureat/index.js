import { el, screenHead, announce, showPhase } from "../../ui.js";
import { playersCard } from "../../players.js";
import { createDeck } from "../../deck.js";
import { createScores, scoreboard } from "../../scoring.js";
import { getData, setData } from "../../store.js";
import { liveSession, syncCountdown, peekAutoLive } from "../../realtime.js";
import { tick, vibrate } from "../../sound.js";
import { CATEGORIES_DEFAUT, LETTRES, DUREE_DEFAUT } from "./data.js";

const GRACE_SECONDS = 12; // sprint final déclenché quand le 1er joueur crie « STOP »

export function render(container, { game }) {
  let duree = DUREE_DEFAUT;
  let categories = [...CATEGORIES_DEFAUT];
  let activeTimer = null; // chrono en cours, réf. au niveau du jeu pour pouvoir l'arrêter
  let liveStop = null; // arrêt du salon multi si actif
  const deck = createDeck(LETTRES); // tirage des lettres sans répétition

  container.append(screenHead(game.title, "Une lettre, des catégories, le chrono tourne"));
  const stage = el("div");
  container.append(stage);

  if (peekAutoLive()) startLive(); else setup(); // « suivre l'hôte » : salon direct
  // Catégories personnalisées mémorisées par soirée (sans écraser un salon en cours).
  getData("bac-categories", null).then((saved) => {
    if (Array.isArray(saved) && saved.length) { categories = saved; if (!liveStop) setup(); }
  });

  // Nettoyage appelé par le routeur quand on quitte le jeu : stoppe chrono + salon.
  return () => {
    if (activeTimer) clearInterval(activeTimer);
    activeTimer = null;
    if (liveStop) { liveStop(); liveStop = null; }
  };

  /* ---------- Réglages + choix du mode ---------- */
  function setup() {
    const catText = el("textarea.input", { rows: "6", style: "resize:vertical", text: categories.join("\n") });
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
    const readCats = () => {
      categories = catText.value.split("\n").map((s) => s.trim()).filter(Boolean);
      setData("bac-categories", categories);
    };

    showPhase(stage,
      el("div.card", {}, [
        el("h3", { text: "Catégories (une par ligne)" }),
        catText,
        el("h3", { text: "Durée", style: "margin-top:16px" }),
        dureeChips,
        el("button.btn.btn--full", {
          text: "▶️ Classique (sur papier)",
          style: "margin-top:18px",
          onClick: () => { readCats(); play(); },
        }),
        el("button.btn.btn--full.btn--ghost", {
          text: "👥 À la ronde (scoring dans l'app)",
          style: "margin-top:10px",
          onClick: () => {
            readCats();
            showPhase(stage, playersCard({ min: 2, cta: "Jouer à la ronde", onReady: (names) => rondeStart(names) }));
          },
        }),
        el("button.btn.btn--full.btn--ghost", {
          text: "🌐 Multi-appareils (chacun son tél)",
          style: "margin-top:10px",
          onClick: () => { readCats(); startLive(); },
        }),
      ])
    );
  }

  /* ================= Mode multi-appareils (chacun son téléphone) =================
     Même lettre pour tous, chrono synchronisé. L'hôte fait l'arbitre : dès qu'un
     joueur crie « STOP », il déclenche un sprint final commun (GRACE_SECONDS).
     À l'échéance, chaque téléphone envoie ses réponses ; correction + classement
     synchronisés. Totaux = meta.base autoritative + points de la manche
     (déterministes) → aucune dérive entre appareils. */
  function startLive() {
    if (liveStop) liveStop();
    const scores = {}; // deviceId -> total cumulé (converge sur tous les clients)

    liveStop = liveSession(stage, {
      gameId: "baccalaureat",
      title: "Baccalauréat — multi",
      minPlayers: 2,
      startLabel: "Lancer la manche",
      revealLabel: "Corriger la manche",
      newRoundLabel: "Nouvelle manche",
      onExit: setup,
      lobbyExtra: () =>
        el("div", { style: "margin:10px 0" }, [
          el("p.screen__subtitle", { text: `${categories.length} catégories · ${duree}s par manche`, style: "text-align:center" }),
          el("p.screen__subtitle", { text: "Reviens aux Réglages pour les modifier avant de lancer.", style: "text-align:center;opacity:.75;font-size:.85em" }),
        ]),
      assign: (ps) => {
        const letter = drawLetter();
        announce("Lettre : " + letter);
        const base = {};
        ps.forEach((p) => (base[p.id] = scores[p.id] || 0));
        const roles = {};
        ps.forEach((p) => (roles[p.id] = true)); // tout le monde reçoit la même lettre
        return { roles, meta: { letter, categories: [...categories], duree, base } };
      },
      renderMine: (mine, ctx) => liveFill(ctx),
      renderReveal: (live, ctx) => liveScore(live, scores, ctx),
    });
  }

  // Écran de remplissage synchronisé (identique sur chaque téléphone).
  function liveFill({ api, meta }) {
    const cats = meta.categories || [];
    const letter = meta.letter;
    const total = api.players().length;
    let submitted = false;
    let mainLeft = meta.duree; // secondes restantes du chrono principal (suivi par l'hôte)
    let graceStarted = false;
    let cdStop = null;
    let barMax = null;

    const timeEl = el("div.bc-timer", { text: fmt(meta.duree) });
    const bar = el("div.bc-bar__fill");
    const inputs = cats.map((cat) =>
      el("label.bc-field", {}, [
        el("span.bc-field__label", { text: cat }),
        el("input.input", { placeholder: `en ${letter}…`, maxlength: "30", autocapitalize: "words" }),
      ])
    );
    const prog = el("p.screen__subtitle", { text: `0 / ${total} ont fini`, style: "margin-top:10px" });
    const status = el("div.qz-feedback", { style: "min-height:22px;margin-top:6px" });
    const stopBtn = el("button.btn.btn--full", { text: "STOP ! J'ai fini", style: "margin-top:16px" });

    function collect() {
      const a = {};
      cats.forEach((c, i) => (a[c] = inputs[i].querySelector("input").value.trim()));
      return a;
    }
    function doSubmit(auto) {
      if (submitted) return;
      submitted = true;
      inputs.forEach((l) => (l.querySelector("input").disabled = true));
      stopBtn.disabled = true;
      api.submit({ answers: collect() });
      status.textContent = auto ? "⏰ Temps écoulé — réponses envoyées." : "✋ Envoyé ! En attente des autres…";
    }
    stopBtn.onclick = () => doSubmit(false);

    // Chrono synchronisé (principal puis, éventuellement, sprint final).
    api.on("timer", (endsAt) => {
      if (cdStop) cdStop();
      barMax = null;
      cdStop = syncCountdown(endsAt, {
        onTick: (s) => {
          mainLeft = s;
          if (barMax === null) barMax = Math.max(s, 1);
          timeEl.textContent = fmt(s);
          bar.style.transform = `scaleX(${Math.max(0, s / barMax)})`;
          if (s <= 10) timeEl.classList.add("is-low");
          if (s <= 3 && s > 0 && !submitted) tick(); // tension des dernières secondes
        },
        onEnd: () => { if (!submitted) vibrate(150); doSubmit(true); },
      });
    });

    // Progression + arbitrage de l'hôte : 1er « STOP » (assez tôt) → sprint final.
    api.on("progress", (done) => {
      prog.textContent = `${done.length} / ${total} ont fini`;
      if (api.isHost() && !graceStarted && done.length >= 1 && done.length < total && mainLeft > GRACE_SECONDS) {
        graceStarted = true;
        status.textContent = "⚡ Quelqu'un a fini ! Sprint final…";
        api.startTimer(GRACE_SECONDS);
      }
    });

    // L'hôte lance le chrono principal au démarrage de la manche.
    if (api.isHost()) api.startTimer(meta.duree);

    return [
      el("div.card.center.bc-header", {}, [
        el("p.screen__subtitle", { text: "Lettre" }),
        el("div.bc-letter", { text: letter }),
        timeEl,
        el("div.bc-bar", {}, [bar]),
      ]),
      el("div.card", { style: "margin-top:14px" }, [
        el("div.stack", {}, inputs),
        stopBtn,
        status,
        prog,
      ]),
    ];
  }

  // Correction + classement (calcul déterministe partagé par tous les clients).
  function liveScore(live, scores, { api }) {
    const cats = (live.meta && live.meta.categories) || [];
    const letter = live.meta && live.meta.letter;
    const base = (live.meta && live.meta.base) || {};
    const inputs = live.inputs || {};
    const names = live.names || {};
    const order = live.order || [];
    const ids = Object.keys(names);

    const roundPts = {};
    ids.forEach((id) => (roundPts[id] = 0));
    const catResults = cats.map((cat) => {
      const entries = ids.map((id) => {
        const raw = (inputs[id] && inputs[id].answers && inputs[id].answers[cat]) || "";
        return { id, raw, valid: startsWithLetter(raw, letter) };
      });
      const counts = {};
      entries.filter((e) => e.valid).forEach((e) => (counts[norm(e.raw)] = (counts[norm(e.raw)] || 0) + 1));
      entries.forEach((e) => {
        e.pts = !e.valid ? 0 : counts[norm(e.raw)] === 1 ? 2 : 1;
        roundPts[e.id] += e.pts;
      });
      return { cat, entries };
    });
    // Totaux recalculés depuis la base autoritative → aucune dérive entre appareils.
    ids.forEach((id) => (scores[id] = (base[id] || 0) + roundPts[id]));
    const ranking = ids
      .map((id) => ({ id, name: names[id], total: scores[id], d: roundPts[id] }))
      .sort((a, b) => b.total - a.total);
    const first = order[0];

    return el("div", {}, [
      el("h3", { text: "Résultats", style: "margin-bottom:4px" }),
      el("p.screen__subtitle", { text: `Lettre : ${letter} · unique = 2 pts, partagée = 1 pt`, style: "margin-bottom:8px" }),
      first ? el("p.screen__subtitle", { text: `⚡ ${names[first]} a fini en premier`, style: "margin-bottom:12px" }) : null,
      el("div.stack", {},
        catResults.map((cr) =>
          el("div.bc-cat", {}, [
            el("div.bc-field__label", { text: cr.cat }),
            ...cr.entries.map((e) =>
              el("div.bc-score-row" + (e.valid ? "" : ".is-invalid"), {}, [
                el("span", { text: names[e.id] + (e.id === api.me ? " (toi)" : "") }),
                el("span.bc-ans", { text: e.raw || "—" }),
                el("span.bc-pts", { text: "+" + e.pts }),
              ])
            ),
          ])
        )
      ),
      el("h3", { text: "👑 Classement", style: "margin-top:16px;margin-bottom:8px" }),
      el("div.stack", {},
        ranking.map((r, i) =>
          el("div.uc-role-row", {}, [
            el("span", { text: `${i + 1}. ${r.name}${r.id === api.me ? " (toi)" : ""}` }),
            el("span", { text: `${r.total} pts (+${r.d})` }),
          ])
        )
      ),
    ]);
  }

  /* ---------- Mode classique (une manche, un remplisseur) ---------- */
  function play() {
    const lettre = drawLetter();
    announce("Lettre : " + lettre);
    let remaining = duree;
    const timeEl = el("div.bc-timer", { text: fmt(remaining) });
    const bar = el("div.bc-bar__fill");
    const inputs = fieldInputs(lettre);

    function tick() {
      remaining--;
      timeEl.textContent = fmt(remaining);
      bar.style.transform = `scaleX(${remaining / duree})`;
      if (remaining <= 10) timeEl.classList.add("is-low");
      if (remaining <= 0) stop(true);
    }
    function stop(timeUp) {
      clearTimer();
      finish(timeUp);
    }
    startTimer(tick);

    showPhase(stage,
      letterHeader(lettre, timeEl, bar),
      el("div.card", { style: "margin-top:14px" }, [
        el("div.stack", {}, inputs),
        el("button.btn.btn--full", { text: "STOP ! J'ai fini", style: "margin-top:16px", onClick: () => stop(false) }),
      ])
    );

    function finish(timeUp) {
      announce(timeUp ? "Temps écoulé" : "Manche terminée");
      const answers = categories.map((cat, idx) => ({ cat, val: inputs[idx].querySelector("input").value.trim() }));
      showPhase(stage,
        el("div.card.center", {}, [
          el("h2", { text: timeUp ? "⏰ Temps écoulé !" : "✋ Terminé !" }),
          el("p.screen__subtitle", { text: `Lettre : ${lettre}` }),
          el("div.stack.bc-recap", { style: "margin-top:14px;text-align:left" },
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

  /* ---------- Mode à la ronde (pass-the-phone + validation + scoring) ---------- */
  function rondeStart(players) {
    const sc = createScores("baccalaureat", players);
    sc.ready.then(() => rondeRound(players, sc));
  }

  function rondeRound(players, sc) {
    const lettre = drawLetter();
    announce("Lettre : " + lettre);
    const answers = {}; // joueur -> { catégorie: réponse }
    let pi = 0;

    function passScreen() {
      if (pi >= players.length) return scoreRound(players, sc, lettre, answers);
      showPhase(stage,
        el("div.card.center", {}, [
          el("p.big-prompt", { text: "📱" }),
          el("p", { text: `Passe le téléphone à ${players[pi]}` }),
          el("div.bc-letter", { text: lettre, style: "font-size:clamp(40px,12vw,64px)" }),
          el("button.btn.btn--full", { text: `${players[pi]} est prêt·e`, style: "margin-top:12px", onClick: fillScreen }),
        ])
      );
    }

    function fillScreen() {
      const player = players[pi];
      let remaining = duree;
      const timeEl = el("div.bc-timer", { text: fmt(remaining) });
      const bar = el("div.bc-bar__fill");
      const inputs = fieldInputs(lettre);

      function tick() {
        remaining--;
        timeEl.textContent = fmt(remaining);
        bar.style.transform = `scaleX(${remaining / duree})`;
        if (remaining <= 10) timeEl.classList.add("is-low");
        if (remaining <= 0) done();
      }
      function done() {
        clearTimer();
        answers[player] = {};
        categories.forEach((cat, idx) => (answers[player][cat] = inputs[idx].querySelector("input").value.trim()));
        pi++;
        passScreen();
      }
      startTimer(tick);

      showPhase(stage,
        el("div.card.center.bc-header", {}, [
          el("p.screen__subtitle", { text: `${player} · à toi !` }),
          el("div.bc-letter", { text: lettre }),
          timeEl,
          el("div.bc-bar", {}, [bar]),
        ]),
        el("div.card", { style: "margin-top:14px" }, [
          el("div.stack", {}, inputs),
          el("button.btn.btn--full", { text: "Fini →", style: "margin-top:16px", onClick: done }),
        ])
      );
    }

    passScreen();
  }

  function scoreRound(players, sc, lettre, answers) {
    announce("Manche terminée, résultats");
    const roundPts = Object.fromEntries(players.map((p) => [p, 0]));

    const catResults = categories.map((cat) => {
      const entries = players.map((p) => {
        const raw = (answers[p] && answers[p][cat]) || "";
        return { p, raw, valid: startsWithLetter(raw, lettre) };
      });
      const counts = {};
      entries.filter((e) => e.valid).forEach((e) => (counts[norm(e.raw)] = (counts[norm(e.raw)] || 0) + 1));
      entries.forEach((e) => {
        e.pts = !e.valid ? 0 : counts[norm(e.raw)] === 1 ? 2 : 1;
        roundPts[e.p] += e.pts;
      });
      return { cat, entries };
    });

    players.forEach((p) => sc.add(p, roundPts[p]));
    const scoreWrap = el("div", {}, [scoreboard(sc.scores)]);

    showPhase(stage,
      el("div.card", {}, [
        el("h2.center", { text: "Résultats" }),
        el("p.screen__subtitle.center", { text: `Lettre : ${lettre} · unique = 2 pts, partagée = 1 pt`, style: "margin-bottom:12px" }),
        el("div.stack", {},
          catResults.map((cr) =>
            el("div.bc-cat", {}, [
              el("div.bc-field__label", { text: cr.cat }),
              ...cr.entries.map((e) =>
                el("div.bc-score-row" + (e.valid ? "" : ".is-invalid"), {}, [
                  el("span", { text: e.p }),
                  el("span.bc-ans", { text: e.raw || "—" }),
                  el("span.bc-pts", { text: "+" + e.pts }),
                ])
              ),
            ])
          )
        ),
      ]),
      el("div.card", { style: "margin-top:14px" }, [
        el("div.row", { style: "justify-content:space-between;align-items:center;margin-bottom:10px" }, [
          el("h3", { text: "👑 Classement de la soirée" }),
          el("button.chip", { text: "↺ Réinitialiser", onClick: () => { sc.reset(); scoreWrap.replaceChildren(scoreboard(sc.scores)); } }),
        ]),
        scoreWrap,
      ]),
      el("div.row", { style: "justify-content:center;margin-top:14px" }, [
        el("button.btn", { text: "Nouvelle manche", onClick: () => rondeRound(players, sc) }),
        el("button.btn.btn--ghost", { text: "Réglages", onClick: setup }),
      ])
    );
  }

  /* ---------- Utilitaires partagés ---------- */
  function drawLetter() {
    let l = deck.next();
    if (l === null) { deck.reset(); l = deck.next(); }
    return l;
  }
  function fieldInputs(lettre) {
    return categories.map((cat) =>
      el("label.bc-field", {}, [
        el("span.bc-field__label", { text: cat }),
        el("input.input", { placeholder: `en ${lettre}…`, maxlength: "30", autocapitalize: "words" }),
      ])
    );
  }
  function letterHeader(lettre, timeEl, bar) {
    return el("div.card.center.bc-header", {}, [
      el("p.screen__subtitle", { text: "Lettre" }),
      el("div.bc-letter", { text: lettre }),
      timeEl,
      el("div.bc-bar", {}, [bar]),
    ]);
  }
  function startTimer(tick) {
    clearTimer(); // sécurité : pas deux chronos à la fois
    activeTimer = setInterval(tick, 1000);
  }
  function clearTimer() {
    if (activeTimer) clearInterval(activeTimer);
    activeTimer = null;
  }
  function norm(s) {
    return (s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }
  function startsWithLetter(ans, lettre) {
    const n = norm(ans);
    return n.length > 0 && n[0] === norm(lettre);
  }
  function fmt(s) {
    s = Math.max(0, s);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }
}
