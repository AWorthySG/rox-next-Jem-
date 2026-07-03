import { QUESTS, type SelfState } from "@rox/shared";

// A compact always-on HUD list of the player's active quests with progress, so
// objectives are visible without opening the quest board. Re-rendered on each
// SelfSync; hidden when there are no active quests.
export class QuestTracker {
  private root: HTMLElement;
  private sig = "";
  private readySeen = new Set<string>(); // quest ids already flashed complete once

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
      this.readySeen.clear();
      return;
    }
    this.root.classList.remove("hidden");
    const activeIds = new Set(active.map((q) => q.id));
    for (const id of this.readySeen) if (!activeIds.has(id)) this.readySeen.delete(id); // turned in / dropped
    this.root.innerHTML =
      `<div class="qt-title">Quests</div>` +
      active
        .map((q) => {
          const def = QUESTS[q.id];
          if (!def) return "";
          const done = Math.min(q.progress, def.count);
          const pct = def.count ? (done / def.count) * 100 : 0;
          const ready = done >= def.count;
          // flash once the moment a quest first reaches completion, not on
          // every re-render while it stays ready waiting to be turned in
          const justCompleted = ready && !this.readySeen.has(q.id);
          if (ready) this.readySeen.add(q.id);
          return (
            `<div class="qt-row${ready ? " ready" : ""}${justCompleted ? " just-completed" : ""}">` +
            `<div class="qt-name">${def.name}</div>` +
            `<div class="qt-bar"><i style="width:${pct}%"></i></div>` +
            `<div class="qt-count">${done}/${def.count} ${def.targetName}${ready ? " ✓" : ""}</div>` +
            `</div>`
          );
        })
        .join("");
  }
}
