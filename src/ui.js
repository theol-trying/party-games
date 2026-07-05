/* =========================================================================
   UI — petits helpers partagés par tous les jeux.
   Volontairement minimal (pas de framework) pour rester éditable facilement.
   ========================================================================= */

/** Crée un élément DOM. tag "div.classe#id", props, enfants (string/Node/array). */
export function el(spec, props = {}, children = []) {
  const [tagAndClasses, id] = spec.split("#");
  const [tag, ...classes] = tagAndClasses.split(".");
  const node = document.createElement(tag || "div");
  if (id) node.id = id;
  if (classes.length) node.className = classes.join(" ");

  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === "dataset") {
      Object.assign(node.dataset, v);
    } else {
      node.setAttribute(k, v);
    }
  }

  appendChildren(node, children);
  return node;
}

function appendChildren(node, children) {
  const list = Array.isArray(children) ? children : [children];
  for (const c of list) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
}

/** En-tête standard d'un écran de jeu, avec bouton retour vers l'accueil. */
export function screenHead(title, subtitle) {
  return el("header.screen__head", {}, [
    el("a.screen__back", { href: "#/", "aria-label": "Retour", text: "←" }),
    el("div", {}, [
      el("div.screen__title", { text: title }),
      subtitle ? el("div.screen__subtitle", { text: subtitle }) : null,
    ]),
  ]);
}

/** Mélange un tableau (Fisher-Yates), sans muter l'original. */
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Élément aléatoire d'un tableau. */
export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Annonce un message aux lecteurs d'écran via la région aria-live persistante
    (#a11y-live dans index.html, qui survit aux remplacements de #app). */
export function announce(message) {
  const region = document.getElementById("a11y-live");
  if (!region) return;
  region.textContent = "";
  // Décale la mise à jour pour forcer la relecture même si le texte est identique.
  requestAnimationFrame(() => {
    region.textContent = message;
  });
}

/** Remplace le contenu d'un conteneur de phase :
    - réinitialise le scroll en haut (sinon la nouvelle phase reste hors écran),
    - rejoue l'animation d'entrée.
    Accepte un ou plusieurs nœuds. */
export function showPhase(container, ...nodes) {
  container.replaceChildren(...nodes);
  container.classList.remove("phase-in");
  void container.offsetWidth; // reflow pour rejouer l'anim
  container.classList.add("phase-in");
  window.scrollTo({ top: 0 });
}

/** Charge (une seule fois) la feuille de style propre à un jeu. */
export function ensureGameStyle(gameId) {
  const href = `src/games/${gameId}/style.css`;
  if (document.querySelector(`link[data-game-style="${gameId}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.gameStyle = gameId;
  // Si le fichier n'existe pas encore, l'erreur est silencieuse — pas bloquant.
  link.onerror = () => link.remove();
  document.head.appendChild(link);
}
