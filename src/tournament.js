/* =========================================================================
   TOURNOI — enchaîner plusieurs jeux avec un classement global.

   Le classement existe déjà (crown.js agrège les jeux à score). Ce qu'il
   manquait, c'est le FIL : choisir une suite de jeux, savoir où on en est, et
   passer au suivant sans repasser par le menu.

   Un tournoi est donc volontairement mince : une liste ordonnée de jeux + un
   index courant, stockés dans le KV room-scopé pour que tous les téléphones
   voient la même progression. L'avancement reste déclenché par l'hôte (rien
   n'indique automatiquement qu'un jeu est « fini »), et le passage au jeu
   suivant réutilise le message « goto » qui emmène déjà toute la soirée.
   ========================================================================= */

import { el } from "./ui.js";
import { getData, setData } from "./store.js";
import { GAMES, getGame } from "./registry.js";
import { gameArt } from "./art.js";

const KEY = "tournoi";

/** Jeux proposables : ceux qui alimentent le classement, donc qui font sens
    dans un tournoi. Les autres (Undercover, Menteur…) n'ont pas de score.
    Le Blind Test en est exclu — comme dans « Changer de jeu » — parce qu'il
    demande de préparer une playlist et n'entre donc pas en multi tout seul. */
const JEUX_A_SCORE = ["quiz-gages", "plus-susceptible", "tu-preferes", "estimations"];

export async function getTournoi() {
  const t = await getData(KEY, null);
  return t && Array.isArray(t.jeux) && t.jeux.length ? t : null;
}
export async function demarrerTournoi(jeux) {
  const liste = (jeux || []).filter((id) => getGame(id));
  if (!liste.length) return null;
  const t = { jeux: liste, index: 0, debut: Date.now() };
  await setData(KEY, t);
  return t;
}
export async function avancerTournoi() {
  const t = await getTournoi();
  if (!t) return null;
  t.index = Math.min(t.index + 1, t.jeux.length); // === longueur ⇒ terminé
  await setData(KEY, t);
  return t;
}
export async function arreterTournoi() {
  await setData(KEY, null);
}

/** Jeu courant du tournoi, ou null s'il est terminé. */
export function jeuCourant(t) {
  return t && t.index < t.jeux.length ? t.jeux[t.index] : null;
}
export function estTermine(t) {
  return !!t && t.index >= t.jeux.length;
}

/** Bandeau de progression, à afficher dans le salon. */
export function bandeauTournoi(t, { isHost, onSuivant, onArreter }) {
  if (!t) return null;
  const termine = estTermine(t);
  const etapes = el("div.row", { style: "justify-content:center;gap:6px;flex-wrap:wrap" },
    t.jeux.map((id, i) => {
      const g = getGame(id);
      const etat = i < t.index ? "fait" : i === t.index ? "encours" : "avenir";
      return el("span.tn-etape.is-" + etat, {
        title: `${i + 1}. ${g ? g.title : id}${etat === "fait" ? " — terminé" : etat === "encours" ? " — en cours" : ""}`,
      }, [gameArt(id, { size: 22 }) || el("span", { text: g ? g.icon : "🎮" })]);
    })
  );
  const g = getGame(jeuCourant(t));
  return el("div.tn-banner", {}, [
    el("div.tn-banner__titre", {
      text: termine ? "🏁 Tournoi terminé !" : `🏆 Tournoi · manche ${t.index + 1}/${t.jeux.length}${g ? " · " + g.title : ""}`,
    }),
    etapes,
    isHost
      ? el("div.row", { style: "justify-content:center;margin-top:10px;flex-wrap:wrap" }, [
          termine
            ? null
            : el("button.chip", { text: "➡️ Jeu suivant", onClick: () => onSuivant && onSuivant() }),
          el("button.chip", { text: termine ? "Fermer" : "✕ Arrêter le tournoi", onClick: () => onArreter && onArreter() }),
        ].filter(Boolean))
      : el("p.screen__subtitle.center", { text: termine ? "Regardez le palmarès 👑" : "L'hôte fera avancer le tournoi.", style: "margin-top:8px" }),
  ]);
}

/** Écran de composition d'un tournoi (hôte). onLancer(jeux). */
export function ecranTournoi({ onLancer, onAnnuler }) {
  const choisis = new Set(JEUX_A_SCORE.slice(0, 3));
  const carte = el("div.card.center", {});

  function rendre() {
    const dispo = GAMES.filter((g) => JEUX_A_SCORE.includes(g.id));
    carte.replaceChildren(
      el("h3", { text: "🏆 Tournoi" }),
      el("p.screen__subtitle", {
        text: "Choisis les jeux à enchaîner. Le classement « Roi de la soirée » fait le total, et l'hôte passe au jeu suivant quand vous le voulez.",
        style: "margin:8px 0 14px",
      }),
      el("div.stack", {}, dispo.map((g) =>
        el("button.btn.btn--ghost.btn--full.btn--art" + (choisis.has(g.id) ? ".is-on" : ""), {
          onClick: () => { choisis.has(g.id) ? choisis.delete(g.id) : choisis.add(g.id); rendre(); },
        }, [
          el("span", { text: choisis.has(g.id) ? "✅" : "⬜" }),
          gameArt(g.id, { size: 24 }) || el("span", { text: g.icon }),
          el("span", { text: g.title }),
        ])
      )),
      el("button.btn.btn--full", {
        text: `Lancer le tournoi (${choisis.size} jeu${choisis.size > 1 ? "x" : ""})`,
        style: "margin-top:14px",
        disabled: choisis.size < 2,
        onClick: () => onLancer && onLancer(GAMES.filter((g) => choisis.has(g.id)).map((g) => g.id)),
      }),
      el("button.chip", { text: "← Retour", style: "margin-top:12px", onClick: () => onAnnuler && onAnnuler() })
    );
  }
  rendre();
  return carte;
}
