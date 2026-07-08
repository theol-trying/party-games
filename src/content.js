/* =========================================================================
   CONTENT — contenu personnalisé + sélection, par jeu et par soirée.

   Deux stockages (via store.js, room-scopés, partagés entre appareils) :
     - "content:<jeu>"      : les cartes perso [{id, ...champs}]
     - "content-cfg:<jeu>"  : { onlyCustom:bool, disabled:{ clé:true } }
         onlyCustom → n'utiliser QUE les cartes perso
         disabled   → cartes exclues (clé = id pour le perso, clé stable pour l'intégré)

   activeCards(...) calcule la liste finale (valeurs prêtes pour createDeck).
   openEditor(...) : CRUD + coller en masse + import/export + choix de source
     + activer/désactiver chaque carte (perso ET intégrée).

   Sécurité : texte only, rendu via nœuds DOM (jamais innerHTML).
   ========================================================================= */

import { el } from "./ui.js";
import { getData, setData } from "./store.js";

const MAX_LEN = 200;

export async function loadContent(gameId) {
  const list = await getData("content:" + gameId, []);
  return Array.isArray(list) ? list : [];
}
export async function saveContent(gameId, entries) {
  await setData("content:" + gameId, entries);
}
export async function loadConfig(gameId) {
  const cfg = await getData("content-cfg:" + gameId, {});
  return { onlyCustom: !!(cfg && cfg.onlyCustom), disabled: (cfg && cfg.disabled) || {} };
}
export async function saveConfig(gameId, cfg) {
  await setData("content-cfg:" + gameId, cfg);
}
export function newId() {
  return "c" + Math.random().toString(36).slice(2, 9);
}

/** Cartes actives = intégrées (sauf si onlyCustom) filtrées + perso filtrées,
    en excluant les clés désactivées. Renvoie des VALEURS prêtes pour le deck. */
export function activeCards({ builtIn = [], custom = [], config = {}, keyOf, customToValue }) {
  const disabled = config.disabled || {};
  const out = [];
  if (!config.onlyCustom) {
    for (const c of builtIn) if (!disabled[keyOf(c)]) out.push(c);
  }
  for (const e of custom) if (!disabled[e.id]) out.push(customToValue ? customToValue(e) : e);
  return out;
}

function sanitizeEntry(raw, schema) {
  if (!raw || typeof raw !== "object") return null;
  const e = { id: newId() };
  for (const f of schema.fields) {
    let v = raw[f.key];
    if (f.type === "select") {
      e[f.key] = f.options.some((o) => o.v === v) ? v : f.options[0].v;
    } else {
      v = typeof v === "string" ? v.trim().slice(0, MAX_LEN) : "";
      if (!v && !f.optional) return null;
      e[f.key] = v;
    }
  }
  return e;
}

export function openEditor(container, { gameId, schema, builtInList = [], onDone }) {
  let entries = [];
  let config = { onlyCustom: false, disabled: {} };
  let editingId = null;

  const fields = schema.fields;
  const textFields = fields.filter((f) => f.type === "text");
  const singleText = textFields.length === 1 ? textFields[0] : null;
  const controls = {};

  const formRows = fields.map((f) => {
    let ctrl;
    if (f.type === "select") ctrl = el("select.select", {}, f.options.map((o) => el("option", { value: o.v, text: o.l })));
    else ctrl = el("input.input", { placeholder: f.label, maxlength: String(MAX_LEN) });
    controls[f.key] = ctrl;
    return el("label.ed-field", {}, [el("span.bc-field__label", { text: f.label }), ctrl]);
  });

  const addBtn = el("button.btn.btn--full", { text: "Ajouter", style: "margin-top:10px" });
  const sourceWrap = el("div");
  const listWrap = el("div.stack.ed-list");
  const builtinWrap = el("div");
  const countInfo = el("p.screen__subtitle");

  const isOff = (key) => !!config.disabled[key];
  async function toggleOff(key) {
    if (config.disabled[key]) delete config.disabled[key];
    else config.disabled[key] = true;
    await saveConfig(gameId, config);
    renderList();
    renderBuiltin();
  }
  async function setOnlyCustom(v) {
    config.onlyCustom = v;
    await saveConfig(gameId, config);
    renderSource();
  }

  const readValues = () => {
    const v = {};
    fields.forEach((f) => (v[f.key] = f.type === "select" ? controls[f.key].value : controls[f.key].value.trim().slice(0, MAX_LEN)));
    return v;
  };
  const valid = (v) => textFields.every((f) => f.optional || v[f.key]);
  const resetForm = () => { editingId = null; textFields.forEach((f) => (controls[f.key].value = "")); addBtn.textContent = "Ajouter"; };

  async function persist() { await saveContent(gameId, entries); renderList(); }

  function offBtn(key) {
    return el("button.chip", { text: isOff(key) ? "🚫" : "👁", title: isOff(key) ? "Activer" : "Désactiver", onClick: () => toggleOff(key) });
  }
  function renderSource() {
    sourceWrap.replaceChildren(
      el("p.screen__subtitle", { text: "Source des cartes", style: "margin-bottom:6px" }),
      el("div.row", { style: "justify-content:center" }, [
        el("button.chip" + (!config.onlyCustom ? ".is-active" : ""), { text: "Intégrées + mes cartes", onClick: () => setOnlyCustom(false) }),
        el("button.chip" + (config.onlyCustom ? ".is-active" : ""), { text: "Mes cartes uniquement", onClick: () => setOnlyCustom(true) }),
      ])
    );
  }
  function renderList() {
    countInfo.textContent = `${entries.length} carte${entries.length > 1 ? "s" : ""} perso`;
    if (!entries.length) {
      listWrap.replaceChildren(el("p.screen__subtitle", { text: "Aucune carte perso pour l'instant." }));
      return;
    }
    listWrap.replaceChildren(
      ...entries.map((e) =>
        el("div.ed-row" + (isOff(e.id) ? ".is-off" : ""), {}, [
          el("span.ed-sum", { text: schema.summary(e) }),
          el("div.row.ed-actions", {}, [
            offBtn(e.id),
            el("button.chip", { text: "✏️", title: "Éditer", onClick: () => startEdit(e) }),
            el("button.chip", { text: "🗑", title: "Supprimer", onClick: () => remove(e) }),
          ]),
        ])
      )
    );
  }
  function renderBuiltin() {
    if (!builtInList.length) { builtinWrap.replaceChildren(); return; }
    const activeN = builtInList.filter((b) => !isOff(b.key)).length;
    builtinWrap.replaceChildren(
      el("details.ed-bulk", {}, [
        el("summary", { text: `Cartes intégrées (${activeN}/${builtInList.length} actives)` }),
        el("div.stack.ed-list", {},
          builtInList.map((b) =>
            el("div.ed-row" + (isOff(b.key) ? ".is-off" : ""), {}, [
              el("span.ed-sum", { text: b.label }),
              el("div.row.ed-actions", {}, [offBtn(b.key)]),
            ])
          )
        ),
      ])
    );
  }
  function startEdit(e) {
    editingId = e.id;
    fields.forEach((f) => (controls[f.key].value = e[f.key] ?? (f.type === "select" ? f.options[0].v : "")));
    addBtn.textContent = "Enregistrer";
    textFields[0] && controls[textFields[0].key].focus();
  }
  async function remove(e) {
    entries = entries.filter((x) => x.id !== e.id);
    if (editingId === e.id) resetForm();
    await persist();
  }

  addBtn.addEventListener("click", async () => {
    const v = readValues();
    if (!valid(v)) return;
    if (editingId) { const e = entries.find((x) => x.id === editingId); if (e) Object.assign(e, v); }
    else entries.push({ id: newId(), ...v });
    resetForm();
    await persist();
  });

  let bulkBlock = null;
  if (singleText) {
    const bulkArea = el("textarea.input", { rows: "4", placeholder: "Une carte par ligne (reprend les réglages ci-dessus)" });
    const bulkBtn = el("button.btn.btn--ghost", { text: "Ajouter les lignes", style: "margin-top:8px" });
    bulkBtn.addEventListener("click", async () => {
      const lines = bulkArea.value.split("\n").map((s) => s.trim().slice(0, MAX_LEN)).filter(Boolean);
      if (!lines.length) return;
      const v = readValues();
      lines.forEach((line) => entries.push({ id: newId(), ...v, [singleText.key]: line }));
      bulkArea.value = "";
      await persist();
    });
    bulkBlock = el("details.ed-bulk", {}, [el("summary", { text: "Coller en masse" }), bulkArea, bulkBtn]);
  }

  const ioArea = el("textarea.input", { rows: "3", placeholder: "Colle ici du JSON pour importer…" });
  const importBtn = el("button.btn.btn--ghost", { text: "Importer", style: "margin-top:8px" });
  const exportBtn = el("button.btn.btn--ghost", { text: "Exporter", style: "margin-top:8px" });
  const ioMsg = el("p.screen__subtitle");
  importBtn.addEventListener("click", async () => {
    let parsed;
    try { parsed = JSON.parse(ioArea.value); } catch { ioMsg.textContent = "JSON invalide."; return; }
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    let added = 0;
    arr.forEach((raw) => { const e = sanitizeEntry(raw, schema); if (e) { entries.push(e); added++; } });
    ioArea.value = "";
    ioMsg.textContent = `${added} carte(s) importée(s).`;
    await persist();
  });
  exportBtn.addEventListener("click", async () => {
    const json = JSON.stringify(entries.map(({ id, ...rest }) => rest), null, 2);
    ioArea.value = json;
    try { await navigator.clipboard.writeText(json); ioMsg.textContent = "Copié dans le presse-papiers."; }
    catch { ioMsg.textContent = "Sélectionne et copie le JSON ci-dessus."; }
  });
  const ioBlock = el("details.ed-bulk", {}, [
    el("summary", { text: "Importer / Exporter (JSON)" }),
    ioArea,
    el("div.row", {}, [importBtn, exportBtn]),
    ioMsg,
  ]);

  container.replaceChildren(
    el("div", {}, [
      el("div.row.ed-head", { style: "align-items:center;justify-content:space-between;margin-bottom:12px" }, [
        el("h2", { text: "✏️ " + schema.title }),
        el("button.btn.btn--ghost", { text: "← Terminé", onClick: () => onDone && onDone() }),
      ]),
      el("div.card", {}, [sourceWrap]),
      countInfo,
      el("div.card", { style: "margin-top:14px" }, [el("h3", { text: "Ajouter / modifier" }), ...formRows, addBtn, bulkBlock, ioBlock]),
      el("div.card", { style: "margin-top:14px" }, [el("h3", { text: "Mes cartes", style: "margin-bottom:10px" }), listWrap]),
      el("div.card", { style: "margin-top:14px", hidden: !builtInList.length }, [el("h3", { text: "Cartes intégrées", style: "margin-bottom:10px" }), builtinWrap]),
    ])
  );

  renderSource();
  renderBuiltin();
  window.scrollTo({ top: 0 });
  Promise.all([loadContent(gameId), loadConfig(gameId)]).then(([list, cfg]) => {
    entries = list;
    config = cfg;
    renderSource();
    renderList();
    renderBuiltin();
  });
}
