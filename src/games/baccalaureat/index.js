import { el, screenHead, announce, showPhase } from "../../ui.js";
import { playersCard } from "../../players.js";
import { modeScreen } from "../../teams.js";
import { createDeck } from "../../deck.js";
import { createScores, scoreboard } from "../../scoring.js";
import { getData, setData } from "../../store.js";
import { liveSession, syncCountdown, peekAutoLive } from "../../realtime.js";
import { tick, vibrate } from "../../sound.js";
import { CATEGORIES_DEFAUT, LETTRES, DUREE_DEFAUT } from "./data.js";

const GRACE_SECONDS = 12; // sprint final déclenché quand le 1er joueur crie « STOP »
const DUREES = [60, 90, 120, 180];
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? "s" : ""}`;

export function render(container, { game }) {
  let duree = DUREE_DEFAUT;
  let categories = [...CATEGORIES_DEFAUT];
  let activeTimer = null; // chrono en cours, réf. au niveau du jeu pour pouvoir l'arrêter
  let liveStop = null; // arrêt du salon multi si actif
  let decompte = null; // décompte du multi : UN pour tout le jeu (arrêté à chaque écran et en sortie)
  const deck = createDeck(LETTRES); // tirage des lettres sans répétition

  container.append(screenHead(game.title, "Une lettre, des catégories, le chrono tourne", game.id));
  const stage = el("div");
  container.append(stage);

  if (peekAutoLive()) startLive(); else setup(); // « suivre l'hôte » : salon direct
  // Catégories personnalisées mémorisées par soirée (sans écraser un salon en cours).
  // On ne redessine l'écran de réglages que s'il est affiché et encore intact :
  // avant, une partie « Classique » déjà lancée était remplacée (son chrono
  // continuant en fond), et une saisie en cours était perdue.
  getData("bac-categories", null).then((saved) => {
    if (!Array.isArray(saved) || !saved.length) return;
    const zone = stage.querySelector(".bc-setup textarea");
    const intacte = zone && zone.value === categories.join("\n");
    categories = nettoyerCategories(saved);
    if (!liveStop && intacte) setup();
  });

  // Nettoyage appelé par le routeur quand on quitte le jeu : stoppe chrono + salon.
  return () => {
    if (activeTimer) clearInterval(activeTimer);
    activeTimer = null;
    arreterDecompte();
    if (liveStop) { liveStop(); liveStop = null; }
  };

  /* ---------- Réglages + choix du mode ---------- */
  function setup() {
    const catText = el("textarea.input", { rows: "6", style: "resize:vertical", text: categories.join("\n") });
    const dureeChips = el("div.row", { style: "margin-top:8px" });
    DUREES.forEach((d) => {
      const c = el("button.chip", { text: `${d} s` });
      if (d === duree) c.classList.add("is-active");
      c.addEventListener("click", () => {
        duree = d;
        [...dureeChips.children].forEach((x) => x.classList.toggle("is-active", x.textContent === `${d} s`));
      });
      dureeChips.appendChild(c);
    });
    const readCats = () => {
      categories = nettoyerCategories(catText.value.split("\n"));
      catText.value = categories.join("\n");
      setData("bac-categories", categories);
    };

    showPhase(stage,
      el("div.card.bc-setup", {}, [
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
            // En équipes, on cherche les mots ensemble : c'est le mode le plus
            // vivant du Baccalauréat, et le scoring fonctionne tel quel
            // (une équipe est une entité de score comme un joueur).
            showPhase(stage, playersCard({
              min: 2,
              cta: "Suite →",
              onReady: (names) => showPhase(stage, modeScreen(stage, { names, soloLabel: "🙋 Chacun pour soi", onStart: (entites) => rondeStart(entites) })),
            }));
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
    arreterDecompte();
    const scores = {}; // deviceId -> total cumulé (converge sur tous les clients)
    // Suivi des envois pour le ramassage avant correction (hôte).
    const suivi = { finis: 0, attendus: 0, quandTousFinis: null, ramassage: false };

    liveStop = liveSession(stage, {
      gameId: "baccalaureat",
      title: "Baccalauréat — multi",
      minPlayers: 2,
      startLabel: "Lancer la manche",
      revealLabel: "Corriger la manche",
      newRoundLabel: "Nouvelle manche",
      onExit: setup,
      // Réglages modifiables depuis le salon : avant, le texte renvoyait aux
      // « Réglages », accessibles seulement en quittant le salon (et jamais vus
      // par un hôte arrivé via « Changer de jeu »).
      lobbyExtra: () => reglagesSalon(),
      // « Corriger la manche » pendant l'écriture : on ramasse d'abord les
      // réponses de tout le monde (sinon ceux qui n'avaient pas appuyé sur STOP
      // finissaient à 0 point, cases remplies).
      beforeReveal: (api, reveler) => {
        suivi.ramassage = true; // pas de sprint final déclenché par les copies ramassées
        api.sendState({ ramasser: Date.now() });
        let fait = false;
        const go = () => { if (fait) return; fait = true; suivi.quandTousFinis = null; reveler(); };
        if (suivi.finis >= suivi.attendus && suivi.attendus > 0) return go();
        suivi.quandTousFinis = go;
        setTimeout(go, 3000); // filet : un téléphone endormi ne bloque pas la correction
      },
      assign: (ps) => {
        const letter = drawLetter();
        announce("Lettre : " + letter);
        const base = {};
        ps.forEach((p) => (base[p.id] = scores[p.id] || 0));
        const roles = {};
        ps.forEach((p) => (roles[p.id] = true)); // tout le monde reçoit la même lettre
        return { roles, meta: { letter, categories: [...categories], duree, base } };
      },
      renderMine: (mine, ctx) => liveFill(ctx, suivi),
      renderReveal: (live, ctx) => { arreterDecompte(); return liveScore(live, scores, ctx); },
    });
  }

  function reglagesSalon() {
    const dureeChips = el("div.row", { style: "justify-content:center;margin-top:6px" }, DUREES.map((d) =>
      el("button.chip" + (d === duree ? ".is-active" : ""), {
        text: `${d} s`,
        onClick: (e) => {
          duree = d;
          [...e.currentTarget.parentNode.children].forEach((x) => x.classList.toggle("is-active", x === e.currentTarget));
        },
      })
    ));
    const zone = el("textarea.input", { rows: "6", style: "resize:vertical;margin-top:8px", text: categories.join("\n") });
    zone.addEventListener("input", () => { categories = nettoyerCategories(zone.value.split("\n"), false); });
    zone.addEventListener("change", () => { categories = nettoyerCategories(zone.value.split("\n")); setData("bac-categories", categories); });
    return el("div", { style: "margin:10px 0" }, [
      el("p.screen__subtitle", { text: "Durée d'une manche", style: "text-align:center" }),
      dureeChips,
      el("details.ed-bulk", { style: "margin-top:10px" }, [
        el("summary", { text: `📝 ${pluriel(categories.length, "catégorie")} (une par ligne)` }),
        zone,
      ]),
    ]);
  }

  // Écran de remplissage synchronisé (identique sur chaque téléphone).
  // Tout ce qui doit survivre à « Retour au salon → Revenir à la manche » (ou à
  // un nouvel hôte) vit dans api.memo() : brouillon, envoi, sprint lancé.
  function liveFill({ api, meta }, suivi) {
    const cats = meta.categories || [];
    const letter = meta.letter;
    const m = api.memo();
    if (!m.brouillon) suivi.ramassage = false; // manche neuve
    if (!m.brouillon) Object.assign(m, { brouillon: {}, envoye: false, envoiAuto: false, sprint: false, chronoLance: false, chronoRecu: false, restant: meta.duree });
    let total = api.players().length;
    let barMax = null;
    let dernierBip = null;

    const timeEl = el("div.bc-timer", { text: fmt(meta.duree) });
    const bar = el("div.bc-bar__fill");
    const inputs = cats.map((cat) => {
      const champ = el("input.input", { placeholder: `en ${letter}…`, maxlength: "30", autocapitalize: "words", value: m.brouillon[cat] || "" });
      champ.addEventListener("input", () => { m.brouillon[cat] = champ.value; });
      return el("label.bc-field", {}, [el("span.bc-field__label", { text: cat }), champ]);
    });
    const prog = el("p.screen__subtitle", { text: `0 / ${total} ont fini`, style: "margin-top:10px" });
    const status = el("div.qz-feedback", { style: "min-height:22px;margin-top:6px" });
    const stopBtn = el("button.btn.btn--full", { text: "STOP ! J'ai fini", style: "margin-top:16px" });

    function collect() {
      const a = {};
      cats.forEach((c, i) => (a[c] = inputs[i].querySelector("input").value.trim()));
      return a;
    }
    function verrouiller() {
      inputs.forEach((l) => (l.querySelector("input").disabled = true));
      stopBtn.disabled = true;
      status.textContent = m.envoiAuto ? "⏰ Temps écoulé — réponses envoyées." : "✋ Envoyé ! En attente des autres…";
    }
    function doSubmit(auto) {
      if (m.envoye) return;
      m.envoye = true;
      m.envoiAuto = auto;
      // stop : ce joueur a VRAIMENT appuyé sur STOP (sert au « a fini en premier »).
      api.submit({ answers: collect(), stop: !auto });
      verrouiller();
    }
    stopBtn.onclick = () => doSubmit(false);
    if (m.envoye) verrouiller();

    // Chrono synchronisé (principal puis, éventuellement, sprint final). Un seul
    // décompte à la fois pour tout le jeu : celui d'un écran remplacé est arrêté.
    api.on("timer", (endsAt) => {
      m.chronoRecu = true;
      arreterDecompte();
      barMax = null;
      decompte = syncCountdown(endsAt, {
        onTick: (s) => {
          m.restant = s;
          if (barMax === null) barMax = Math.max(s, 1);
          timeEl.textContent = fmt(s);
          bar.style.transform = `scaleX(${Math.max(0, s / barMax)})`;
          if (s <= 10) timeEl.classList.add("is-low");
          // Un bip par seconde (le décompte passe toutes les 250 ms).
          if (s <= 3 && s > 0 && !m.envoye && s !== dernierBip) { dernierBip = s; tick(); }
        },
        onEnd: () => { if (!m.envoye) vibrate(150); doSubmit(true); },
      });
    });

    // Progression + arbitrage de l'hôte : 1er « STOP » (assez tôt) → sprint final.
    api.on("progress", (done, attendus) => {
      if (attendus) total = attendus;
      prog.textContent = `${done.length} / ${total} ont fini`;
      suivi.finis = done.length;
      suivi.attendus = total;
      if (suivi.quandTousFinis && done.length >= total) suivi.quandTousFinis();
      if (api.isHost() && !m.sprint && !suivi.ramassage && done.length >= 1 && done.length < total && m.restant > GRACE_SECONDS) {
        m.sprint = true;
        status.textContent = "⚡ Quelqu'un a fini ! Sprint final…";
        api.startTimer(GRACE_SECONDS);
      }
    });

    // L'hôte ramasse les copies avant la correction.
    api.on("state", (s) => { if (s && s.ramasser) doSubmit(true); });

    // L'hôte lance le chrono principal UNE fois par manche. Un chrono déjà reçu
    // (rejoué au re-rendu, ou transmis avec la manche à la reconnexion) ne se
    // relance pas : avant, revenir à la manche le remettait à zéro pour tous.
    if (api.isHost() && !m.chronoLance && !m.chronoRecu) {
      m.chronoLance = true;
      api.startTimer(meta.duree);
    }

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
  // Contestation : l'hôte touche une réponse pour l'invalider (ou la revalider)
  // après le débat de la table ; l'override est diffusé via state et TOUS les
  // téléphones recalculent — aucune dérive possible.
  function liveScore(live, scores, { api }) {
    const cats = (live.meta && live.meta.categories) || [];
    const letter = live.meta && live.meta.letter;
    const base = (live.meta && live.meta.base) || {};
    const inputs = live.inputs || {};
    const names = live.names || {};
    const order = live.order || [];
    const ids = Object.keys(names);
    // Premier à avoir VRAIMENT crié STOP (pas le premier envoi automatique).
    const first = order.find((id) => inputs[id] && inputs[id].stop);

    let overrides = new Set(); // "id|cat" invalidés par contestation
    let forces = new Set(); // "id|cat" validés d'office (lettre mal reconnue, mot accepté par la table)
    const wrap = el("div");

    function render() {
      const roundPts = {};
      ids.forEach((id) => (roundPts[id] = 0));
      const catResults = cats.map((cat) => {
        const entries = ids.map((id) => {
          const raw = (inputs[id] && inputs[id].answers && inputs[id].answers[cat]) || "";
          const contested = overrides.has(id + "|" + cat);
          const force = forces.has(id + "|" + cat);
          return { id, raw, contested, force, valid: force || (!contested && startsWithLetter(raw, letter)) };
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

      wrap.replaceChildren(
        el("h3", { text: "Résultats", style: "margin-bottom:4px" }),
        el("p.screen__subtitle", { text: `Lettre : ${letter} · unique = 2 pts, partagée = 1 pt`, style: "margin-bottom:4px" }),
        first ? el("p.screen__subtitle", { text: `⚡ ${names[first]} a fini en premier`, style: "margin-bottom:8px" }) : el("span"),
        api.isHost()
          ? el("p.screen__subtitle", { text: "⚖️ Contestation : touche une réponse pour l'invalider, ou pour valider un mot refusé.", style: "margin-bottom:8px" })
          : el("span"),
        el("div.stack", {},
          catResults.map((cr) =>
            el("div.bc-cat", {}, [
              el("div.bc-field__label", { text: cr.cat }),
              ...cr.entries.map((e) => {
                const row = el("div.bc-score-row" + (e.valid ? "" : ".is-invalid"), {}, [
                  el("span", { text: names[e.id] + (e.id === api.me ? " (toi)" : "") }),
                  el("span.bc-ans", { text: (e.raw || "—") + (e.contested || e.force ? " ⚖️" : "") }),
                  el("span.bc-pts", { text: "+" + e.pts }),
                ]);
                if (api.isHost() && e.raw) {
                  row.style.cursor = "pointer";
                  row.addEventListener("click", () => {
                    const k = e.id + "|" + cr.cat;
                    // Mot valide → invalidé ; mot refusé (lettre) → validé d'office ; sinon on annule.
                    if (overrides.has(k)) overrides.delete(k);
                    else if (forces.has(k)) forces.delete(k);
                    else if (e.valid) overrides.add(k);
                    else forces.add(k);
                    render();
                    api.sendState({ bacOverrides: [...overrides], bacForces: [...forces] });
                  });
                }
                return row;
              }),
            ])
          )
        ),
        el("h3", { text: "👑 Classement", style: "margin-top:16px;margin-bottom:8px" }),
        el("div.stack", {},
          ranking.map((r, i) =>
            el("div.uc-role-row", {}, [
              el("span", { text: `${i + 1}. ${r.name}${r.id === api.me ? " (toi)" : ""}` }),
              el("span", { text: `${pluriel(r.total, "pt")} (+${r.d})` }),
            ])
          )
        )
      );
    }

    // Tout le monde suit les contestations de l'hôte.
    api.on("state", (s) => {
      if (s && Array.isArray(s.bacOverrides)) {
        overrides = new Set(s.bacOverrides);
        forces = new Set(Array.isArray(s.bacForces) ? s.bacForces : []);
        render();
      }
    });

    render();
    return wrap;
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
    const scoreWrap = el("div", {}, [scoreboard(sc.scores, { podium: true })]);

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
          el("button.chip", { text: "↺ Réinitialiser", onClick: () => { if (!window.confirm("Remettre les scores de la soirée à zéro ?")) return; sc.reset(); scoreWrap.replaceChildren(scoreboard(sc.scores, { podium: true })); } }),
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
  // œ/æ : « Œuf » commence bien par O (NFD ne les décompose pas).
  function norm(s) {
    return (s || "").trim().toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  function startsWithLetter(ans, lettre) {
    const n = norm(ans);
    return n.length > 0 && n[0] === norm(lettre);
  }
  function arreterDecompte() {
    if (decompte) { decompte(); decompte = null; }
  }
  // Catégories nettoyées : sans vide ni doublon (deux « Animal » se
  // confondaient, les réponses étant rangées par nom de catégorie) ; jamais
  // vide (retour aux catégories par défaut).
  function nettoyerCategories(lignes, defautSiVide = true) {
    const vues = new Set();
    const out = [];
    for (const l of lignes || []) {
      const c = String(l || "").trim().slice(0, 40);
      const k = norm(c);
      if (!c || vues.has(k)) continue;
      vues.add(k);
      out.push(c);
    }
    return out.length || !defautSiVide ? out : [...CATEGORIES_DEFAUT];
  }
  function fmt(s) {
    s = Math.max(0, s);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }
}
