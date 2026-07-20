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
let apiAvailable = null; // null = inconnu, true/false = détecté

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
  if (apiAvailable !== false) {
    try {
      const res = await fetch(API + encodeURIComponent(k));
      if (res.status === 404) {
        apiAvailable = true;
        return lsGet(k, fallback);
      }
      if (res.ok) {
        apiAvailable = true;
        const json = await res.json();
        // On rafraîchit le cache local au passage.
        if (json.value != null) lsSet(k, json.value);
        return json.value != null ? json.value : lsGet(k, fallback);
      }
    } catch {
      apiAvailable = false;
    }
  }
  return lsGet(k, fallback);
}

/** Écrit une valeur (localStorage immédiat + push serveur en tâche de fond). */
export async function setData(key, value) {
  const k = scopedKey(key);
  lsSet(k, value);
  if (apiAvailable === false) return;
  try {
    const res = await fetch(API + encodeURIComponent(k), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    apiAvailable = res.ok ? true : apiAvailable;
  } catch {
    apiAvailable = false;
  }
}
