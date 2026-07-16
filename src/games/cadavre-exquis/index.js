import { el, screenHead, announce, showPhase, shuffle, pick } from "../../ui.js";
import { openEditor } from "../../content.js";
import { contentSource } from "../../game-kit.js";
import { liveSession, peekAutoLive } from "../../realtime.js";
import { AMORCES, OUVERTURES, CLOTURES, THEMES } from "./data.js";

const SCHEMA = {
  title: "Cadavre exquis",
  fields: [{ key: "text", label: "Amorce (début de phrase)", type: "text" }],
  summary: (e) => e.text,
};

export function render(container, { game }) {
  let steps = 8; // nombre de contributions
  let seePrevious = false; // mode : voir la ligne précédente ou non
  let theme = "libre"; // thème d'histoire (solo)
  let liveStop = null;
  const src = contentSource("cadavre-exquis", { builtIn: AMORCES });

  container.append(screenHead(game.title, "Chacun écrit sans voir la suite"));
  const stage = el("div");
  container.append(stage);

  if (peekAutoLive()) startLive(); else setup(); // « suivre l'hôte » : salon direct
  src.reload();

  const amorces = () => src.cards();
  const builtInList = () => AMORCES.map((t) => ({ key: t, label: t }));

  function setup() {
    const stepChips = el("div.row", { style: "margin-top:8px" });
    [4, 6, 8, 10, 12].forEach((n) => {
      const c = el("button.chip", { text: `${n}` });
      if (n === steps) c.classList.add("is-active");
      c.addEventListener("click", () => {
        steps = n;
        [...stepChips.children].forEach((x) => x.classList.toggle("is-active", x.textContent === `${n}`));
      });
      stepChips.appendChild(c);
    });

    const themeChips = el("div.row", { style: "margin-top:8px;flex-wrap:wrap" });
    THEMES.forEach((t) => {
      const c = el("button.chip" + (theme === t.id ? ".is-active" : ""), { text: t.label });
      c.addEventListener("click", () => { theme = t.id; [...themeChips.children].forEach((x) => x.classList.toggle("is-active", x === c)); });
      themeChips.appendChild(c);
    });

    const modeChips = el("div.row", { style: "margin-top:8px" });
    const mHidden = el("button.chip.is-active", { text: "🙈 Rien voir (classique)" });
    const mPrev = el("button.chip", { text: "👀 Voir la ligne d'avant" });
    mHidden.addEventListener("click", () => { seePrevious = false; mHidden.classList.add("is-active"); mPrev.classList.remove("is-active"); });
    mPrev.addEventListener("click", () => { seePrevious = true; mPrev.classList.add("is-active"); mHidden.classList.remove("is-active"); });
    modeChips.append(mHidden, mPrev);

    showPhase(stage,
      el("div.card", {}, [
        el("h3", { text: "Nombre de contributions" }),
        stepChips,
        el("h3", { text: "Thème", style: "margin-top:16px" }),
        themeChips,
        el("h3", { text: "Mode", style: "margin-top:16px" }),
        modeChips,
        el("button.btn.btn--full", { text: "Écrire l'histoire (ce téléphone)", style: "margin-top:18px", onClick: play }),
        el("button.btn.btn--full.btn--ghost", { text: "🌐 Multi — chacun écrit en même temps", style: "margin-top:10px", onClick: startLive }),
        el("div.row", { style: "justify-content:center;margin-top:12px" }, [el("button.chip", { text: "✏️ Mes amorces", onClick: openEd })]),
      ])
    );
  }

  /* ====== Mode multi : fragments en parallèle, histoire dévoilée, podium ======
     1) Chacun écrit sa ligne (amorce privée + position secrète, thème choisi
        par l'hôte). 2) L'hôte dévoile l'histoire assemblée (state). 3) Chacun
        vote sa ligne préférée (re-soumission {text, vote}). 4) « Podium » =
        révélation finale avec la meilleure ligne. */
  function startLive() {
    if (liveStop) liveStop();
    let liveTheme = "libre"; // thème choisi par l'hôte dans le salon

    const themePools = () => {
      const th = THEMES.find((t) => t.id === liveTheme) || {};
      return { ouv: th.ouvertures || OUVERTURES, clo: th.clotures || CLOTURES, consigne: th.consigne || "", label: th.label || "" };
    };

    liveStop = liveSession(stage, {
      gameId: "cadavre-exquis",
      title: "Cadavre exquis — multi",
      minPlayers: 2,
      startLabel: "✍️ Écrire une histoire",
      revealLabel: "🏆 Podium de la meilleure ligne",
      newRoundLabel: "Nouvelle histoire",
      onExit: setup,
      lobbyExtra: () => {
        const row = el("div.row", { style: "justify-content:center;flex-wrap:wrap" });
        THEMES.forEach((t) => {
          const c = el("button.chip" + (liveTheme === t.id ? ".is-active" : ""), { text: t.label });
          c.addEventListener("click", () => { liveTheme = t.id; [...row.children].forEach((x) => x.classList.toggle("is-active", x === c)); });
          row.appendChild(c);
        });
        return el("div", { style: "margin:10px 0" }, [
          el("p.screen__subtitle", { text: "Thème de l'histoire", style: "margin-bottom:8px" }),
          row,
        ]);
      },
      assign: (ps) => {
        const { ouv, clo, consigne, label } = themePools();
        const n = ps.length;
        const positions = shuffle(ps.map((_, i) => i)); // position secrète de chacun
        const mids = shuffle(amorces());
        const roles = {};
        const order = {};
        const amor = {};
        ps.forEach((p, i) => {
          const pos = positions[i];
          const amorce =
            pos === 0 ? pick(ouv)
            : pos === n - 1 ? pick(clo)
            : mids.length ? mids[(pos - 1) % mids.length]
            : pick(AMORCES);
          roles[p.id] = { amorce, pos };
          order[p.id] = pos;
          amor[p.id] = amorce;
        });
        // order/amorces dans meta : nécessaires à TOUS pour assembler l'histoire
        // avant la révélation finale (les textes restent cachés jusqu'au dévoilement).
        return { roles, meta: { count: n, theme: label, consigne, order, amorces: amor }, open: true };
      },
      renderMine: (mine, ctx) => liveWrite(mine, ctx),
      renderReveal: (live, ctx) => livePodium(live, ctx),
    });

    function storyLines(order, amor, texts, names, decorate) {
      const ids = Object.keys(order).sort((a, b) => order[a] - order[b]);
      return ids.map((id) =>
        el("p.ce-line", {}, [
          `${amor[id]} ${(texts[id] && texts[id].text) || "…"} `,
          el("em", { text: `— ${names[id] || "?"}`, style: "opacity:.5;font-size:.8em" }),
          decorate ? decorate(id) : "",
        ])
      );
    }

    function liveWrite(mine, { api, meta }) {
      let myText = "";
      let myVote = null;
      let inputsCache = {};
      let phase = "write";
      const zone = el("div");
      const nameOf = (id) => (api.players().find((p) => p.id === id) || {}).name || "?";

      function renderWrite() {
        const ta = el("textarea.input.ce-input", { rows: "3", placeholder: "…" });
        const status = el("p.screen__subtitle", { text: "Personne ne verra ta ligne avant le dévoilement 🤫", style: "margin-top:10px" });
        const prog = el("p.screen__subtitle", { text: "", style: "margin-top:4px" });
        const hostBtn = api.isHost()
          ? el("button.chip", { text: "📖 Dévoiler l'histoire", style: "display:none;margin-top:10px", onClick: () => api.sendState({ phase: "story" }) })
          : null;
        const sendBtn = el("button.btn.btn--full", {
          text: "Envoyer ma ligne ✍️",
          style: "margin-top:12px",
          onClick: () => {
            const txt = ta.value.trim();
            if (!txt || myText) return;
            myText = txt;
            ta.disabled = true;
            sendBtn.disabled = true;
            api.submit({ text: myText });
            status.textContent = "✅ Envoyée — en attente des autres…";
          },
        });
        api.on("progress", (done, total) => {
          prog.textContent = `${done.length} / ${total} lignes écrites`;
          if (hostBtn && done.length >= total) hostBtn.style.display = "";
        });
        const posLabel = mine.pos === 0 ? "🚀 Tu écris LE DÉBUT" : mine.pos === meta.count - 1 ? "🏁 Tu écris LA FIN" : `Tu écris la ligne ${mine.pos + 1} / ${meta.count}`;
        zone.replaceChildren(
          el("p.screen__subtitle", { text: posLabel }),
          el("div.ce-amorce", { text: mine.amorce }),
          ta, sendBtn, status, prog, hostBtn || ""
        );
      }

      function renderStory() {
        const voteRow = el("div.row", { style: "justify-content:center;flex-wrap:wrap;margin-top:12px" });
        Object.keys(meta.order).filter((id) => id !== api.me).forEach((id) => {
          const c = el("button.chip" + (myVote === id ? ".is-active" : ""), {
            text: `🏅 ${nameOf(id)}`,
            onClick: (e) => {
              if (myVote) return;
              myVote = id;
              api.submit({ text: myText, vote: id }); // fusion : garde ma ligne, ajoute mon vote
              [...voteRow.children].forEach((b) => (b.disabled = true));
              e.currentTarget.classList.add("is-active");
            },
          });
          if (myVote) c.disabled = true; // l'écran se re-rend à chaque vote reçu : conserver l'état
          voteRow.appendChild(c);
        });
        zone.replaceChildren(
          el("h3.center", { text: "📖 Votre chef-d'œuvre" }),
          el("div.ce-story", { style: "margin-top:10px" }, storyLines(meta.order, meta.amorces, inputsCache, namesMap())),
          el("p.screen__subtitle", { text: "🏅 Vote pour la meilleure ligne (pas la tienne) :", style: "margin-top:14px" }),
          voteRow,
          api.isHost() ? el("p.screen__subtitle", { text: "Puis « 🏆 Podium » pour les résultats.", style: "margin-top:8px;opacity:.75" }) : ""
        );
        announce("Histoire dévoilée, votez pour la meilleure ligne");
      }

      function namesMap() {
        const m = {};
        api.players().forEach((p) => (m[p.id] = p.name));
        return m;
      }

      api.on("progress", (done, total, inputs) => {
        inputsCache = inputs || {};
        if (phase === "story") renderStory(); // lignes tardives / votes qui tombent
      });
      api.on("state", (s) => {
        if (s && s.phase === "story" && phase !== "story") { phase = "story"; renderStory(); }
      });

      renderWrite();
      return [
        meta.consigne ? el("p.screen__subtitle", { text: `${meta.theme} — ${meta.consigne}`, style: "margin-bottom:8px" }) : "",
        zone,
      ];
    }

    function livePodium(live, { api }) {
      const names = live.names || {};
      const inputs = live.inputs || {};
      const meta = live.meta || {};
      const order = meta.order || {};
      const ids = Object.keys(order);
      const tally = {};
      ids.forEach((id) => (tally[id] = 0));
      ids.forEach((id) => {
        const v = inputs[id] && inputs[id].vote;
        if (v && v in tally) tally[v]++;
      });
      const max = Math.max(0, ...Object.values(tally));
      const winners = ids.filter((id) => max > 0 && tally[id] === max);
      return el("div", {}, [
        el("h3.center", { text: "🏆 Podium" }),
        winners.length
          ? el("p.center", { text: `Meilleure ligne : ${winners.map((id) => names[id]).join(" & ")} (${max} voix) 🍻`, style: "font-weight:800;margin:10px 0" })
          : el("p.screen__subtitle.center", { text: "Personne n'a voté 🤷", style: "margin:10px 0" }),
        el("div.ce-story", {}, storyLines(order, meta.amorces || {}, inputs, names, (id) =>
          winners.includes(id) ? " 🏆" : tally[id] ? ` (${tally[id]}🏅)` : ""
        )),
      ]);
    }
  }

  function openEd() {
    openEditor(stage, {
      gameId: "cadavre-exquis",
      schema: SCHEMA,
      builtInList: builtInList(),
      onDone: async () => { await src.reload(); setup(); },
    });
  }

  function play() {
    const fragments = [];
    let step = 0;
    // Une ouverture, des connecteurs de milieu mélangés (intégrés + perso), une clôture.
    const mids = shuffle(amorces());
    const th = THEMES.find((t) => t.id === theme) || {};
    const ouvPool = th.ouvertures || OUVERTURES;
    const cloPool = th.clotures || CLOTURES;

    function passScreen() {
      if (step >= steps) return reveal();
      showPhase(stage,
        el("div.card.center", {}, [
          el("p.big-prompt", { text: "✍️" }),
          el("p", { text: `Contribution ${step + 1} / ${steps}` }),
          el("p.screen__subtitle", { text: "Passe le téléphone au joueur suivant" }),
          el("button.btn.btn--full", { text: "À moi d'écrire", style: "margin-top:18px", onClick: writeScreen }),
        ])
      );
    }

    function writeScreen() {
      const amorce =
        step === 0 ? pick(ouvPool)
        : step === steps - 1 ? pick(cloPool)
        : mids.length ? mids[(step - 1) % mids.length]
        : pick(AMORCES);
      const ta = el("textarea.input.ce-input", { rows: "3", placeholder: "…" });
      const prev = fragments[fragments.length - 1];

      const blocks = [
        el("p.screen__subtitle", { text: `Contribution ${step + 1} / ${steps}${th.consigne ? ` · ${th.label} — ${th.consigne}` : ""}` }),
        el("div.ce-amorce", { text: amorce }),
      ];
      if (seePrevious && prev) {
        blocks.push(el("div.ce-prev", {}, [el("span.ce-prev__tag", { text: "Ligne précédente :" }), el("span", { text: prev })]));
      }
      blocks.push(
        ta,
        el("button.btn.btn--full", {
          text: step === steps - 1 ? "Terminer l'histoire" : "Valider & cacher →",
          style: "margin-top:14px",
          onClick: () => {
            const txt = ta.value.trim();
            fragments.push(`${amorce} ${txt}`.trim());
            step++;
            passScreen();
          },
        })
      );
      showPhase(stage,el("div.card", {}, blocks));
      ta.focus();
    }

    function reveal() {
      announce("Histoire terminée, lisez-la à voix haute");
      showPhase(stage,
        el("div.card", {}, [
          el("h2.center", { text: "📖 Votre chef-d'œuvre", style: "margin-bottom:16px" }),
          el(
            "div.ce-story",
            {},
            fragments.map((f) => el("p.ce-line", { text: f }))
          ),
          el("div.row", { style: "justify-content:center;margin-top:20px" }, [
            el("button.btn", { text: "Nouvelle histoire", onClick: play }),
            el("button.btn.btn--ghost", { text: "Réglages", onClick: setup }),
          ]),
        ])
      );
    }

    passScreen();
  }

  // Cleanup routeur : stoppe le salon multi si actif.
  return () => { if (liveStop) liveStop(); };
}
