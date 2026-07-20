import { el, screenHead, announce, showPhase } from "../../ui.js";
import { createDeck } from "../../deck.js";
import { playersCard } from "../../players.js";
import { openEditor } from "../../content.js";
import { passThePhone, contentSource } from "../../game-kit.js";
import { liveSession, peekAutoLive } from "../../realtime.js";
import { celebrate } from "../../fx.js";
import { MISSIONS } from "./data.js";

const SCHEMA = {
  title: "Le Menteur",
  fields: [{ key: "text", label: "Mission à glisser dans la conversation", type: "text" }],
  summary: (e) => e.text,
};

export function render(container, { game }) {
  const src = contentSource("menteur", { builtIn: MISSIONS });
  let deck = createDeck(missions());
  let liveStop = null;
  let menteurFxRound = -1; // manche dont les confettis du verdict ont déjà été joués
  container.append(screenHead(game.title, "Une mission secrète à glisser dans la conversation"));
  const stage = el("div");
  container.append(stage);

  if (peekAutoLive()) startLive(); else modeSelect(); // « suivre l'hôte » : salon direct
  reload();

  // Cleanup appelé par le routeur : stoppe les timers du mode multi si actif.
  return () => { if (liveStop) liveStop(); };

  function modeSelect() {
    showPhase(stage,
      el("div.card.center", {}, [
        el("h3", { text: "Comment jouer ?" }),
        el("button.btn.btn--full", { text: "📱 Sur ce téléphone", onClick: introScreen }),
        el("button.btn.btn--full.btn--ghost", { text: "🌐 Multi-appareils", style: "margin-top:10px", onClick: startLive }),
      ])
    );
  }
  function startLive() {
    if (liveStop) liveStop();
    liveStop = liveSession(stage, {
      gameId: "menteur",
      title: "Le Menteur — multi",
      minPlayers: 2,
      startLabel: "Distribuer les missions",
      revealLabel: "Révéler missions & accusations",
      newRoundLabel: "Nouvelles missions",
      onExit: modeSelect,
      assign: (ps) => {
        const roles = {};
        ps.forEach((p) => {
          let m = deck.next();
          if (m == null) { deck.reset(); m = deck.next(); }
          roles[p.id] = { mission: m };
        });
        return { roles };
      },
      renderMine: (mine, { api }) => {
        // Mission privée + mission bonus risquée + accusation secrète.
        let myVote = null;
        let myBonus = null;
        const status = el("p.screen__subtitle", { text: "", style: "margin-top:8px" });
        const bonusBox = el("div");
        const bonusBtn = el("button.chip", {
          text: "🔥 Mission bonus (risqué : grillé = double)",
          style: "margin-top:10px",
          onClick: () => {
            if (myBonus) return;
            let m = deck.next();
            if (m == null) { deck.reset(); m = deck.next(); }
            myBonus = m;
            api.submit({ vote: myVote || undefined, bonus: myBonus });
            bonusBtn.style.display = "none";
            bonusBox.replaceChildren(
              el("div.mt-mission", { text: myBonus }),
              el("p.screen__subtitle", { text: "Réussis les DEUX : distribue 2 gorgées. Grillé : tu bois double." })
            );
          },
        });
        const btns = api.players().filter((p) => p.id !== api.me).map((p) =>
          el("button.btn.btn--ghost.btn--full", {
            text: p.name,
            style: "margin-top:8px",
            onClick: (e) => {
              if (myVote) return;
              myVote = p.id;
              api.submit({ vote: p.id, bonus: myBonus || undefined });
              btns.forEach((b) => (b.disabled = true));
              e.currentTarget.style.borderColor = "var(--accent)";
              status.textContent = "✅ Accusation enregistrée.";
            },
          })
        );
        api.on("progress", (done, total) => {
          if (myVote) status.textContent = `✅ Accusé · ${done.length} / ${total} ont accusé`;
        });
        return [
          el("p.screen__subtitle", { text: "Ta mission :" }),
          el("div.mt-mission", { text: mine.mission }),
          el("p.screen__subtitle", { text: "Accomplis-la sans te faire griller." }),
          bonusBtn,
          bonusBox,
          el("h3", { text: "🕵️ Qui accuses-tu ?", style: "margin-top:18px" }),
          el("p.screen__subtitle", { text: "Vote secret : qui s'est fait griller selon toi ? ⚠️ Accuser à tort se paie…" }),
          el("div.stack", {}, btns),
          status,
        ];
      },
      renderReveal: (live, { api, n }) => {
        const names = live.names || {};
        const inputs = live.inputs || {};
        const ids = Object.keys(names);
        const tally = {};
        ids.forEach((id) => (tally[id] = 0));
        Object.values(inputs).forEach((d) => { if (d && d.vote in tally) tally[d.vote]++; });
        const max = Math.max(0, ...Object.values(tally));
        const grilled = ids.filter((id) => max > 0 && tally[id] === max);
        const accusers = ids.filter((id) => inputs[id] && grilled.includes(inputs[id].vote));
        let verdict = null; // 'grille' | 'infonde' — décidé par l'hôte après débat
        const wrap = el("div");

        function render() {
          const bits = [
            el("h3.center", { text: "Les missions", style: "margin-bottom:10px" }),
            el("div.stack", {},
              Object.keys(live.roles).map((id) =>
                el("div.mt-reveal-row", {}, [
                  el("strong", { text: (names[id] || "?") + (id === api.me ? " (toi)" : "") }),
                  el("span", { text: live.roles[id].mission
                    + (inputs[id] && inputs[id].bonus ? ` · 🔥 bonus : ${inputs[id].bonus}` : "")
                    + (tally[id] ? ` · 🕵️ ${tally[id]} accusation${tally[id] > 1 ? "s" : ""}` : "") }),
                ])
              )
            ),
          ];
          if (grilled.length) {
            const gNames = grilled.map((id) => names[id]).join(" & ");
            bits.push(el("p", { text: `🔥 Le plus accusé : ${gNames}`, style: "font-weight:700;margin-top:12px" }));
            // ⚖️ Double tranchant : l'hôte tranche après l'aveu / le débat.
            if (!verdict && api.isHost()) {
              bits.push(el("p.screen__subtitle", { text: "L'accusé avoue-t-il s'être fait griller ?" }));
              bits.push(el("div.row", { style: "justify-content:center;margin-top:8px" }, [
                el("button.btn", { text: "✅ Grillé confirmé", onClick: () => api.sendState({ menteurVerdict: "grille" }) }),
                el("button.btn.btn--ghost", { text: "❌ Accusation infondée", onClick: () => api.sendState({ menteurVerdict: "infonde" }) }),
              ]));
            } else if (!verdict) {
              bits.push(el("p.screen__subtitle", { text: "L'hôte va trancher…" }));
            } else if (verdict === "grille") {
              const hasBonus = grilled.some((id) => inputs[id] && inputs[id].bonus);
              bits.push(el("p", { text: `🍺 ${gNames} boit${hasBonus ? " DOUBLE (mission bonus) 🔥" : ""} !`, style: "font-weight:800;margin-top:8px" }));
            } else {
              bits.push(el("p", {
                text: accusers.length
                  ? `⚖️ Accusation infondée : ${accusers.map((id) => names[id]).join(", ")} boi${accusers.length > 1 ? "vent" : "t"} !`
                  : "⚖️ Accusation infondée… mais personne à punir 🤷",
                style: "font-weight:800;margin-top:8px",
              }));
            }
          }
          wrap.replaceChildren(...bits);
        }

        api.on("state", (s) => {
          if (s && s.menteurVerdict) {
            verdict = s.menteurVerdict;
            // Payoff une seule fois par manche (n survit aux re-renders et au replay
            // du state via « Revoir la révélation » ; garde au scope render()).
            if (n != null && n !== menteurFxRound) { menteurFxRound = n; celebrate(); }
            render();
          }
        });
        render();
        return wrap;
      },
    });
  }

  async function reload() {
    await src.reload();
    deck = createDeck(missions());
  }
  function missions() { return src.cards(); }
  function builtInList() { return MISSIONS.map((t) => ({ key: t, label: t })); }
  function introScreen() {
    showPhase(stage,
      playersCard({ min: 2, cta: "Distribuer les missions", onReady: (names) => distribute(names) }),
      el("div.row", { style: "justify-content:center;margin-top:14px" }, [el("button.chip", { text: "✏️ Mes cartes", onClick: openEd })])
    );
  }
  function openEd() {
    openEditor(stage, { gameId: "menteur", schema: SCHEMA, builtInList: builtInList(), onDone: async () => { await reload(); introScreen(); } });
  }

  function distribute(players) {
    if (!missions().length) {
      showPhase(stage, el("div.card.center", {}, [
        el("p", { text: "Aucune mission active — ajoute-en ou change la source via ✏️ Mes cartes." }),
        el("button.btn", { text: "✏️ Mes cartes", style: "margin-top:12px", onClick: openEd }),
      ]));
      return;
    }
    const roles = players.map((name) => ({ name, mission: deck.next() }));
    passThePhone(stage, players, {
      icon: "🤫",
      cta: "Voir ma mission",
      onPlayer: (name, i, next) =>
        showPhase(stage,
          el("div.card.center", {}, [
            el("p.screen__subtitle", { text: name + ", ta mission :" }),
            el("div.mt-mission", { text: roles[i].mission }),
            el("p.screen__subtitle", { text: "Accomplis-la sans te faire griller. Ne montre à personne." }),
            el("button.btn.btn--full", { text: "Compris, cacher →", style: "margin-top:18px", onClick: next }),
          ])
        ),
      onDone: () => discussion(roles),
    });
  }

  function discussion(roles) {
    showPhase(stage,
      el("div.card.center", {}, [
        el("h3", { text: "Lancez la conversation 🗣️" }),
        el("p", {
          text:
            "Discutez normalement. Chacun tente d'accomplir sa mission sans se faire repérer. " +
            "Si tu penses avoir démasqué quelqu'un, accuse-le ! À la fin :",
          style: "color:var(--text-dim);margin:12px 0 20px",
        }),
        el("button.btn.btn--full", { text: "Révéler les missions", onClick: () => reveal(roles) }),
      ])
    );
  }

  function reveal(roles) {
    announce("Les missions sont révélées");
    showPhase(stage,
      el("div.card", {}, [
        el("h3.center", { text: "Les missions étaient…", style: "margin-bottom:16px" }),
        el(
          "div.stack",
          {},
          roles.map((r) =>
            el("div.mt-reveal-row", {}, [
              el("strong", { text: r.name }),
              el("span", { text: r.mission }),
            ])
          )
        ),
        el("button.btn.btn--full", { text: "Rejouer", style: "margin-top:20px", onClick: introScreen }),
      ])
    );
  }
}
