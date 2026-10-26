/* =========================================================================
   Anonymat du dépôt (public) : aucune donnée personnelle. Le test n'autorise
   que les adresses noreply et refuse toute autre adresse e-mail et tout
   chemin de session Windows, dans les fichiers comme dans les commits de
   toutes les refs (tout l'historique en local, le dernier commit en CI).
   ========================================================================= */

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const AUTORISEES = new Set([
  "290863944+theol-trying@users.noreply.github.com", // identité des commits
  "noreply@github.com", // commits faits depuis le site GitHub
  "noreply@anthropic.com", // ligne Co-Authored-By
]);
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const CHEMIN_SESSION = new RegExp("[A-Za-z]:[\\\\/]+Users[\\\\/]+", "i");
const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

let dansUnDepot = true;
try { git("rev-parse", "--git-dir"); } catch { dansUnDepot = false; }

test("anonymat : auteurs et committers de tous les commits accessibles", { skip: !dansUnDepot && "pas de dépôt git" }, () => {
  const identites = new Set(git("log", "--all", "--format=%ae%n%ce").split("\n").filter(Boolean));
  for (const e of identites) assert.ok(AUTORISEES.has(e.toLowerCase()), `adresse de commit non autorisée : ${e}`);
});

test("anonymat : messages de commit sans adresse ni chemin de session", { skip: !dansUnDepot && "pas de dépôt git" }, () => {
  const messages = git("log", "--all", "--format=%B");
  for (const e of messages.match(EMAIL) || []) assert.ok(AUTORISEES.has(e.toLowerCase()), `adresse dans un message de commit : ${e}`);
  assert.ok(!CHEMIN_SESSION.test(messages), "chemin de session Windows dans un message de commit");
});

test("anonymat : fichiers suivis sans adresse e-mail ni chemin de session", { skip: !dansUnDepot && "pas de dépôt git" }, () => {
  for (const f of git("ls-files").split("\n").filter(Boolean)) {
    const texte = fs.readFileSync(f, "utf8");
    for (const e of texte.match(EMAIL) || []) assert.ok(AUTORISEES.has(e.toLowerCase()), `${f} : adresse e-mail ${e}`);
    assert.ok(!CHEMIN_SESSION.test(texte), `${f} : chemin de session Windows`);
  }
});
