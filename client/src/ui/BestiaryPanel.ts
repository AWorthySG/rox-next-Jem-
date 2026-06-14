import { Element, ELEMENT_ICON, ELEMENT_LABEL, type SelfState } from "@rox/shared";
import type { DexEntry, GameState } from "../state/GameState.js";

// Monster Codex (key "N"): a handbook of every species the player has met, with
// their level, element and a running kill tally. Reads the live monster registry
// from GameState and merges in server-authoritative kill counts from SelfSync.
export class BestiaryPanel {
  private root = document.getElementById("bestiary")!;
  private list = document.getElementById("bestiary-list")!;
  private countEl = document.getElementById("bestiary-count")!;
  private kills = new Map<string, number>();

  constructor(private gameState: GameState) {
    document.getElementById("bestiary-close")!.addEventListener("click", () => this.close());
    window.addEventListener("keydown", (e) => {
      if (isTyping()) return;
      if (e.key === "n" || e.key === "N") this.toggle();
      else if (e.key === "Escape" && this.isOpen) this.close();
    });
  }

  get isOpen(): boolean {
    return !this.root.classList.contains("hidden");
  }

  toggle(): void {
    this.root.classList.toggle("hidden");
    if (this.isOpen) this.render();
  }

  close(): void {
    this.root.classList.add("hidden");
  }

  sync(self: SelfState): void {
    this.kills = new Map((self.killCounts ?? []).map((k) => [k.id, k.count]));
    if (this.isOpen) this.render();
  }

  private render(): void {
    const entries = [...this.gameState.monsterDex.values()].sort(
      (a, b) => Number(b.boss) - Number(a.boss) || a.level - b.level || a.name.localeCompare(b.name),
    );
    this.countEl.textContent = String(entries.length);
    this.list.innerHTML = "";
    if (entries.length === 0) {
      const empty = document.createElement("div");
      empty.className = "inv-empty";
      empty.textContent = "No monsters discovered yet — go explore!";
      this.list.appendChild(empty);
      return;
    }
    for (const e of entries) this.list.appendChild(this.row(e));
  }

  private row(e: DexEntry): HTMLElement {
    const el = e.element as Element;
    const elemTag = el && el !== Element.Neutral ? `${ELEMENT_ICON[el] ?? ""} ${ELEMENT_LABEL[el] ?? ""}` : "Neutral";
    const kills = this.kills.get(e.templateId) ?? 0;
    const row = document.createElement("div");
    row.className = `bestiary-row${e.boss ? " boss" : ""}`;
    row.innerHTML =
      `<span class="bx-name">${e.boss ? "👑 " : ""}${e.name}</span>` +
      `<span class="bx-lv">Lv${e.level}</span>` +
      `<span class="bx-elem">${elemTag}</span>` +
      `<span class="bx-kills">${kills > 0 ? `☠ ${kills}` : "—"}</span>`;
    return row;
  }
}

function isTyping(): boolean {
  const a = document.activeElement;
  return !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA");
}
