/* =========================================================================
   QUI A DIT ÇA ? — chacun répond en secret à la même question, puis la
   table devine qui a écrit quoi.

   Multi (le cœur du jeu) : une question = deux manches du moteur.
     1. « ecrire » : chacun écrit sa réponse sur son téléphone.
     2. « vote »   : le serveur mélange les réponses et les renvoie SANS leurs
        auteurs (start « anonymise », voir live.js) ; chacun ne connaît que
        l'indice de la sienne (son rôle privé). On désigne l'auteur de chaque
        réponse, puis la révélation défile réponse par réponse, au rythme de
        l'hôte (state { etape }), jusqu'au bilan.
   Sur un seul téléphone : on se le passe pour écrire, puis on lit les
   réponses une à une et l'on devine à voix haute.

   Points : chaque vote rapporte un point — au détective s'il a vu juste, à
   l'auteur sinon. Gorgées : l'auteur démasqué par la majorité boit 1, le
   pire détective de la manche boit 1, et l'auteur que personne n'a trouvé
   distribue 2 gorgées.
   ========================================================================= */

import { el, screenHead, announce, showPhase, shuffle } from "../../ui.js";
import { createDeck } from "../../deck.js";
import { makeSeen } from "../../seen.js";
import { levelSelector } from "../../levels.js";
import { openEditor, loadContent, loadConfig, activeCards } from "../../content.js";
import { liveSession, peekAutoLive, syncCountdown, dedupeNames } from "../../realtime.js";
import { playersCard } from "../../players.js";
import { passThePhone, anneauChrono, totalChrono, pastille, tuilesVote } from "../../game-kit.js";
import { awardStanding } from "../../crown.js";
import { bumpMany } from "../../stats.js";
import { podium } from "../../scoring.js";
import { compterGorgees } from "../../gorgees.js";
import { celebrate, stampGage } from "../../fx.js";
import { vibrate, pop, tick } from "../../sound.js";
import { QUESTIONS } from "./data.js";
import { depouiller } from "./regles.js";

const LEVEL_LABEL = { soft: "😇 Soft", soiree: "🥳 Soirée", x18: "🔥 18+" };
const MAX_REPONSE = 90; // court, c'est plus drôle — et ça tient sur un écran
const MIN_REPONSES = 3; // en dessous, chacun devinerait les autres par élimination
const SCHEMA = {
  title: "Qui a dit ça ?",
  fields: [
    { key: "niveau", label: "Niveau", type: "select", options: [{ v: "soft", l: "Soft" }, { v: "soiree", l: "Soirée" }, { v: "x18", l: "18+" }] },
    { key: "text", label: "Question (qui appelle une réponse courte et perso)", type: "text" },
  ],
  summary: (e) => `${LEVEL_LABEL[e.niveau] || e.niveau} · ${e.text}`,
};

const nettoyer = (t) => String(t || "").replace(/\s+/g, " ").trim().slice(0, MAX_REPONSE);
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? "s" : ""}`;
// replaceChildren() écrirait « null » pour un enfant absent : on les écarte.
const remplir = (noeud, ...enfants) => noeud.replaceChildren(...enfants.filter((x) => x != null && x !== false));

export function render(container, { game }) {
  let level = "soft";
  let custom = [];
  let config = { onlyCustom: false, disabled: {} };
  const seen = makeSeen("qui-a-dit"); // anti-répétition entre soirées
  let decks = {}; // un paquet par niveau, reconstruit quand les cartes perso arrivent
  let liveStop = null;
  let cdStop = null; // décompte du chrono d'écriture
  let tamponTimer = null; // tampon « tu bois » en attente

  container.append(screenHead(game.title, "Réponds en secret, devine qui a écrit quoi", game.id));
  const stage = el("div");
  container.append(stage);

  if (peekAutoLive()) startLive(); else modeSelect(); // « suivre l'hôte » : salon direct
  reload();

  // Cleanup routeur : chrono, tampon et salon multi.
  return () => { stopChrono(); annulerTampon(); if (liveStop) liveStop(); };

  async function reload() {
    [custom, config] = await Promise.all([loadContent("qui-a-dit"), loadConfig("qui-a-dit")]);
    decks = {};
  }
  function pool(lv) {
    return activeCards({
      builtIn: QUESTIONS[lv] || [],
      custom: custom.filter((e) => e.niveau === lv),
      config,
      keyOf: (t) => `${lv}|${t}`,
      customToValue: (e) => e.text,
    });
  }
  function tirer(lv) {
    const d = (decks[lv] ||= createDeck(pool(lv), { seen }));
    let q = d.next();
    if (q == null) { d.reset(); q = d.next(); }
    return q || (QUESTIONS[lv] || QUESTIONS.soft)[0];
  }
  function builtInList() {
    const out = [];
    for (const lv of ["soft", "soiree", "x18"]) (QUESTIONS[lv] || []).forEach((t) => out.push({ key: `${lv}|${t}`, label: `${LEVEL_LABEL[lv]} · ${t}` }));
    return out;
  }
  function openEd() {
    openEditor(stage, {
      gameId: "qui-a-dit",
      schema: SCHEMA,
      builtInList: builtInList(),
      onDone: async () => { await reload(); modeSelect(); },
      onReshuffle: () => seen.clear(),
    });
  }
  function stopChrono() { if (cdStop) { cdStop(); cdStop = null; } }
  function annulerTampon() { if (tamponTimer) { clearTimeout(tamponTimer); tamponTimer = null; } }

  function modeSelect() {
    if (liveStop) { liveStop(); liveStop = null; }
    stopChrono();
    showPhase(stage,
      el("div.card.center", {}, [
        el("h3", { text: "Comment jouer ?" }),
        el("button.btn.btn--full", { text: "🌐 Multi-appareils (recommandé)", onClick: startLive }),
        el("button.btn.btn--full.btn--ghost", { text: "📱 Sur un seul téléphone (on se le passe)", style: "margin-top:10px", onClick: soloJoueurs }),
        el("p.screen__subtitle", { text: "Tout le monde répond en secret à la même question. Ensuite, devinez qui a écrit quoi !", style: "margin-top:14px" }),
      ]),
      el("div.row", { style: "justify-content:center;margin-top:14px" }, [el("button.chip", { text: "✏️ Mes questions", onClick: openEd })])
    );
  }

  /* Petits éléments d'affichage partagés. */
  function joueur(nom, avatar, suffixe = "") {
    return el("span.qd-joueur", {}, [pastille(nom, avatar), el("span", { text: nom + suffixe })]);
  }
  function revelAuteur(nom, avatar, { anime, suffixe = "" } = {}) {
    return el("div.qd-auteur" + (anime ? ".is-anime" : ""), {}, [
      el("span.qd-auteur__lead", { text: "C'était…" }),
      el("span.qd-auteur__qui", {}, [pastille(nom, avatar, "qd-auteur__av"), el("span", { text: nom + suffixe })]),
    ]);
  }

  /* ================= Mode multi : chacun sur son téléphone ================= */
  function startLive() {
    if (liveStop) liveStop();
    let chrono = 0; // réglage de l'hôte : secondes pour écrire (0 = sans chrono)
    const points = {}; // deviceId -> points cumulés (base de l'hôte + manche → identiques partout)
    let courant = null; // manche affichée : { n, meta, ecrites, alerte } (l'hôte s'en sert pour passer au vote)
    let versVote = false; // le prochain assign() prépare le vote de la question en cours
    let voteDemande = -1; // manche d'écriture dont le vote est déjà parti (double tap, chrono + bouton…)
    let revelDemandee = -1; // manche de vote dont la révélation automatique est partie
    let compteManche = -1; // manche déjà comptée (couronnes, gorgées, stats)
    const fxVus = new Set(); // effets déjà joués (« n:etape ») : rien ne se rejoue à « Revoir »

    liveStop = liveSession(stage, {
      gameId: "qui-a-dit",
      title: "Qui a dit ça ? — multi",
      minPlayers: 3,
      startLabel: "Lancer la 1re question",
      revealLabel: (meta) => (meta && meta.phase === "ecrire" ? "🗳️ Passer au vote" : "🎭 Révéler qui a dit quoi"),
      newRoundLabel: "Question suivante →",
      onExit: modeSelect,
      reglages: {
        lire: () => ({ level, chrono }),
        ecrire: (r) => { if (r.level) level = r.level; if (Number.isInteger(r.chrono)) chrono = r.chrono; },
      },
      lobbyExtra: () => {
        const niveaux = levelSelector({ initial: level, onChange: (v) => (level = v) });
        const rangee = el("div.row", { style: "justify-content:center;flex-wrap:wrap" });
        [[0, "Sans chrono"], [45, "⏱️ 45 s"], [90, "⏱️ 90 s"]].forEach(([v, label]) => {
          const c = el("button.chip" + (chrono === v ? ".is-active" : ""), { text: label });
          c.addEventListener("click", () => { chrono = v; [...rangee.children].forEach((x) => x.classList.toggle("is-active", x === c)); });
          rangee.appendChild(c);
        });
        return el("div", { style: "margin:10px 0" }, [
          el("p.screen__subtitle", { text: "Niveau des questions", style: "margin-bottom:8px" }),
          niveaux.node,
          el("p.screen__subtitle", { text: "Temps pour écrire", style: "margin:12px 0 8px" }),
          rangee,
        ]);
      },
      // Bouton de l'hôte : pendant l'écriture, il lance le vote ; pendant le vote, il révèle.
      beforeReveal: (api, reveler) => {
        if (courant && courant.meta && courant.meta.phase === "ecrire") passerAuVote(api);
        else reveler();
      },
      assign: (ps) => {
        const roles = {};
        ps.forEach((p) => (roles[p.id] = true));
        const prec = courant && courant.meta;
        if (versVote && prec && prec.phase === "ecrire") {
          voteDemande = courant.n;
          const base = {};
          [...Object.keys(points), ...ps.map((p) => p.id)].forEach((id) => (base[id] = points[id] || 0));
          // Les auteurs (et leurs indices) sont ajoutés par le serveur : voir live.js.
          return {
            roles,
            meta: { phase: "vote", q: prec.q, level: prec.level, num: prec.num, base, noms: { ...(prec.noms || {}), ...dedupeNames(ps) } },
            anonymise: true,
          };
        }
        return { roles, meta: { phase: "ecrire", q: tirer(level), level, num: ((prec && prec.num) || 0) + 1, chrono, noms: dedupeNames(ps) } };
      },
      renderMine: (mine, ctx) => {
        if (!courant || courant.n !== ctx.n) courant = { n: ctx.n, meta: ctx.meta || {}, ecrites: 0, alerte: null };
        stopChrono();
        return ctx.meta && ctx.meta.phase === "vote" ? ecranVote(mine, ctx) : ecranEcriture(ctx);
      },
      renderReveal: (live, ctx) => revelation(live, ctx),
    });

    function passerAuVote(api) {
      if (!courant || !courant.meta || courant.meta.phase !== "ecrire" || voteDemande === courant.n) return;
      if (courant.ecrites < MIN_REPONSES) {
        const texte = `Il faut au moins ${MIN_REPONSES} réponses pour voter (${courant.ecrites} pour l'instant).`;
        if (courant.alerte) courant.alerte(texte);
        announce(texte);
        return;
      }
      versVote = true;
      api.newRound(); // synchrone jusqu'à l'envoi : assign() lit versVote
      versVote = false;
    }

    /* ---------- 1. Écriture ---------- */
    function ecranEcriture({ api, meta, n }) {
      const m = api.memo();
      if (!("texte" in m)) Object.assign(m, { texte: "", brouillon: "", edition: false });
      const noms = meta.noms || {};
      const nomDe = (id) => noms[id] || (api.players().find((p) => p.id === id) || {}).name || "?";
      const ta = el("textarea.input.qd-saisie", { rows: "3", maxlength: String(MAX_REPONSE), placeholder: "Ta réponse… courte, c'est plus drôle", "aria-label": "Ta réponse" });
      ta.value = m.edition || !m.texte ? m.brouillon || m.texte : m.texte;
      const reste = el("span.qd-reste");
      const envoyer = el("button.btn.btn--full", { text: "Envoyer ✍️", style: "margin-top:10px" });
      const modifier = el("button.chip", { text: "✏️ Modifier ma réponse", style: "margin-top:10px" });
      const statut = el("p.screen__subtitle", { style: "margin-top:10px" });
      const alerte = el("p.qd-alerte", { hidden: true });
      const prog = el("div.qd-prog");
      const anneau = anneauChrono();
      const finir = api.isHost() && !(meta.chrono > 0)
        ? el("button.chip", { text: "⏱️ 30 s pour finir", style: "margin-top:12px", onClick: () => api.startTimer(30) })
        : null;
      courant.alerte = (t) => { alerte.textContent = t; alerte.hidden = false; };

      function peindre() {
        const envoye = !!m.texte && !m.edition;
        ta.disabled = envoye;
        envoyer.hidden = envoye;
        modifier.hidden = !envoye;
        reste.textContent = `${ta.value.length} / ${MAX_REPONSE}`;
        statut.textContent = envoye ? "✅ Envoyée. Personne ne sait que c'est toi 🤫" : "Personne ne saura que c'est toi… sauf s'ils devinent 😏";
      }
      function envoyerReponse() {
        const t = nettoyer(ta.value);
        if (!t) { ta.focus(); return; }
        m.texte = t;
        m.brouillon = t;
        m.edition = false;
        ta.value = t;
        api.submit({ texte: t }); // re-soumettre remplace la réponse
        vibrate(20);
        peindre();
      }
      ta.addEventListener("input", () => { m.brouillon = ta.value; reste.textContent = `${ta.value.length} / ${MAX_REPONSE}`; });
      // Entrée = envoyer : une réponse tient sur une ligne.
      ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); envoyerReponse(); } });
      envoyer.addEventListener("click", envoyerReponse);
      modifier.addEventListener("click", () => { m.edition = true; peindre(); ta.focus(); });
      peindre();

      api.on("progress", (done, total) => {
        if (courant && courant.n === n) courant.ecrites = done.length;
        const avs = api.avatars();
        prog.replaceChildren(
          el("span.qd-prog__compte", { text: `✍️ ${done.length} / ${total || "?"} ont écrit` }),
          el("span.qd-prog__avs", {}, done.map((id) => pastille(nomDe(id), avs[id]))),
        );
        // Tout le monde a écrit : l'hôte lance le vote tout seul.
        if (api.isHost() && total >= MIN_REPONSES && done.length >= total && !m.auto) {
          m.auto = true;
          courant.alerte("🎲 Tout le monde a écrit : on mélange les réponses…");
          setTimeout(() => { if (courant && courant.n === n) passerAuVote(api); }, 1300);
        }
      });
      let chronoVu = false;
      api.on("timer", (endsAt) => {
        chronoVu = true;
        if (finir) finir.hidden = true; // un chrono tourne déjà
        stopChrono();
        cdStop = syncCountdown(endsAt, {
          onTick: (s) => {
            anneau.maj(s, totalChrono(m, endsAt, s));
            if (s <= 3 && s > 0 && (!m.texte || m.edition) && s !== m.bip) { m.bip = s; tick(); }
          },
          onEnd: () => {
            cdStop = null;
            // Temps écoulé : le brouillon part tel quel, s'il y en a un.
            if ((!m.texte || m.edition) && nettoyer(m.brouillon)) { ta.value = m.brouillon; envoyerReponse(); }
            ta.disabled = true;
            envoyer.hidden = true;
            modifier.hidden = true;
            if (!m.texte) statut.textContent = "⏰ Temps écoulé !";
            if (api.isHost()) setTimeout(() => { if (courant && courant.n === n) passerAuVote(api); }, 1500);
          },
        });
      });
      // Chrono réglé dans le salon : l'hôte le lance une fois (pas à un re-rendu,
      // ni chez un hôte promu : le chrono déjà lancé a été rejoué juste au-dessus).
      if (api.isHost() && meta.chrono > 0 && !chronoVu && !m.chronoLance) { m.chronoLance = true; api.startTimer(meta.chrono); }

      return [
        el("p.screen__subtitle", { text: `Question ${meta.num || 1} · ${LEVEL_LABEL[meta.level] || ""}` }),
        el("p.big-prompt.qd-question", { text: meta.q || "…" }),
        anneau.node,
        ta,
        reste,
        envoyer,
        modifier,
        statut,
        alerte,
        prog,
        finir,
        api.isHost() ? el("p.screen__subtitle", { text: "Le vote démarre tout seul quand tout le monde a écrit.", style: "margin-top:8px;font-size:13px" }) : null,
      ];
    }

    /* ---------- 2. Vote : qui a écrit quoi ? ---------- */
    function ecranVote(mine, { api, meta, n }) {
      const m = api.memo();
      if (!m.v) Object.assign(m, { v: {}, i: null, envoye: false });
      const anonymes = Array.isArray(meta.anonymes) ? meta.anonymes : [];
      const mien = mine && typeof mine === "object" && Number.isInteger(mine.mien) ? mine.mien : -1;
      const noms = meta.noms || {};
      const nomDe = (id) => noms[id] || (api.players().find((p) => p.id === id) || {}).name || "?";
      const avs = api.avatars();
      const candidats = (meta.auteurs || []).filter((id) => id !== api.me);
      const aVoter = anonymes.map((_, i) => i).filter((i) => i !== mien);
      const zone = el("div");
      const prog = el("p.screen__subtitle", { style: "margin-top:12px" });
      const complet = () => aVoter.every((i) => m.v[i] != null);

      if (anonymes.length < MIN_REPONSES || !aVoter.length || !candidats.length) {
        return [
          el("p.qd-question.is-petite", { text: meta.q || "" }),
          el("p", { text: "Pas assez de réponses pour voter cette fois-ci 🤷", style: "margin-top:12px" }),
          api.isHost() ? el("p.screen__subtitle", { text: "Passe à la question suivante.", style: "margin-top:8px" }) : null,
        ];
      }

      function peindre() {
        if (m.i == null) m.i = complet() ? -1 : aVoter.find((i) => m.v[i] == null);
        if (m.i === -1) recap();
        else carte(m.i);
      }
      function choisir(i, id) {
        m.v[i] = id;
        vibrate(15);
        if (complet()) { api.submit({ v: { ...m.v } }); m.envoye = true; } // re-soumettre = changer d'avis
        const suite = aVoter.find((j) => m.v[j] == null);
        m.i = suite == null ? -1 : suite;
        setTimeout(peindre, 220); // le temps de voir la tuile choisie
      }
      function carte(i) {
        const pos = aVoter.indexOf(i);
        const grille = tuilesVote(candidats.map((id) => ({ id, nom: nomDe(id), avatar: avs[id] })), { onChoisir: (id) => choisir(i, id) });
        grille.peindre({ choisi: m.v[i] || null });
        // Repère : ce joueur est déjà désigné pour une autre réponse.
        [...grille.node.children].forEach((t, k) => {
          const ailleurs = aVoter.find((j) => j !== i && m.v[j] === candidats[k]);
          if (ailleurs != null) t.append(el("span.qd-deja", { text: `déjà : n° ${aVoter.indexOf(ailleurs) + 1}` }));
        });
        remplir(zone, 
          el("div.qd-points", { role: "group", "aria-label": "Réponses" }, aVoter.map((j, k) =>
            el("button.qd-point" + (j === i ? ".is-actif" : "") + (m.v[j] != null ? ".is-fait" : ""), {
              type: "button", "aria-label": `Réponse ${k + 1}${m.v[j] != null ? " (choisie)" : ""}`,
              onClick: () => { m.i = j; peindre(); },
            })
          )),
          el("p.screen__subtitle", { text: `Réponse ${pos + 1} / ${aVoter.length}` }),
          el("blockquote.qd-reponse", { text: anonymes[i].texte || "…" }),
          el("p.qd-qui", { text: "Qui a écrit ça ?" }),
          grille.node,
          complet() ? el("button.chip", { text: "📋 Voir tous mes choix", style: "margin-top:12px", onClick: () => { m.i = -1; peindre(); } }) : null,
        );
      }
      function recap() {
        remplir(zone, 
          el("h3", { text: m.envoye ? "✅ Tes choix sont partis" : "Tes choix" }),
          el("div.stack.qd-recap", { style: "margin-top:10px" }, aVoter.map((i) =>
            el("button.qd-recap__ligne", { type: "button", onClick: () => { m.i = i; peindre(); } }, [
              el("span.qd-recap__texte", { text: `« ${anonymes[i].texte || "…"} »` }),
              m.v[i] ? joueur(nomDe(m.v[i]), avs[m.v[i]]) : el("span", { text: "?" }),
            ])
          )),
          el("p.screen__subtitle", { text: "Touche une réponse pour changer d'avis, jusqu'à la révélation.", style: "margin-top:10px" }),
        );
      }
      peindre();

      api.on("progress", (done, total) => {
        prog.textContent = `🗳️ ${done.length} / ${total || "?"} ont voté`;
        // Tout le monde a voté : l'hôte révèle tout seul.
        if (api.isHost() && total >= 2 && done.length >= total && revelDemandee !== n) {
          revelDemandee = n;
          prog.textContent = "🎭 Tout le monde a voté : place à la révélation !";
          setTimeout(() => { if (courant && courant.n === n) api.reveal(); }, 1500);
        }
      });

      return [
        el("p.qd-question.is-petite", { text: meta.q || "" }),
        mien >= 0 ? el("p.qd-moi", { text: `📝 Ta réponse est dans le lot : « ${anonymes[mien].texte || "…"} ». Fais-toi discret 🤫` }) : null,
        zone,
        prog,
      ];
    }

    /* ---------- 3. Révélation, réponse par réponse ---------- */
    function revelation(live, { api, n, masquerSuite = () => {} }) {
      stopChrono();
      const meta = live.meta || {};
      if (meta.phase !== "vote") return el("p", { text: "Manche terminée." });
      const noms = meta.noms || {};
      const nomDe = (id) => noms[id] || (live.names || {})[id] || "?";
      const avs = live.avatars || {};
      const d = depouiller(meta.anonymes, live.roles, live.inputs);
      const base = meta.base || {};
      const ids = [...new Set([...Object.keys(live.roles || {}), ...Object.keys(base).filter((id) => base[id] > 0)])];
      const totaux = {};
      ids.forEach((id) => (totaux[id] = (base[id] || 0) + (d.points[id] || 0)));
      Object.assign(points, totaux); // tous les téléphones convergent (utile si l'hôte change)
      const toi = (id) => (id === api.me ? " (toi)" : "");

      // 👑 Couronnes, 🍺 compteur et superlatif : l'hôte seul, une fois par manche.
      if (api.isHost() && n !== compteManche) {
        compteManche = n;
        const classes = ids.filter((id) => totaux[id] > 0).sort((a, b) => totaux[b] - totaux[a]);
        const prenoms = {};
        classes.forEach((id) => (prenoms[id] = (live.names || {})[id] || nomDe(id)));
        if (classes.length) awardStanding("qui-a-dit", classes, prenoms, avs, { scores: totaux });
        compterGorgees(Object.entries(d.gorgees).map(([id, g]) => ({ id, nom: (live.names || {})[id] || nomDe(id), avatar: avs[id], n: g })), { manche: "qui-a-dit:" + n });
        if (d.fantomes.length) bumpMany(d.fantomes, "fantome");
      }

      const N = d.reponses.length;
      const zone = el("div.qd-revel");
      const boutons = el("div", { style: "margin-top:14px" });
      let etape = 0;

      function afficher(e) {
        etape = Math.max(0, Math.min(N, e));
        if (etape >= N) bilan();
        else montrer(d.reponses[etape]);
        peindreBoutons();
      }
      function montrer(r) {
        const cle = `${n}:${etape}`;
        const neuf = !fxVus.has(cle);
        fxVus.add(cle);
        const nom = r.auteur ? nomDe(r.auteur) : "?";
        const voix = r.trouvePar.length + r.bernes.length;
        remplir(zone, 
          el("p.screen__subtitle", { text: `Réponse ${etape + 1} / ${N}` }),
          el("blockquote.qd-reponse", { text: r.texte }),
          revelAuteur(nom, avs[r.auteur], { anime: neuf, suffixe: toi(r.auteur) }),
          el("div.qd-verdicts" + (neuf ? ".is-anime" : ""), {}, [
            r.trouvePar.length
              ? el("div.qd-ligne", {}, [el("span.qd-ligne__titre", { text: "🎯 Trouvé par" }), ...r.trouvePar.map((id) => joueur(nomDe(id), avs[id], toi(id)))])
              : null,
            r.bernes.length
              ? el("div.qd-ligne", {}, [el("span.qd-ligne__titre", { text: "🙈 Bernés" }), ...r.bernes.map((b) =>
                  el("span.qd-berne", {}, [joueur(nomDe(b.id), avs[b.id], toi(b.id)), el("span.qd-berne__choix", { text: `pensait ${nomDe(b.choix)}` })]))])
              : null,
            !voix ? el("p.screen__subtitle", { text: "Personne n'a voté pour cette réponse." }) : null,
            r.demasque ? el("p.qd-sentence", { text: `🍺 Trop facile ! ${nom} boit 1 gorgée.` }) : null,
            r.fantome ? el("p.qd-sentence.is-fantome", { text: `👻 Personne n'a trouvé : ${nom} distribue 2 gorgées !` }) : null,
          ]),
        );
        if (!neuf) return;
        setTimeout(pop, 800); // l'auteur apparaît (même tempo que l'animation)
        if (r.auteur === api.me && r.fantome) setTimeout(celebrate, 900);
        else if (r.auteur === api.me && r.demasque) setTimeout(() => vibrate([30, 40, 30]), 800);
        else if (r.trouvePar.includes(api.me)) setTimeout(() => vibrate(25), 800);
      }
      function bilan() {
        const cle = `${n}:bilan`;
        const neuf = !fxVus.has(cle);
        fxVus.add(cle);
        const classement = [...ids].sort((a, b) => totaux[b] - totaux[a]);
        const aBoire = Object.keys(d.gorgees).sort((a, b) => d.gorgees[b] - d.gorgees[a]);
        remplir(zone, 
          el("h3", { text: "📊 Bilan de la question" }),
          el("div.stack.qd-bilan" + (neuf ? ".is-anime" : ""), { style: "margin-top:10px" }, d.reponses.map((r, k) =>
            el("div.qd-bilan__ligne", { style: `--i:${k}` }, [
              pastille(nomDe(r.auteur), avs[r.auteur]),
              el("span.qd-bilan__texte", { text: `« ${r.texte} »` }),
              el("span.qd-bilan__score", { text: `🎯 ${r.trouvePar.length}/${r.trouvePar.length + r.bernes.length}` }),
            ])
          )),
          aBoire.length || d.fantomes.length
            ? el("div.qd-boire", {}, [
                ...aBoire.map((id) => el("p", { text: `🍺 ${nomDe(id)}${toi(id)} : ${pluriel(d.gorgees[id], "gorgée")} (${d.raisons[id].join(", ")})` })),
                ...d.fantomes.map((id) => el("p", { text: `👻 ${nomDe(id)}${toi(id)} distribue 2 gorgées` })),
              ])
            : el("p.screen__subtitle", { text: "Personne ne boit cette fois-ci 😇", style: "margin-top:12px" }),
          el("h3", { text: "Classement", style: "margin-top:18px" }),
          el("p.screen__subtitle", { text: "1 point par bon vote… et 1 point pour l'auteur à chaque joueur berné.", style: "margin:4px 0 8px;font-size:13px" }),
          podium(classement.map((id) => ({ nom: nomDe(id) + toi(id), points: totaux[id], avant: neuf ? base[id] || 0 : totaux[id] }))),
          el("div.stack", { style: "margin-top:10px" }, classement.map((id) =>
            el("div.uc-role-row", {}, [
              joueur(nomDe(id), avs[id], toi(id)),
              el("span", { text: `${totaux[id]} pt${totaux[id] > 1 ? "s" : ""}${d.points[id] ? ` (+${d.points[id]})` : ""}` }),
            ])
          )),
        );
        if (neuf && d.gorgees[api.me]) {
          annulerTampon();
          tamponTimer = setTimeout(() => { tamponTimer = null; stampGage(`Tu bois ${pluriel(d.gorgees[api.me], "gorgée")} 🍺`); }, 900);
        }
      }
      function peindreBoutons() {
        masquerSuite(etape < N); // « Question suivante » n'apparaît qu'au bilan
        if (!api.isHost()) {
          remplir(boutons, etape < N ? el("p.screen__subtitle", { text: "L'hôte fait défiler les réponses…" }) : "");
          return;
        }
        remplir(boutons, 
          etape < N ? el("button.btn.btn--full", { text: etape + 1 < N ? "Réponse suivante ▶" : "📊 Voir le bilan", onClick: () => api.sendState({ etape: etape + 1 }) }) : "",
          etape < N - 1 ? el("button.chip", { text: "⏭️ Tout révéler", style: "margin-top:10px", onClick: () => api.sendState({ etape: N }) }) : "",
        );
      }

      afficher(0);
      api.on("state", (s) => { if (s && Number.isInteger(s.etape)) afficher(s.etape); }); // rejoué : un retardataire arrive à la bonne étape
      return el("div.center", {}, [
        el("p.screen__subtitle", { text: `Question ${meta.num || 1}` }),
        el("p.qd-question.is-petite", { text: meta.q || "" }),
        N ? zone : el("p", { text: "Aucune réponse 🤷" }),
        boutons,
      ]);
    }
  }

  /* ============ Sur un seul téléphone : on se le passe pour écrire ============ */
  function soloJoueurs() {
    showPhase(stage,
      playersCard({ min: 3, cta: "Suite →", onReady: (noms) => soloReglages(noms) }),
      el("div.row", { style: "justify-content:center;margin-top:14px" }, [
        el("button.chip", { text: "← Mode", onClick: modeSelect }),
        el("button.chip", { text: "✏️ Mes questions", onClick: openEd }),
      ])
    );
  }
  function soloReglages(noms) {
    const niveaux = levelSelector({ initial: level, onChange: (v) => (level = v) });
    showPhase(stage, el("div.card.center", {}, [
      el("h3", { text: "Niveau des questions" }),
      niveaux.node,
      el("p.screen__subtitle", { text: "Chacun écrit sa réponse en secret, puis on les lit une à une et l'on devine qui a dit quoi.", style: "margin-top:12px" }),
      el("button.btn.btn--full", { text: "C'est parti →", style: "margin-top:14px", onClick: () => soloQuestion(noms, 1) }),
      el("button.chip", { text: "← Joueurs", style: "margin-top:10px", onClick: soloJoueurs }),
    ]));
  }
  function soloQuestion(noms, num) {
    const q = tirer(level);
    const reponses = [];
    passThePhone(stage, noms, {
      icon: "✍️",
      cta: "écrire",
      onPlayer: (p, i, next) => {
        const ta = el("textarea.input.qd-saisie", { rows: "3", maxlength: String(MAX_REPONSE), placeholder: "Ta réponse… courte, c'est plus drôle", "aria-label": "Ta réponse" });
        const valider = () => {
          const t = nettoyer(ta.value);
          if (!t) { ta.focus(); return; }
          reponses.push({ auteur: p, texte: t });
          next();
        };
        ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); valider(); } });
        showPhase(stage, el("div.card.center", {}, [
          el("p.screen__subtitle", { text: `Question ${num} · à toi, ${p}` }),
          el("p.big-prompt.qd-question", { text: q }),
          ta,
          el("button.btn.btn--full", { text: "Valider et cacher 🙈", style: "margin-top:12px", onClick: valider }),
        ]));
      },
      onDone: () => soloLecture(noms, num, q, shuffle(reponses), 0),
    });
  }
  function soloLecture(noms, num, q, reponses, i) {
    if (i >= reponses.length) return soloFin(noms, num, q, reponses);
    const r = reponses[i];
    const suite = () => soloLecture(noms, num, q, reponses, i + 1);
    const zone = el("div");
    const reveler = el("button.btn.btn--full", {
      text: "🎭 Révéler l'auteur",
      style: "margin-top:14px",
      onClick: () => {
        reveler.remove();
        remplir(zone, 
          revelAuteur(r.auteur, null, { anime: true }),
          el("p.screen__subtitle", { text: "La majorité avait trouvé ?", style: "margin-top:14px" }),
          el("div.stack", { style: "margin-top:8px" }, [
            el("button.btn.btn--full", { text: `🎯 Oui : ${r.auteur} boit`, onClick: () => { compterGorgees([{ nom: r.auteur, n: 1 }]); suite(); } }),
            el("button.btn.btn--full.btn--ghost", { text: `👻 Non : ${r.auteur} distribue 2 gorgées`, onClick: suite }),
          ]),
        );
        setTimeout(pop, 800);
      },
    });
    showPhase(stage, el("div.card.center", {}, [
      el("p.screen__subtitle", { text: `Question ${num} · réponse ${i + 1} / ${reponses.length}` }),
      el("p.qd-question.is-petite", { text: q }),
      el("blockquote.qd-reponse", { text: r.texte }),
      el("p.screen__subtitle", { text: "Lisez-la à voix haute. Qui a dit ça ? Votez à main levée !", style: "margin-top:10px" }),
      zone,
      reveler,
    ]));
  }
  function soloFin(noms, num, q, reponses) {
    showPhase(stage, el("div.card.center", {}, [
      el("h3", { text: "📜 Toutes les réponses" }),
      el("p.qd-question.is-petite", { text: q }),
      el("div.stack.qd-bilan.is-anime", { style: "margin-top:10px" }, reponses.map((r, k) =>
        el("div.qd-bilan__ligne", { style: `--i:${k}` }, [pastille(r.auteur, null), el("span.qd-bilan__texte", { text: `« ${r.texte} »` }), el("span.qd-bilan__score", { text: r.auteur })])
      )),
      el("button.btn.btn--full", { text: "Question suivante →", style: "margin-top:14px", onClick: () => soloQuestion(noms, num + 1) }),
      el("button.chip", { text: "← Mode", style: "margin-top:10px", onClick: modeSelect }),
    ]));
  }
}
