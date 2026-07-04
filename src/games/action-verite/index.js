import { el, screenHead, pick } from "../../ui.js";
import { VERITES, ACTIONS } from "./data.js";

export function render(container, { game }) {
  let intensity = "soft"; // "soft" | "hot"

  const promptBox = el("div.big-prompt.av-prompt", { text: "Prêt·e ? Choisis Action ou Vérité." });
  const tag = el("div.av-tag");

  function draw(kind) {
    const pool = kind === "verite" ? VERITES[intensity] : ACTIONS[intensity];
    promptBox.textContent = pick(pool);
    promptBox.classList.remove("av-flash");
    void promptBox.offsetWidth; // reflow pour rejouer l'anim
    promptBox.classList.add("av-flash");
    tag.textContent = kind === "verite" ? "🗣️ Vérité" : "🔥 Action";
    tag.dataset.kind = kind;
  }

  const softChip = el("button.chip.is-active", { text: "😇 Soft" });
  const hotChip = el("button.chip", { text: "🌶️ Hot" });
  softChip.addEventListener("click", () => setIntensity("soft"));
  hotChip.addEventListener("click", () => setIntensity("hot"));
  function setIntensity(v) {
    intensity = v;
    softChip.classList.toggle("is-active", v === "soft");
    hotChip.classList.toggle("is-active", v === "hot");
  }

  container.append(
    screenHead(game.title, "Intensité réglable · appuie sur un bouton"),
    el("div.card.av-card", {}, [
      el("div.row", { style: "justify-content:center;margin-bottom:18px" }, [softChip, hotChip]),
      tag,
      promptBox,
      el("div.row", { style: "justify-content:center;margin-top:22px" }, [
        el("button.btn.av-btn-verite", { text: "Vérité", onClick: () => draw("verite") }),
        el("button.btn.av-btn-action", { text: "Action", onClick: () => draw("action") }),
      ]),
    ])
  );
}
