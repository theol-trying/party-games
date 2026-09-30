import { el, screenHead, announce, showPhase, typo } from "../../ui.js";
import { createDeck } from "../../deck.js";
import { makeSeen } from "../../seen.js";
import { levelSelector, LEVELS } from "../../levels.js";
import { openEditor, loadContent, loadConfig, activeCards } from "../../content.js";
import { liveSession, peekAutoLive } from "../../realtime.js";
import { pickGage, chargerGages, ouvrirMesGages } from "../../gages.js";
import { stampGage, retournerCarte } from "../../fx.js";
import { VERITES, ACTIONS } from "./data.js";
import { playersCard } from "../../players.js";
import { de } from "../../names.js";
import { pastille } from "../../game-kit.js";
import { vibrate } from "../../sound.js";
import { compterGorgees } from "../../gorgees.js";

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
  let joueursSolo = null; // prénoms du mode « sur ce téléphone » (facultatifs)
  let tourSolo = 0; // à qui le tour
  // Anti-répétition entre soirées, comme les autres jeux : les cartes déjà
  // tirées reviennent en dernier (et « Tout remélanger » dans ✏️ Mes cartes).
  const seen = makeSeen("action-verite");

  container.append(screenHead(game.title, "Niveau réglable · ajoute tes propres cartes", game.id));
  const stage = el("div");
  container.append(stage);

  let liveStop = null;
  buildDecks();
  if (peekAutoLive()) startLive(); else modeSelect(); // « suivre l'hôte » : salon direct
  reload();
  chargerGages(); // gages du groupe (🎭 Mes gages), partagés par la soirée

  // Cleanup routeur : stoppe le salon multi si actif (déclarations suivantes hissées).
  return () => { if (liveStop) liveStop(); };

  function modeSelect() {
    if (liveStop) { liveStop(); liveStop = null; }
    showPhase(stage,
      el("div.card.center", {}, [
        el("h3", { text: "Comment jouer ?" }),
        el("button.btn.btn--full", { text: "📱 Sur ce téléphone", onClick: choixJoueurs }),
        el("button.btn.btn--full.btn--ghost", { text: "🌐 Multi-appareils (la roue désigne)", style: "margin-top:10px", onClick: startLive }),
      ]),
      el("div.row", { style: "justify-content:center;gap:8px;margin-top:14px" }, [
        el("button.chip", { text: "✏️ Mes cartes", onClick: openEd }),
        el("button.chip", { text: "🎭 Mes gages", onClick: () => ouvrirMesGages(stage, modeSelect) }),
      ])
    );
  }

  /* ====== Mode multi : la roue désigne un joueur, il choisit sur SON tél ====== */
  function startLive() {
    if (liveStop) liveStop();
    let turn = -1; // rotation équitable des joueurs désignés
    // Mémoire de la manche (keyée sur n) : survit au re-render « Revenir à la manche »
    // → on restaure la carte / le pari déjà posé au lieu de rouvrir la mise.
    let avN = -1, avBet = null, avCard = null;
    let roueVue = -1; // manche dont la roue a déjà tourné

    liveStop = liveSession(stage, {
      gameId: "action-verite",
      title: "Action ou Vérité — multi",
      minPlayers: 2,
      startLabel: "Lancer la roue",
      revealLabel: "Récap de la manche",
      newRoundLabel: "🎯 Joueur suivant",
      onExit: modeSelect,
      // La rotation voyage aussi : un nouvel hôte continue avec le joueur suivant.
      reglages: {
        lire: () => ({ level, turn }),
        ecrire: (r) => { if (r.level) level = r.level; if (Number.isInteger(r.turn)) turn = r.turn; },
      },
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
      renderMine: (mine, { api, meta, n }) => {
        if (n !== avN) { avN = n; avBet = null; avCard = null; } // nouvelle manche : mémoire fraîche
        const isTarget = api.me === meta.target;
        const head = el("h3", { text: `🎯 Au tour ${de(meta.targetName)}${isTarget ? " (toi !)" : ""}` });
        const zone = el("div", { style: "margin-top:14px" });
        // 🎡 La roue des avatars tourne et s'arrête sur le joueur désigné, une
        // fois par manche ; le nom et les boutons n'apparaissent qu'à l'arrêt.
        const roue = n !== roueVue ? roueDesJoueurs(api.players(), api.avatars(), meta.target, () => { head.hidden = false; zone.hidden = false; }) : null;
        roueVue = n;
        if (roue) { head.hidden = true; zone.hidden = true; }

        function showCard(data) {
          avCard = data; // mémorisé → au re-render (« Revenir à la manche ») on restaure la carte, pas la mise
          const choice = data.choice;
          const kind = choice === "verite" ? "🗣️ Vérité" : "🔥 Action";
          const card = choice === "verite" ? meta.v : meta.a;
          const bits = [
            el("div.av-tag", { text: kind }),
            el("div.big-prompt.av-prompt", { text: card, style: data.refused ? "text-decoration:line-through;color:var(--text-dim)" : "" }),
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
          // Résultat du pari du public (le désigné, lui, ne parie pas).
          if (!isTarget && avBet) {
            const won = avBet === choice;
            const betLabel = avBet === "verite" ? "🗣️ Vérité" : "🔥 Action";
            bits.push(el("p", {
              text: won ? `😎 Bien vu ! Tu avais parié ${betLabel}` : `🍺 Perdu : tu avais parié ${betLabel} → bois avec ${meta.targetName}`,
              style: "font-weight:700;margin-top:10px",
            }));
          }
          if (api.isHost()) bits.push(el("p.screen__subtitle", { text: "« 🎯 Joueur suivant » pour continuer.", style: "margin-top:8px" }));
          zone.replaceChildren(...bits);
        }

        if (avCard) {
          // Le choix du désigné est déjà connu (même après un aller-retour au salon) :
          // on restaure la carte → les paris sont fermés, pas de re-mise possible.
          showCard(avCard);
        } else if (isTarget) {
          const bV = el("button.btn.av-btn-verite", { text: "Vérité" });
          const bA = el("button.btn.av-btn-action", { text: "Action" });
          const choose = (c) => { if (avCard) return; api.submit({ choice: c }); showCard({ choice: c }); };
          bV.addEventListener("click", () => choose("verite"));
          bA.addEventListener("click", () => choose("action"));
          zone.replaceChildren(
            el("p", { text: "Choisis ton destin :", style: "font-weight:700" }),
            el("div.row", { style: "justify-content:center;margin-top:12px" }, [bV, bA])
          );
        } else {
          // 🗣️ Pari du public : mise sur le choix du désigné pendant qu'il hésite.
          const label = (s) => (s === "verite" ? "🗣️ Vérité" : "🔥 Action");
          const betStatus = el("p.screen__subtitle", {
            text: avBet ? `✅ Tu as parié ${label(avBet)}` : "🗣️ Pendant qu'il hésite, parie sur son choix !",
            style: "margin-top:8px",
          });
          const mkBet = (side) => el("button.btn.btn--ghost", {
            text: label(side), disabled: !!avBet,
            onClick: () => {
              if (avBet || avCard) return; // déjà parié, ou le choix est déjà tombé
              avBet = side;
              api.submit({ bet: side });
              [...betRow.querySelectorAll("button")].forEach((b) => (b.disabled = true));
              betStatus.textContent = `✅ Tu as parié ${label(side)}`;
            },
          });
          const betRow = el("div.row", { style: "justify-content:center;margin-top:12px" }, [mkBet("verite"), mkBet("action")]);
          zone.replaceChildren(
            el("p.screen__subtitle", { text: `${meta.targetName} choisit… 🥁` }),
            betStatus,
            betRow,
          );
        }

        // Tout le monde voit la carte (et un éventuel refus) dès que le désigné agit.
        api.on("progress", (done, total, inputs) => {
          const d = inputs && inputs[meta.target];
          if (d && d.choice) showCard(d);
        });

        return [roue, head, zone].filter(Boolean);
      },
      renderReveal: (live, { api, n }) => {
        const meta = live.meta || {};
        const inputs = live.inputs || {};
        const names = live.names || {};
        const ch = inputs[meta.target] && inputs[meta.target].choice;
        const refus = inputs[meta.target] && inputs[meta.target].refused ? inputs[meta.target] : null;
        // Bilan des paris du public.
        const bettors = Object.keys(names).filter((id) => id !== meta.target && inputs[id] && inputs[id].bet);
        const right = ch ? bettors.filter((id) => inputs[id].bet === ch) : [];
        const wrong = ch ? bettors.filter((id) => inputs[id].bet !== ch) : [];
        if (api.isHost()) compterGorgees(wrong.map((id) => ({ id, nom: names[id], avatar: (live.avatars || {})[id], n: 1 })), { manche: "action-verite:" + n });
        return el("div", {}, [
          el("h3", { text: `Récap — ${meta.targetName || "?"}` }),
          ch
            ? el("div", {}, [
                el("div.av-tag", { text: ch === "verite" ? "🗣️ Vérité" : "🔥 Action", dataset: { kind: ch } }),
                el("div.big-prompt.av-prompt", { text: ch === "verite" ? meta.v : meta.a, style: refus ? "text-decoration:line-through;color:var(--text-dim)" : "" }),
                // Le refus et son gage apparaissent dans le récap (avant, une
                // carte refusée y figurait comme faite).
                refus ? el("p", { text: `🙅 Refusé ! Gage à la place :`, style: "font-weight:700;margin-top:10px" }) : null,
                refus ? el("div.big-prompt.av-prompt", { text: refus.gage || "…" }) : null,
              ])
            : el("p.screen__subtitle", { text: "Aucun choix fait cette manche." }),
          bettors.length
            ? el("div", { style: "margin-top:12px" }, [
                el("p.screen__subtitle", { text: "🗣️ Paris du public :", style: "margin-bottom:4px" }),
                right.length ? el("p", { text: `😎 Bien vu : ${right.map((id) => names[id]).join(", ")}`, style: "font-weight:700" }) : null,
                wrong.length ? el("p", { text: `🍺 À côté (${wrong.length > 1 ? "ils boivent" : "il boit"}) : ${wrong.map((id) => names[id]).join(", ")}`, style: "font-weight:700;margin-top:2px" }) : null,
              ])
            : null,
        ]);
      },
    });
  }

  /* 🎡 Roue des joueurs. Le disque tourne (5 tours et un peu) pour finir avec
     le désigné sous la flèche ; chaque avatar contre-tourne pour rester droit.
     Tout est piloté par setTimeout : même sans animation (onglet masqué,
     mouvements réduits), le résultat apparaît à l'heure. */
  function roueDesJoueurs(joueurs, avatars, cibleId, onArret) {
    const i0 = joueurs.findIndex((p) => p.id === cibleId);
    if (joueurs.length < 2 || i0 < 0) return null;
    const pas = 360 / joueurs.length;
    const tour = 360 * 5 - i0 * pas; // l'angle de la cible + tour ≡ 0 (en haut)
    const reduit = (() => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } })();
    const disque = el("div.av-roue__disque");
    const badges = joueurs.map((p, i) => {
      const b = pastille(p.name, avatars[p.id], "av-badge av-roue__badge");
      b.style.transform = `rotate(${-i * pas}deg)`;
      disque.appendChild(el("div.av-roue__place", { style: `transform:rotate(${i * pas}deg) translateY(-84px)` }, [b]));
      return b;
    });
    const noeud = el("div.av-roue", { role: "img", "aria-label": "La roue désigne le prochain joueur" }, [el("span.av-roue__fleche", { text: "▼" }), disque]);
    const duree = reduit ? 0 : 2800;
    setTimeout(() => {
      disque.style.transform = `rotate(${tour}deg)`;
      badges.forEach((b, i) => (b.style.transform = `rotate(${-i * pas - tour}deg)`));
    }, 40);
    setTimeout(() => {
      badges[i0].classList.add("is-cible");
      if (!reduit) vibrate(40);
      onArret();
    }, duree + 80);
    return noeud;
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
      }), { seen, keyOf: (t) => `v|${lv}|${t}` });
      decks.action[lv] = createDeck(activeCards({
        builtIn: ACTIONS[lv] || [],
        custom: custom.filter((e) => e.type === "action" && e.niveau === lv),
        config,
        keyOf: (t) => `a|${lv}|${t}`,
        customToValue: (e) => e.text,
      }), { seen, keyOf: (t) => `a|${lv}|${t}` });
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

  // Prénoms facultatifs : avec eux, le téléphone désigne qui joue, tour après
  // tour, et les gages nominatifs visent les autres joueurs.
  function choixJoueurs() {
    showPhase(stage,
      playersCard({ min: 2, cta: "C'est parti →", onReady: (noms) => { joueursSolo = noms; tourSolo = 0; mainScreen(); } }),
      el("div.row", { style: "justify-content:center;margin-top:14px" }, [
        el("button.chip", { text: "Jouer sans prénoms", onClick: () => { joueursSolo = null; mainScreen(); } }),
        el("button.chip", { text: "← Mode", onClick: modeSelect }),
      ])
    );
  }

  function mainScreen() {
    const noms = joueursSolo;
    const courant = () => (noms ? noms[tourSolo % noms.length] : null);
    const invite = () => (noms ? `${courant()}, Action ou Vérité ?` : "Prêt·e ? Choisis Action ou Vérité.");
    const promptBox = el("div.big-prompt.av-prompt", { text: invite() });
    const tag = el("div.av-tag");
    const tourLigne = el("p.av-tour", { text: noms ? `🎯 Au tour ${de(courant())}` : "" });
    const suivantBtn = el("button.btn.btn--full.btn--ghost", {
      text: "👉 Joueur suivant",
      style: "margin-top:12px;display:none",
      onClick: () => {
        tourSolo++;
        tourLigne.textContent = `🎯 Au tour ${de(courant())}`;
        tag.textContent = "";
        delete tag.dataset.kind;
        refuseBtn.style.display = "none";
        suivantBtn.style.display = "none";
        retournerCarte(promptBox, () => { promptBox.textContent = typo(invite()); });
      },
    });
    // Refuser sa carte coûte un gage tiré au sort (même niveau).
    const refuseBtn = el("button.chip", {
      text: "🙅 Je refuse → gage",
      style: "display:none",
      onClick: () => {
        // Gage nominatif : il vise un AUTRE joueur que celui qui refuse.
        const g = pickGage(level, noms ? noms.filter((n) => n !== courant()) : null);
        tag.textContent = "⚡ Gage";
        tag.dataset.kind = "gage"; // sinon il gardait la couleur de la carte refusée
        promptBox.textContent = typo(g);
        announce("Gage : " + g);
        refuseBtn.style.display = "none";
        stampGage(g);
      },
    });

    function draw(kind) {
      const card = decks[kind][level].next();
      if (card) announce((kind === "verite" ? "Vérité : " : "Action : ") + card);
      // La carte se retourne ; son texte et son étiquette changent quand elle
      // est de profil, donc jamais visibles à moitié mis à jour.
      retournerCarte(promptBox, () => {
        promptBox.textContent = typo(card || "Aucune carte à ce niveau — ajoute-en ou active-en via ✏️ Mes cartes.");
        tag.textContent = kind === "verite" ? "🗣️ Vérité" : "🔥 Action";
        tag.dataset.kind = kind;
        refuseBtn.style.display = card ? "" : "none"; // avec la carte, pas avant
        if (noms) suivantBtn.style.display = "";
      });
    }

    const levelUI = levelSelector({ initial: level, onChange: (v) => (level = v) });

    stage.replaceChildren(
      el("div.card.av-card", {}, [
        el("div", { style: "margin-bottom:18px" }, [levelUI.node]),
        noms ? tourLigne : null,
        tag,
        promptBox,
        el("div.row", { style: "justify-content:center;margin-top:22px" }, [
          el("button.btn.av-btn-verite", { text: "Vérité", onClick: () => draw("verite") }),
          el("button.btn.av-btn-action", { text: "Action", onClick: () => draw("action") }),
        ]),
        suivantBtn,
        el("div.row", { style: "justify-content:center;margin-top:14px" }, [
          refuseBtn,
          el("button.chip", { text: "✏️ Mes cartes", onClick: openEd }),
          el("button.chip", { text: "🎭 Mes gages", onClick: () => ouvrirMesGages(stage, mainScreen) }),
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
      onReshuffle: () => seen.clear(),
    });
  }
}
