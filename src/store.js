/* =========================================================================
   STORE — persistance côté client avec dégradation gracieuse.

   Stratégie « local-first + sync » :
   - setData()  écrit TOUJOURS dans localStorage (instantané, hors-ligne) et,
     en tâche de fond, pousse vers l'API serveur (donc vers Upstash Redis).
   - getData()  tente d'abord l'API (donnée partagée / à jour) ; en cas
     d'échec ou d'absence d'API, retombe sur localStorage.

   Résultat : le site fonctionne à l'identique en statique (sans backend),
   et devient partagé/persistant dès qu'il tourne sur le serveur Node + Upstash.
   ========================================================================= */

import { currentRoom } from "./room.js";

const API = "/api/kv/";
const LS_PREFIX = "soiree:";
// Après une erreur réseau, on repasse en local-seul un court moment, puis on
// retente. (Avant : la moindre coupure — Wi-Fi qui saute, passage en 4G —
// coupait le partage jusqu'au rechargement de la page, donc toute la soirée
// puisque le site ne recharge jamais entre deux jeux.)
const PAUSE_APRES_ECHEC_MS = 10000;
let apiEnPauseJusqua = 0;
const apiEnPause = () => Date.now() < apiEnPauseJusqua;
function signalerEchec() {
  apiEnPauseJusqua = Date.now() + PAUSE_APRES_ECHEC_MS;
}

// Écritures qui n'ont pas pu partir (réseau coupé, serveur saturé) : la
// dernière valeur de chaque clé est repoussée dès que possible.
const enAttente = new Map(); // clé complète -> valeur
let relance = null;
function planifierRelance() {
  if (relance) return;
  relance = setTimeout(() => {
    relance = null;
    const lot = [...enAttente];
    enAttente.clear();
    lot.forEach(([k, v]) => pousser(k, v));
  }, PAUSE_APRES_ECHEC_MS + 500);
}
try { window.addEventListener("online", () => { apiEnPauseJusqua = 0; if (enAttente.size) { clearTimeout(relance); relance = null; planifierRelance(); } }); } catch {}

/** Préfixe la clé par le code de la soirée : deux groupes sont isolés, deux
    appareils avec le même code partagent la donnée. Ex. "ABCD:players". */
function scopedKey(key) {
  return currentRoom() + ":" + key;
}

function lsGet(key, fallback) {
  try {
    const v = localStorage.getItem(LS_PREFIX + key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

function lsSet(key, value) {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
  } catch {}
}

/** Lecture SYNCHRONE du cache local (room-scopée), sans toucher au réseau.
    Utile quand on a besoin d'une valeur tout de suite (ex. amorçage anti-répétition). */
export function getLocal(key, fallback = null) {
  return lsGet(scopedKey(key), fallback);
}

/** Lit une valeur (API en priorité, sinon localStorage). */
export async function getData(key, fallback = null) {
  const k = scopedKey(key);
  // Une écriture locale pas encore repartie est plus récente que le serveur.
  if (enAttente.has(k)) return lsGet(k, fallback);
  if (!apiEnPause()) {
    try {
      const res = await fetch(API + encodeURIComponent(k));
      if (res.status === 404) return lsGet(k, fallback);
      if (res.ok) {
        const json = await res.json();
        // On rafraîchit le cache local au passage.
        if (json.value != null) lsSet(k, json.value);
        return json.value != null ? json.value : lsGet(k, fallback);
      }
    } catch {
      signalerEchec();
    }
  }
  return lsGet(k, fallback);
}

/** Écrit une valeur (localStorage immédiat + push serveur en tâche de fond).
    Renvoie { ok, raison? } : raison = "trop-gros" quand le serveur refuse la
    taille (plafond de 32 Ko) — la donnée reste alors sur CE téléphone seulement. */
export async function setData(key, value) {
  const k = scopedKey(key);
  lsSet(k, value);
  return pousser(k, value);
}

async function pousser(k, value) {
  if (apiEnPause()) {
    enAttente.set(k, value);
    planifierRelance();
    return { ok: false, raison: "hors-ligne" };
  }
  try {
    const res = await fetch(API + encodeURIComponent(k), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    if (res.ok) return { ok: true };
    if (res.status === 413) return { ok: false, raison: "trop-gros" };
    // 429 (trop de requêtes), 5xx : on repoussera plus tard.
    if (res.status === 429 || res.status >= 500) {
      enAttente.set(k, value);
      planifierRelance();
    }
    return { ok: false, raison: "serveur" };
  } catch {
    signalerEchec();
    enAttente.set(k, value);
    planifierRelance();
    return { ok: false, raison: "hors-ligne" };
  }
}
