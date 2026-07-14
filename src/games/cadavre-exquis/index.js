import { el, screenHead, announce, showPhase, shuffle, pick } from "../../ui.js";
import { openEditor } from "../../content.js";
import { contentSource } from "../../game-kit.js";
import { liveSession, peekAutoLive } from "../../realtime.js";
import { AMORCES, OUVERTURES, CLOTURES } from "./data.js";

const SCHEMA = {
  title: "Cadavre exquis",
  fields: [{ key: "text", label: "Amorce (début de phrase)", type: "text" }],
  summary: (e) => e.text,
};

export function render(container, { game }) {
  let steps = 8; // nombre de contributions
  let seePrevious = false; // mode : voir la ligne précédente ou non
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
        el("h3", { text: "Mode", style: "margin-top:16px" }),
        modeChips,
        el("button.btn.btn--full", { text: "Écrire l'histoire (ce téléphone)", style: "margin-top:18px", onClick: play }),
        el("button.btn.btn--full.btn--ghost", { text: "🌐 Multi — chacun écrit en même temps", style: "margin-top:10px", onClick: startLive }),
        el("div.row", { style: "justify-content:center;margin-top:12px" }, [el("button.chip", { text: "✏️ Mes amorces", onClick: openEd })]),
      ])
    );
  }

  /* ====== Mode multi : chaque joueur écrit SON fragment en parallèle ======
     Chacun reçoit une amorce privée + une position secrète dans l'histoire ;
     personne ne voit rien avant la révélation, où tout s'assemble. */
  function startLive() {
    if (liveStop) liveStop();
    liveStop = liveSession(stage, {
      gameId: "cadavre-exquis",
      title: "Cadavre exquis — multi",
      minPlayers: 2,
      startLabel: "✍️ Écrire une histoire",
      revealLabel: "📖 Révéler l'histoire",
      newRoundLabel: "Nouvelle histoire",
      onExit: setup,
      assign: (ps) => {
        const n = ps.length;
        const positions = shuffle(ps.map((_, i) => i)); // position secrète de chacun
        const mids = shuffle(amorces());
        const roles = {};
        ps.forEach((p, i) => {
          const pos = positions[i];
          const amorce =
            pos === 0 ? pick(OUVERTURES)
            : pos === n - 1 ? pick(CLOTURES)
            : mids.length ? mids[(pos - 1) % mids.length]
            : pick(AMORCES);
          roles[p.id] = { amorce, pos };
        });
        return { roles, meta: { count: n } };
      },
      renderMine: (mine, { api, meta }) => {
        let sent = false;
        const ta = el("textarea.input.ce-input", { rows: "3", placeholder: "…" });
        const status = el("p.screen__subtitle", { text: "Personne ne verra ta ligne avant la révélation 🤫", style: "margin-top:10px" });
        const sendBtn = el("button.btn.btn--full", {
          text: "Envoyer ma ligne ✍️",
          style: "margin-top:12px",
          onClick: () => {
            if (sent) return;
            const txt = ta.value.trim();
            if (!txt) return;
            sent = true;
            ta.disabled = true;
            sendBtn.disabled = true;
            api.submit({ text: txt });
            status.textContent = "✅ Envoyée — en attente des autres…";
          },
        });
        api.on("progress", (done, total) => {
          if (sent) status.textContent = `✅ Envoyée · ${done.length} / ${total} lignes écrites`;
        });
        const posLabel = mine.pos === 0 ? "🚀 Tu écris LE DÉBUT" : mine.pos === meta.count - 1 ? "🏁 Tu écris LA FIN" : `Tu écris la ligne ${mine.pos + 1} / ${meta.count}`;
        return [
          el("p.screen__subtitle", { text: posLabel }),
          el("div.ce-amorce", { text: mine.amorce }),
          ta, sendBtn, status,
        ];
      },
      renderReveal: (live) => {
        const roles = live.roles || {};
        const inputs = live.inputs || {};
        const names = live.names || {};
        const ids = Object.keys(roles).sort((a, b) => (roles[a].pos || 0) - (roles[b].pos || 0));
        announce("Histoire terminée, lisez-la à voix haute");
        return el("div", {}, [
          el("h2.center", { text: "📖 Votre chef-d'œuvre", style: "margin-bottom:16px" }),
          el("div.ce-story", {}, ids.map((id) =>
            el("p.ce-line", {}, [
              `${roles[id].amorce} ${(inputs[id] && inputs[id].text) || "…"} `,
              el("em", { text: `— ${names[id] || "?"}`, style: "opacity:.5;font-size:.8em" }),
            ])
          )),
        ]);
      },
    });
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
        step === 0 ? pick(OUVERTURES)
        : step === steps - 1 ? pick(CLOTURES)
        : mids.length ? mids[(step - 1) % mids.length]
        : pick(AMORCES);
      const ta = el("textarea.input.ce-input", { rows: "3", placeholder: "…" });
      const prev = fragments[fragments.length - 1];

      const blocks = [
        el("p.screen__subtitle", { text: `Contribution ${step + 1} / ${steps}` }),
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
