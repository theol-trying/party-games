/* =========================================================================
   PLAYERS — composant partagé de saisie des joueurs.
   Réutilisé par les jeux qui ont besoin d'une liste de participants.

   Persistance via store.js : la liste est gardée en localStorage (instantané)
   ET synchronisée avec le serveur (Upstash Redis) quand il est dispo — donc
   partagée entre appareils / conservée entre sessions.
   ========================================================================= */

import { el } from "./ui.js";
import { getData, setData } from "./store.js";

const KEY = "players";

/** Lecture synchrone immédiate (cache localStorage) pour un rendu instantané. */
export function loadPlayers() {
  try {
    return JSON.parse(localStorage.getItem("soiree:" + KEY)) || [];
  } catch {
    return [];
  }
}

/** Sauvegarde locale + push serveur (tâche de fond). */
export function savePlayers(list) {
  setData(KEY, list);
}

/**
 * Construit une carte de saisie des joueurs.
 * @param {object} opts
 * @param {number} opts.min  nombre minimum requis (def. 2)
 * @param {string} opts.cta  libellé du bouton de validation
 * @param {(names:string[])=>void} opts.onReady  callback avec les noms validés
 * @returns {HTMLElement}
 */
export function playersCard({ min = 2, cta = "Commencer", onReady }) {
  let players = loadPlayers();
  if (players.length < min) players = players.concat(Array(min - players.length).fill(""));
  let touched = false; // l'utilisateur a-t-il commencé à éditer ?

  const list = el("div.stack.pl-list");
  const startBtn = el("button.btn.btn--full", { text: cta });

  function refresh() {
    list.replaceChildren();
    players.forEach((name, i) => {
      const input = el("input.input", {
        value: name,
        placeholder: `Joueur ${i + 1}`,
        maxlength: "20",
      });
      input.addEventListener("input", () => {
        touched = true;
        players[i] = input.value;
      });
      const del = el("button.btn.btn--ghost.pl-del", {
        text: "✕",
        title: "Supprimer",
        onClick: () => {
          touched = true;
          players.splice(i, 1);
          refresh();
        },
      });
      list.appendChild(el("div.pl-row", {}, [input, del]));
    });
    startBtn.disabled = validNames().length < min;
  }

  function validNames() {
    return players.map((p) => p.trim()).filter(Boolean);
  }

  const addBtn = el("button.btn.btn--ghost", {
    text: "+ Ajouter un joueur",
    onClick: () => {
      touched = true;
      players.push("");
      refresh();
    },
  });

  list.addEventListener("input", () => {
    startBtn.disabled = validNames().length < min;
  });

  startBtn.addEventListener("click", () => {
    const names = validNames();
    if (names.length < min) return;
    savePlayers(names);
    onReady(names);
  });

  refresh();

  // Réconciliation avec le serveur : si une liste distante existe et que
  // l'utilisateur n'a pas encore touché au formulaire, on l'affiche.
  getData(KEY, null).then((remote) => {
    if (touched || !Array.isArray(remote) || !remote.length) return;
    players = remote.slice();
    if (players.length < min) players = players.concat(Array(min - players.length).fill(""));
    refresh();
  });

  return el("div.card", {}, [
    el("h3", { text: "Qui joue ?", style: "margin-bottom:14px" }),
    list,
    el("div.row", { style: "margin-top:14px" }, [addBtn]),
    el("div", { style: "margin-top:18px" }, [startBtn]),
  ]);
}
