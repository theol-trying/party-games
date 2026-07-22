import { el, screenHead, announce, showPhase } from "../../ui.js";
import { playersCard } from "../../players.js";
import { createScores, scoreboard } from "../../scoring.js";
import { createDeck } from "../../deck.js";
import { buzz, vibrate } from "../../sound.js";
import { teamBuilder } from "../../teams.js";
import { openEditor } from "../../content.js";
import { contentSource } from "../../game-kit.js";
import { liveSession } from "../../realtime.js";
import { celebrate } from "../../fx.js";
import { awardStanding } from "../../crown.js";
import { TRACKS } from "./data.js";

const BT_SCHEMA = {
  title: "Blind Test",
  fields: [
    { key: "title", label: "Titre", type: "text" },
    { key: "artist", label: "Artiste", type: "text" },
    { key: "url", label: "Lien audio .mp3 (optionnel)", type: "text", optional: true },
  ],
  summary: (e) => `${e.title} — ${e.artist}${e.url ? " 🔊" : ""}`,
};

// Thèmes rapides : une requête envoyée à la recherche d'extraits.
const THEMES = [
  { label: "Années 80", q: "80s hits" },
  { label: "Années 90", q: "90s hits" },
  { label: "Années 2000", q: "2000s hits" },
  { label: "Rap FR", q: "rap francais" },
  { label: "Variété FR", q: "chanson francaise" },
  { label: "Disney", q: "disney" },
  { label: "Rock", q: "rock classics" },
  { label: "Été", q: "summer hits" },
];

export function render(container, { game }) {
  container.append(screenHead(game.title, "Buzzer + scores en temps réel"));
  const stage = el("div");
  container.append(stage);
  let currentAudio = null;
  let liveStop = null;
  const objectUrls = []; // URLs de fichiers locaux à libérer au cleanup
  const src = contentSource("blind-test", { builtIn: TRACKS, keyOf: (t) => t.title, toValue: (e) => ({ title: e.title, artist: e.artist, audioUrl: e.url || "" }) });

  modeSelect0();
  src.reload();

  // Nettoyage : coupe l'extrait, libère les fichiers locaux, stoppe le salon.
  return () => {
    if (currentAudio) currentAudio.pause();
    currentAudio = null;
    objectUrls.forEach((u) => URL.revokeObjectURL(u));
    if (liveStop) liveStop();
  };

  // Choix du support : un téléphone (buzzers partagés) ou multi (buzzer chacun).
  function modeSelect0() {
    if (liveStop) { liveStop(); liveStop = null; }
    showPhase(stage,
      el("div.card.center", {}, [
        el("h3", { text: "Comment jouer ?" }),
        el("button.btn.btn--full", { text: "📱 Sur ce téléphone", onClick: () => showPhase(stage, playersCard({ min: 2, cta: "Suite →", onReady: (names) => modeScreen(names) })) }),
        el("button.btn.btn--full.btn--ghost", { text: "🌐 Multi — buzzer sur chaque tél", style: "margin-top:10px", onClick: () => sourceScreen(null, "blind-test", (q) => startLive(q)) }),
      ])
    );
  }

  // Choix : chacun pour soi ou en équipes.
  function modeScreen(names) {
    showPhase(stage,
      el("div.card.center", {}, [
        el("h3", { text: "Mode de jeu" }),
        el("p.screen__subtitle", { text: `${names.length} joueurs`, style: "margin:6px 0 14px" }),
        el("button.btn.btn--full", { text: "🙋 Chacun pour soi", onClick: () => sourceScreen(names, "blind-test") }),
        el("button.btn.btn--full.btn--ghost", {
          text: "👥 En équipes",
          style: "margin-top:10px",
          onClick: () => showPhase(stage, teamBuilder({ players: names, onReady: (teams) => sourceScreen(teams.map((t) => t.name), "blind-test:teams") })),
        }),
      ])
    );
  }

  function defaultTracks() { return src.cards(); }
  function builtInTracks() { return TRACKS.map((t) => ({ key: t.title, label: `${t.title} — ${t.artist}` })); }

  /* ---------- Choix de la source + construction de la playlist ---------- */
  function sourceScreen(players, scoreKey, onLaunch) {
    const queue = [];
    let provider = "itunes";

    const queueInfo = el("p.bt-queue", { text: "0 titre dans la playlist" });
    const launch = el("button.btn.btn--full", { text: "Lancer le blind test", disabled: true });
    launch.addEventListener("click", () => (onLaunch || ((q) => startGame(players, q, scoreKey)))(queue.slice()));

    function refreshQueue() {
      queueInfo.textContent = `${queue.length} titre${queue.length > 1 ? "s" : ""} dans la playlist`;
      launch.disabled = queue.length === 0;
    }
    function addTrack(t) {
      queue.push(t);
      refreshQueue();
    }

    // -- Recherche --
    const results = el("div.bt-results");
    const searchInput = el("input.input", { placeholder: "Titre ou artiste…", "aria-label": "Recherche musicale" });
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doSearch(searchInput.value);
    });
    const searchBtn = el("button.btn", { text: "Chercher", onClick: () => doSearch(searchInput.value) });

    const appleChip = el("button.chip.is-active", { text: "🍏 Apple", onClick: () => setProvider("itunes") });
    const deezerChip = el("button.chip", { text: "🎵 Deezer", onClick: () => setProvider("deezer") });
    function setProvider(p) {
      provider = p;
      appleChip.classList.toggle("is-active", p === "itunes");
      deezerChip.classList.toggle("is-active", p === "deezer");
    }

    const themeRow = el(
      "div.row.bt-themes",
      {},
      THEMES.map((th) => el("button.chip", { text: th.label, onClick: () => { searchInput.value = th.label; doSearch(th.q); } }))
    );

    async function doSearch(q) {
      q = (q || "").trim();
      if (!q) return;
      results.replaceChildren(el("p.screen__subtitle", { text: "Recherche…" }));
      try {
        const r = await fetch(`/api/music?provider=${provider}&limit=20&q=${encodeURIComponent(q)}`);
        const j = await r.json();
        const list = (j.results || []).filter((t) => t.preview);
        if (!list.length) {
          results.replaceChildren(el("p.screen__subtitle", { text: "Aucun extrait trouvé." }));
          return;
        }
        results.replaceChildren(
          ...list.map((t) =>
            el("div.bt-result", {}, [
              el("div.bt-result__meta", {}, [
                el("div.bt-result__title", { text: t.title }),
                el("div.bt-result__artist", { text: t.artist || "" }),
              ]),
              el("button.chip", {
                text: "+ Ajouter",
                onClick: (e) => {
                  addTrack({ title: t.title, artist: t.artist, src: t.preview });
                  e.currentTarget.textContent = "✓ Ajouté";
                  e.currentTarget.disabled = true;
                },
              }),
            ])
          )
        );
      } catch {
        results.replaceChildren(el("p.screen__subtitle", { text: "Recherche indisponible (réseau ?)." }));
      }
    }

    // -- Fichiers locaux --
    const fileInput = el("input.input", { type: "file", accept: "audio/*", multiple: "", "aria-label": "Fichiers audio" });
    fileInput.addEventListener("change", () => {
      [...fileInput.files].forEach((f) => {
        const u = URL.createObjectURL(f);
        objectUrls.push(u);
        addTrack({ title: f.name.replace(/\.[^.]+$/, ""), artist: "", src: u });
      });
      fileInput.value = "";
    });

    // -- Liste par défaut + mes titres --
    const defaultBtn = el("button.chip", {
      text: `Charger la liste (${defaultTracks().length})`,
      onClick: () => defaultTracks().forEach((t) => addTrack({ title: t.title, artist: t.artist, src: t.audioUrl || "" })),
    });
    const editBtn = el("button.chip", {
      text: "✏️ Mes titres",
      onClick: () => openEditor(stage, {
        gameId: "blind-test",
        schema: BT_SCHEMA,
        builtInList: builtInTracks(),
        onDone: async () => { await src.reload(); sourceScreen(players, scoreKey, onLaunch); },
      }),
    });

    refreshQueue();
    showPhase(stage,
      el("div.card", {}, [
        el("h3", { text: "🔎 Recherche d'extraits (30 s)" }),
        el("p.screen__subtitle", { text: "Apple Music / Deezer — gratuit, sans compte", style: "margin-bottom:10px" }),
        el("div.row", { style: "justify-content:center;margin-bottom:10px" }, [appleChip, deezerChip]),
        el("div.row", {}, [searchInput, searchBtn]),
        themeRow,
        results,
      ]),
      el("div.card", { style: "margin-top:14px" }, [
        el("h3", { text: "📁 Fichiers du téléphone" }),
        el("p.screen__subtitle", { text: "Tes propres MP3, joués en local (hors-ligne)", style: "margin-bottom:10px" }),
        fileInput,
      ]),
      el("div.card", { style: "margin-top:14px" }, [
        el("h3", { text: "📝 Liste par défaut & mes titres", style: "margin-bottom:10px" }),
        el("div.row", {}, [defaultBtn, editBtn]),
      ]),
      el("div.card.bt-launch", { style: "margin-top:14px" }, [queueInfo, launch]),
    );
  }

  /* ---------- Partie : buzzer + scores ---------- */
  function startGame(players, tracks, scoreKey = "blind-test") {
    const sc = createScores(scoreKey, players); // scores persistés par soirée (par joueur ou par équipe)
    const deck = createDeck(tracks);
    let round = 0;
    let buzzedBy = null;
    let revealed = false;

    function playRound() {
      buzzedBy = null;
      revealed = false;
      let t = deck.next();
      if (!t) { deck.reset(); t = deck.next(); }

      const audio = t.src
        ? el("audio.bt-audio", { src: t.src, controls: "", autoplay: "", "aria-label": "Extrait à deviner" })
        : el("div.placeholder", { text: "Pas d'audio pour ce titre — lance-le à la main, puis buzzez." });

      if (currentAudio) currentAudio.pause();
      currentAudio = t.src ? audio : null;

      const buzzers = el(
        "div.bt-buzzers",
        {},
        players.map((p) =>
          el("button.bt-buzzer", {
            text: p,
            onClick: (e) => {
              if (buzzedBy) return;
              buzzedBy = p;
              buzz();
              announce(`${p} a buzzé`);
              buzzInfo.textContent = `🔔 ${p} a buzzé !`;
              buzzers.querySelectorAll(".bt-buzzer").forEach((b) => (b.disabled = true));
              e.currentTarget.classList.add("is-buzzed");
              judge.style.display = "";
            },
          })
        )
      );

      const buzzInfo = el("p.bt-buzzinfo.center", { text: "Premier à buzzer !", style: "font-weight:700;margin:14px 0" });

      const judge = el("div.row", { style: "display:none;justify-content:center;margin-top:6px" }, [
        el("button.btn", { text: "✅ Correct (+1)", onClick: () => resolve(true) }),
        el("button.btn.btn--ghost", { text: "❌ Raté", onClick: () => resolve(false) }),
      ]);

      const answer = el("div.bt-answer", { style: "display:none" });

      function resolve(correct) {
        if (correct && buzzedBy) { sc.add(buzzedBy); celebrate(); }
        revealAnswer();
      }
      function revealAnswer() {
        if (revealed) return;
        revealed = true;
        answer.style.display = "";
        answer.replaceChildren(
          el("div.bt-answer__title", { text: t.title }),
          el("div.bt-answer__artist", { text: t.artist || "" })
        );
        announce(`Réponse : ${t.title}${t.artist ? " par " + t.artist : ""}`);
        scoreWrap.replaceChildren(scoreboard(sc.scores));
        judge.style.display = "none";
      }

      const scoreWrap = el("div", {}, [scoreboard(sc.scores)]);

      showPhase(stage,
        el("div.card", {}, [
          el("p.screen__subtitle.center", { text: `Manche ${round + 1}` }),
          audio,
          buzzInfo,
          buzzers,
          judge,
          answer,
          el("div.row", { style: "justify-content:center;margin-top:18px" }, [
            el("button.btn.btn--ghost", { text: "Révéler la réponse", onClick: revealAnswer }),
            el("button.btn", { text: "Manche suivante →", onClick: () => { round++; playRound(); } }),
          ]),
        ]),
        el("div.card", { style: "margin-top:16px" }, [
          el("div.row", { style: "justify-content:space-between;align-items:center;margin-bottom:10px" }, [
            el("h3", { text: "Scores" }),
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
      );
    }

    sc.ready.then(playRound);
  }

  /* ================= Mode multi : l'hôte est DJ, chacun buzze sur son tél =================
     Le morceau ne circule JAMAIS sur le réseau avant le résultat : il ne vit que
     dans la closure de l'hôte. L'ordre de buzz vient du serveur (progress). */
  function startLive(tracks) {
    if (liveStop) liveStop();
    const deck = createDeck(tracks);
    const scores = {}; // deviceId -> total (autorité hôte, diffusé via state)
    let roundTrack = null; // secret DJ
    let lastTotals = null; // pour l'écran final
    let btFxRound = -1; // manche dont les confettis du gagnant ont déjà été joués

    liveStop = liveSession(stage, {
      gameId: "blind-test",
      title: "Blind Test — multi",
      minPlayers: 2,
      startLabel: "Lancer le 1er extrait",
      revealLabel: "🏁 Terminer la partie",
      newRoundLabel: "Morceau suivant →",
      onExit: modeSelect0,
      assign: (ps) => {
        let t = deck.next();
        if (!t) { deck.reset(); t = deck.next(); }
        roundTrack = t || { title: "?", artist: "", src: "" };
        const base = {};
        ps.forEach((p) => (base[p.id] = scores[p.id] || 0));
        const roles = {};
        ps.forEach((p) => (roles[p.id] = true));
        return { roles, meta: { base } };
      },
      renderMine: (mine, ctx) => liveRound(ctx), // ctx porte n (manche)
      renderReveal: (live, { api }) => {
        const names = live.names || {};
        const totals = lastTotals || (live.meta && live.meta.base) || {};
        const rows = Object.keys(names).map((id) => ({ id, t: totals[id] || 0 })).sort((a, b) => b.t - a.t);
        // 👑 Contribue au Roi de la soirée (classement final du blind test).
        if (api.isHost() && rows.some((r) => r.t > 0)) awardStanding("blind-test", rows.map((r) => r.id), names, live.avatars || {});
        return el("div", {}, [
          el("h3", { text: "🏁 Classement final", style: "margin-bottom:10px" }),
          el("div.stack", {}, rows.map((r, i) =>
            el("div.uc-role-row", {}, [
              el("span", { text: `${i + 1}. ${names[r.id] || "?"}${r.id === api.me ? " (toi)" : ""}` }),
              el("span", { text: `${r.t} pts` }),
            ])
          )),
        ]);
      },
    });

    const BUZZ_PTS = [10, 7, 5, 3]; // points selon le rang de buzz du gagnant

    function liveRound({ api, meta, n }) {
      let order = [];
      let rejected = [];
      let decided = false;
      let doubleRound = false; // ⭐ manche « artiste + titre » : points doublés
      let audioEl = null;
      let buzzBtn = null;
      const nameOf = (id) => (api.players().find((p) => p.id === id) || {}).name || "?";

      const info = el("p.bt-buzzinfo.center", {
        text: api.isHost()
          ? "🎧 La musique joue sur TON téléphone — les autres buzzent !"
          : "Écoute… et BUZZ ! (1er = 10 pts, puis 7, 5, 3)",
        style: "font-weight:700;margin:12px 0",
      });
      const orderBox = el("div.stack");
      const judgeBox = el("div", { style: "margin-top:12px" });
      const resultBox = el("div", { style: "margin-top:12px" });

      const firstPending = () => order.find((id) => !rejected.includes(id));

      function refreshOrder() {
        orderBox.replaceChildren(...order.map((id, i) =>
          el("div.uc-role-row", {}, [
            el("span", { text: `${i + 1}. ${nameOf(id)}${id === api.me ? " (toi)" : ""}` }),
            el("span", { text: rejected.includes(id) ? "❌" : id === firstPending() ? "🎤" : "🔔" }),
          ])
        ));
      }
      const winPts = (id) => {
        const rank = Math.max(0, order.indexOf(id));
        return BUZZ_PTS[Math.min(rank, BUZZ_PTS.length - 1)] * (doubleRound ? 2 : 1);
      };
      function refreshJudge() {
        if (!api.isHost() || decided) return judgeBox.replaceChildren();
        const kids = [];
        // ⭐ Manche spéciale : il faut donner l'artiste ET le titre, points doublés.
        const dbl = el("button.chip" + (doubleRound ? ".is-active" : ""), {
          text: doubleRound ? "⭐ Manche DOUBLE (artiste + titre)" : "⭐ Passer en manche double",
          onClick: () => { doubleRound = !doubleRound; refreshJudge(); },
        });
        kids.push(dbl);
        const id = firstPending();
        if (id) {
          kids.push(el("p", { text: `🎤 ${nameOf(id)} répond à voix haute${doubleRound ? " (artiste + titre !)" : ""} :`, style: "font-weight:700;margin-top:8px" }));
          kids.push(el("div.row", { style: "justify-content:center;margin-top:8px" }, [
            el("button.btn", { text: `✅ Correct (+${winPts(id)})`, onClick: () => hostAward(id) }),
            el("button.btn.btn--ghost", { text: "❌ Faux", onClick: () => hostReject(id) }),
          ]));
        }
        kids.push(el("button.chip", { text: "🔎 Personne — révéler la réponse", style: "margin-top:10px", onClick: hostFlop }));
        judgeBox.replaceChildren(...kids);
      }
      const baseTotals = () => {
        const t = {};
        api.players().forEach((p) => (t[p.id] = (meta.base || {})[p.id] || 0));
        return t;
      };
      function hostAward(id) {
        const pts = winPts(id);
        const totals = baseTotals();
        totals[id] = (totals[id] || 0) + pts;
        Object.assign(scores, totals);
        api.sendState({ phase: "won", id, pts, double: doubleRound, answer: { title: roundTrack.title, artist: roundTrack.artist }, totals });
      }
      function hostReject(id) {
        rejected = [...rejected, id];
        api.sendState({ phase: "rejected", ids: rejected });
      }
      function hostFlop() {
        const totals = baseTotals();
        Object.assign(scores, totals);
        api.sendState({ phase: "flop", answer: { title: roundTrack.title, artist: roundTrack.artist }, totals });
      }
      function showResult(s) {
        // Confettis du gagnant : une seule fois par manche (n survit au re-render
        // « Revenir à la manche » et au replay du state ; garde au scope startLive).
        if (s.phase === "won" && n != null && n !== btFxRound) { btFxRound = n; celebrate(); }
        decided = true;
        lastTotals = s.totals || lastTotals;
        const ids = Object.keys(s.totals || {}).sort((a, b) => (s.totals[b] || 0) - (s.totals[a] || 0));
        resultBox.replaceChildren(
          el("div.bt-answer", {}, [
            el("div.bt-answer__title", { text: s.answer ? s.answer.title : "?" }),
            el("div.bt-answer__artist", { text: (s.answer && s.answer.artist) || "" }),
          ]),
          el("p", { text: s.phase === "won" ? `🏆 ${nameOf(s.id)} +${s.pts}${s.double ? " ⭐ (manche double)" : ""} !` : "🤷 Personne n'a trouvé.", style: "font-weight:800;margin:10px 0" }),
          el("div.stack", {}, ids.map((id, i) =>
            el("div.uc-role-row", {}, [
              el("span", { text: `${i + 1}. ${nameOf(id)}${id === api.me ? " (toi)" : ""}` }),
              el("span", { text: `${s.totals[id]} pts` }),
            ])
          ))
        );
        info.textContent = "";
        judgeBox.replaceChildren();
        if (buzzBtn) buzzBtn.disabled = true;
        if (audioEl && audioEl.pause) audioEl.pause();
      }

      let feltFirstBuzz = false;
      api.on("progress", (done) => {
        order = done;
        refreshOrder();
        refreshJudge();
        if (order.length && !decided) {
          if (!api.isHost()) info.textContent = `🔔 ${nameOf(order[0])} a buzzé en premier !`;
          if (!feltFirstBuzz) { feltFirstBuzz = true; if (order[0] !== api.me) vibrate(40); }
        }
      });
      api.on("state", (s) => {
        if (s.phase === "rejected") {
          rejected = s.ids || [];
          refreshOrder();
          refreshJudge();
          if (rejected.includes(api.me)) info.textContent = "❌ Raté — les autres peuvent encore buzzer.";
        } else if (s.phase === "won" || s.phase === "flop") showResult(s);
      });

      const bits = [];
      if (api.isHost()) {
        audioEl = roundTrack && roundTrack.src
          ? el("audio.bt-audio", { src: roundTrack.src, controls: "", autoplay: "", "aria-label": "Extrait à deviner" })
          : el("div.placeholder", { text: "Pas d'audio pour ce titre — chante-le ou lance-le à la main 🎤" });
        if (currentAudio) currentAudio.pause();
        currentAudio = audioEl && audioEl.pause ? audioEl : null;
        bits.push(el("p.screen__subtitle", { text: "🎧 Tu es le DJ" }), audioEl);
      } else {
        buzzBtn = el("button.bt-buzzer.bt-buzzer--big", {
          text: "🔔 BUZZ !",
          onClick: () => {
            buzzBtn.disabled = true;
            buzz();
            api.submit(true);
            info.textContent = "🔔 Buzzé ! Attends la validation du DJ…";
          },
        });
        bits.push(buzzBtn);
      }
      bits.push(info, orderBox, judgeBox, resultBox);
      refreshJudge();
      return bits;
    }
  }
}
