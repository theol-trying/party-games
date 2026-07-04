import { el, screenHead, shuffle, pick } from "../../ui.js";
import { playersCard } from "../../players.js";
import { PAIRES } from "./data.js";

export function render(container, { game }) {
  container.append(screenHead(game.title, "Distribution secrète · un intrus parmi vous"));
  const stage = el("div");
  container.append(stage);

  let impostorCount = 1;

  stage.append(
    playersCard({ min: 3, cta: "Distribuer les mots", onReady: (names) => setup(names) })
  );

  function setup(players) {
    // Réglage du nombre d'imposteurs
    const maxImp = Math.max(1, Math.floor(players.length / 3));
    const chips = el("div.row", { style: "justify-content:center;margin:12px 0" });
    for (let n = 1; n <= maxImp; n++) {
      const c = el("button.chip", { text: `${n} imposteur${n > 1 ? "s" : ""}` });
      if (n === impostorCount) c.classList.add("is-active");
      c.addEventListener("click", () => {
        impostorCount = n;
        [...chips.children].forEach((x, idx) => x.classList.toggle("is-active", idx + 1 === n));
      });
      chips.appendChild(c);
    }
    stage.replaceChildren(
      el("div.card.center", {}, [
        el("h3", { text: "Combien d'imposteurs ?" }),
        chips,
        el("button.btn.btn--full", { text: "C'est parti", onClick: () => distribute(players) }),
      ])
    );
  }

  function distribute(players) {
    const pair = pick(PAIRES);
    const order = shuffle(players.map((_, i) => i));
    const impostors = new Set(order.slice(0, impostorCount));
    const roles = players.map((name, i) => ({
      name,
      word: impostors.has(i) ? pair.imposteur : pair.civils,
      isImpostor: impostors.has(i),
    }));

    let idx = 0;
    function pass() {
      if (idx >= roles.length) return discussion(roles);
      stage.replaceChildren(
        el("div.card.center", {}, [
          el("p.big-prompt", { text: "📱" }),
          el("p", { text: `Passe le téléphone à ${roles[idx].name}` }),
          el("button.btn.btn--full", { text: "Voir mon mot", style: "margin-top:18px", onClick: showWord }),
        ])
      );
    }
    function showWord() {
      const r = roles[idx];
      stage.replaceChildren(
        el("div.card.center.uc-reveal", {}, [
          el("p.screen__subtitle", { text: r.name + ", ton mot est :" }),
          el("div.uc-word", { text: r.word }),
          el("p.screen__subtitle", { text: "Retiens-le. Ne le montre à personne." }),
          el("button.btn.btn--full", { text: "J'ai vu, cacher →", style: "margin-top:18px", onClick: () => { idx++; pass(); } }),
        ])
      );
    }
    pass();
  }

  function discussion(roles) {
    stage.replaceChildren(
      el("div.card.center", {}, [
        el("h3", { text: "À vous de jouer 🗣️" }),
        el("p", {
          text:
            "Chacun décrit son mot avec UN mot, sans le dire. Débattez, puis votez pour éliminer un suspect. " +
            "Quand vous voulez la vérité :",
          style: "color:var(--text-dim);margin:12px 0 20px",
        }),
        el("button.btn.btn--full", { text: "Révéler les imposteurs", onClick: () => reveal(roles) }),
      ])
    );
  }

  function reveal(roles) {
    stage.replaceChildren(
      el("div.card.center", {}, [
        el("h3", { text: "Résultat", style: "margin-bottom:14px" }),
        el(
          "div.stack",
          {},
          roles.map((r) =>
            el("div.uc-role-row", { class: r.isImpostor ? "uc-role-row is-imp" : "uc-role-row" }, [
              el("span", { text: r.name }),
              el("span", { text: r.isImpostor ? "🕵️ Imposteur — " + r.word : "😇 " + r.word }),
            ])
          )
        ),
        el("button.btn.btn--full", { text: "Rejouer", style: "margin-top:20px", onClick: () => render(clear(), { game }) }),
      ])
    );
  }

  function clear() {
    container.replaceChildren();
    return container;
  }
}
