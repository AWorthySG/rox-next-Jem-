import { QUESTS, type SelfState } from "@rox/shared";

// A compact always-on HUD list of the player's active quests with progress, so
// objectives are visible without opening the quest board. Re-rendered on each
// SelfSync; hidden when there are no active quests.
export class QuestTracker {
  private root: HTMLElement;
  private sig = "";

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.id = "quest-tracker";
    this.root.className = "hidden";
    parent.appendChild(this.root);
  }

  sync(self: SelfState): void {
    const active = self.quests.active;
    // only rebuild when the visible state actually changes
    const sig = active.map((q) => `${q.id}:${q.progress}`).join("|");
    if (sig === this.sig) return;
    this.sig = sig;

    if (active.length === 0) {
      this.root.classList.add("hidden");
      this.root.innerHTML = "";
      return;
    }
    this.root.classList.remove("hidden");
    this.root.innerHTML =
      `<div class="qt-title">Quests</div>` +
      active
        .map((q) => {
          const def = QUESTS[q.id];
          if (!def) return "";
          const done = Math.min(q.progress, def.count);
          const pct = def.count ? (done / def.count) * 100 : 0;
          const ready = done >= def.count;
          return (
            `<div class="qt-row${ready ? " ready" : ""}">` +
            `<div class="qt-name">${def.name}</div>` +
            `<div class="qt-bar"><i style="width:${pct}%"></i></div>` +
            `<div class="qt-count">${done}/${def.count} ${def.targetName}${ready ? " ✓" : ""}</div>` +
            `</div>`
          );
        })
        .join("");
  }
}
