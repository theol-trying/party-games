import { el, screenHead, announce, showPhase } from "../../ui.js";
import { createDeck } from "../../deck.js";
import { openEditor } from "../../content.js";
import { contentSource } from "../../game-kit.js";
import { liveSession, peekAutoLive } from "../../realtime.js";
import { DILEMMES } from "./data.js";

const SCHEMA = {
  title: "Tu préfères…",
  fields: [
    { key: "a", label: "Option A", type: "text" },
    { key: "b", label: "Option B", type: "text" },
  ],
  summary: (e) => `${e.a}  /  ${e.b}`,
};

export function render(container, { game }) {
  const src = contentSource("tu-preferes", { builtIn: DILEMMES, keyOf: (d) => `${d.a}|${d.b}`, toValue: (e) => ({ a: e.a, b: e.b }) });
  let deck = createDeck(dilemmes());
  let counts = { a: 0, b: 0 };
  let revealed = false;

  container.append(screenHead(game.title, "Tape ton camp · le camp minoritaire boit"));
  const stage = el("div");
  container.append(stage);
  let liveStop = null;

  src.reload().then(() => (deck = createDeck(dilemmes())));

  function dilemmes() { return src.cards(); }
  function builtInList() { return DILEMMES.map((d) => ({ key: `${d.a}|${d.b}`, label: `${d.a} / ${d.b}` })); }
  function openEd() {
    openEditor(stage, { gameId: "tu-preferes", schema: SCHEMA, builtInList: builtInList(), onDone: async () => { await src.reload(); deck = createDeck(dilemmes()); draw(); } });
  }

  function optionBtn(side, label) {
    const btn = el("button.tp-option", {}, [
      el("div.tp-option__label", { text: label }),
      el("div.tp-option__count", { text: String(counts[side]) }),
    ]);
    btn.dataset.side = side;
    btn.addEventListener("click", () => {
      if (revealed) return;
      counts[side]++;
      btn.querySelector(".tp-option__count").textContent = counts[side];
    });
    return btn;
  }

  function reveal() {
    revealed = true;
    const { a, b } = counts;
    let verdict;
    if (a === b) verdict = "Égalité parfaite… tout le monde boit ! 🍻";
    else {
      const loser = a < b ? "A" : "B";
      verdict = `Camp ${loser} minoritaire → il boit ! 🍻`;
    }
    stage.querySelector(".tp-verdict").textContent = verdict;
    announce(verdict);
    stage.querySelectorAll(".tp-option").forEach((n) => {
      const side = n.dataset.side;
      const isMin = (side === "a" && a < b) || (side === "b" && b < a);
      n.classList.toggle("is-loser", isMin);
    });
    stage.querySelector(".tp-reveal").style.display = "none";
    stage.querySelector(".tp-next").style.display = "";
  }

  function draw() {
    revealed = false;
    counts = { a: 0, b: 0 };
    const d = deck.next();
    if (!d) {
      showPhase(stage, el("div.card.center", {}, [
        el("p", { text: "Aucun dilemme actif — ajoute-en ou change la source via ✏️ Mes cartes." }),
        el("button.btn", { text: "✏️ Mes cartes", style: "margin-top:12px", onClick: openEd }),
      ]));
      return;
    }
    showPhase(stage,
      el("div.tp-board", {}, [optionBtn("a", d.a), el("div.tp-or", { text: "OU" }), optionBtn("b", d.b)]),
      el("p.tp-verdict.center", { style: "min-height:22px;margin:16px 0;font-weight:700" }),
      el("button.btn.btn--full.tp-reveal", { text: "Révéler le résultat", onClick: reveal }),
      el("button.btn.btn--full.tp-next", { text: "Dilemme suivant →", style: "display:none", onClick: draw }),
      el("div.row", { style: "justify-content:center;margin-top:12px" }, [el("button.chip", { text: "✏️ Mes cartes", onClick: openEd })])
    );
  }

  // Choix du mode : compteur sur un seul téléphone, ou vote secret multi.
  function modeSelect() {
    if (liveStop) { liveStop(); liveStop = null; }
    showPhase(stage,
      el("div.card.center", {}, [
        el("h3", { text: "Comment jouer ?" }),
        el("button.btn.btn--full", { text: "📱 Sur ce téléphone", onClick: draw }),
        el("button.btn.btn--full.btn--ghost", { text: "🌐 Multi-appareils (vote secret)", style: "margin-top:10px", onClick: startLive }),
      ]),
      el("div.row", { style: "justify-content:center;margin-top:14px" }, [el("button.chip", { text: "✏️ Mes cartes", onClick: openEd })])
    );
  }

  /* ============ Mode multi : chacun choisit son camp en secret ============ */
  function startLive() {
    if (!dilemmes().length) return modeSelect();
    if (liveStop) liveStop();
    const liveDeck = createDeck(dilemmes());
    const predScores = {}; // deviceId -> bonnes prédictions cumulées (base + delta)
    const stats = { rounds: 0, agreeSum: 0, unanimous: 0 }; // stats de soirée (identiques partout)

    liveStop = liveSession(stage, {
      gameId: "tu-preferes",
      title: "Tu préfères — multi",
      minPlayers: 2,
      startLabel: "Lancer le 1er dilemme",
      revealLabel: "Révéler les votes",
      newRoundLabel: "Dilemme suivant →",
      onExit: modeSelect,
      assign: (ps) => {
        let d = liveDeck.next();
        if (!d) { liveDeck.reset(); d = liveDeck.next(); }
        const base = {};
        ps.forEach((p) => (base[p.id] = predScores[p.id] || 0));
        const roles = {};
        ps.forEach((p) => (roles[p.id] = true));
        return { roles, meta: { a: d.a, b: d.b, base } };
      },
      renderMine: (mine, { api, meta }) => {
        let myPick = null;
        let myPredict = null;
        const status = el("p.screen__subtitle", { text: "Choisis ton camp 🤫", style: "margin-top:12px" });
        const mk = (side, label) =>
          el("button.tp-option", { style: "width:100%" }, [
            el("div.tp-option__label", { text: label }),
          ]);
        const btnA = mk("a", meta.a);
        const btnB = mk("b", meta.b);
        // 🔮 Prédiction (optionnelle) : quel camp sera majoritaire ?
        const predRow = el("div", { style: "display:none;margin-top:14px" });
        const predStatus = el("span");
        const mkPred = (side, label) => el("button.chip", {
          text: label,
          onClick: (e) => {
            if (myPredict) return;
            myPredict = side;
            api.submit({ pick: myPick, predict: side });
            [...predRow.querySelectorAll("button")].forEach((b) => (b.disabled = true));
            e.currentTarget.classList.add("is-active");
            predStatus.textContent = " ✅";
          },
        });
        predRow.append(
          el("p.screen__subtitle", { text: "🔮 Bonus : quel camp sera MAJORITAIRE ?", style: "margin-bottom:6px" }),
          el("div.row", { style: "justify-content:center" }, [mkPred("a", "Camp A"), mkPred("b", "Camp B"), predStatus])
        );
        const pickSide = (side, btn) => {
          if (myPick) return;
          myPick = side;
          api.submit({ pick: side });
          [btnA, btnB].forEach((b) => (b.style.opacity = ".55"));
          btn.style.opacity = "1";
          btn.style.outline = "3px solid var(--accent)";
          status.textContent = "✅ Camp choisi — en attente des autres…";
          predRow.style.display = "";
        };
        btnA.addEventListener("click", () => pickSide("a", btnA));
        btnB.addEventListener("click", () => pickSide("b", btnB));
        api.on("progress", (done, total) => {
          if (myPick) status.textContent = `✅ Voté · ${done.length} / ${total} ont choisi`;
        });
        return [
          el("h3", { text: "Tu préfères…", style: "margin-bottom:12px" }),
          el("div.stack", {}, [btnA, el("div.tp-or.center", { text: "OU" }), btnB]),
          status,
          predRow,
        ];
      },
      renderReveal: (live, { api }) => {
        const names = live.names || {};
        const inputs = live.inputs || {};
        const base = (live.meta && live.meta.base) || {};
        const ids = Object.keys(names);
        const campA = ids.filter((id) => inputs[id] && inputs[id].pick === "a");
        const campB = ids.filter((id) => inputs[id] && inputs[id].pick === "b");
        const na = campA.length, nb = campB.length;
        let verdict;
        if (na === nb) verdict = "Égalité parfaite… tout le monde boit ! 🍻";
        else verdict = `Camp minoritaire : « ${na < nb ? live.meta.a : live.meta.b} » → il boit ! 🍻`;

        // 🔮 Prophètes : bonne prédiction du camp majoritaire (égalité = personne).
        const majority = na === nb ? null : na > nb ? "a" : "b";
        const prophets = majority ? ids.filter((id) => inputs[id] && inputs[id].predict === majority) : [];
        ids.forEach((id) => (predScores[id] = (base[id] || 0) + (prophets.includes(id) ? 1 : 0)));
        const predRank = ids.map((id) => ({ id, s: predScores[id] })).filter((r) => r.s > 0).sort((a, b) => b.s - a.s);

        // 📊 Stats de soirée (déterministes : chaque téléphone calcule pareil).
        const total = na + nb;
        stats.rounds++;
        if (total > 0) stats.agreeSum += Math.max(na, nb) / total;
        if (total > 1 && (na === 0 || nb === 0)) stats.unanimous++;
        const agreePct = stats.rounds ? Math.round((stats.agreeSum / stats.rounds) * 100) : 0;

        const bloc = (label, camp, isMin) =>
          el("div.card", { style: `margin-top:10px;${isMin ? "border-color:var(--accent)" : ""}` }, [
            el("p", { text: label, style: "font-weight:800" }),
            el("p.screen__subtitle", { text: `${camp.length} voix${camp.length ? " · " + camp.map((id) => names[id] + (id === api.me ? " (toi)" : "")).join(", ") : ""}` }),
          ]);
        return el("div", {}, [
          el("h3", { text: "Résultats" }),
          el("p", { text: verdict, style: "font-weight:700;margin:10px 0" }),
          bloc(live.meta.a, campA, na < nb),
          bloc(live.meta.b, campB, nb < na),
          prophets.length
            ? el("p", { text: `🔮 Bien vu : ${prophets.map((id) => names[id]).join(", ")} (+1)`, style: "font-weight:700;margin-top:12px" })
            : el("p.screen__subtitle", { text: majority ? "🔮 Personne n'avait prédit le bon camp." : "🔮 Égalité : pas de prophète cette manche.", style: "margin-top:12px" }),
          predRank.length
            ? el("div", { style: "margin-top:8px" }, [
                el("p.screen__subtitle", { text: "Classement des prophètes :" }),
                el("div.stack", {}, predRank.map((r, i) => el("div.uc-role-row", {}, [
                  el("span", { text: `${i + 1}. ${names[r.id]}${r.id === api.me ? " (toi)" : ""}` }),
                  el("span", { text: "🔮".repeat(Math.min(r.s, 8)) + (r.s > 8 ? ` ×${r.s}` : "") }),
                ]))),
              ])
            : null,
          el("p.screen__subtitle", {
            text: `📊 Soirée : accord moyen ${agreePct}% · ${stats.unanimous} manche${stats.unanimous > 1 ? "s" : ""} unanime${stats.unanimous > 1 ? "s" : ""} sur ${stats.rounds}`,
            style: "margin-top:12px",
          }),
        ]);
      },
    });
  }

  if (peekAutoLive()) startLive(); else modeSelect(); // « suivre l'hôte » : salon direct

  // Cleanup routeur : stoppe le salon multi si actif.
  return () => { if (liveStop) liveStop(); };
}
