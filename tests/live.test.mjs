/* =========================================================================
   Tests du moteur de salons (live.js).

   live.js est du Node pur : `handleSocket(ws)` attend un objet muni de
   `onmessage` / `onclose` / `send` / `close`. On peut donc piloter tout le
   protocole avec de faux sockets, sans réseau ni navigateur.

   Ces tests couvrent en priorité les comportements où des bugs sont réellement
   apparus : élection de l'hôte, rang de buzzer, avatars dans la révélation,
   isolation du spectateur, et manche envoyée aux écrans TV.
   ========================================================================= */

import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { handleSocket } = require("../live.js");

/* ----------------------------- outillage ----------------------------- */

let roomSeq = 0;
// Les salons vivent dans un état de module partagé : un code par test évite
// que deux tests se marchent dessus.
const newRoom = () => "T" + String(++roomSeq).padStart(3, "0");

function socket() {
  const ws = {
    sent: [],
    closed: false,
    send(text) {
      ws.sent.push(JSON.parse(text));
    },
    close() {
      if (ws.closed) return;
      ws.closed = true;
      if (ws.onclose) ws.onclose();
    },
  };
  handleSocket(ws);
  return ws;
}

const send = (ws, obj) => ws.onmessage(JSON.stringify(obj));
const all = (ws, t) => ws.sent.filter((m) => m.t === t);
const last = (ws, t) => [...ws.sent].reverse().find((m) => m.t === t);

/** Joueur connecté à un salon. */
function join(room, game, id, name, avatar) {
  const ws = socket();
  send(ws, { t: "join", room, game, id, name, avatar });
  return ws;
}
/** Écran TV : rejoint sans jouer. `game` vide = « le jeu courant du salon ». */
function spectate(room, id, game = "") {
  const ws = socket();
  send(ws, { t: "join", room, id, game, spectator: true });
  return ws;
}

/* ------------------------------- tests -------------------------------- */

test("le premier arrivé est l'hôte, et le salon est diffusé à tous", () => {
  const r = newRoom();
  const a = join(r, "quiz-gages", "alice", "Alice", "🦊");
  assert.equal(last(a, "lobby").host, "alice");

  const b = join(r, "quiz-gages", "bob", "Bob", "🐼");
  const lob = last(a, "lobby");
  assert.equal(lob.players.length, 2, "les deux joueurs sont listés");
  assert.equal(lob.host, "alice", "l'arrivée d'un second joueur ne change pas l'hôte");
  assert.equal(last(b, "lobby").host, "alice");
  assert.deepEqual(lob.avatars, { alice: "🦊", bob: "🐼" });
});

test("un non-hôte ne peut ni lancer une manche, ni révéler, ni exclure", () => {
  const r = newRoom();
  const a = join(r, "quiz-gages", "alice", "Alice");
  const b = join(r, "quiz-gages", "bob", "Bob");

  send(b, { t: "start", roles: { bob: "X" } });
  assert.equal(all(a, "round").length, 0, "aucune manche lancée par un non-hôte");

  send(b, { t: "kick", id: "alice" });
  assert.equal(last(b, "lobby").players.length, 2, "personne n'a été exclu");

  send(a, { t: "start", roles: { alice: "A", bob: "B" } });
  send(b, { t: "reveal" });
  assert.equal(all(a, "revealed").length, 0, "aucune révélation par un non-hôte");
});

test("l'ordre d'arrivée fait office de buzzer ; re-soumettre garde le rang", () => {
  const r = newRoom();
  const a = join(r, "quiz-gages", "alice", "Alice");
  const b = join(r, "quiz-gages", "bob", "Bob");
  send(a, { t: "start", roles: { alice: "A", bob: "B" } });

  send(b, { t: "input", data: { rep: 1 } }); // Bob buzze en premier
  send(a, { t: "input", data: { rep: 2 } });
  assert.deepEqual(last(a, "progress").done, ["bob", "alice"], "Bob est premier");
  assert.equal(last(a, "progress").total, 2);

  send(b, { t: "input", data: { rep: 99 } }); // Bob change d'avis
  assert.deepEqual(last(a, "progress").done, ["bob", "alice"], "le rang est conservé");

  send(a, { t: "reveal" });
  assert.deepEqual(last(a, "revealed").inputs.bob, { rep: 99 }, "la donnée est remplacée");
});

test("la révélation embarque rôles, ordre, prénoms ET avatars", () => {
  const r = newRoom();
  const a = join(r, "quiz-gages", "alice", "Alice", "🦊");
  join(r, "quiz-gages", "bob", "Bob", "🐼");
  send(a, { t: "start", roles: { alice: "A", bob: "B" }, meta: { q: "?" } });
  send(a, { t: "input", data: 1 });
  send(a, { t: "reveal" });

  const rev = last(a, "revealed");
  assert.deepEqual(rev.roles, { alice: "A", bob: "B" });
  assert.deepEqual(rev.order, ["alice"]);
  assert.deepEqual(rev.names, { alice: "Alice", bob: "Bob" });
  // Régression déjà vécue : les avatars manquaient dans ce message précis.
  assert.deepEqual(rev.avatars, { alice: "🦊", bob: "🐼" });
  assert.deepEqual(rev.meta, { q: "?" });
});

test("un joueur qui arrive en cours de manche reçoit l'état courant", () => {
  const r = newRoom();
  const a = join(r, "quiz-gages", "alice", "Alice");
  send(a, { t: "start", roles: { alice: "A" }, meta: { q: "?" } });
  send(a, { t: "input", data: 1 });

  const c = join(r, "quiz-gages", "carol", "Carol"); // retardataire
  const round = last(c, "round");
  assert.ok(round, "le retardataire reçoit la manche");
  assert.equal(round.you, null, "sans rôle : il n'était pas là à la distribution");
  assert.deepEqual(last(c, "progress").done, ["alice"], "et la progression en cours");
});

test("l'écran TV reçoit tout sans compter comme joueur", () => {
  const r = newRoom();
  const a = join(r, "quiz-gages", "alice", "Alice", "🦊");
  const tv = spectate(r, "tv1"); // jeu non précisé : le serveur résout le jeu courant

  assert.equal(last(tv, "watching").game, "quiz-gages", "on lui dit quel jeu il regarde");
  assert.equal(last(tv, "lobby").players.length, 1, "le spectateur n'est pas un joueur");
  assert.equal(last(a, "lobby").players.length, 1, "et n'apparaît pas chez les joueurs");

  // Régression déjà vécue : la manche était poussée joueur par joueur, donc un
  // écran TV présent AVANT le lancement ne la recevait jamais.
  send(a, { t: "start", roles: { alice: "A" }, meta: { q: "?" } });
  const round = last(tv, "round");
  assert.ok(round, "le spectateur reçoit la manche");
  assert.equal(round.you, null, "sans rôle privé");

  send(a, { t: "input", data: 1 });
  assert.equal(last(tv, "progress").total, 1, "le total ne compte que les joueurs");

  send(a, { t: "reveal" });
  assert.ok(last(tv, "revealed"), "et la révélation");
});

test("un spectateur ne peut pas altérer la partie", () => {
  const r = newRoom();
  const a = join(r, "quiz-gages", "alice", "Alice");
  const tv = spectate(r, "tv1");

  send(tv, { t: "start", roles: { tv1: "PIRATE" } });
  send(tv, { t: "reveal" });
  send(tv, { t: "kick", id: "alice" });

  assert.equal(all(a, "round").length, 0, "aucune manche lancée");
  assert.equal(all(a, "revealed").length, 0, "aucune révélation");
  assert.equal(last(a, "lobby").players.length, 1, "personne exclu");
});

test("un spectateur sans jeu actif reçoit « nogame »", () => {
  const tv = spectate(newRoom(), "tv1"); // salon vide : aucun jeu en cours
  assert.ok(last(tv, "nogame"), "il saura qu'il doit réessayer");
  assert.equal(last(tv, "watching"), undefined);
});

test("la cérémonie est diffusée à tous, émetteur compris, et son contenu est borné", () => {
  const r = newRoom();
  const a = join(r, "quiz-gages", "alice", "Alice");
  const b = join(r, "quiz-gages", "bob", "Bob");

  send(a, {
    t: "ceremony",
    top: [
      { id: "x".repeat(40), name: "N".repeat(60), avatar: "🎉surplus", pts: "99", intrus: "à jeter" },
      { id: "bob", name: "Bob", avatar: "🐼", pts: 3 },
      { id: "c", name: "C", avatar: "🦁", pts: 2 },
      { id: "d", name: "D", avatar: "🐧", pts: 1 },
    ],
  });

  // L'hôte doit recevoir l'écho : c'est lui qui déclenche l'animation dessus.
  const chezHote = last(a, "ceremony");
  const chezBob = last(b, "ceremony");
  assert.ok(chezHote, "l'émetteur reçoit sa propre cérémonie");
  assert.deepEqual(chezHote, chezBob, "tout le monde joue exactement le même podium");

  assert.equal(chezHote.top.length, 3, "podium limité à 3");
  assert.deepEqual(Object.keys(chezHote.top[0]).sort(), ["avatar", "id", "name", "pts"]);
  assert.equal(chezHote.top[0].id.length, 20);
  assert.equal(chezHote.top[0].name.length, 24);
  assert.ok(chezHote.top[0].avatar.length <= 8);
  assert.equal(typeof chezHote.top[0].pts, "number");

  send(b, { t: "ceremony", top: [{ id: "bob", name: "Bob", avatar: "🐼", pts: 1 }] });
  assert.equal(all(a, "ceremony").length, 1, "un non-hôte ne déclenche rien");
});

test("les réactions sont diffusées à tous, mais bornées et filtrées", () => {
  const r = newRoom();
  const a = join(r, "quiz-gages", "alice", "Alice");
  const b = join(r, "quiz-gages", "bob", "Bob");

  send(b, { t: "react", emoji: "🔥" });
  const chezA = last(a, "react");
  assert.deepEqual(chezA, { t: "react", id: "bob", emoji: "🔥" }, "tout le monde la voit, avec son auteur");
  assert.ok(last(b, "react"), "l'émetteur aussi (retour visuel immédiat)");

  // Cadence : une deuxième réaction dans la foulée est ignorée.
  send(b, { t: "react", emoji: "😂" });
  assert.equal(all(a, "react").length, 1, "le spam est absorbé côté serveur");

  // Mais un AUTRE joueur n'est pas pénalisé par la cadence de son voisin.
  send(a, { t: "react", emoji: "👏" });
  assert.equal(all(b, "react").length, 2, "la limite est par joueur");

  // Liste fermée : rien d'arbitraire ne transite.
  send(a, { t: "react", emoji: "<img src=x onerror=alert(1)>" });
  assert.equal(all(b, "react").length, 2, "emoji hors liste refusé");
});

test("un spectateur ne peut pas envoyer de réaction", () => {
  const r = newRoom();
  const a = join(r, "quiz-gages", "alice", "Alice");
  const tv = spectate(r, "tv1");
  send(tv, { t: "react", emoji: "🔥" });
  assert.equal(all(a, "react").length, 0, "l'écran TV affiche, il ne participe pas");
});

test("si l'hôte part, la main passe au joueur présent le plus ancien", () => {
  const r = newRoom();
  const a = join(r, "quiz-gages", "alice", "Alice");
  const b = join(r, "quiz-gages", "bob", "Bob");
  const c = join(r, "quiz-gages", "carol", "Carol");

  a.close(); // l'hôte ferme son téléphone
  assert.equal(last(b, "lobby").host, "bob", "Bob était là avant Carol");
  assert.equal(last(b, "lobby").players.length, 2);

  // et le nouvel hôte peut effectivement lancer
  send(b, { t: "start", roles: { bob: "B", carol: "C" } });
  assert.ok(last(c, "round"), "la partie continue");
});

test("l'hôte peut passer la main volontairement", () => {
  const r = newRoom();
  const a = join(r, "quiz-gages", "alice", "Alice");
  const b = join(r, "quiz-gages", "bob", "Bob");

  send(a, { t: "host", id: "bob" });
  assert.equal(last(a, "lobby").host, "bob");

  send(a, { t: "start", roles: { alice: "A" } });
  assert.equal(all(b, "round").length, 0, "l'ancien hôte n'a plus la main");
  send(b, { t: "start", roles: { alice: "A", bob: "B" } });
  assert.ok(last(a, "round"), "le nouvel hôte l'a bien");
});

test("un joueur exclu est prévenu puis retiré du salon", () => {
  const r = newRoom();
  const a = join(r, "quiz-gages", "alice", "Alice");
  const b = join(r, "quiz-gages", "bob", "Bob");

  send(a, { t: "kick", id: "bob" });
  assert.ok(last(b, "kicked"), "la cible est prévenue avant fermeture");
  assert.equal(last(a, "lobby").players.length, 1, "et disparaît du salon");
});

test("une reconnexion remplace l'ancien socket sans dupliquer le joueur", () => {
  const r = newRoom();
  const a = join(r, "quiz-gages", "alice", "Alice");
  join(r, "quiz-gages", "bob", "Bob");

  const bis = join(r, "quiz-gages", "bob", "Bob"); // Bob revient (nouveau socket)
  assert.equal(last(a, "lobby").players.length, 2, "toujours deux joueurs, pas trois");
  assert.equal(last(bis, "lobby").players.length, 2);
});

// Cas réel : quitter par « ← » envoie un « leave », mais le joueur peut revenir
// aussitôt. Sur Render, le proxy relaie encore l'ancienne connexion ~10 s : son
// « leave » peut donc arriver APRÈS la reconnexion, et ne doit pas l'éjecter.
test("un « leave » tardif d'un ancien socket n'éjecte pas la nouvelle connexion", () => {
  const r = newRoom();
  const a = join(r, "quiz-gages", "alice", "Alice");
  const vieux = join(r, "quiz-gages", "bob", "Bob");
  join(r, "quiz-gages", "bob", "Bob"); // Bob revient (nouveau socket)

  send(vieux, { t: "leave" });
  assert.equal(last(a, "lobby").players.length, 2, "Bob doit rester dans le salon");
});

test("même garde pour l'écran TV : un vieux « leave » ne coupe pas le nouvel écran", () => {
  const r = newRoom();
  const a = join(r, "quiz-gages", "alice", "Alice");
  const tv1 = spectate(r, "ecran");
  const tv2 = spectate(r, "ecran"); // l'écran TV s'est reconnecté

  send(tv1, { t: "leave" });
  send(a, { t: "start", roles: { alice: "A" } });
  assert.ok(last(tv2, "round"), "le nouvel écran reçoit toujours la manche");
});

test("un message mal formé ou une donnée géante ne cassent pas le salon", () => {
  const r = newRoom();
  const a = join(r, "quiz-gages", "alice", "Alice");
  send(a, { t: "start", roles: { alice: "A" } });

  a.onmessage("{ceci n'est pas du JSON");
  send(a, { t: "inconnu", charge: "quoi que ce soit" });
  send(a, { t: "input", data: "x".repeat(5000) }); // au-delà du plafond de 4 Ko

  assert.equal(last(a, "progress"), undefined, "la donnée géante est refusée");
  send(a, { t: "input", data: "ok" });
  assert.deepEqual(last(a, "progress").done, ["alice"], "le salon fonctionne toujours");
});

/* ---- Audit du 2026-09-28 : manches après redémarrage, hôte, départs ---- */

test("après un redémarrage du serveur, la manche suivante ne réutilise pas un numéro déjà vu", () => {
  const r = newRoom();
  const a = join(r, "quiz-gages", "alice", "Alice");
  // Salon neuf (serveur redémarré) mais l'hôte avait déjà vu la manche 5.
  send(a, { t: "start", roles: { alice: "A" }, after: 5 });
  assert.equal(last(a, "round").n, 6);
  send(a, { t: "start", roles: { alice: "A" }, after: 2 }); // repère plus ancien : sans effet
  assert.equal(last(a, "round").n, 7);
});

test("un envoi qui vise une autre manche est ignoré (décompte d'un ancien écran)", () => {
  const r = newRoom();
  const a = join(r, "quiz-gages", "alice", "Alice");
  const b = join(r, "quiz-gages", "bob", "Bob");
  send(a, { t: "start", roles: { alice: "A", bob: "B" } }); // manche 1
  send(a, { t: "start", roles: { alice: "A", bob: "B" } }); // manche 2
  send(b, { t: "input", n: 1, data: "réponse de la manche 1" });
  assert.equal(last(a, "progress"), undefined, "la réponse périmée ne compte pas");
  send(a, { t: "timer", n: 1, seconds: 30 });
  assert.equal(last(b, "timer"), undefined, "l'ancien chrono ne repart pas");
  send(b, { t: "input", n: 2, data: "ok" });
  assert.deepEqual(last(a, "progress").done, ["bob"]);
});

test("le vrai hôte reprend la main dans un salon tout juste créé, une seule fois", () => {
  const r = newRoom();
  const b = join(r, "blind-test", "bob", "Bob"); // l'invité arrive le premier
  assert.equal(last(b, "lobby").host, "bob");
  const a = socket();
  send(a, { t: "join", room: r, game: "blind-test", id: "alice", name: "Alice", wasHost: true });
  assert.equal(last(b, "lobby").host, "alice", "l'hôte d'origine est rétabli");
  const c = socket();
  send(c, { t: "join", room: r, game: "blind-test", id: "carl", name: "Carl", wasHost: true });
  assert.equal(last(b, "lobby").host, "alice", "une deuxième revendication est refusée");
});

test("le total attendu exclut les retardataires sans rôle, et suit les départs", () => {
  const r = newRoom();
  const a = join(r, "quiz-gages", "alice", "Alice");
  const b = join(r, "quiz-gages", "bob", "Bob");
  const c = join(r, "quiz-gages", "carl", "Carl");
  send(a, { t: "start", roles: { alice: "A", bob: "B", carl: "C" } });
  join(r, "quiz-gages", "dan", "Dan"); // arrive après la distribution
  send(a, { t: "input", data: 1 });
  assert.equal(last(a, "progress").total, 3, "Dan n'a pas de rôle : il n'est pas attendu");
  send(c, { t: "leave" });
  assert.equal(last(a, "progress").total, 2, "Carl parti : plus que 2 attendus, diffusé tout de suite");
  send(b, { t: "input", data: 2 });
  assert.equal(last(a, "progress").done.length, 2);
});

test("l'hôte qui recharge sa page reprend la main, sauf s'il l'avait donnée", () => {
  const r = newRoom();
  const a = join(r, "quiz-gages", "alice", "Alice");
  const b = join(r, "quiz-gages", "bob", "Bob");
  a.close(); // page rechargée : la main passe à Bob
  assert.equal(last(b, "lobby").host, "bob");
  join(r, "quiz-gages", "alice", "Alice"); // Alice revient
  assert.equal(last(b, "lobby").host, "alice", "Alice est de nouveau l'hôte");

  const r2 = newRoom();
  const c = join(r2, "quiz-gages", "carl", "Carl");
  const d = join(r2, "quiz-gages", "dan", "Dan");
  send(c, { t: "host", id: "dan" }); // transfert volontaire
  c.close();
  join(r2, "quiz-gages", "carl", "Carl");
  assert.equal(last(d, "lobby").host, "dan", "un transfert volontaire n'est pas annulé au retour");
});
