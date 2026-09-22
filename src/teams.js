/* =========================================================================
   TEAMS — constructeur d'équipes réutilisable.
   Répartit les joueurs saisis en 2 à 4 équipes (auto ou manuel), puis renvoie
   la liste des équipes. Le jeu utilise ensuite les NOMS d'équipe comme entités
   de score (createScores) : buzzers, tours et classement fonctionnent tels quels.

   teamBuilder({ players, onReady }) -> élément DOM
     onReady(teams) avec teams = [{ name, members: [...] }]
   ========================================================================= */

import { el, shuffle, showPhase } from "./ui.js";

const TEAM_META = [
  { name: "Rouge", emoji: "🔴" },
  { name: "Bleu", emoji: "🔵" },
  { name: "Vert", emoji: "🟢" },
  { name: "Jaune", emoji: "🟡" },
];

export function teamBuilder({ players, onReady }) {
  const maxTeams = Math.min(4, players.length);
  let count = Math.min(2, maxTeams);
  const assign = {}; // joueur -> index d'équipe
  players.forEach((p, i) => (assign[p] = i % count));

  const root = el("div.card");
  const teamName = (i) => `${TEAM_META[i].emoji} ${TEAM_META[i].name}`;

  function teams() {
    const t = [];
    for (let i = 0; i < count; i++) t.push({ name: teamName(i), members: players.filter((p) => assign[p] === i) });
    return t;
  }

  function redistribute() {
    shuffle(players).forEach((p, i) => (assign[p] = i % count));
  }

  function refresh() {
    const countRow = el(
      "div.row",
      { style: "justify-content:center" },
      [2, 3, 4]
        .filter((n) => n <= maxTeams)
        .map((n) =>
          el("button.chip" + (n === count ? ".is-active" : ""), {
            text: `${n} équipes`,
            onClick: () => {
              count = n;
              players.forEach((p, i) => { if (assign[p] >= count) assign[p] = i % count; });
              refresh();
            },
          })
        )
    );

    const list = el(
      "div.stack",
      {},
      players.map((p) =>
        el("div.tm-row", {}, [
          el("span", { text: p }),
          el("button.chip.tm-badge", {
            text: teamName(assign[p]),
            dataset: { t: String(assign[p]) },
            onClick: () => { assign[p] = (assign[p] + 1) % count; refresh(); },
          }),
        ])
      )
    );

    const rosters = el(
      "div.stack.tm-rosters",
      {},
      teams().map((t) =>
        el("div.tm-roster", {}, [el("strong", { text: t.name }), el("span", { text: t.members.join(", ") || "—" })])
      )
    );

    const valid = teams().every((t) => t.members.length >= 1);
    const startBtn = el("button.btn.btn--full", { text: "Commencer", disabled: !valid, onClick: () => onReady(teams()) });

    root.replaceChildren(
      el("h3", { text: "Former les équipes" }),
      el("p.screen__subtitle", { text: "Touche l'étiquette d'un joueur pour changer son équipe.", style: "margin:6px 0 12px" }),
      countRow,
      el("div.row", { style: "justify-content:center;margin:10px 0" }, [
        el("button.chip", { text: "🎲 Répartir au hasard", onClick: () => { redistribute(); refresh(); } }),
      ]),
      list,
      el("h4", { text: "Équipes", style: "margin:14px 0 8px" }),
      rosters,
      el("div", { style: "margin-top:14px" }, [startBtn])
    );
  }

  refresh();
  return root;
}

/** Écran « Mode de jeu » : chacun pour soi, ou en équipes.
    Greffable sur n'importe quel jeu qui démarre à partir d'une liste de noms,
    puisqu'une équipe est traitée comme un joueur portant le nom de l'équipe.

    modeScreen(stage, { names, onStart, soloLabel? })
      onStart(noms, { equipes }) — noms = joueurs, ou noms d'équipes */
export function modeScreen(stage, { names, onStart, soloLabel = "🙋 Chacun pour soi" }) {
  return el("div.card.center", {}, [
    el("h3", { text: "Mode de jeu" }),
    el("p.screen__subtitle", { text: `${names.length} joueurs`, style: "margin:6px 0 14px" }),
    el("button.btn.btn--full", { text: soloLabel, onClick: () => onStart(names, { equipes: null }) }),
    el("button.btn.btn--full.btn--ghost", {
      text: "👥 En équipes",
      style: "margin-top:10px",
      onClick: () =>
        showPhase(
          stage,
          teamBuilder({
            players: names,
            onReady: (teams) => onStart(teams.map((t) => t.name), { equipes: teams }),
          })
        ),
    }),
  ]);
}
