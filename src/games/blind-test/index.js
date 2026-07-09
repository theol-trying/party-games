import { el, screenHead, announce, showPhase } from "../../ui.js";
import { playersCard } from "../../players.js";
import { createScores, scoreboard } from "../../scoring.js";
import { createDeck } from "../../deck.js";
import { buzz } from "../../sound.js";
import { teamBuilder } from "../../teams.js";
import { openEditor } from "../../content.js";
import { contentSource } from "../../game-kit.js";
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
  const objectUrls = []; // URLs de fichiers locaux à libérer au cleanup
  const src = contentSource("blind-test", { builtIn: TRACKS, keyOf: (t) => t.title, toValue: (e) => ({ title: e.title, artist: e.artist, audioUrl: e.url || "" }) });

  stage.append(
    playersCard({ min: 2, cta: "Suite →", onReady: (names) => modeScreen(names) })
  );
  src.reload();

  // Nettoyage : coupe l'extrait et libère les fichiers locaux.
  return () => {
    if (currentAudio) currentAudio.pause();
    currentAudio = null;
    objectUrls.forEach((u) => URL.revokeObjectURL(u));
  };

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
  function sourceScreen(players, scoreKey) {
    const queue = [];
    let provider = "itunes";

    const queueInfo = el("p.bt-queue", { text: "0 titre dans la playlist" });
    const launch = el("button.btn.btn--full", { text: "Lancer le blind test", disabled: true });
    launch.addEventListener("click", () => startGame(players, queue.slice(), scoreKey));

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
        onDone: async () => { await src.reload(); sourceScreen(players, scoreKey); },
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
        if (correct && buzzedBy) sc.add(buzzedBy);
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
}
