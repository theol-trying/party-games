/* =========================================================================
   CONTENT — contenu personnalisé (« Mes cartes »), par jeu et par soirée.

   Stocké via store.js (clé "content:<jeu>") : persisté et PARTAGÉ entre les
   appareils d'une même soirée (room). Le jeu fusionne ce contenu avec son
   data.js intégré au moment de construire ses paquets (deck).

   Sécurité : tout est du texte, rendu via des nœuds DOM (jamais innerHTML).

   Éditeur générique piloté par un schéma :
     schema = {
       title,
       fields: [{ key, label, type:'select'|'text', options?:[{v,l}] }],
       summary: (entry) => "…",   // ligne affichée dans la liste
     }
   Prend en charge plusieurs champs texte (ex. Tu préfères A/B, Undercover paires,
   Quiz QCM). Le « coller en masse » n'est proposé que s'il y a un seul champ texte.
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
export function newId() {
  return "c" + Math.random().toString(36).slice(2, 9);
}

// Normalise une entrée importée : ne garde que les clés du schéma, valide les
// selects, exige les champs texte non vides. Renvoie null si invalide.
function sanitizeEntry(raw, schema) {
  if (!raw || typeof raw !== "object") return null;
  const e = { id: newId() };
  for (const f of schema.fields) {
    let v = raw[f.key];
    if (f.type === "select") {
      const ok = f.options.some((o) => o.v === v);
      e[f.key] = ok ? v : f.options[0].v;
    } else {
      v = typeof v === "string" ? v.trim().slice(0, MAX_LEN) : "";
      if (!v) return null; // champ texte obligatoire
      e[f.key] = v;
    }
  }
  return e;
}

export function openEditor(container, { gameId, schema, onDone }) {
  let entries = [];
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
  const listWrap = el("div.stack.ed-list");
  const countInfo = el("p.screen__subtitle");

  const readValues = () => {
    const v = {};
    fields.forEach((f) => {
      v[f.key] = f.type === "select" ? controls[f.key].value : controls[f.key].value.trim().slice(0, MAX_LEN);
    });
    return v;
  };
  const valid = (v) => textFields.every((f) => v[f.key]);
  const resetForm = () => {
    editingId = null;
    textFields.forEach((f) => (controls[f.key].value = ""));
    addBtn.textContent = "Ajouter";
  };

  async function persist() {
    await saveContent(gameId, entries);
    renderList();
  }
  function renderList() {
    countInfo.textContent = `${entries.length} carte${entries.length > 1 ? "s" : ""} perso`;
    if (!entries.length) {
      listWrap.replaceChildren(el("p.screen__subtitle", { text: "Aucune carte perso pour l'instant." }));
      return;
    }
    listWrap.replaceChildren(
      ...entries.map((e) =>
        el("div.ed-row", {}, [
          el("span.ed-sum", { text: schema.summary(e) }),
          el("div.row.ed-actions", {}, [
            el("button.chip", { text: "✏️", title: "Éditer", onClick: () => startEdit(e) }),
            el("button.chip", { text: "🗑", title: "Supprimer", onClick: () => remove(e) }),
          ]),
        ])
      )
    );
  }
  function startEdit(e) {
    editingId = e.id;
    fields.forEach((f) => (controls[f.key].value = e[f.key] ?? (f.type === "select" ? f.options[0].v : "")));
    addBtn.textContent = "Enregistrer";
    (textFields[0] && controls[textFields[0].key].focus());
  }
  async function remove(e) {
    entries = entries.filter((x) => x.id !== e.id);
    if (editingId === e.id) resetForm();
    await persist();
  }

  addBtn.addEventListener("click", async () => {
    const v = readValues();
    if (!valid(v)) return;
    if (editingId) {
      const e = entries.find((x) => x.id === editingId);
      if (e) Object.assign(e, v);
    } else {
      entries.push({ id: newId(), ...v });
    }
    resetForm();
    await persist();
  });

  /* ---- Coller en masse (uniquement si un seul champ texte) ---- */
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

  /* ---- Import / Export JSON ---- */
  const ioArea = el("textarea.input", { rows: "3", placeholder: "Colle ici du JSON pour importer…" });
  const importBtn = el("button.btn.btn--ghost", { text: "Importer", style: "margin-top:8px" });
  const exportBtn = el("button.btn.btn--ghost", { text: "Exporter", style: "margin-top:8px" });
  const ioMsg = el("p.screen__subtitle");
  importBtn.addEventListener("click", async () => {
    let parsed;
    try {
      parsed = JSON.parse(ioArea.value);
    } catch {
      ioMsg.textContent = "JSON invalide.";
      return;
    }
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    let added = 0;
    arr.forEach((raw) => {
      const e = sanitizeEntry(raw, schema);
      if (e) { entries.push(e); added++; }
    });
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
      countInfo,
      el("div.card", {}, [el("h3", { text: "Ajouter / modifier" }), ...formRows, addBtn, bulkBlock, ioBlock]),
      el("div.card", { style: "margin-top:14px" }, [el("h3", { text: "Mes cartes", style: "margin-bottom:10px" }), listWrap]),
    ])
  );

  window.scrollTo({ top: 0 });
  loadContent(gameId).then((list) => { entries = list; renderList(); });
}
