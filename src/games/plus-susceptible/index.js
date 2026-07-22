import { el, screenHead, announce, showPhase } from "../../ui.js";
import { playersCard } from "../../players.js";
import { createDeck } from "../../deck.js";
import { makeSeen } from "../../seen.js";
import { awardStanding } from "../../crown.js";
import { createScores, scoreboard } from "../../scoring.js";
import { openEditor } from "../../content.js";
import { passThePhone, contentSource } from "../../game-kit.js";
import { liveSession, peekAutoLive } from "../../realtime.js";
import { AFFIRMATIONS } from "./data.js";

const SCHEMA = {
  title: "Qui est le plus susceptible de…",
  fields: [{ key: "text", label: "… (commence par un verbe : « finir la soirée… »)", type: "text" }],
  summary: (e) => e.text,
};

export function render(container, { game }) {
  const src = contentSource("plus-susceptible", { builtIn: AFFIRMATIONS });
  const seen = makeSeen("plus-susceptible"); // anti-répétition entre soirées
  container.append(screenHead(game.title, "Vote anonyme · roi/reine de la soirée"));
  const stage = el("div");
  container.append(stage);

  let liveStop = null;
  if (peekAutoLive()) startLive(); else modeSelect(); // « suivre l'hôte » : salon direct
  src.reload();

  // Cleanup routeur : stoppe le salon multi si actif.
  return () => { if (liveStop) liveStop(); };

  function affirmations() { return src.cards(); }
  function builtInList() {
    return AFFIRMATIONS.map((t) => ({ key: t, label: t }));
  }

  function modeSelect() {
    if (liveStop) { liveStop(); liveStop = null; }
    showPhase(stage,
      el("div.card.center", {}, [
        el("h3", { text: "Comment jouer ?" }),
        el("button.btn.btn--full", { text: "📱 Sur ce téléphone", onClick: introScreen }),
        el("button.btn.btn--full.btn--ghost", { text: "🌐 Multi-appareils (vote secret)", style: "margin-top:10px", onClick: startLive }),
      ]),
      el("div.row", { style: "justify-content:center;margin-top:14px" }, [el("button.chip", { text: "✏️ Mes cartes", onClick: openEd })])
    );
  }

  function introScreen() {
    stage.replaceChildren(
      playersCard({ min: 3, cta: "Lancer les votes", onReady: (names) => startGame(names) }),
      el("div.row", { style: "justify-content:center;margin-top:14px" }, [
        el("button.chip", { text: "← Mode", onClick: modeSelect }),
        el("button.chip", { text: "✏️ Mes cartes", onClick: openEd }),
      ])
    );
  }

  /* ============ Mode multi : chacun vote en secret sur son téléphone ============ */
  function startLive() {
    if (!affirmations().length) return modeSelect();
    if (liveStop) liveStop();
    const deck = createDeck(affirmations(), { seen });
    const crowns = {}; // deviceId -> couronnes cumulées (converge : base + delta déterministe)

    liveStop = liveSession(stage, {
      gameId: "plus-susceptible",
      title: "Plus susceptible — multi",
      minPlayers: 3,
      startLabel: "Lancer la 1re affirmation",
      revealLabel: "Révéler les votes",
      newRoundLabel: "Affirmation suivante →",
      onExit: modeSelect,
      assign: (ps) => {
        let s = deck.next();
        if (s == null) { deck.reset(); s = deck.next(); }
        const base = {};
        ps.forEach((p) => (base[p.id] = crowns[p.id] || 0));
        const roles = {};
        ps.forEach((p) => (roles[p.id] = true));
        return { roles, meta: { statement: s, base } };
      },
      renderMine: (mine, { api, meta }) => {
        let voted = false;
        const others = api.players().filter((p) => p.id !== api.me);
        const status = el("p.screen__subtitle", { text: "Vote en secret 🤫", style: "margin-top:12px" });
        const btns = others.map((p) =>
          el("button.btn.btn--ghost.btn--full", {
            text: p.name,
            style: "margin-top:8px",
            onClick: (e) => {
              if (voted) return;
              voted = true;
              api.submit({ vote: p.id });
              btns.forEach((b) => (b.disabled = true));
              e.currentTarget.style.borderColor = "var(--accent)";
              status.textContent = "✅ Vote envoyé — en attente des autres…";
            },
          })
        );
        api.on("progress", (done, total) => {
          if (!voted) return;
          status.textContent = `✅ Voté · ${done.length} / ${total} ont voté`;
        });
        return [
          el("p.ps-statement", { text: `Qui est le plus susceptible de ${meta.statement}` }),
          el("div.stack.ps-choices", { style: "margin-top:14px" }, btns),
          status,
        ];
      },
      renderReveal: (live, { api }) => {
        const names = live.names || {};
        const ids = Object.keys(names);
        const tally = {};
        ids.forEach((id) => (tally[id] = 0));
        Object.values(live.inputs || {}).forEach((d) => {
          if (d && d.vote != null && d.vote in tally) tally[d.vote]++;
        });
        const max = Math.max(0, ...Object.values(tally));
        const winners = ids.filter((id) => max > 0 && tally[id] === max);
        // Couronnes : base autoritative + delta → aucun décalage entre appareils.
        const base = (live.meta && live.meta.base) || {};
        ids.forEach((id) => (crowns[id] = (base[id] || 0) + (winners.includes(id) ? 1 : 0)));
        // 👑 Contribue au Roi de la soirée (classement par couronnes).
        if (api.isHost()) {
          const cranked = ids.filter((id) => crowns[id] > 0).sort((a, b) => crowns[b] - crowns[a]);
          if (cranked.length) awardStanding("plus-susceptible", cranked, names, live.avatars || {});
        }
        const ranking = ids.map((id) => ({ id, v: tally[id] })).sort((a, b) => b.v - a.v);
        const wNames = winners.map((id) => names[id]);
        return el("div", {}, [
          el("p.ps-statement", { text: `Qui est le plus susceptible de ${(live.meta || {}).statement || "…"}` }),
          el("h2.ps-winner", {
            text: wNames.length ? (wNames.length > 1 ? wNames.join(" & ") + " 🍻" : wNames[0] + " boit ! 🍻") : "Personne n'a voté 🤷",
            style: "margin:14px 0",
          }),
          el("div.ps-ranking", {},
            ranking.map((r) =>
              el("div.ps-rank-row", {}, [
                el("span", { text: names[r.id] + (r.id === api.me ? " (toi)" : "") }),
                el("span.ps-rank-bar", { style: `--v:${max ? r.v / max : 0}` }),
                el("span", { text: String(r.v) }),
              ])
            )
          ),
          el("h3", { text: "👑 Couronnes", style: "margin-top:16px;margin-bottom:8px" }),
          el("div.stack", {},
            ids.map((id) => ({ id, c: crowns[id] })).sort((a, b) => b.c - a.c).map((r) =>
              el("div.uc-role-row", {}, [
                el("span", { text: names[r.id] + (r.id === api.me ? " (toi)" : "") }),
                el("span", { text: "👑".repeat(Math.min(r.c, 10)) + (r.c > 10 ? ` ×${r.c}` : r.c === 0 ? "—" : "") }),
              ])
            )
          ),
        ]);
      },
    });
  }

  function openEd() {
    openEditor(stage, {
      gameId: "plus-susceptible",
      schema: SCHEMA,
      builtInList: builtInList(),
      onDone: async () => { await src.reload(); introScreen(); },
      onReshuffle: () => seen.clear(),
    });
  }

  function startGame(players) {
    if (!affirmations().length) {
      showPhase(stage, el("div.card.center", {}, [
        el("p", { text: "Aucune affirmation active — ajoute-en ou change la source via ✏️ Mes cartes." }),
        el("button.btn", { text: "✏️ Mes cartes", style: "margin-top:12px", onClick: openEd }),
      ]));
      return;
    }
    const deck = createDeck(affirmations(), { seen }); // anti-répétition intra + inter-soirées
    const sc = createScores("plus-susceptible", players); // couronnes cumulées, persistées

    function nextRound() {
      runVote(players, deck.next());
    }

    /* Vote pass-the-phone : chaque joueur désigne secrètement quelqu'un. */
    function runVote(players, statement) {
      const votes = {};

      function reveal() {
        const max = Math.max(0, ...Object.values(votes));
        const winners = Object.keys(votes).filter((p) => votes[p] === max);
        announce(winners.length > 1 ? winners.join(" et ") + " boivent" : winners[0] + " boit");
        winners.forEach((w) => sc.add(w)); // +1 couronne pour le/les plus désigné(s)

        const ranking = players.map((p) => ({ p, v: votes[p] || 0 })).sort((a, b) => b.v - a.v);
        const scoreWrap = el("div", {}, [scoreboard(sc.scores)]);

        showPhase(stage,
          el("div.card.center", {}, [
            el("p.ps-statement", { text: `Qui est le plus susceptible de ${statement}` }),
            el("h2.ps-winner", {
              text: winners.length > 1 ? winners.join(" & ") + " 🍻" : winners[0] + " boit ! 🍻",
              style: "margin:14px 0",
            }),
            el(
              "div.ps-ranking",
              {},
              ranking.map((r) =>
                el("div.ps-rank-row", {}, [
                  el("span", { text: r.p }),
                  el("span.ps-rank-bar", { style: `--v:${max ? r.v / max : 0}` }),
                  el("span", { text: String(r.v) }),
                ])
              )
            ),
          ]),
          el("div.card", { style: "margin-top:14px" }, [
            el("div.row", { style: "justify-content:space-between;align-items:center;margin-bottom:10px" }, [
              el("h3", { text: "👑 Roi / Reine de la soirée" }),
              el("button.chip", {
                text: "↺ Réinitialiser",
                onClick: () => {
                  sc.reset();
                  scoreWrap.replaceChildren(scoreboard(sc.scores));
                },
              }),
            ]),
            scoreWrap,
          ]),
          el("button.btn.btn--full", { text: "Affirmation suivante →", style: "margin-top:14px", onClick: nextRound })
        );
      }

      passThePhone(stage, players, {
        icon: "🙈",
        cta: "voter",
        onPlayer: (current, i, next) =>
          showPhase(stage,
            el("div.card.center", {}, [
              el("p.ps-statement", { text: `Qui est le plus susceptible de ${statement}` }),
              el("p.screen__subtitle", { text: `Au tour de ${current} de voter` }),
              el("div.stack.ps-choices", { style: "margin-top:18px" },
                players.filter((p) => p !== current).map((p) =>
                  el("button.btn.btn--ghost.btn--full", { text: p, onClick: () => { votes[p] = (votes[p] || 0) + 1; next(); } })
                )
              ),
            ])
          ),
        onDone: reveal,
      });
    }

    sc.ready.then(nextRound); // charge les couronnes persistées avant la 1re manche
  }
}
