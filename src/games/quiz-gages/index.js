import { el, screenHead, announce, showPhase, shuffle } from "../../ui.js";
import { playersCard } from "../../players.js";
import { createDeck } from "../../deck.js";
import { makeSeen } from "../../seen.js";
import { createScores, scoreboard, podium, compteur } from "../../scoring.js";
import { pickGage, chargerGages, ouvrirMesGages } from "../../gages.js";
import { levelSelector, LEVELS } from "../../levels.js";
import { teamBuilder } from "../../teams.js";
import { openEditor } from "../../content.js";
import { contentSource, themeSelector, paquetSuivi, anneauChrono, totalChrono, pastille } from "../../game-kit.js";
import { liveSession, syncCountdown, peekAutoLive } from "../../realtime.js";
import { tick, vibrate, vibrateSuccess, vibrateTap } from "../../sound.js";
import { confettiBurst, celebrate, stampGage } from "../../fx.js";
import { awardStanding } from "../../crown.js";
import { bump, bumpMany } from "../../stats.js";
import { CATEGORIES, DIFFICULTES, garderDifficulte, libelleNiveau } from "./categories.js";
import { de } from "../../names.js";

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

/* Mélange les réponses à CHAQUE tirage. Sans ça, les questions intégrées
   s'affichaient dans l'ordre où elles ont été écrites, et la bonne réponse
   tombait en « B » une fois sur deux (80 % en Sport) : répondre toujours B
   suffisait à gagner. On mélange des indices plutôt que des libellés, pour
   rester juste même si deux propositions portaient le même texte. Renvoie une
   copie : la banque partagée n'est jamais modifiée. */
function melanger(item) {
  if (!item || !Array.isArray(item.choices)) return item;
  const ordre = shuffle(item.choices.map((_, i) => i));
  return { ...item, choices: ordre.map((i) => item.choices[i]), correct: ordre.indexOf(item.correct) };
}

const LETTRES = "ABCD";
/** Bouton de réponse : grosse pastille lettrée + texte. La lettre sert à
    s'annoncer la réponse à voix haute (« B ! ») ; les lecteurs d'écran ne
    lisent que le texte. */
function boutonReponse(texte, idx, props = {}) {
  return el("button.btn.btn--ghost.btn--full.qz-choice", props, [
    el("span.qz-lettre", { text: LETTRES[idx] || "?", "aria-hidden": "true" }),
    el("span.qz-texte", { text: texte }),
  ]);
}

export function render(container, { game }) {
  container.append(screenHead(game.title, "Bonne réponse = point, sinon gage", game.id));
  const stage = el("div");
  container.append(stage);

  // Les ~4 000 questions (53 fichiers) arrivent en arrière-plan : le menu
  // s'affiche tout de suite, et tout ce qui a besoin des questions les attend.
  let QUESTIONS = [];
  let questionsPretes = false;
  const donnees = import("./data.js").then((m) => { QUESTIONS = m.QUESTIONS; questionsPretes = true; }, (e) => {
    // Réseau coupé pendant le chargement : on le dit, au lieu d'attendre en silence.
    console.error(e);
    showPhase(stage, el("div.card.center", {}, [
      el("p", { text: "😵 Les questions n'ont pas pu se charger — la connexion a sans doute sauté." }),
      el("button.btn", { text: "🔄 Réessayer", style: "margin-top:12px", onClick: () => location.reload() }),
    ]));
    return new Promise(() => {}); // ceux qui attendent les questions restent en attente
  });
  const src = contentSource("quiz-gages", { builtIn: () => QUESTIONS, keyOf: (q) => q.q, toValue: toQuestion });
  let liveStop = null;
  let quizFxRound = -1; // manche dont les FX du reveal ont déjà été joués (anti-refire)
  let quizScoresRound = -1; // manche dont les scores ont déjà défilé (même logique)
  // Chrono : vit ICI (et pas dans la closure de manche) pour survivre aux re-rendus
  // — sinon un 2e décompte se lance et verrouille les réponses avant l'heure.
  let cdStop = null;
  let cdRound = -1;
  const seen = makeSeen("quiz-gages"); // anti-répétition entre soirées
  const qKey = (q) => q.q; // identité d'une question
  if (peekAutoLive()) startLive(); else modeSelect(); // « suivre l'hôte » : salon direct
  donnees.then(() => src.reload()); // recharge APRÈS les questions : le paquet multi se reconstruit (paquetSuivi)
  chargerGages(); // gages du groupe (🎭 Mes gages), partagés par la soirée

  // Cleanup routeur : stoppe les timers/socket du mode multi si actif.
  return () => { stopCountdown(); if (liveStop) liveStop(); };

  function stopCountdown() {
    if (cdStop) { cdStop(); cdStop = null; }
  }

  function questions() { return src.cards(); }
  function builtInList() { return QUESTIONS.map((q) => ({ key: q.q, label: `${q.q} → ${q.choices[q.correct]}` })); }

  /* Sélecteur de catégories (multi-sélection). `selected` : Set d'ids muté en
     place ; onChange() rappelé après chaque changement (au moins 1 catégorie
     reste toujours active). Les cartes perso (sans cat) sont toujours incluses. */
  function categorySelector(selected, onChange) {
    return themeSelector(CATEGORIES, selected, onChange); // brique commune (game-kit.js)
  }

  /* Difficulté des questions : choix unique (Tous niveaux, Facile, Moyen,
     Expert), même rangée de pastilles que le niveau des gages. */
  function difficulteSelector(initial, onChange) {
    const chips = DIFFICULTES.map((d) => el("button.chip", { text: d.label, type: "button", "aria-pressed": "false", onClick: () => choisir(d.id) }));
    function choisir(id, auDemarrage) {
      DIFFICULTES.forEach((d, i) => {
        chips[i].classList.toggle("is-active", d.id === id);
        chips[i].setAttribute("aria-pressed", String(d.id === id));
      });
      if (!auDemarrage) onChange(id);
    }
    choisir(initial, true);
    return el("div.lvl", {}, [el("div.row.lvl-row", { style: "justify-content:center;flex-wrap:wrap" }, chips)]);
  }
  /** Pastille du niveau d'une question (rien pour une carte perso). */
  function pastilleNiveau(niveau) {
    const t = libelleNiveau(niveau);
    return t ? el("span.qz-niv", { text: t }) : null;
  }

  // Choix du mode : sur ce téléphone (passe-le) ou chacun sur le sien.
  function modeSelect() {
    if (liveStop) { liveStop(); liveStop = null; }
    stopCountdown(); // « Quitter » en plein chrono : plus de bips sur le menu
    showPhase(stage,
      el("div.card.center", {}, [
        el("h3", { text: "Comment jouer ?" }),
        el("button.btn.btn--full", { text: "📱 Sur ce téléphone", onClick: introScreen }),
        el("button.btn.btn--full.btn--ghost", { text: "🌐 Multi-appareils", style: "margin-top:10px", onClick: startLive }),
      ]),
      el("div.row", { style: "justify-content:center;gap:8px;margin-top:14px" }, [
        el("button.chip", { text: "✏️ Mes cartes", onClick: openEd }),
        el("button.chip", { text: "🎭 Mes gages", onClick: () => ouvrirMesGages(stage, modeSelect) }),
      ])
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
  async function openEd() {
    if (!questionsPretes) await donnees;
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
    if (!questionsPretes) return void donnees.then(startLive); // (le salon attend les questions, une fraction de seconde)
    if (!questions().length) {
      showPhase(stage, el("div.card.center", {}, [
        el("p", { text: "Aucune question active — ajoute-en ou change la source via ✏️ Mes cartes." }),
        el("button.btn", { text: "✏️ Mes cartes", style: "margin-top:12px", onClick: openEd }),
        el("button.btn.btn--ghost", { text: "← Mode", style: "margin-top:10px", onClick: modeSelect }),
      ]));
      return;
    }
    if (liveStop) liveStop();
    // Nouvelle partie : si le salon a été recréé, les manches repartent de 1 —
    // les repères de la partie précédente feraient sauter ses effets.
    stopCountdown();
    cdRound = quizFxRound = quizScoresRound = -1;
    const deck = paquetSuivi(src, { seen, keyOf: qKey }); // suit les cartes perso, même arrivées après l'ouverture du salon
    const scores = {}; // deviceId -> total cumulé (converge sur tous les clients)
    const streaks = {}; // deviceId -> série de bonnes réponses consécutives (autorité meta)
    let level = "soft"; // niveau des gages, réglé par l'hôte
    let diff = "tous"; // difficulté des questions, réglée par l'hôte
    // Catégories et difficulté filtrées par l'hôte (deck côté hôte : c'est lui qui tire les questions).
    const cats = new Set(CATEGORIES.map((c) => c.id));
    const filtre = (c) => (!c.cat || cats.has(c.cat)) && garderDifficulte(diff)(c);
    deck.setFilter(filtre);

    liveStop = liveSession(stage, {
      gameId: "quiz-gages",
      title: "Quiz — multi",
      minPlayers: 2,
      startLabel: "Lancer la 1re question",
      revealLabel: "Révéler les réponses",
      newRoundLabel: "Question suivante →",
      onExit: modeSelect,
      reglages: {
        lire: () => ({ level, cats: [...cats], diff }),
        ecrire: (r) => {
          if (r.level) level = r.level;
          let change = false;
          if (DIFFICULTES.some((d) => d.id === r.diff) && r.diff !== diff) { diff = r.diff; change = true; }
          if (Array.isArray(r.cats) && r.cats.length) { cats.clear(); r.cats.forEach((c) => cats.add(c)); change = true; }
          if (change) deck.setFilter(filtre);
        },
      },
      lobbyExtra: () => {
        const ui = levelSelector({ initial: level, onChange: (v) => (level = v) });
        return el("div", { style: "margin:10px 0" }, [
          el("p.screen__subtitle", { text: "Niveau des gages", style: "margin-bottom:8px" }),
          ui.node,
          el("p.screen__subtitle", { text: "Difficulté des questions", style: "margin:14px 0 8px" }),
          difficulteSelector(diff, (v) => { diff = v; deck.setFilter(filtre); }),
          categorySelector(cats, () => deck.setFilter(filtre)),
        ]);
      },
      assign: (ps) => {
        // Mélangé une seule fois, chez l'hôte : tous les téléphones reçoivent
        // le même ordre via meta, donc la même lettre gagnante.
        const item = melanger(deck.next()) || { q: "?", choices: ["?"], correct: 0 };
        const base = {};
        const strk = {};
        ps.forEach((p) => { base[p.id] = scores[p.id] || 0; strk[p.id] = streaks[p.id] || 0; });
        const roles = {};
        ps.forEach((p) => (roles[p.id] = true)); // tout le monde reçoit la même question
        return { roles, meta: { q: item.q, choices: item.choices, correct: item.correct, niveau: item.niveau || null, level, base, streaks: strk } };
      },
      renderMine: (mine, ctx) => liveRound(ctx),
      renderReveal: (live, ctx) => liveReveal(live, scores, streaks, ctx), // ctx porte n (manche)
    });
  }

  // Écran de réponse (identique sur chaque téléphone).
  function liveRound({ api, meta, n }) {
    // Nouvelle manche : un décompte encore en cours appartient à la précédente
    // (son chrono ne concerne plus personne) — on le coupe. Un simple re-rendu
    // de la MÊME manche ne le touche pas.
    if (n !== cdRound) { stopCountdown(); cdRound = n; }
    // Mémoire de manche : la réponse envoyée, le « Je double » et « temps
    // écoulé » survivent à « Retour au salon → Revenir à la manche ». Avant,
    // les boutons redevenaient actifs et l'on pouvait changer sa réponse.
    const m = api.memo();
    if (!("repondu" in m)) Object.assign(m, { repondu: false, choix: null, x2: false, tempsEcoule: false });
    let total = api.players().length;
    let dernierBip = null;
    const prog = el("p.screen__subtitle", { text: `0 / ${total} ont répondu`, style: "margin-top:14px" });
    const chrono = anneauChrono(); // ⏱️ anneau qui se vide, orange puis rouge
    const timerLine = chrono.node;
    const feedback = el("div.qz-feedback", { style: "min-height:24px;margin-top:8px" });

    // 🎯 Tout ou rien : à activer AVANT de répondre.
    const myStreak = (meta.streaks && meta.streaks[api.me]) || 0;
    const x2Btn = el("button.chip", {
      text: "🔥 Je double (risqué : faux = −100 + gage)",
      style: "margin-top:12px",
      onClick: () => {
        if (m.repondu) return;
        m.x2 = !m.x2;
        peindreX2();
      },
    });
    function peindreX2() {
      x2Btn.classList.toggle("is-active", m.x2);
      x2Btn.textContent = m.x2 ? "🔥 DOUBLÉ ! (faux = −100 + gage)" : "🔥 Je double (risqué : faux = −100 + gage)";
    }

    const btns = meta.choices.map((c, idx) =>
      boutonReponse(c, idx, {
        onClick: () => {
          if (m.repondu) return;
          m.repondu = true;
          m.choix = idx;
          api.submit({ choice: idx, x2: m.x2 || undefined });
          vibrateTap(); // accusé de réception tactile (Android)
          verrouiller();
        },
      })
    );
    function verrouiller() {
      btns.forEach((b) => (b.disabled = true));
      x2Btn.disabled = true;
      if (m.choix != null) {
        btns[m.choix].classList.add("is-choisi");
        feedback.textContent = (m.x2 ? "🔥 Doublé ! " : "✅ ") + "Réponse envoyée — en attente des autres…";
      } else if (m.tempsEcoule) feedback.textContent = "⏰ Temps écoulé !";
    }
    peindreX2();
    if (m.repondu) verrouiller();

    function lockOut() {
      if (m.repondu) return;
      m.repondu = true;
      m.tempsEcoule = true;
      verrouiller();
    }

    // total : celui du serveur (joueurs présents ET distribués) — le chiffre
    // figé au rendu restait faux après un départ.
    api.on("progress", (done, attendus) => { if (attendus) total = attendus; prog.textContent = `${done.length} / ${total} ont répondu`; });
    api.on("timer", (endsAt) => {
      // Un seul décompte à la fois : l'hôte peut relancer le chrono, et cet
      // abonnement est repris à chaque re-rendu de la manche (« Revenir à la
      // manche »). Sans ce stop, deux décomptes coexistaient et le premier
      // arrivé à zéro verrouillait les réponses malgré le temps affiché.
      stopCountdown();
      cdStop = syncCountdown(endsAt, {
        onTick: (s) => {
          chrono.maj(s, totalChrono(m, endsAt, s));
          // Un bip par seconde (le décompte passe toutes les 250 ms : 12 bips avant).
          if (s <= 3 && s > 0 && !m.repondu && s !== dernierBip) { dernierBip = s; tick(); }
        },
        onEnd: () => { cdStop = null; if (!m.repondu) vibrate(150); lockOut(); },
      });
    });

    const hostCtrl = api.isHost()
      ? el("button.chip", { text: "⏱️ Lancer un chrono (20 s)", style: "margin-top:14px", onClick: () => api.startTimer(20) })
      : null;

    return [
      el("p.screen__subtitle", {}, [`Question ${n}${myStreak >= 2 ? ` · série ${myStreak} 🔥` : ""}`, pastilleNiveau(meta.niveau)].filter(Boolean)),
      el("h2.qz-question", { text: meta.q, style: "margin:8px 0 8px" }),
      el("div.stack.qz-choices", {}, btns),
      el("div.row", { style: "justify-content:center" }, [x2Btn]),
      timerLine,
      feedback,
      prog,
      hostCtrl,
    ];
  }

  // Résultats de la manche + classement (calcul déterministe partagé).
  function liveReveal(live, scores, streaks, { api, n }) {
    // Révélation : le chrono de la manche est fini pour tout le monde (avant,
    // un joueur sans réponse entendait encore les bips sur les résultats).
    stopCountdown();
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
    // Gage tiré UNE fois par manche : « Revoir la révélation » en tirait un
    // autre, et l'on pouvait ainsi échapper au sien.
    const mem = api.memo();
    if (!("gage" in mem)) mem.gage = myOk ? null : pickGage(level, others);
    const myGage = mem.gage;
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
      if (api.isHost()) {
        awardStanding("quiz-gages", rows.map((r) => r.id), names, live.avatars || {});
        // Superlatifs : premier au buzzer, et bonnes réponses. Hôte only, comme
        // ci-dessus, sinon l'événement serait compté une fois par téléphone.
        const premier = (live.order || [])[0];
        if (premier) bump(premier, "buzz1");
        const justes = ids.filter((id) => inputs[id] && inputs[id].choice === correct);
        if (justes.length) bumpMany(justes, "bonneRep");
        const rates = ids.filter((id) => inputs[id] && inputs[id].choice !== correct);
        if (rates.length) bumpMany(rates, "gage");
      }
    }

    // Les totaux défilent depuis le score d'avant la manche — une seule fois par
    // manche : « Revoir la révélation » réaffiche directement les valeurs finales.
    const defile = n == null || n !== quizScoresRound;
    if (n != null) quizScoresRound = n;
    const depuis = (r) => (defile ? Math.max(0, base[r.id] || 0) : r.total);

    return el("div", {}, [
      el("h3", { text: "Résultats", style: "margin-bottom:6px" }),
      el("p.screen__subtitle", { text: "Bonne réponse :", style: "margin-bottom:6px" }),
      choices
        ? el("div.qz-bonne", {}, [el("span.qz-lettre", { text: LETTRES[correct] || "?", "aria-hidden": "true" }), el("span", { text: choices[correct] })])
        : el("div", { text: "?" }),
      myCallout,
      repartitionReponses({ choices, correct, inputs, order, names, avatars: live.avatars || {}, ids, anime: defile }),
      podium(rows.map((r) => ({ nom: r.name + (r.id === me ? " (toi)" : ""), points: r.total, avant: depuis(r) }))),
      // Style commun des tableaux de scores (.sb-row) : l'ancienne classe venait
      // d'Undercover, dont la feuille de style n'est pas chargée ici — le nom
      // et les points se collaient (« Bob150 pts »).
      el("div.sb", {}, rows.map((r, i) =>
        el("div.sb-row" + (i === 0 && r.total > 0 ? ".is-leader" : ""), {}, [
          el("span.sb-rank", { text: `${i + 1}.` }),
          el("span.sb-name", { text: `${r.name}${r.id === me ? " (toi)" : ""} ${r.choice === correct ? "✅" : r.choice == null ? "⏳" : "❌"}` }),
          el("span.sb-pts", {}, [compteur(r.total, depuis(r)), ` pts${r.d ? ` (${r.d > 0 ? "+" : ""}${r.d})` : ""}`]),
        ])
      )),
    ]);
  }

  /* 📊 Qui a répondu quoi : une barre par lettre (proportionnelle au nombre de
     réponses), les avatars de ceux qui l'ont choisie, ⚡ sur la bonne réponse
     la plus rapide. Les barres ne poussent qu'au 1er affichage de la manche. */
  function repartitionReponses({ choices, correct, inputs, order, names, avatars, ids, anime }) {
    if (!choices) return null;
    const parChoix = choices.map((_, i) => ids.filter((id) => inputs[id] && inputs[id].choice === i));
    const maxi = Math.max(1, ...parChoix.map((l) => l.length));
    const rapide = order.find((id) => inputs[id] && inputs[id].choice === correct);
    return el("div.qz-repartition" + (anime ? ".is-anime" : ""), { "aria-label": "Répartition des réponses" }, parChoix.map((qui, i) =>
      el("div.qz-rep" + (i === correct ? ".is-bonne" : ""), { style: `--i:${i}` }, [
        el("span.qz-lettre", { text: LETTRES[i] || "?", "aria-hidden": "true" }),
        el("div.qz-rep__corps", {}, [
          el("div.qz-rep__barre", { style: `--part:${qui.length / maxi}` }),
          el("div.qz-rep__qui", {}, qui.map((id) =>
            el("span.qz-rep__av", { title: names[id] || "" }, [
              pastille(names[id], avatars[id]),
              id === rapide ? el("span.qz-rep__eclair", { text: "⚡", title: "Le plus rapide" }) : null,
            ].filter(Boolean))
          )),
        ]),
        el("span.qz-rep__n", { text: String(qui.length) }),
      ])
    ));
  }

  function startGame(players, scoreKey = "quiz-gages") {
    if (!questionsPretes) return void donnees.then(() => startGame(players, scoreKey));
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
    let diff = "tous"; // difficulté des questions

    // Catégories : toutes actives par défaut ; le filtre garde aussi les perso (sans cat ni niveau).
    const cats = new Set(CATEGORIES.map((c) => c.id));
    const filtre = (c) => (!c.cat || cats.has(c.cat)) && garderDifficulte(diff)(c);
    deck.setFilter(filtre);

    // ⚙️ Réglages repliables : ouverts avant la 1re question, repliés ensuite
    // (une seule fois — si le joueur les rouvre, on les laisse ouverts), pour
    // que question et réponses tiennent à l'écran sans défiler.
    const resume = el("span.reglages__resume");
    const compte = el("p.screen__subtitle.qz-compte");
    const majResume = () => {
      const lv = LEVELS.find((l) => l.id === level);
      const df = DIFFICULTES.find((d) => d.id === diff);
      resume.textContent = `${lv ? lv.label : level} · ${df.label} · ${cats.size}/${CATEGORIES.length} thèmes`;
      compte.textContent = `${deck.size().toLocaleString("fr-FR")} questions dans cette sélection`;
    };
    const catUI = categorySelector(cats, () => { deck.setFilter(filtre); majResume(); });
    const levelUI = levelSelector({ initial: level, onChange: (v) => { level = v; majResume(); } });
    const diffUI = difficulteSelector(diff, (v) => { diff = v; deck.setFilter(filtre); majResume(); });
    majResume();
    // Replié d'emblée : le résumé montre déjà niveau et thèmes, et déplié il
    // repoussait les réponses C et D sous l'écran dès la 1re question.
    const reglages = el("details.card.reglages", {}, [
      el("summary", {}, [el("span", { text: "⚙️ Réglages" }), resume]),
      el("div.reglages__corps", {}, [
        el("p.screen__subtitle", { text: "Niveau des gages", style: "margin-bottom:8px" }),
        levelUI.node,
        el("p.screen__subtitle", { text: "Difficulté des questions", style: "margin:14px 0 8px" }),
        diffUI,
        catUI,
        compte,
      ]),
    ]);

    const qArea = el("div");
    // Vide tant que les scores de la soirée ne sont pas chargés : un premier
    // rendu à zéro ferait ensuite « gagner » (+N) des points déjà acquis.
    const scoreWrap = el("div");
    const nb = players.length;
    let debutTour = { ...sc.scores }; // scores au début du tour, pour le podium de fin de tour

    // Tour de table : une case par joueur ; le quiz n'a pas de fin fixe, la
    // progression qui compte est « chacun a-t-il eu sa question ce tour-ci ? ».
    function barreTour(pos, fait) {
      return el("div.qz-tour", { "aria-label": `Tour ${Math.floor(turn / nb) + 1}, question ${pos + 1} sur ${nb}` }, [
        el("div.qz-tour__label", { text: `Tour ${Math.floor(turn / nb) + 1} · ${pos + 1}/${nb}` }),
        el("div.qz-tour__cases", {}, players.map((p, i) =>
          el("span.qz-tour__case" + (i < pos || (i === pos && fait) ? ".is-fait" : i === pos ? ".is-courant" : ""), { title: p })
        )),
      ]);
    }

    // 🏁 Fin de tour : mini-podium, les points défilent depuis le début du tour.
    function finDeTour() {
      const classement = Object.keys(sc.scores)
        .sort((a, b) => sc.scores[b] - sc.scores[a])
        .map((nom) => ({ nom, points: sc.scores[nom], avant: debutTour[nom] ?? 0 }));
      debutTour = { ...sc.scores };
      if (classement[0] && classement[0].points > 0) vibrateSuccess();
      showPhase(qArea,
        el("div.card.center.qz-fin-tour", {}, [
          el("h3", { text: `🏁 Fin du tour ${Math.floor((turn - 1) / nb) + 1}` }),
          podium(classement) || el("p.screen__subtitle", { text: "Personne n'a encore marqué." }),
          el("button.btn.btn--full", { text: "Tour suivant →", style: "margin-top:16px", onClick: draw }),
        ])
      );
    }

    function draw() {
      answered = false;
      const item = melanger(deck.next());
      if (!item) { // aucun thème × difficulté ne donne de question (ne devrait pas arriver)
        showPhase(qArea, el("div.card.center", {}, [el("p", { text: "Aucune question pour ces réglages : change la difficulté ou les thèmes dans ⚙️ Réglages." })]));
        reglages.open = true;
        return;
      }
      count++;
      const pos = turn % nb;
      const player = players[pos];
      const dernierDuTour = nb >= 2 && pos === nb - 1;
      const tourWrap = el("div", {}, [barreTour(pos, false)]);

      const feedback = el("div.qz-feedback", { style: "min-height:26px;margin-top:14px" });
      const nextBtn = el("button.btn.btn--full", {
        text: dernierDuTour ? "🏁 Classement du tour →" : "Question suivante →",
        style: "display:none;margin-top:14px",
        onClick: () => { turn++; if (dernierDuTour) finDeTour(); else draw(); },
      });

      const boutons = item.choices.map((c, idx) =>
        boutonReponse(c, idx, {
          onClick: (e) => {
            if (answered) return;
            answered = true;
            const correct = idx === item.correct;
            boutons.forEach((b, bi) => {
              b.disabled = true;
              if (bi === item.correct) b.classList.add("is-correct");
            });
            if (correct) {
              sc.add(player);
              feedback.textContent = `✅ Bien joué, ${player} ! +1`;
              announce(`Bonne réponse pour ${player}`);
              vibrateSuccess();
              const r = e.currentTarget.getBoundingClientRect();
              confettiBurst(r.left + r.width / 2, r.top + r.height / 2, 70);
            } else {
              e.currentTarget.classList.add("is-wrong");
              const gage = pickGage(level, players.filter((p) => p !== player));
              feedback.replaceChildren(`❌ Raté, ${player} ! `, el("strong", { text: gage }));
              announce(`Raté pour ${player}. ${gage}`);
              stampGage(gage); // vibre déjà (buzz)
            }
            tourWrap.replaceChildren(barreTour(pos, true));
            scoreWrap.replaceChildren(scoreboard(sc.scores));
            nextBtn.style.display = "";
          },
        })
      );

      showPhase(qArea,
        el("div.card", {}, [
          nb >= 2 ? tourWrap : null,
          el("p.screen__subtitle", {}, [`Question ${count} · 🎯 au tour ${de(player)}`, pastilleNiveau(item.niveau)].filter(Boolean)),
          el("h2.qz-question", { text: item.q, style: "margin:8px 0 18px" }),
          el("div.stack.qz-choices", {}, boutons),
          feedback,
          nextBtn,
        ])
      );
    }

    stage.replaceChildren(
      reglages,
      qArea,
      el("div.card", { style: "margin-top:14px" }, [
        el("div.row", { style: "justify-content:space-between;align-items:center;margin-bottom:10px" }, [
          el("h3", { text: "Scores" }),
          el("button.chip", {
            text: "↺ Réinitialiser",
            onClick: () => {
              if (!window.confirm("Remettre les scores de la soirée à zéro ?")) return;
              sc.reset();
              debutTour = { ...sc.scores };
              scoreWrap.replaceChildren(scoreboard(sc.scores));
            },
          }),
        ]),
        scoreWrap,
      ])
    );

    // Scores persistés de la soirée chargés AVANT la 1re question — et avant de
    // figer le début du tour, sinon le premier podium partirait de zéro.
    sc.ready.then(() => {
      debutTour = { ...sc.scores };
      scoreWrap.replaceChildren(scoreboard(sc.scores));
      draw();
    });
  }
}
