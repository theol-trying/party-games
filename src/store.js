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

const API = "/api/kv/";
const LS_PREFIX = "soiree:";
let apiAvailable = null; // null = inconnu, true/false = détecté

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

/** Lit une valeur (API en priorité, sinon localStorage). */
export async function getData(key, fallback = null) {
  if (apiAvailable !== false) {
    try {
      const res = await fetch(API + encodeURIComponent(key));
      if (res.status === 404) {
        apiAvailable = true;
        return lsGet(key, fallback);
      }
      if (res.ok) {
        apiAvailable = true;
        const json = await res.json();
        // On rafraîchit le cache local au passage.
        if (json.value != null) lsSet(key, json.value);
        return json.value != null ? json.value : lsGet(key, fallback);
      }
    } catch {
      apiAvailable = false;
    }
  }
  return lsGet(key, fallback);
}

/** Écrit une valeur (localStorage immédiat + push serveur en tâche de fond). */
export async function setData(key, value) {
  lsSet(key, value);
  if (apiAvailable === false) return;
  try {
    const res = await fetch(API + encodeURIComponent(key), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    apiAvailable = res.ok ? true : apiAvailable;
  } catch {
    apiAvailable = false;
  }
}

/** Indique si le backend de persistance est joignable (après un 1er appel). */
export function isRemoteAvailable() {
  return apiAvailable === true;
}
