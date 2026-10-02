/* =========================================================================
   Tests du moteur multi (src/realtime.js) tel qu'il tourne sur un téléphone,
   contre le VRAI serveur, avec d'autres téléphones simulés en WebSocket.

   Ils visent la famille de bugs trouvée à l'audit du 2026-09-28 : un écran de
   manche re-rendu (« Retour au salon → Revenir à la manche », nouvel hôte)
   perdait ce qui s'était passé, doublait ses traitements, ou laissait un
   ancien écran envoyer des réponses dans la manche suivante.
   Le DOM est simulé (tests/outils/dom-mini.mjs) : on teste la logique.
   ========================================================================= */

import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { installerDom, bouton } from "./outils/dom-mini.mjs";

const RACINE = fileURLToPath(new URL("..", import.meta.url));
const PORT = 5900 + Math.floor(Math.random() * 400);
const ORIGINE = `http://127.0.0.1:${PORT}`;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function attendre(cond, quoi, ms = 4000) {
  for (let t = 0; t < ms; t += 25) { if (cond()) return; await pause(25); }
  throw new Error("délai dépassé : " + quoi);
}

let srv;
let liveSession;
let el;
test.before(async () => {
  srv = spawn(process.execPath, ["server.js"], {
    cwd: RACINE,
    env: { ...process.env, PORT: String(PORT), ALLOWED_ORIGIN: "", UPSTASH_REDIS_REST_URL: "", UPSTASH_REDIS_REST_TOKEN: "" },
    stdio: "ignore",
  });
  for (let i = 0; i < 50; i++) {
    if (await fetch(`${ORIGINE}/api/health`).then((r) => r.ok, () => false)) break;
    await pause(100);
  }
  installerDom(ORIGINE);
  ({ liveSession } = await import("../src/realtime.js"));
  ({ el } = await import("../src/ui.js"));
});
test.after(() => srv && srv.kill());

/** Autre téléphone, simulé : un WebSocket brut qui garde tout ce qu'il reçoit. */
async function telephone(room, id, name) {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  const recus = [];
  ws.onmessage = (e) => recus.push(JSON.parse(e.data));
  await new Promise((r) => (ws.onopen = r));
  const envoyer = (o) => ws.send(JSON.stringify(o));
  envoyer({ t: "join", room, game: "quiz-gages", id, name });
  return { recus, envoyer, fermer: () => ws.close(), dernier: (t) => [...recus].reverse().find((m) => m.t === t) };
}

/** Le téléphone testé : le vrai moteur, avec un « jeu » qui note chaque rendu. */
function moteur(room, id, options = {}) {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem("soiree.room", room);
  localStorage.setItem("soiree.device", id);
  localStorage.setItem("soiree.name", "Moi");
  sessionStorage.setItem("soiree.joined", "1"); // entrée directe dans le salon
  const stage = document.createElement("div");
  document.body.appendChild(stage);
  const rendus = [];
  const stop = liveSession(stage, {
    gameId: "quiz-gages",
    title: "Test",
    minPlayers: 2,
    assign: (ps) => ({ roles: Object.fromEntries(ps.map((p) => [p.id, true])), meta: { x: 1 } }),
    renderMine: (_mine, { api, n }) => {
      const r = { api, n, memo: api.memo(), progress: [], hote: api.isHost() };
      rendus.push(r);
      api.on("progress", (done) => r.progress.push(done.slice()));
      return el("p", { text: "manche " + n });
    },
    renderReveal: () => el("p", { text: "révélation" }),
    ...options,
  });
  return { stage, rendus, stop };
}

test("écran re-rendu : il reçoit ce qui s'est déjà passé, garde sa mémoire, et l'ancien se tait", async () => {
  const room = "TMA" + Math.floor(Math.random() * 90 + 10);
  const m = moteur(room, "dmoi");
  await attendre(() => bouton(m.stage, "Distribuer"), "salon du moteur");
  const bob = await telephone(room, "dbob", "Bob");
  await attendre(() => bouton(m.stage, "Distribuer les rôles (2)"), "Bob visible dans le salon");
  bouton(m.stage, "Distribuer les rôles (2)").click();
  await attendre(() => m.rendus.length === 1 && bob.dernier("round"), "manche 1");
  const n = bob.dernier("round").n;
  bob.envoyer({ t: "input", n, data: "rép" });
  await attendre(() => m.rendus[0].progress.length === 1, "progress reçu");
  m.rendus[0].memo.choix = "B";

  bouton(m.stage, "Retour au salon").click();
  bouton(m.stage, "Revenir à la manche").click();
  assert.equal(m.rendus.length, 2, "l'écran de manche est re-rendu");
  const [premier, second] = m.rendus;
  assert.deepEqual(second.progress, [["dbob"]], "le nouvel écran sait tout de suite que Bob a répondu");
  assert.equal(second.memo, premier.memo, "même mémoire de manche");
  assert.equal(second.memo.choix, "B");

  bob.envoyer({ t: "input", n, data: "rép2" }); // re-soumission : nouveau progress
  await attendre(() => second.progress.length === 2, "progress suivant");
  assert.equal(premier.progress.length, 1, "l'abonnement de l'écran remplacé ne reçoit plus rien");

  // Manche suivante : l'API de l'ancienne manche ne peut plus rien envoyer.
  bouton(m.stage, "Nouvelle manche").click();
  await attendre(() => m.rendus.length === 3 && bob.dernier("round").n === n + 1, "manche 2");
  assert.notEqual(m.rendus[2].memo, premier.memo, "mémoire neuve à la manche suivante");
  premier.api.submit("réponse périmée");
  await pause(300);
  assert.ok(!bob.recus.some((x) => x.t === "progress" && x.n === n + 1), "la réponse périmée est ignorée");
  m.rendus[2].api.submit("ok");
  await attendre(() => bob.recus.some((x) => x.t === "progress" && x.n === n + 1 && x.done.includes("dmoi")), "la bonne réponse passe");

  m.stop();
  bob.fermer();
});

test("nouvel hôte en pleine manche : son écran est re-rendu avec les boutons d'hôte", async () => {
  const room = "TMB" + Math.floor(Math.random() * 90 + 10);
  const alice = await telephone(room, "dalice", "Alice"); // arrive la première : hôte
  const m = moteur(room, "dmoi2");
  await attendre(() => alice.dernier("lobby") && alice.dernier("lobby").players.length === 2, "salon à 2");
  alice.envoyer({ t: "start", roles: { dalice: true, dmoi2: true }, meta: {} });
  await attendre(() => m.rendus.length === 1, "manche reçue");
  assert.equal(m.rendus[0].hote, false);
  assert.equal(bouton(m.stage, "Révéler"), null, "pas de bouton d'hôte pour un invité");

  alice.envoyer({ t: "host", id: "dmoi2" }); // Alice passe la main
  await attendre(() => m.rendus.length === 2, "écran re-rendu");
  assert.equal(m.rendus[1].hote, true, "le jeu sait qu'il est hôte");
  assert.ok(bouton(m.stage, "Révéler"), "le bouton de révélation apparaît");

  m.stop();
  alice.fermer();
});

test("réglages de l'hôte : chaque téléphone les recopie, un nouvel hôte repart avec eux", async () => {
  const room = "TMC" + Math.floor(Math.random() * 90 + 10);
  const alice = await telephone(room, "dalice3", "Alice"); // hôte
  let niveau = "soft"; // réglage local du moteur (invité)
  const m = moteur(room, "dmoi3", { reglages: { lire: () => ({ niveau }), ecrire: (r) => { niveau = r.niveau; } } });
  await attendre(() => alice.dernier("lobby") && alice.dernier("lobby").players.length === 2, "salon à 2");
  alice.envoyer({ t: "start", roles: { dalice3: true, dmoi3: true }, meta: { __reglages: { niveau: "x18" } } });
  await attendre(() => m.rendus.length === 1, "manche reçue");
  assert.equal(niveau, "x18", "l'invité a recopié le réglage de l'hôte");

  alice.envoyer({ t: "host", id: "dmoi3" }); // le moteur devient hôte
  await attendre(() => m.rendus.length === 2, "écran d'hôte");
  bouton(m.stage, "Nouvelle manche").click();
  await attendre(() => alice.recus.filter((x) => x.t === "round").length === 2, "manche lancée par le nouvel hôte");
  assert.equal(alice.dernier("round").meta.__reglages.niveau, "x18", "le nouvel hôte relance avec les réglages de la partie");
  m.stop();
  alice.fermer();
});

test("salon : une arrivée ajoute sa ligne sans redessiner le reste (réglages, focus, lignes déjà là)", async () => {
  const room = "TMD" + Math.floor(Math.random() * 90 + 10);
  let rendusExtra = 0;
  const m = moteur(room, "dmoi4", { lobbyExtra: () => { rendusExtra++; return el("details", {}, [el("summary", { text: "Réglages" })]); } });
  await attendre(() => m.stage.querySelector(".salon-joueur"), "salon du moteur");
  const carte = m.stage.firstElementChild;
  const maLigne = m.stage.querySelector(".salon-joueur");
  m.stage.querySelector("details").open = true;
  const bob = await telephone(room, "dbob4", "Bob");
  await attendre(() => m.stage.querySelectorAll(".salon-joueur").length === 2, "Bob arrive");
  assert.equal(m.stage.firstElementChild, carte, "l'écran n'est pas redessiné");
  assert.equal(m.stage.querySelector(".salon-joueur"), maLigne, "la ligne déjà affichée est la même");
  const nouvelle = m.stage.querySelectorAll(".salon-joueur")[1];
  assert.ok(nouvelle.classList.contains("is-arrivee"), "la nouvelle ligne s'anime");
  assert.equal(m.stage.querySelector("details").open, true, "les réglages dépliés le restent");
  assert.ok(bouton(m.stage, "(2)"), "le bouton de lancement compte Bob");
  bob.fermer();
  await attendre(() => m.stage.querySelectorAll(".salon-joueur").length === 1, "Bob repart");
  m.stop();
});

test("« Qui a dit ça ? » : libellé du bouton selon la phase, et vote anonymisé par le serveur", async () => {
  const room = "TMQ" + Math.floor(Math.random() * 90 + 10);
  let phase = "ecrire";
  const m = moteur(room, "dmoiq", {
    revealLabel: (meta) => (meta && meta.phase === "ecrire" ? "Passer au vote" : "Révéler qui"),
    assign: (ps) => ({ roles: Object.fromEntries(ps.map((p) => [p.id, true])), meta: { phase }, anonymise: phase === "vote" }),
  });
  await attendre(() => bouton(m.stage, "Distribuer"), "salon du moteur");
  const bob = await telephone(room, "dbobq", "Bob");
  await attendre(() => bouton(m.stage, "Distribuer les rôles (2)"), "Bob visible");
  bouton(m.stage, "Distribuer les rôles (2)").click();
  await attendre(() => m.rendus.length === 1 && bob.dernier("round"), "manche d'écriture");
  assert.ok(bouton(m.stage, "Passer au vote"), "libellé de la phase d'écriture");
  bob.envoyer({ t: "input", n: bob.dernier("round").n, data: { texte: "B" } });
  m.rendus[0].api.submit({ texte: "M" });
  await attendre(() => bob.dernier("progress") && bob.dernier("progress").done.length === 2, "deux réponses");

  phase = "vote";
  m.rendus[0].api.newRound();
  await attendre(() => m.rendus.length === 2, "manche de vote");
  const r = bob.dernier("round");
  assert.equal(r.meta.anonymes.length, 2, "les deux réponses, mélangées");
  assert.equal(r.meta.anonymes[r.you.mien].texte, "B", "Bob ne connaît que la sienne");
  assert.ok(bouton(m.stage, "Révéler qui"), "libellé de la phase de vote");

  m.stop();
  bob.fermer();
});
