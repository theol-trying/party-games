/* =========================================================================
   ESTIMATIONS — « Combien de… ? » Chacun tape un nombre en secret ; le plus
   proche marque (1 point, 2 s'il tombe pile), le plus loin boit.

   Deux façons de jouer, 100 % téléphone :
   - Sur ce téléphone : on lit la question à voix haute, puis on se passe le
     téléphone pour noter chacun son estimation à l'abri des regards.
   - Multi-appareils : la question s'affiche chez tout le monde, chacun répond
     sur le sien, l'hôte révèle.
   Les règles (classement, points) vivent dans regles.js, testé en Node.
   ========================================================================= */

import { el, screenHead, announce, showPhase } from "../../ui.js";
import { playersCard } from "../../players.js";
import { createDeck } from "../../deck.js";
import { makeSeen } from "../../seen.js";
import { createScores, scoreboard, podium, compteur } from "../../scoring.js";
import { openEditor } from "../../content.js";
import { contentSource, passThePhone, themeSelector } from "../../game-kit.js";
import { liveSession, syncCountdown, peekAutoLive } from "../../realtime.js";
import { tick, vibrate, vibrateTap } from "../../sound.js";
import { celebrate, stampGage } from "../../fx.js";
import { awardStanding } from "../../crown.js";
import { lireNombre, classer, facteur, gorgees } from "./regles.js";
import { QUESTIONS, THEMES } from "./data.js";

const SCHEMA = {
  title: "Estimations",
  fields: [
    { key: "q", label: "Question", type: "text" },
    { key: "reponse", label: "Réponse (un nombre)", type: "text" },
    { key: "unite", label: "Unité (facultatif)", type: "text", optional: true },
  ],
  summary: (e) => `${e.q} → ${e.reponse}${e.unite ? " " + e.unite : ""}`,
};
/** Carte perso → question. Une réponse qui n'est pas un nombre est écartée
    (null), plutôt que de faire planter la manche. */
function toQuestion(e) {
  const reponse = lireNombre(e.reponse);
  return reponse == null ? null : { q: e.q, reponse, unite: e.unite || "" };
}

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const nfSansEspace = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2, useGrouping: false });
/** « 1 500 m », mais « 1789 » : sans unité et sous 10 000, c'est une année
    (ou un petit compte), qu'on n'écrit jamais « 1 789 ». */
const formater = (v, unite) => (!unite && Math.abs(v) < 10000 ? nfSansEspace : nf).format(v);
const nombre = (v, unite) => formater(v, unite) + (unite ? " " + unite : "");
/** Nombre de décimales à montrer pendant que la réponse défile (9,58 → 2). */
const decimales = (v) => (String(v).split(".")[1] || "").length;
const nf1 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
/** « ×5,7 » (trop haut) ou « ÷4 » (trop bas), à partir d'une fois et demie. */
function ecartEnFois(reponse, v) {
  const f = facteur(reponse, v);
  if (!Number.isFinite(f) || f < 1.5) return "";
  return (v > reponse ? " · ×" : " · ÷") + nf1.format(f);
}
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? "s" : ""}`;

/** Réglages communs aux deux modes : thèmes + gorgées selon l'écart.
    `etat` = { cats:Set, gorgees:bool } est muté en place ; onChange() après chaque
    modification (le deck refiltre, le résumé se met à jour). */
function blocReglages(etat, onChange) {
  const toggle = el("button.chip", { type: "button" });
  const peindre = () => {
    toggle.textContent = etat.gorgees ? "🍺 Gorgées selon l'écart : oui" : "🍺 Gorgées selon l'écart : non";
    toggle.classList.toggle("is-active", etat.gorgees);
    toggle.setAttribute("aria-pressed", String(etat.gorgees));
  };
  toggle.addEventListener("click", () => { etat.gorgees = !etat.gorgees; peindre(); onChange(); });
  peindre();
  return el("div", {}, [
    themeSelector(THEMES, etat.cats, onChange, { titre: "🗂️ Thèmes" }),
    el("div.row", { style: "justify-content:center;margin-top:10px" }, [toggle]),
    el("p.screen__subtitle", {
      text: "Option gorgées : le plus loin boit 1 gorgée s'il reste à moins d'une fois et demie la réponse, 2 jusqu'à trois fois, 3 au-delà.",
      style: "margin-top:8px;font-size:12px;text-align:center",
    }),
  ]);
}
const resumeReglages = (etat) => `${etat.cats.size}/${THEMES.length} thèmes${etat.gorgees ? " · 🍺 selon l'écart" : ""}`;

export function render(container, { game }) {
  container.append(screenHead(game.title, "Le plus proche marque, le plus loin boit", game.id));
  const stage = el("div");
  container.append(stage);

  const src = contentSource("estimations", { builtIn: QUESTIONS, keyOf: (q) => q.q, toValue: toQuestion });
  const seen = makeSeen("estimations");
  const qKey = (q) => q.q;
  let liveStop = null;
  // États ponctuels au scope du jeu, indexés sur la manche (invariant du projet :
  // les écrans sont re-rendus, une closure de rendu repartirait de zéro).
  let cdStop = null;
  let cdRound = -1;
  let fxRound = -1;       // manche dont les effets de révélation ont été joués
  let defileRound = -1;   // manche dont la réponse et les scores ont déjà défilé
  const envoye = { n: -1, v: null }; // mon estimation déjà envoyée (multi)

  const questions = () => src.cards().filter(Boolean);
  const builtInList = () => QUESTIONS.map((q) => ({ key: q.q, label: `${q.q} → ${nombre(q.reponse, q.unite)}` }));

  if (peekAutoLive()) startLive(); else modeSelect(); // « suivre l'hôte » : salon direct
  src.reload();
  return () => { stopCountdown(); if (liveStop) liveStop(); };

  function stopCountdown() { if (cdStop) { cdStop(); cdStop = null; } }

  function openEd() {
    openEditor(stage, { gameId: "estimations", schema: SCHEMA, builtInList: builtInList(), onDone: async () => { await src.reload(); modeSelect(); }, onReshuffle: () => seen.clear() });
  }

  function modeSelect() {
    if (liveStop) { liveStop(); liveStop = null; }
    showPhase(stage,
      el("div.card.center", {}, [
        el("h3", { text: "Comment jouer ?" }),
        el("p.screen__subtitle", { text: "Une question « combien de… ? », chacun note son estimation en secret.", style: "margin:6px 0 14px" }),
        el("button.btn.btn--full", { text: "📱 Sur ce téléphone", onClick: introSolo }),
        el("button.btn.btn--full.btn--ghost", { text: "🌐 Multi-appareils", style: "margin-top:10px", onClick: startLive }),
      ]),
      el("div.row", { style: "justify-content:center;margin-top:14px" }, [el("button.chip", { text: "✏️ Mes cartes", onClick: openEd })])
    );
  }

  /** Champ de saisie d'une estimation : clavier numérique, validation à Entrée. */
  function champEstimation(unite, onValide) {
    const input = el("input.input.es-saisie", { inputmode: "decimal", autocomplete: "off", placeholder: "Ton estimation", "aria-label": "Ton estimation" });
    const ok = el("button.btn.btn--full", { text: "Valider", style: "margin-top:12px", disabled: "" });
    const maj = () => { ok.disabled = lireNombre(input.value) == null; };
    const valider = () => { const v = lireNombre(input.value); if (v != null) onValide(v); };
    input.addEventListener("input", maj);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") valider(); });
    ok.addEventListener("click", valider);
    setTimeout(() => input.focus(), 50);
    return el("div", {}, [
      el("div.es-champ", {}, [input, unite ? el("span.es-unite", { text: unite }) : null]),
      ok,
    ]);
  }

  /* ============================ Sur ce téléphone ============================ */
  function introSolo() {
    showPhase(stage,
      playersCard({ min: 2, cta: "C'est parti →", onReady: startSolo }),
      el("div.row", { style: "justify-content:center;margin-top:14px" }, [el("button.chip", { text: "← Mode", onClick: modeSelect })])
    );
  }

  function startSolo(players) {
    if (!questions().length) {
      showPhase(stage, el("div.card.center", {}, [
        el("p", { text: "Aucune question active — ajoute-en via ✏️ Mes cartes." }),
        el("button.btn", { text: "✏️ Mes cartes", style: "margin-top:12px", onClick: openEd }),
      ]));
      return;
    }
    const deck = createDeck(questions(), { seen, keyOf: qKey });
    const sc = createScores("estimations", players);
    let manche = 0;
    // Réglages de la partie : tous les thèmes, gorgées fixes (1) par défaut.
    const etat = { cats: new Set(THEMES.map((t) => t.id)), gorgees: false };
    const filtre = (q) => !q.cat || etat.cats.has(q.cat); // cartes perso (sans thème) toujours incluses
    deck.setFilter(filtre);

    function question() {
      const item = deck.next();
      manche++;
      const estimations = {};
      // ⚙️ Ouverts à la 1re manche, repliés ensuite (comme le quiz) ; l'état vit
      // dans `etat`, donc le bloc recréé à chaque manche garde les choix faits.
      const resume = el("span.reglages__resume", { text: resumeReglages(etat) });
      const reglages = el("details.card.reglages", manche === 1 ? { open: "" } : {}, [
        el("summary", {}, [el("span", { text: "⚙️ Réglages" }), resume]),
        el("div.reglages__corps", {}, [
          blocReglages(etat, () => { deck.setFilter(filtre); resume.textContent = resumeReglages(etat); }),
        ]),
      ]);
      showPhase(stage,
        reglages,
        el("div.card.center", {}, [
          el("p.screen__subtitle", { text: `Manche ${manche} · à lire à voix haute` }),
          el("h2.big-prompt.es-question", { text: item.q }),
          item.unite ? el("p.screen__subtitle", { text: `Réponse en ${item.unite}`, style: "margin-top:10px" }) : null,
          el("button.btn.btn--full", {
            text: "🤫 Chacun note son estimation",
            style: "margin-top:18px",
            onClick: () => passThePhone(stage, players, {
              icon: "🤫",
              cta: "Estimer",
              onPlayer: (p, i, next) => showPhase(stage,
                el("div.card.center", {}, [
                  el("p.screen__subtitle", { text: `${p}, à toi (les autres ne regardent pas !)` }),
                  el("p.es-rappel", { text: item.q }),
                  champEstimation(item.unite, (v) => { estimations[p] = v; vibrateTap(); next(); }),
                ])
              ),
              onDone: () => revelationSolo(item, estimations, etat.gorgees),
            }),
          }),
        ])
      );
    }

    function revelationSolo(item, estimations, avecGorgees) {
      const r = classer(item.reponse, players.map((p) => ({ id: p, v: estimations[p] })));
      Object.entries(r.points).forEach(([p, n]) => sc.add(p, n));
      const boire = aBoire(r, item.reponse, avecGorgees);
      const nom = (id) => id;
      const bilan = verdict(r, nom, boire, avecGorgees);
      announce(`Réponse : ${nombre(item.reponse, item.unite)}. ${bilan.texte}`);
      if (r.gagnants.length) celebrate();
      if (Object.keys(boire).length) setTimeout(() => stampGage(texteBoire(boire, nom, avecGorgees)), 900);

      const scoreWrap = el("div", {}, [scoreboard(sc.scores, { podium: true })]);
      showPhase(stage,
        el("div.card.center", {}, [
          blocReponse(item, true),
          lignesEstimations(r, item, nom, { boire, avecGorgees }),
          bilan.noeud,
        ]),
        el("div.card", { style: "margin-top:14px" }, [
          el("div.row", { style: "justify-content:space-between;align-items:center;margin-bottom:6px" }, [
            el("h3", { text: "Classement" }),
            el("button.chip", { text: "↺ Réinitialiser", onClick: () => { sc.reset(); scoreWrap.replaceChildren(scoreboard(sc.scores, { podium: true })); } }),
          ]),
          scoreWrap,
        ]),
        el("button.btn.btn--full", { text: "Question suivante →", style: "margin-top:14px", onClick: question })
      );
    }

    sc.ready.then(question); // scores de la soirée chargés avant la 1re manche
  }

  /* ============================ Multi-appareils ============================ */
  function startLive() {
    if (!questions().length) { modeSelect(); return; }
    if (liveStop) liveStop();
    // Nouvelle partie : les numéros de manche repartent de 1, donc les repères
    // de la partie précédente feraient prendre la manche 1 pour « déjà jouée ».
    stopCountdown();
    cdRound = fxRound = defileRound = envoye.n = -1;
    const deck = createDeck(questions(), { seen, keyOf: qKey });
    const scores = {}; // deviceId → total (converge sur tous les téléphones via meta.base)
    // Réglages de l'hôte : c'est lui qui tire les questions (deck filtré chez lui)
    // et l'option gorgées part avec chaque manche, pour un verdict identique partout.
    const etat = { cats: new Set(THEMES.map((t) => t.id)), gorgees: false };
    const filtre = (q) => !q.cat || etat.cats.has(q.cat);
    deck.setFilter(filtre);

    liveStop = liveSession(stage, {
      gameId: "estimations",
      title: "Estimations — multi",
      minPlayers: 2,
      startLabel: "Lancer la 1re question",
      revealLabel: "Révéler les estimations",
      newRoundLabel: "Question suivante →",
      onExit: modeSelect,
      lobbyExtra: () => el("div", { style: "margin:10px 0" }, [blocReglages(etat, () => deck.setFilter(filtre))]),
      assign: (ps) => {
        const item = deck.next() || { q: "?", reponse: 0, unite: "" };
        const base = {};
        const roles = {};
        ps.forEach((p) => { base[p.id] = scores[p.id] || 0; roles[p.id] = true; });
        // La réponse voyage avec la manche (comme la bonne réponse du quiz) ;
        // l'interface ne l'affiche jamais avant la révélation.
        return { roles, meta: { q: item.q, reponse: item.reponse, unite: item.unite || "", info: item.info || "", base, gorgees: etat.gorgees } };
      },
      renderMine: (mine, ctx) => liveRound(ctx),
      renderReveal: (live, ctx) => liveReveal(live, scores, ctx),
    });
  }

  function liveRound({ api, meta, n }) {
    if (n !== cdRound) { stopCountdown(); cdRound = n; }
    const total = api.players().length;
    const prog = el("p.screen__subtitle", { text: `0 / ${total} ont répondu`, style: "margin-top:14px" });
    const timerLine = el("p.es-chrono");
    const zone = el("div");
    const dejaEnvoye = envoye.n === n; // re-rendu de la même manche : on ne redemande rien

    function confirme(v) {
      zone.replaceChildren(el("div.es-envoye", { text: `✅ Estimation envoyée : ${nombre(v, meta.unite)} — en attente des autres…` }));
    }
    if (dejaEnvoye) confirme(envoye.v);
    else zone.append(champEstimation(meta.unite, (v) => {
      envoye.n = n; envoye.v = v;
      api.submit({ v });
      vibrateTap();
      confirme(v);
    }));

    api.on("progress", (done) => { prog.textContent = `${done.length} / ${total} ont répondu`; });
    api.on("timer", (endsAt) => {
      stopCountdown();
      cdStop = syncCountdown(endsAt, {
        onTick: (s) => {
          timerLine.textContent = s > 0 ? `⏱️ ${s}` : "⏰";
          if (s <= 3 && s > 0 && envoye.n !== n) tick();
        },
        onEnd: () => {
          cdStop = null;
          if (envoye.n !== n) { vibrate(150); zone.replaceChildren(el("div.es-envoye", { text: "⏰ Temps écoulé !" })); }
        },
      });
    });

    return [
      el("p.screen__subtitle", { text: `Question ${n}` }),
      el("h2.big-prompt.es-question", { text: meta.q }),
      meta.unite ? el("p.screen__subtitle", { text: `Réponse en ${meta.unite}`, style: "margin:10px 0 14px" }) : null,
      zone,
      timerLine,
      prog,
      api.isHost() ? el("button.chip", { text: "⏱️ Lancer un chrono (30 s)", style: "margin-top:14px", onClick: () => api.startTimer(30) }) : null,
    ];
  }

  function liveReveal(live, scores, { api, n }) {
    const meta = live.meta || {};
    const base = meta.base || {};
    const names = live.names || {};
    const inputs = live.inputs || {};
    const ids = Object.keys(names);
    const r = classer(meta.reponse, ids.map((id) => ({ id, v: inputs[id] ? inputs[id].v : null })));
    // Totaux déterministes : base de l'hôte + points de la manche → identiques partout.
    ids.forEach((id) => { scores[id] = (base[id] || 0) + (r.points[id] || 0); });
    const nom = (id) => names[id] || "?";
    const me = api.me;
    const avecGorgees = meta.gorgees === true; // réglage de l'hôte, transmis avec la manche
    const boire = aBoire(r, meta.reponse, avecGorgees);

    // Effets personnels, une seule fois par manche (pas à « Revoir la révélation »).
    if (n != null && n !== fxRound) {
      fxRound = n;
      if (r.gagnants.includes(me)) celebrate();
      else if (boire[me]) {
        const combien = pluriel(boire[me], "gorgée");
        setTimeout(() => stampGage(r.absents.includes(me) ? `Pas de réponse : tu bois ${combien} 🍺` : `Le plus loin : tu bois ${combien} 🍺`), 900);
      }
      // 👑 Roi de la soirée : l'hôte seul contribue (sinon compté une fois par téléphone).
      if (api.isHost()) awardStanding("estimations", [...ids].sort((a, b) => scores[b] - scores[a]), names, live.avatars || {});
    }
    const defile = n == null || n !== defileRound;
    if (n != null) defileRound = n;

    const bilan = verdict(r, nom, boire, avecGorgees);
    return el("div.center", {}, [
      blocReponse(meta, defile),
      lignesEstimations(r, meta, nom, { moi: me, boire, avecGorgees }),
      bilan.noeud,
      el("h3", { text: "Classement", style: "margin-top:18px" }),
      podium([...ids].sort((a, b) => scores[b] - scores[a]).map((id) => ({
        nom: nom(id) + (id === me ? " (toi)" : ""),
        points: scores[id],
        avant: defile ? base[id] || 0 : scores[id],
      }))),
    ]);
  }

  /* ============================ Briques d'affichage ============================ */
  /** La bonne réponse, qui défile depuis 0 pour ménager le suspense. */
  function blocReponse(item, defile) {
    const dec = decimales(item.reponse);
    const fmt = (v) => formater(Number(v.toFixed(dec)), item.unite);
    return el("div.es-reponse", {}, [
      el("p.screen__subtitle", { text: "La réponse était…" }),
      el("div.es-reponse__valeur", {}, [
        defile ? compteur(item.reponse, 0, { format: fmt, duree: 1400 }) : el("span", { text: fmt(item.reponse) }),
        item.unite ? el("span.es-reponse__unite", { text: " " + item.unite }) : null,
      ]),
      item.info ? el("p.es-reponse__info", { text: item.info }) : null,
    ]);
  }

  /** Qui boit, et combien : id → gorgées. Le(s) plus loin(s) et les absents ;
      1 gorgée chacun, ou selon l'écart si l'option est active (absent = 3). */
  function aBoire(r, reponse, avecGorgees) {
    const m = {};
    for (const l of r.lignes) if (r.perdants.includes(l.id)) m[l.id] = avecGorgees ? gorgees(reponse, l.v) : 1;
    for (const id of r.absents) m[id] = avecGorgees ? gorgees(reponse, null) : 1;
    return m;
  }

  /** « Chloé boit 3 gorgées 🍺 », « Bob et Chloé boivent une gorgée 🍺 »… */
  function texteBoire(boire, nom, avecGorgees) {
    const ids = Object.keys(boire);
    if (!avecGorgees) return `${ids.map(nom).join(" et ")} ${ids.length > 1 ? "boivent" : "boit"} une gorgée 🍺`;
    return ids.map((id) => `${nom(id)} boit ${pluriel(boire[id], "gorgée")}`).join(", ") + " 🍺";
  }

  /** Les estimations, de la plus proche à la plus lointaine. */
  function lignesEstimations(r, item, nom, { moi, boire = {}, avecGorgees = false } = {}) {
    const { unite, reponse } = item;
    const lignes = r.lignes.map((l) => {
      const gagne = r.points[l.id];
      const boit = boire[l.id];
      return el("div.es-ligne" + (gagne ? ".is-gagnant" : boit ? ".is-perdant" : ""), {}, [
        el("span.es-ligne__rang", { text: gagne ? "🎯" : boit ? "🍺" : `${l.rang}.` }),
        el("span.es-ligne__nom", { text: nom(l.id) + (l.id === moi ? " (toi)" : "") }),
        el("span.es-ligne__val", {}, [
          el("strong", { text: nombre(l.v, unite) }),
          // L'écart en « fois » parle mieux que la différence brute sur les gros nombres.
          el("small", { text: l.ecart <= 1e-9 ? "pile !" : `à ${nombre(l.ecart, unite)}${ecartEnFois(reponse, l.v)}` }),
        ]),
        gagne ? el("span.es-ligne__pts", { text: `+${gagne}` })
          : boit && avecGorgees ? el("span.es-ligne__pts.is-boit", { text: `${boit} 🍺` }) : null,
      ]);
    });
    const absents = r.absents.map((id) =>
      el("div.es-ligne.is-perdant", {}, [
        el("span.es-ligne__rang", { text: "⏳" }),
        el("span.es-ligne__nom", { text: nom(id) + (id === moi ? " (toi)" : "") }),
        el("span.es-ligne__val", {}, [el("small", { text: "pas de réponse" })]),
        avecGorgees ? el("span.es-ligne__pts.is-boit", { text: `${boire[id]} 🍺` }) : null,
      ])
    );
    return el("div.es-lignes", {}, [...lignes, ...absents]);
  }

  /** Phrase de bilan : qui marque, qui boit (et combien, avec l'option). */
  function verdict(r, nom, boire, avecGorgees) {
    const liste = (ids) => ids.map(nom).join(" et ");
    const morceaux = [];
    const plusieurs = r.gagnants.length > 1;
    if (r.gagnants.length) morceaux.push(`🎯 ${liste(r.gagnants)} ${r.pile ? (plusieurs ? "tombent pile : +2 !" : "tombe pile : +2 !") : (plusieurs ? "marquent +1" : "marque +1")}`);
    const boivent = Object.keys(boire);
    if (boivent.length) {
      morceaux.push(avecGorgees
        ? "🍺 " + boivent.map((id) => `${nom(id)} : ${pluriel(boire[id], "gorgée")}`).join(", ")
        : `🍺 ${liste(boivent)} ${boivent.length > 1 ? "boivent" : "boit"}`);
    }
    if (!morceaux.length) morceaux.push("Personne n'a répondu…");
    const texte = morceaux.join(" · ");
    return { texte, noeud: el("p.es-verdict", { text: texte }) };
  }
}
