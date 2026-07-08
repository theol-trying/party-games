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

export function openEditor(container, { gameId, schema, onDone }) {
  let entries = [];
  let editingId = null;

  const selectFields = schema.fields.filter((f) => f.type === "select");
  const textField = schema.fields.find((f) => f.type === "text");
  const controls = {};

  selectFields.forEach((f) => {
    controls[f.key] = el("select.select", {}, f.options.map((o) => el("option", { value: o.v, text: o.l })));
  });
  const textInput = el("input.input", { placeholder: textField.label, maxlength: String(MAX_LEN) });
  const addBtn = el("button.btn", { text: "Ajouter" });
  const bulkArea = el("textarea.input", { rows: "4", placeholder: "Une carte par ligne (reprend les réglages ci-dessus)" });
  const bulkBtn = el("button.btn.btn--ghost", { text: "Ajouter les lignes" });
  const listWrap = el("div.stack.ed-list");
  const countInfo = el("p.screen__subtitle");

  const currentTags = () => {
    const t = {};
    selectFields.forEach((f) => (t[f.key] = controls[f.key].value));
    return t;
  };
  const resetForm = () => { editingId = null; textInput.value = ""; addBtn.textContent = "Ajouter"; };

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
    selectFields.forEach((f) => (controls[f.key].value = e[f.key]));
    textInput.value = e[textField.key];
    addBtn.textContent = "Enregistrer";
    textInput.focus();
  }
  async function remove(e) {
    entries = entries.filter((x) => x.id !== e.id);
    if (editingId === e.id) resetForm();
    await persist();
  }

  addBtn.addEventListener("click", async () => {
    const text = textInput.value.trim().slice(0, MAX_LEN);
    if (!text) return;
    if (editingId) {
      const e = entries.find((x) => x.id === editingId);
      if (e) Object.assign(e, currentTags(), { [textField.key]: text });
    } else {
      entries.push({ id: newId(), ...currentTags(), [textField.key]: text });
    }
    resetForm();
    await persist();
  });
  bulkBtn.addEventListener("click", async () => {
    const lines = bulkArea.value.split("\n").map((s) => s.trim().slice(0, MAX_LEN)).filter(Boolean);
    if (!lines.length) return;
    const tags = currentTags();
    lines.forEach((line) => entries.push({ id: newId(), ...tags, [textField.key]: line }));
    bulkArea.value = "";
    await persist();
  });

  container.replaceChildren(
    el("div", {}, [
      el("div.row.ed-head", { style: "align-items:center;justify-content:space-between;margin-bottom:12px" }, [
        el("h2", { text: "✏️ " + schema.title }),
        el("button.btn.btn--ghost", { text: "← Terminé", onClick: () => onDone && onDone() }),
      ]),
      countInfo,
      el("div.card", {}, [
        el("h3", { text: "Ajouter / modifier" }),
        el("div.row", { style: "margin:10px 0" }, selectFields.map((f) =>
          el("label.ed-field", {}, [el("span.bc-field__label", { text: f.label }), controls[f.key]])
        )),
        el("div.row", {}, [textInput, addBtn]),
        el("details.ed-bulk", { style: "margin-top:12px" }, [
          el("summary", { text: "Coller en masse" }),
          bulkArea,
          bulkBtn,
        ]),
      ]),
      el("div.card", { style: "margin-top:14px" }, [el("h3", { text: "Mes cartes", style: "margin-bottom:10px" }), listWrap]),
    ])
  );

  window.scrollTo({ top: 0 });
  loadContent(gameId).then((list) => { entries = list; renderList(); });
}
