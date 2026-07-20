import { el, screenHead, announce, showPhase } from "../../ui.js";
import { createDeck } from "../../deck.js";
import { levelSelector, LEVELS } from "../../levels.js";
import { openEditor, loadContent, loadConfig, activeCards } from "../../content.js";
import { liveSession, peekAutoLive } from "../../realtime.js";
import { pickGage } from "../../gages.js";
import { stampGage } from "../../fx.js";
import { VERITES, ACTIONS } from "./data.js";

const LEVEL_LABEL = { soft: "Soft", soiree: "Soirée", x18: "18+" };

const EDIT_SCHEMA = {
  title: "Action ou Vérité",
  fields: [
    { key: "type", label: "Type", type: "select", options: [{ v: "verite", l: "Vérité" }, { v: "action", l: "Action" }] },
    { key: "niveau", label: "Niveau", type: "select", options: [{ v: "soft", l: "Soft" }, { v: "soiree", l: "Soirée" }, { v: "x18", l: "18+" }] },
    { key: "text", label: "Texte de la carte", type: "text" },
  ],
  summary: (e) => `${e.type === "verite" ? "🗣️" : "🔥"} ${LEVEL_LABEL[e.niveau] || e.niveau} · ${e.text}`,
};

export function render(container, { game }) {
  let level = "soft";
  let custom = [];
  let config = { onlyCustom: false, disabled: {} };
  const decks = { verite: {}, action: {} };

  container.append(screenHead(game.title, "Niveau réglable · ajoute tes propres cartes"));
  const stage = el("div");
  container.append(stage);

  let liveStop = null;
  buildDecks();
  if (peekAutoLive()) startLive(); else modeSelect(); // « suivre l'hôte » : salon direct
  reload();

  // Cleanup routeur : stoppe le salon multi si actif (déclarations suivantes hissées).
  return () => { if (liveStop) liveStop(); };

  function modeSelect() {
    if (liveStop) { liveStop(); liveStop = null; }
    showPhase(stage,
      el("div.card.center", {}, [
        el("h3", { text: "Comment jouer ?" }),
        el("button.btn.btn--full", { text: "📱 Sur ce téléphone", onClick: mainScreen }),
        el("button.btn.btn--full.btn--ghost", { text: "🌐 Multi-appareils (la roue désigne)", style: "margin-top:10px", onClick: startLive }),
      ]),
      el("div.row", { style: "justify-content:center;margin-top:14px" }, [el("button.chip", { text: "✏️ Mes cartes", onClick: openEd })])
    );
  }

  /* ====== Mode multi : la roue désigne un joueur, il choisit sur SON tél ====== */
  function startLive() {
    if (liveStop) liveStop();
    let turn = -1; // rotation équitable des joueurs désignés

    liveStop = liveSession(stage, {
      gameId: "action-verite",
      title: "Action ou Vérité — multi",
      minPlayers: 2,
      startLabel: "Lancer la roue",
      revealLabel: "Récap de la manche",
      newRoundLabel: "🎯 Joueur suivant",
      onExit: modeSelect,
      lobbyExtra: () => {
        const ui = levelSelector({ initial: level, onChange: (v) => (level = v) });
        return el("div", { style: "margin:10px 0" }, [
          el("p.screen__subtitle", { text: "Niveau", style: "margin-bottom:8px" }),
          ui.node,
        ]);
      },
      assign: (ps) => {
        turn = (turn + 1) % ps.length;
        const target = ps[turn];
        const v = decks.verite[level].next() || "Aucune carte Vérité à ce niveau — ajoute-en via ✏️ Mes cartes.";
        const a = decks.action[level].next() || "Aucune carte Action à ce niveau — ajoute-en via ✏️ Mes cartes.";
        const roles = {};
        ps.forEach((p) => (roles[p.id] = true));
        // open : le choix du joueur désigné est diffusé à tous en direct.
        return { roles, meta: { target: target.id, targetName: target.name, v, a, level }, open: true };
      },
      renderMine: (mine, { api, meta }) => {
        const isTarget = api.me === meta.target;
        const head = el("h3", { text: `🎯 Au tour de ${meta.targetName}${isTarget ? " (toi !)" : ""}` });
        const zone = el("div", { style: "margin-top:14px" });

        function showCard(data) {
          const choice = data.choice;
          const kind = choice === "verite" ? "🗣️ Vérité" : "🔥 Action";
          const card = choice === "verite" ? meta.v : meta.a;
          const bits = [
            el("div.av-tag", { text: kind }),
            el("div.big-prompt.av-prompt", { text: card, style: data.refused ? "text-decoration:line-through;opacity:.5" : "" }),
          ];
          if (data.refused) {
            bits.push(el("p", { text: `🙅 ${meta.targetName} a refusé ! Gage à la place :`, style: "font-weight:700;margin-top:10px" }));
            bits.push(el("div.big-prompt.av-prompt", { text: data.gage || "…" }));
          } else {
            bits.push(el("p.screen__subtitle", {
              text: isTarget ? "À toi de jouer ! 🎬" : `${meta.targetName} doit s'exécuter… soyez témoins !`,
              style: "margin-top:10px",
            }));
            if (isTarget) {
              // Refuser coûte un gage tiré au sort (au niveau de la manche).
              bits.push(el("button.chip", {
                text: "🙅 Je refuse → gage",
                style: "margin-top:10px",
                onClick: () => {
                  const g = pickGage(meta.level, api.players().filter((p) => p.id !== api.me).map((p) => p.name));
                  api.submit({ choice, refused: true, gage: g });
                  showCard({ choice, refused: true, gage: g });
                  stampGage(g); // le désigné qui refuse : tampon sur SON écran
                },
              }));
            }
          }
          if (api.isHost()) bits.push(el("p.screen__subtitle", { text: "« 🎯 Joueur suivant » pour continuer.", style: "margin-top:8px;opacity:.75" }));
          zone.replaceChildren(...bits);
        }

        if (isTarget) {
          let chosen = false;
          const bV = el("button.btn.av-btn-verite", { text: "Vérité" });
          const bA = el("button.btn.av-btn-action", { text: "Action" });
          const choose = (c) => {
            if (chosen) return;
            chosen = true;
            api.submit({ choice: c });
            showCard({ choice: c });
          };
          bV.addEventListener("click", () => choose("verite"));
          bA.addEventListener("click", () => choose("action"));
          zone.replaceChildren(
            el("p", { text: "Choisis ton destin :", style: "font-weight:700" }),
            el("div.row", { style: "justify-content:center;margin-top:12px" }, [bV, bA])
          );
        } else {
          zone.replaceChildren(el("p.screen__subtitle", { text: `${meta.targetName} choisit… 🥁` }));
        }

        // Tout le monde voit la carte (et un éventuel refus) dès que le désigné agit.
        api.on("progress", (done, total, inputs) => {
          const d = inputs && inputs[meta.target];
          if (d && d.choice) showCard(d);
        });

        return [head, zone];
      },
      renderReveal: (live) => {
        const meta = live.meta || {};
        const ch = live.inputs && live.inputs[meta.target] && live.inputs[meta.target].choice;
        return el("div", {}, [
          el("h3", { text: `Récap — ${meta.targetName || "?"}` }),
          ch
            ? el("div", {}, [
                el("div.av-tag", { text: ch === "verite" ? "🗣️ Vérité" : "🔥 Action" }),
                el("div.big-prompt.av-prompt", { text: ch === "verite" ? meta.v : meta.a }),
              ])
            : el("p.screen__subtitle", { text: "Aucun choix fait cette manche." }),
        ]);
      },
    });
  }

  async function reload() {
    [custom, config] = await Promise.all([loadContent("action-verite"), loadConfig("action-verite")]);
    buildDecks();
  }

  function buildDecks() {
    for (const lv of LEVELS.map((l) => l.id)) {
      decks.verite[lv] = createDeck(activeCards({
        builtIn: VERITES[lv] || [],
        custom: custom.filter((e) => e.type === "verite" && e.niveau === lv),
        config,
        keyOf: (t) => `v|${lv}|${t}`,
        customToValue: (e) => e.text,
      }));
      decks.action[lv] = createDeck(activeCards({
        builtIn: ACTIONS[lv] || [],
        custom: custom.filter((e) => e.type === "action" && e.niveau === lv),
        config,
        keyOf: (t) => `a|${lv}|${t}`,
        customToValue: (e) => e.text,
      }));
    }
  }

  function builtInList() {
    const out = [];
    for (const lv of LEVELS.map((l) => l.id)) {
      (VERITES[lv] || []).forEach((t) => out.push({ key: `v|${lv}|${t}`, label: `🗣️ ${LEVEL_LABEL[lv]} · ${t}` }));
      (ACTIONS[lv] || []).forEach((t) => out.push({ key: `a|${lv}|${t}`, label: `🔥 ${LEVEL_LABEL[lv]} · ${t}` }));
    }
    return out;
  }

  function mainScreen() {
    const promptBox = el("div.big-prompt.av-prompt", { text: "Prêt·e ? Choisis Action ou Vérité." });
    const tag = el("div.av-tag");
    // Refuser sa carte coûte un gage tiré au sort (même niveau).
    const refuseBtn = el("button.chip", {
      text: "🙅 Je refuse → gage",
      style: "display:none",
      onClick: () => {
        const g = pickGage(level);
        tag.textContent = "⚡ Gage";
        promptBox.textContent = g;
        announce("Gage : " + g);
        refuseBtn.style.display = "none";
        stampGage(g);
      },
    });

    function draw(kind) {
      const card = decks[kind][level].next();
      promptBox.textContent = card || "Aucune carte à ce niveau — ajoute-en ou active-en via ✏️ Mes cartes.";
      if (card) announce((kind === "verite" ? "Vérité : " : "Action : ") + card);
      promptBox.classList.remove("av-flash");
      void promptBox.offsetWidth;
      promptBox.classList.add("av-flash");
      tag.textContent = kind === "verite" ? "🗣️ Vérité" : "🔥 Action";
      tag.dataset.kind = kind;
      refuseBtn.style.display = card ? "" : "none";
    }

    const levelUI = levelSelector({ initial: level, onChange: (v) => (level = v) });

    stage.replaceChildren(
      el("div.card.av-card", {}, [
        el("div", { style: "margin-bottom:18px" }, [levelUI.node]),
        tag,
        promptBox,
        el("div.row", { style: "justify-content:center;margin-top:22px" }, [
          el("button.btn.av-btn-verite", { text: "Vérité", onClick: () => draw("verite") }),
          el("button.btn.av-btn-action", { text: "Action", onClick: () => draw("action") }),
        ]),
        el("div.row", { style: "justify-content:center;margin-top:14px" }, [
          refuseBtn,
          el("button.chip", { text: "✏️ Mes cartes", onClick: openEd }),
        ]),
      ])
    );
  }

  function openEd() {
    openEditor(stage, {
      gameId: "action-verite",
      schema: EDIT_SCHEMA,
      builtInList: builtInList(),
      onDone: async () => { await reload(); mainScreen(); },
    });
  }
}
