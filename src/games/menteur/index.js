import { el, screenHead, announce, showPhase, typo } from "../../ui.js";
import { createDeck } from "../../deck.js";
import { makeSeen } from "../../seen.js";
import { playersCard } from "../../players.js";
import { openEditor } from "../../content.js";
import { passThePhone, contentSource } from "../../game-kit.js";
import { liveSession, peekAutoLive, dedupeNames } from "../../realtime.js";
import { de } from "../../names.js";
import { compterGorgees } from "../../gorgees.js";
import { bumpMany } from "../../stats.js";
import { celebrate } from "../../fx.js";
import { MISSIONS } from "./data.js";

const SCHEMA = {
  title: "Le Menteur",
  fields: [{ key: "text", label: "Mission à glisser dans la conversation", type: "text" }],
  summary: (e) => e.text,
};

/** Mission voilée : visible seulement tant qu'on maintient le doigt dessus.
    Le téléphone reste posé sur la table pendant toute la discussion ; une
    mission affichée en clair s'y lisait par-dessus l'épaule. */
function voile(texte, quoi) {
  const invite = `👆 Maintiens appuyé pour voir ${quoi}`;
  const zone = el("div.mt-mission.mt-voile", { text: invite, role: "button", tabindex: "0", "aria-label": invite });
  const montrer = (e) => {
    if (e && e.cancelable) e.preventDefault(); // pas de sélection de texte ni de loupe
    zone.textContent = typo(texte);
    zone.classList.add("is-visible");
  };
  const cacher = () => {
    zone.textContent = invite;
    zone.classList.remove("is-visible");
  };
  zone.addEventListener("pointerdown", montrer);
  ["pointerup", "pointerleave", "pointercancel", "blur"].forEach((t) => zone.addEventListener(t, cacher));
  zone.addEventListener("contextmenu", (e) => e.preventDefault()); // appui long = pas de menu
  zone.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") montrer(e); });
  zone.addEventListener("keyup", cacher);
  return zone;
}

export function render(container, { game }) {
  const src = contentSource("menteur", { builtIn: MISSIONS });
  const seen = makeSeen("menteur"); // anti-répétition entre soirées
  let deck = createDeck(missions(), { seen });
  let liveStop = null;
  let menteurFxRound = -1; // manche dont les confettis du verdict ont déjà été joués
  container.append(screenHead(game.title, "Une mission secrète à glisser dans la conversation", game.id));
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
      ]),
      el("div.row", { style: "justify-content:center;margin-top:14px" }, [el("button.chip", { text: "✏️ Mes cartes", onClick: openEd })])
    );
  }
  function startLive() {
    if (liveStop) liveStop();
    menteurFxRound = -1; // salon peut-être recréé : les manches repartent de 1
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
        const tirer = () => { let m = deck.next(); if (m == null) { deck.reset(); m = deck.next(); } return m; };
        ps.forEach((p) => { roles[p.id] = { mission: tirer() }; });
        // Mission bonus tirée ICI, par l'hôte, dans le même paquet : tirée sur
        // le téléphone de l'invité, elle pouvait être la sienne ou celle d'un autre.
        const prises = new Set(ps.map((p) => roles[p.id].mission));
        ps.forEach((p) => {
          let b = tirer();
          for (let essai = 0; essai < 5 && prises.has(b); essai++) b = tirer();
          prises.add(b);
          roles[p.id].bonus = b;
        });
        // 🕵️ La Taupe : à 3+ joueurs, un joueur tiré au sort connaît la mission
        // d'un autre et gagne 3 gorgées à distribuer s'il le fait griller.
        if (ps.length >= 3) {
          const ti = Math.floor(Math.random() * ps.length);
          let gi = Math.floor(Math.random() * ps.length);
          if (gi === ti) gi = (gi + 1) % ps.length;
          const taupe = ps[ti], cible = ps[gi];
          roles[taupe.id].espionne = { id: cible.id, name: cible.name, mission: roles[cible.id].mission };
        }
        // Joueurs de la manche (avec prénoms distincts) : les boutons d'accusation
        // ne proposent ni un retardataire sans mission, ni deux « Léa » identiques.
        const noms = dedupeNames(ps);
        return { roles, meta: { noms } };
      },
      renderMine: (mine, { api, meta }) => {
        // Mission privée + mission bonus risquée + accusation secrète. Vote et
        // bonus vivent dans api.memo() : au retour sur la manche, la mission
        // bonus acceptée restait cachée et un nouveau tap effaçait l'accusation.
        const m = api.memo();
        if (!("vote" in m)) Object.assign(m, { vote: null, bonus: null });
        const envoyer = () => api.submit({ vote: m.vote || undefined, bonus: m.bonus || undefined });
        const status = el("p.screen__subtitle", { text: "", style: "margin-top:8px" });
        const bonusBox = el("div");
        const bonusBtn = el("button.chip", {
          text: "🔥 Mission bonus (grillé = double)",
          style: "margin-top:10px",
          onClick: () => {
            if (m.bonus) return;
            m.bonus = mine.bonus || null;
            if (!m.bonus) return;
            envoyer();
            montrerBonus();
          },
        });
        function montrerBonus() {
          bonusBtn.hidden = true;
          bonusBox.replaceChildren(
            voile(m.bonus, "ta mission bonus"),
            el("p.screen__subtitle", { text: "Réussis les DEUX : distribue 2 gorgées. Grillé : tu bois double." })
          );
        }
        if (m.bonus) montrerBonus();
        const noms = (meta && meta.noms) || {};
        const cibles = Object.keys(noms).length ? Object.keys(noms) : api.players().map((p) => p.id);
        const nomDe = (id) => noms[id] || (api.players().find((p) => p.id === id) || {}).name || "?";
        const btns = cibles.filter((id) => id !== api.me).map((id) => {
          const b = el("button.btn.btn--ghost.btn--full", {
            text: nomDe(id),
            style: "margin-top:8px",
            onClick: () => {
              if (m.vote) return;
              m.vote = id;
              envoyer();
              peindreVote();
            },
          });
          b.dataset.id = id;
          return b;
        });
        function peindreVote() {
          btns.forEach((b) => { b.disabled = true; b.classList.toggle("is-choisi", b.dataset.id === m.vote); });
          status.textContent = "✅ Accusation enregistrée.";
        }
        if (m.vote) peindreVote();
        api.on("progress", (done, total) => {
          if (m.vote) status.textContent = `✅ Accusé · ${done.length} / ${total} ont accusé`;
        });
        return [
          el("p.screen__subtitle", { text: "Ta mission :" }),
          voile(mine.mission, "ta mission"),
          el("p.screen__subtitle", { text: "Accomplis-la sans te faire griller." }),
          bonusBtn,
          bonusBox,
          mine.espionne
            ? el("div.card", { style: "margin-top:14px;border-color:var(--accent)" }, [
                el("p", { text: "🕵️ Tu es la Taupe !", style: "font-weight:800" }),
                el("p.screen__subtitle", { text: `Mission secrète ${de(mine.espionne.name)} :` }),
                voile(mine.espionne.mission, "sa mission"),
                el("p.screen__subtitle", { text: `Fais-le griller (accuse-le, et qu'il soit le plus accusé) → 3 gorgées à distribuer. Sans te faire repérer !` }),
              ])
            : null,
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
        // 🕵️ La Taupe : réussie si elle a accusé sa cible ET que la cible est grillée.
        const taupeId = ids.find((id) => live.roles[id] && live.roles[id].espionne);
        const taupeTarget = taupeId ? live.roles[taupeId].espionne : null;
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
              // « DOUBLE » seulement pour qui avait pris la mission bonus.
              const qui = grilled.map((id) => names[id] + (inputs[id] && inputs[id].bonus ? " (double 🔥)" : "")).join(" & ");
              bits.push(el("p", { text: `🍺 ${qui} ${grilled.length > 1 ? "boivent" : "boit"} !`, style: "font-weight:800;margin-top:8px" }));
            } else {
              bits.push(el("p", {
                text: accusers.length
                  ? `⚖️ Accusation infondée : ${accusers.map((id) => names[id]).join(", ")} boi${accusers.length > 1 ? "vent" : "t"} !`
                  : "⚖️ Accusation infondée… mais personne à punir 🤷",
                style: "font-weight:800;margin-top:8px",
              }));
            }
          }
          // 🕵️ Dénouement de la Taupe (une fois le verdict rendu — ou tout de
          // suite si personne n'a accusé : il n'y a alors aucun verdict à attendre).
          if (taupeId && taupeTarget) {
            const taupeVote = inputs[taupeId] && inputs[taupeId].vote;
            const won = verdict === "grille" && grilled.includes(taupeTarget.id) && taupeVote === taupeTarget.id;
            if (!verdict && grilled.length) {
              bits.push(el("p.screen__subtitle", { text: "🕵️ Une Taupe se cachait dans la partie…", style: "margin-top:12px" }));
            } else {
              bits.push(el("p", {
                text: won
                  ? `🕵️ La Taupe ${names[taupeId]} a fait griller sa cible ${taupeTarget.name} → 3 gorgées à distribuer ! 😈`
                  : `🕵️ La Taupe était ${names[taupeId]} (cible : ${taupeTarget.name}) — mission ratée.`,
                style: "font-weight:700;margin-top:12px",
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
            if (n != null && n !== menteurFxRound) {
              menteurFxRound = n;
              celebrate();
              // Superlatif « meilleur menteur » : verdict « infondé » = la
              // mission est passée inaperçue. Hôte only, une fois par manche.
              // Grillé : tous sauf le(s) grillé(s) sont passés inaperçus. Infondé :
              // tout le monde. (Avant, seul « infondé » comptait, pour tous : tout
              // le monde restait à égalité et le titre n'était jamais décerné.)
              // 🍺 Compteur : grillé → le(s) grillé(s) (double avec la mission
              // bonus) ; infondé → les accusateurs.
              if (api.isHost()) {
                const qui = verdict === "grille"
                  ? grilled.map((id) => ({ id, n: inputs[id] && inputs[id].bonus ? 2 : 1 }))
                  : accusers.map((id) => ({ id, n: 1 }));
                compterGorgees(qui.map((x) => ({ ...x, nom: names[x.id], avatar: (live.avatars || {})[x.id] })), { manche: "menteur:" + n });
              }
              if (api.isHost()) {
                const joueurs = Object.keys(live.names || {}).filter((id) => (live.roles || {})[id]);
                const impunis = verdict === "grille" ? joueurs.filter((id) => !grilled.includes(id)) : joueurs;
                if (impunis.length) bumpMany(impunis, "impuni");
              }
            }
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
    deck = createDeck(missions(), { seen });
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
    openEditor(stage, { gameId: "menteur", schema: SCHEMA, builtInList: builtInList(), onDone: async () => { await reload(); introScreen(); }, onReshuffle: () => seen.clear() });
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
