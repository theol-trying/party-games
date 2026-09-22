/* =========================================================================
   CROWN — 👑 Roi de la soirée : classement agrégé multi-jeux.

   Chaque jeu à score (quiz, blind-test, plus susceptible, tu préfères) appelle
   awardStanding(gameId, rankedIds, names, avatars) à la révélation (HÔTE
   uniquement) avec le classement COURANT de ce jeu (meilleur d'abord). On
   convertit en points de couronne (1er=5, 2e=3, 3e=2, participation=1) — ainsi
   aucun jeu (ni le quiz, ni ses nombreuses manches) n'écrase les autres : chaque
   jeu ne pèse qu'une seule contribution, remplacée à chaque mise à jour.

   Stockage : clé KV « crown » room-scopée (store.js) → partagée par tout le salon.
   { [deviceId]: { name, avatar, byGame:{gameId:pts} } }
   ========================================================================= */

import { el } from "./ui.js";
import { getData, setData } from "./store.js";
import { currentRoom } from "./room.js";
import { enregistrerSoiree, palmaresCumule, chargerHistorique, effacerHistorique } from "./history.js";
import { getStats, superlatifs } from "./stats.js";
import { celebrate, confettiRain, confettiBurst } from "./fx.js";
import { jingle, roundCue, pop } from "./sound.js";

const KEY = "crown";
const RANK_PTS = [5, 3, 2]; // 1er, 2e, 3e ; au-delà = participation (1)

// Titres décernés au meilleur de chaque jeu.
const TITLES = {
  "quiz-gages": "🧠 Cerveau",
  "blind-test": "🎧 Oreille d'or",
  "plus-susceptible": "👀 Star",
  "tu-preferes": "🔮 Prophète",
};

function colorOf(text) {
  let h = 0;
  for (let i = 0; i < (text || "").length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 70% 55%)`;
}

/** Contribution d'un jeu au classement (appelée par l'HÔTE à la révélation).
    rankedIds : deviceIds classés (meilleur d'abord). Remplace la contribution
    précédente de ce jeu → idempotent, converge vers le classement final. */
export async function awardStanding(gameId, rankedIds, names = {}, avatars = {}) {
  if (!Array.isArray(rankedIds) || !rankedIds.length) return;
  const crown = (await getData(KEY, {})) || {};
  rankedIds.forEach((id, i) => {
    if (!id) return;
    const e = crown[id] || (crown[id] = { name: names[id] || "?", avatar: avatars[id] || "", byGame: {} });
    if (names[id]) e.name = names[id];
    if (avatars[id]) e.avatar = avatars[id];
    e.byGame = e.byGame || {};
    e.byGame[gameId] = RANK_PTS[i] != null ? RANK_PTS[i] : 1; // participation = 1
  });
  await setData(KEY, crown);
}

export async function getCrown() {
  return (await getData(KEY, {})) || {};
}
export async function resetCrown() {
  await setData(KEY, {});
}

/** Classement agrégé trié + titres par jeu. */
export function crownTotals(crown) {
  const rows = Object.keys(crown || {}).map((id) => {
    const e = crown[id] || {};
    const byGame = e.byGame || {};
    const pts = Object.values(byGame).reduce((a, b) => a + (b || 0), 0);
    return { id, name: e.name || "?", avatar: e.avatar || "🎲", pts, byGame, titles: [] };
  });
  // Titre du jeu : au joueur qui y a le plus de points (≥ points d'un podium).
  for (const gameId of Object.keys(TITLES)) {
    let best = null;
    rows.forEach((r) => { const p = r.byGame[gameId] || 0; if (p >= 2 && (!best || p > best.byGame[gameId])) best = r; });
    if (best) best.titles.push(TITLES[gameId]);
  }
  return rows.sort((a, b) => b.pts - a.pts);
}

/* ========================= 📸 RÉCAP PARTAGEABLE ========================= */

/** Dessine le récap de la soirée sur un canvas vertical (format story). */
export function dessineRecap(totals, room, palmes = []) {
  const nbPodium = Math.min(3, totals.length);
  const nbReste = Math.max(0, Math.min(8, totals.length) - 3);
  const nbPalmes = Math.min(4, palmes.length);
  // Hauteur calée sur le contenu : à 3 joueurs, une image de hauteur fixe
  // laissait un grand vide sous le classement.
  const W = 1080;
  const H = Math.max(900, 480 + nbPodium * 150 + (nbReste ? 20 + nbReste * 58 : 0) + (nbPalmes ? 70 + nbPalmes * 52 : 0) + 190);
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d");

  // Fond : le dégradé sombre du site + deux halos.
  g.fillStyle = "#0f0f1a";
  g.fillRect(0, 0, W, H);
  const halo = (x, y, r, couleur) => {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, couleur);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
  };
  halo(W * 0.85, -60, 700, "rgba(255,77,109,0.30)");
  halo(0, H + 60, 620, "rgba(77,208,225,0.22)");

  const centre = (texte, y, taille, couleur, gras = 800) => {
    g.font = `${gras} ${taille}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    g.fillStyle = couleur;
    g.textAlign = "center";
    g.fillText(texte, W / 2, y);
  };

  centre("🍻", 150, 92, "#fff");
  centre("SOIRÉE", 236, 44, "#a0a0c0", 700);
  centre("Le palmarès", 320, 78, "#f2f2f7", 900);

  const date = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  centre(`${date}  ·  code ${room}`, 376, 32, "#a0a0c0", 600);

  // Podium : les trois premiers, en plus gros.
  const top = totals.slice(0, 3);
  const medailles = ["🥇", "🥈", "🥉"];
  let y = 480;
  top.forEach((r, i) => {
    const h = 132;
    g.fillStyle = i === 0 ? "rgba(255,212,59,0.14)" : "rgba(255,255,255,0.05)";
    arrondi(g, 80, y - 78, W - 160, h, 26);
    g.fill();
    if (i === 0) { g.strokeStyle = "#ffd43b"; g.lineWidth = 3; g.stroke(); }

    g.textAlign = "left";
    g.font = `800 60px system-ui, sans-serif`;
    g.fillStyle = "#fff";
    g.fillText(medailles[i], 120, y);
    g.font = `800 56px system-ui, sans-serif`;
    g.fillText(r.avatar || "🎲", 210, y);
    g.font = `800 46px system-ui, sans-serif`;
    g.fillStyle = "#f2f2f7";
    g.fillText(coupe(g, r.name, 420), 300, y - 8);
    if (r.titles && r.titles.length) {
      g.font = `600 27px system-ui, sans-serif`;
      g.fillStyle = "#a0a0c0";
      g.fillText(coupe(g, r.titles.join("  "), 520), 300, y + 30);
    }
    g.textAlign = "right";
    g.font = `900 50px system-ui, sans-serif`;
    g.fillStyle = "#ffd43b";
    g.fillText(`${r.pts} 👑`, W - 120, y);
    y += h + 18;
  });

  // Le reste du classement, en liste compacte.
  const reste = totals.slice(3, 8);
  if (reste.length) {
    y += 20;
    reste.forEach((r, i) => {
      g.textAlign = "left";
      g.font = `700 34px system-ui, sans-serif`;
      g.fillStyle = "#a0a0c0";
      g.fillText(`${i + 4}.`, 120, y);
      g.font = `700 38px system-ui, sans-serif`;
      g.fillStyle = "#f2f2f7";
      g.fillText(`${r.avatar || "🎲"}  ${coupe(g, r.name, 520)}`, 190, y);
      g.textAlign = "right";
      g.fillStyle = "#ffd43b";
      g.fillText(`${r.pts} 👑`, W - 120, y);
      y += 58;
    });
  }

  // Les palmes : c'est ce qui fait rire au réveil, plus que le classement.
  if (nbPalmes) {
    y += 34;
    centre("🏅 LES PALMES", y, 32, "#a0a0c0", 800);
    y += 44;
    palmes.slice(0, 4).forEach((p) => {
      g.textAlign = "left";
      g.font = "700 34px system-ui, sans-serif";
      g.fillStyle = "#f2f2f7";
      g.fillText(`${p.emoji}  ${coupe(g, `${p.titre} — ${p.nom}`, 700)}`, 120, y);
      g.textAlign = "right";
      g.font = "600 26px system-ui, sans-serif";
      g.fillStyle = "#a0a0c0";
      g.fillText(coupe(g, p.detail, 260), W - 120, y);
      y += 52;
    });
  }

  centre("Rejoue avec tes potes", H - 96, 34, "#a0a0c0", 600);
  centre(location.host, H - 50, 30, "#4dd0e1", 700);
  return cv;
}

// Rectangle arrondi (roundRect n'existe pas partout).
function arrondi(g, x, y, w, h, r) {
  g.beginPath();
  if (g.roundRect) { g.roundRect(x, y, w, h, r); return; }
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// Tronque proprement un texte trop long pour la largeur disponible.
function coupe(g, texte, largeurMax) {
  let t = String(texte || "");
  if (g.measureText(t).width <= largeurMax) return t;
  while (t.length > 1 && g.measureText(t + "…").width > largeurMax) t = t.slice(0, -1);
  return t + "…";
}

/** Génère le récap et le partage (ou le télécharge si le partage est indispo). */
export async function partagerRecap(totals, room, palmes = []) {
  const cv = dessineRecap(totals, room, palmes);
  const blob = await new Promise((r) => cv.toBlob(r, "image/png"));
  if (!blob) throw new Error("image indisponible");
  const fichier = new File([blob], `soiree-${room}.png`, { type: "image/png" });

  // Sur mobile : feuille de partage native (WhatsApp, Messages…).
  if (navigator.canShare && navigator.canShare({ files: [fichier] })) {
    try {
      await navigator.share({ files: [fichier], title: "Soirée 🎉", text: "Le palmarès de la soirée !" });
      return "partage";
    } catch (e) {
      if (e && e.name === "AbortError") return "annule"; // l'utilisateur a fermé la feuille
    }
  }
  // Sinon : téléchargement du PNG.
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fichier.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return "telecharge";
}

/* ============================== ÉCRAN 👑 ============================== */

function medalFor(i) { return i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`; }

function rankRow(r, i, me) {
  return el("div.cr-row" + (i === 0 ? ".is-first" : ""), {}, [
    el("span.cr-rank", { text: medalFor(i) }),
    el("span.av-badge", { text: r.avatar, style: `background:${colorOf(r.name)}` }),
    el("span.cr-name", { text: r.name + (r.id === me ? " (toi)" : "") + (r.titles.length ? " " + r.titles.join(" ") : "") }),
    el("span.cr-pts", { text: `${r.pts} 👑` }),
  ]);
}

/** Rendu du palmarès dans `stage`. { onBack, isHost, me, onStartCeremony }.
    onStartCeremony(top) : l'hôte demande la cérémonie POUR TOUT LE SALON
    (realtime la diffuse → chaque téléphone la joue en même temps). Absent →
    repli local (mono-appareil). */
export async function openCrown(stage, { onBack, isHost, me, onStartCeremony }) {
  const crown = await getCrown();
  const totals = crownTotals(crown);
  const wrap = el("div.card", {});
  let vue = "soiree"; // soiree | cumul

  // Superlatifs : le classement dit qui a gagné, ceux-ci disent comment.
  const noms = {}, avs = {};
  totals.forEach((r) => { noms[r.id] = r.name; avs[r.id] = r.avatar; });
  const palmes = superlatifs(await getStats(), noms, avs);

  function blocSuperlatifs() {
    if (!palmes.length) return null;
    return el("div", { style: "margin-top:18px" }, [
      el("h3.center", { text: "🏅 Les palmes de la soirée", style: "margin-bottom:10px" }),
      el("div.stack", {}, palmes.map((p) =>
        el("div.cr-row", {}, [
          el("span.cr-rank", { text: p.emoji }),
          el("span.av-badge", { text: p.avatar, style: `background:${colorOf(p.nom)}` }),
          el("span.cr-name", { text: `${p.titre} — ${p.nom}` }),
          el("span.cr-pts", { text: p.detail, style: "font-size:13px;color:var(--text-dim);font-weight:600" }),
        ])
      )),
    ]);
  }

  // Dès qu'il y a des scores, la soirée entre dans l'historique du groupe :
  // c'est le seul moment où l'on sait qui a joué ET combien. Idempotent (une
  // entrée par code de soirée et par jour).
  let historique = totals.length
    ? (await enregistrerSoiree(currentRoom(), totals)) || []
    : await chargerHistorique();

  function ongletsHistorique() {
    const n = historique.length;
    if (n < 2) return null; // un palmarès cumulé sur une seule soirée n'apprend rien
    return el("div.row", { style: "justify-content:center;margin-bottom:12px" }, [
      el("button.chip" + (vue === "soiree" ? ".is-active" : ""), {
        text: "Ce soir", onClick: () => { vue = "soiree"; renderList(); },
      }),
      el("button.chip" + (vue === "cumul" ? ".is-active" : ""), {
        text: `🏆 Depuis toujours (${n} soirées)`, onClick: () => { vue = "cumul"; renderList(); },
      }),
    ]);
  }

  function renderCumul() {
    const lignes = palmaresCumule(historique);
    const bits = [
      el("h3.center", { text: "🏆 Palmarès de tous les temps", style: "margin-bottom:4px" }),
      ongletsHistorique(),
      el("p.screen__subtitle.center", {
        text: `Cumul de ${historique.length} soirée(s) sous le code ${currentRoom()} — partagé par tous les téléphones qui l'utilisent. Les joueurs sont regroupés par prénom.`,
        style: "margin-bottom:12px",
      }),
      el("div.stack", {}, lignes.map((r, i) =>
        el("div.cr-row" + (i === 0 ? ".is-first" : ""), {}, [
          el("span.cr-rank", { text: medalFor(i) }),
          el("span.av-badge", { text: r.avatar || "🎲", style: `background:${colorOf(r.nom)}` }),
          el("span.cr-name", { text: `${r.nom} · ${r.soirees} soirée${r.soirees > 1 ? "s" : ""}${r.victoires ? ` · ${r.victoires} 🥇` : ""}` }),
          el("span.cr-pts", { text: `${r.pts} 👑` }),
        ])
      )),
      el("div.row", { style: "justify-content:center;margin-top:14px;flex-wrap:wrap" }, [
        el("button.chip", { text: "← Retour au salon", onClick: () => onBack && onBack() }),
        el("button.chip", {
          text: "🗑 Effacer l'historique",
          onClick: async () => {
            // Le palmarès est partagé : l'effacer touche tout le groupe, pas
            // seulement cet appareil. Le message doit le dire.
            if (!window.confirm(`Effacer le palmarès de toutes les soirées sous le code ${currentRoom()} ? Cela l'efface pour TOUT LE GROUPE.`)) return;
            await effacerHistorique();
            historique = [];
            vue = "soiree";
            renderList();
          },
        }),
      ]),
    ];
    wrap.replaceChildren(...bits.filter(Boolean));
  }

  function renderList() {
    if (vue === "cumul") return renderCumul();
    const bits = [el("h3.center", { text: "👑 Roi de la soirée", style: "margin-bottom:4px" })];
    if (!totals.length) {
      bits.push(el("p.screen__subtitle.center", { text: "Aucun score pour l'instant — jouez quelques manches à score (Quiz, Blind Test, Plus susceptible, Tu préfères) !", style: "margin:10px 0" }));
    } else {
      const onglets = ongletsHistorique();
      if (onglets) bits.push(onglets);
      bits.push(el("p.screen__subtitle.center", { text: "Cumul des jeux à score de la soirée.", style: "margin-bottom:12px" }));
      bits.push(el("div.stack", {}, totals.map((r, i) => rankRow(r, i, me))));
      if (isHost && totals.length >= 2) {
        // Podium synchronisé : on n'envoie que le strict nécessaire à l'animation.
        const top = totals.slice(0, 3).map((r) => ({ id: r.id, name: r.name, avatar: r.avatar, pts: r.pts }));
        bits.push(el("button.btn.btn--full", {
          text: "👑 Couronner le Roi ! (cérémonie)", style: "margin-top:16px",
          onClick: () => { if (onStartCeremony) onStartCeremony(top); else playCeremony(wrap, top, me, renderList); },
        }));
      }
      // Le récap est ouvert à tous : chacun peut repartir avec l'image.
      const recapBtn = el("button.btn.btn--ghost.btn--full", {
        text: "📸 Partager le récap de la soirée",
        style: "margin-top:10px",
        onClick: async () => {
          recapBtn.disabled = true;
          const avant = recapBtn.textContent;
          recapBtn.textContent = "Création de l'image…";
          try {
            const r = await partagerRecap(totals, currentRoom(), palmes);
            recapBtn.textContent = r === "telecharge" ? "✓ Image enregistrée" : avant;
          } catch {
            recapBtn.textContent = "Échec — réessaie";
          }
          recapBtn.disabled = false;
          setTimeout(() => { recapBtn.textContent = avant; }, 2500);
        },
      });
      bits.push(recapBtn);
      const sup = blocSuperlatifs();
      if (sup) bits.push(sup);
    }
    const row = el("div.row", { style: "justify-content:center;margin-top:14px;flex-wrap:wrap" }, [
      el("button.chip", { text: "← Retour au salon", onClick: () => onBack && onBack() }),
      isHost && totals.length ? el("button.chip", { text: "🔄 Remettre à zéro", onClick: async () => { if (window.confirm("Effacer le classement de la soirée ?")) { await resetCrown(); totals.length = 0; renderList(); } } }) : null,
    ]);
    bits.push(row);
    wrap.replaceChildren(...bits);
  }
  renderList();
  stage.replaceChildren(wrap);
}

/** Ouvre la cérémonie dans `stage` (déclenchée localement OU par le broadcast
    « ceremony » de l'hôte, avec le même top-3 pour tous). Renvoie un nettoyage
    (arrête les timers si l'écran est quitté en pleine animation). */
export function openCeremony(stage, top, { me, onDone } = {}) {
  const wrap = el("div.card", {});
  stage.replaceChildren(wrap);
  return playCeremony(wrap, top, me, onDone);
}

/** Cérémonie animée : podium 3e → 2e → 1er + confettis + roulement.
    `top` = jusqu'à 3 entrées {id,name,avatar,pts}, meilleur d'abord.
    Renvoie stop() : coupe les timers en cours (anti-fuite / anti-double). */
function playCeremony(wrap, top, me, onDone) {
  top = (Array.isArray(top) ? top : []).slice(0, 3);
  const podium = el("div.cr-podium");
  // 3 marches : 2e (gauche), 1er (centre), 3e (droite).
  const slots = { 0: null, 1: null, 2: null };
  const stepFor = (rank) => {
    const r = top[rank];
    if (!r) return null;
    const cls = rank === 0 ? "cr-step--1" : rank === 1 ? "cr-step--2" : "cr-step--3";
    const node = el("div.cr-step." + cls + " is-hidden", {}, [
      el("div.cr-step__crown", { text: rank === 0 ? "👑" : "" }),
      el("span.av-badge.cr-step__av", { text: r.avatar, style: `background:${colorOf(r.name)}` }),
      el("div.cr-step__name", { text: r.name + (r.id === me ? " (toi)" : "") }),
      el("div.cr-step__pts", { text: `${r.pts} 👑` }),
      el("div.cr-step__base", { text: rank === 0 ? "1" : rank === 1 ? "2" : "3" }),
    ]);
    slots[rank] = node;
    return node;
  };
  // Ordre visuel : 2e, 1er, 3e.
  [stepFor(1), stepFor(0), stepFor(2)].forEach((n) => n && podium.appendChild(n));

  const title = el("h2.center", { text: "🥁 Roulement de tambour…", style: "margin-bottom:12px" });
  const skip = el("button.chip", { text: "Passer", style: "margin-top:14px" });
  wrap.replaceChildren(el("div", {}, [title, podium, el("div.row", { style: "justify-content:center" }, [skip])]));

  const timers = [];
  let done = false;
  const reveal = (rank, delay, label) => timers.push(setTimeout(() => {
    if (done) return;
    if (slots[rank]) slots[rank].classList.remove("is-hidden");
    title.textContent = label;
    if (rank === 0) { celebrate(); jingle(); const rect = podium.getBoundingClientRect(); confettiBurst(rect.left + rect.width / 2, rect.top + rect.height / 3, 140); }
    else { pop(); }
  }, delay));
  roundCue();
  if (top[2]) reveal(2, 900, "🥉 En 3e place…");
  reveal(1, 2000, "🥈 En 2e place…");
  reveal(0, 3400, `👑 Le Roi de la soirée : ${top[0].name} !`);
  timers.push(setTimeout(() => { if (!done) confettiRain(1200); }, 3600));

  const finish = () => {
    if (done) return; done = true;
    timers.forEach(clearTimeout);
    // Affiche tout le podium d'un coup si on passe.
    Object.values(slots).forEach((n) => n && n.classList.remove("is-hidden"));
    title.textContent = top[0] ? `👑 ${top[0].name}, Roi de la soirée !` : "👑";
    skip.textContent = "← Retour au classement";
    skip.onclick = () => onDone && onDone();
  };
  skip.addEventListener("click", finish);
  timers.push(setTimeout(finish, 4200));

  // Nettoyage externe : écran quitté (stop du salon / nouvelle cérémonie) en
  // pleine animation → on coupe les timers pour ne pas tirer confettis/sons
  // sur un DOM détaché (n'appelle PAS onDone : c'est un abandon, pas une fin).
  return () => { done = true; timers.forEach(clearTimeout); };
}
