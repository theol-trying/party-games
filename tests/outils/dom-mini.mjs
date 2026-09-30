/* =========================================================================
   DOM minimal pour faire tourner le moteur multi (src/realtime.js) sous Node.

   Juste ce que le moteur et ui.js utilisent : créer des éléments, les
   imbriquer, lire leur texte, cliquer, chercher par sélecteur simple
   (« button », « .classe », « tag.classe », « [attr="v"] », descendants).
   Pas de mise en page, pas de CSS : on teste la logique, pas l'affichage.
   ========================================================================= */

class Texte {
  constructor(t) { this.nodeType = 3; this.data = String(t); this.parentNode = null; }
  get textContent() { return this.data; }
  set textContent(v) { this.data = String(v); }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
}

class Classes {
  constructor() { this.s = new Set(); }
  add(...c) { c.forEach((x) => this.s.add(x)); }
  remove(...c) { c.forEach((x) => this.s.delete(x)); }
  contains(c) { return this.s.has(c); }
  toggle(c, force) { const on = force === undefined ? !this.s.has(c) : !!force; on ? this.s.add(c) : this.s.delete(c); return on; }
}

const BOOLEENS = ["disabled", "hidden", "open", "checked"];

class Element {
  constructor(tag) {
    this.nodeType = 1;
    this.tagName = String(tag).toUpperCase();
    this.childNodes = [];
    this.parentNode = null;
    this.attrs = new Map();
    this.style = { setProperty(k, v) { this[k] = String(v); }, removeProperty(k) { delete this[k]; }, getPropertyValue(k) { return this[k] || ""; } };
    this.dataset = {};
    this.classList = new Classes();
    this.ecouteurs = {};
    for (const b of BOOLEENS) {
      Object.defineProperty(this, b, {
        get: () => this.attrs.has(b),
        set: (v) => (v ? this.attrs.set(b, "") : this.attrs.delete(b)),
      });
    }
  }
  get children() { return this.childNodes.filter((n) => n.nodeType === 1); }
  get childElementCount() { return this.children.length; }
  get firstElementChild() { return this.children[0] || null; }
  get isConnected() { let n = this; while (n.parentNode) n = n.parentNode; return n === globalThis.document; }
  get className() { return [...this.classList.s].join(" "); }
  set className(v) { this.classList.s = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get id() { return this.attrs.get("id") || ""; }
  set id(v) { this.attrs.set("id", String(v)); }
  get value() { return this.valeur !== undefined ? this.valeur : this.attrs.get("value") || ""; }
  set value(v) { this.valeur = String(v); }
  get textContent() { return this.childNodes.map((n) => n.textContent).join(""); }
  set textContent(v) { this.replaceChildren(); if (v != null && v !== "") this.appendChild(new Texte(v)); }
  get innerText() { return this.textContent; }
  set innerHTML(_) { this.replaceChildren(); }
  get offsetWidth() { return 0; }
  appendChild(n) {
    if (n.parentNode) n.parentNode.removeChild(n);
    n.parentNode = this;
    this.childNodes.push(n);
    return n;
  }
  append(...ns) { ns.forEach((n) => this.appendChild(typeof n === "string" ? new Texte(n) : n)); }
  prepend(...ns) {
    const nodes = ns.map((n) => (typeof n === "string" ? new Texte(n) : n));
    nodes.forEach((n) => { if (n.parentNode) n.parentNode.removeChild(n); n.parentNode = this; });
    this.childNodes.unshift(...nodes);
  }
  removeChild(n) { const i = this.childNodes.indexOf(n); if (i >= 0) this.childNodes.splice(i, 1); n.parentNode = null; return n; }
  insertBefore(n, ref) {
    if (!ref) return this.appendChild(n);
    if (n.parentNode) n.parentNode.removeChild(n);
    const i = this.childNodes.indexOf(ref);
    n.parentNode = this;
    this.childNodes.splice(i < 0 ? this.childNodes.length : i, 0, n);
    return n;
  }
  replaceWith(n) {
    const p = this.parentNode;
    if (!p) return;
    p.insertBefore(n, this);
    p.removeChild(this);
  }
  contains(n) { for (let x = n; x; x = x.parentNode) if (x === this) return true; return false; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  replaceChildren(...ns) { this.childNodes.slice().forEach((c) => this.removeChild(c)); this.append(...ns); }
  setAttribute(k, v) {
    if (k === "class") this.className = v;
    else this.attrs.set(k, String(v));
  }
  getAttribute(k) { return k === "class" ? this.className : this.attrs.has(k) ? this.attrs.get(k) : null; }
  hasAttribute(k) { return this.attrs.has(k); }
  removeAttribute(k) { this.attrs.delete(k); }
  addEventListener(t, f) { (this.ecouteurs[t] ||= []).push(f); }
  removeEventListener(t, f) { this.ecouteurs[t] = (this.ecouteurs[t] || []).filter((x) => x !== f); }
  dispatchEvent(e) {
    e.target ||= this;
    e.currentTarget = this;
    (this.ecouteurs[e.type] || []).slice().forEach((f) => f(e));
    return true;
  }
  click() {
    if (this.disabled) return;
    this.dispatchEvent({ type: "click", preventDefault() {}, stopPropagation() {} });
  }
  focus() {}
  blur() {}
  getContext() { return null; }
  getBoundingClientRect() { return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }; }
  animate() { return { finished: Promise.resolve(), cancel() {}, onfinish: null }; }
  get descendants() {
    const out = [];
    const tour = (n) => n.children.forEach((c) => { out.push(c); tour(c); });
    tour(this);
    return out;
  }
  querySelectorAll(sel) {
    const etapes = sel.trim().split(/\s+/).map(analyser);
    return this.descendants.filter((n) => correspond(n, etapes, this));
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}

function analyser(compose) {
  const m = { tag: null, classes: [], attrs: [] };
  const re = /^([a-z0-9-]+)|\.([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]/gi;
  let x;
  while ((x = re.exec(compose))) {
    if (x[1]) m.tag = x[1].toUpperCase();
    else if (x[2]) m.classes.push(x[2]);
    else if (x[3]) m.attrs.push([x[3], x[4]]);
  }
  return m;
}
function simple(n, m) {
  if (m.tag && n.tagName !== m.tag) return false;
  if (!m.classes.every((c) => n.classList.contains(c))) return false;
  return m.attrs.every(([k, v]) => {
    const val = k.startsWith("data-") ? n.dataset[k.slice(5).replace(/-(\w)/g, (_, c) => c.toUpperCase())] ?? n.getAttribute(k) : n.getAttribute(k);
    return v === undefined ? val != null : val === v;
  });
}
function correspond(n, etapes, racine) {
  if (!simple(n, etapes[etapes.length - 1])) return false;
  let i = etapes.length - 2;
  let p = n.parentNode;
  while (i >= 0 && p && p !== racine.parentNode) {
    if (p.nodeType === 1 && simple(p, etapes[i])) i--;
    p = p.parentNode;
  }
  return i < 0;
}

class Stockage {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
  clear() { this.m.clear(); }
}

/** Installe window/document/localStorage… ; `origine` = serveur de test. */
export function installerDom(origine) {
  const document = new Element("#document");
  document.head = document.appendChild(new Element("head"));
  document.body = document.appendChild(new Element("body"));
  document.createElement = (t) => new Element(t);
  document.createElementNS = (_, t) => new Element(t);
  document.createTextNode = (t) => new Texte(t);
  document.getElementById = (id) => document.descendants.find((n) => n.id === id) || null;
  document.visibilityState = "visible";
  const u = new URL(origine);
  const location = { protocol: u.protocol, host: u.host, origin: u.origin, pathname: "/", hash: "" };
  const win = {
    scrollY: 0,
    scrollTo() {},
    addEventListener() {},
    removeEventListener() {},
    confirm: () => true,
    prompt: () => null,
    location,
  };
  Object.assign(globalThis, { document, window: win, location, localStorage: new Stockage(), sessionStorage: new Stockage() });
  // fetch("/api/…") : chemins relatifs résolus vers le serveur de test.
  const fetchNatif = globalThis.fetch;
  globalThis.fetch = (url, opts) => fetchNatif(typeof url === "string" && url.startsWith("/") ? origine + url : url, opts);
  return document;
}

/** Bouton (ou lien) de `racine` dont le texte contient `texte`. */
export function bouton(racine, texte) {
  return racine.querySelectorAll("button").find((b) => b.textContent.includes(texte)) || null;
}
