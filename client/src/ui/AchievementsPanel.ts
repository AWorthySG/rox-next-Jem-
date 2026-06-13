import { allAchievements, type SelfState } from "@rox/shared";

// Achievements window (key "V"): shows unlocked/locked milestones. Read-only;
// progress is tracked server-side and surfaced via SelfState.
export class AchievementsPanel {
  private root = document.getElementById("achievements")!;
  private list = document.getElementById("ach-list")!;
  private last: SelfState | null = null;

  constructor() {
    document.getElementById("ach-close")!.addEventListener("click", () => this.close());
    window.addEventListener("keydown", (e) => {
      if (isTyping()) return;
      if (e.key === "v" || e.key === "V") this.toggle();
      else if (e.key === "Escape" && !this.root.classList.contains("hidden")) this.close();
    });
  }

  private get isOpen(): boolean {
    return !this.root.classList.contains("hidden");
  }

  toggle(): void {
    this.root.classList.toggle("hidden");
    if (this.isOpen && this.last) this.render(this.last);
  }

  close(): void {
    this.root.classList.add("hidden");
  }

  sync(self: SelfState): void {
    this.last = self;
    if (this.isOpen) this.render(self);
  }

  private render(self: SelfState): void {
    const done = new Set(self.achievements);
    const total = allAchievements().length;
    this.list.innerHTML = `<div class="ach-count">${done.size} / ${total} unlocked</div>`;
    for (const a of allAchievements()) {
      const unlocked = done.has(a.id);
      const row = document.createElement("div");
      row.className = `ach-row${unlocked ? " done" : ""}`;
      row.innerHTML =
        `<div class="ach-main"><div class="ach-name">${unlocked ? "★ " : "☆ "}${a.name}</div>` +
        `<div class="ach-desc">${a.desc}</div></div>` +
        `<div class="ach-reward">${a.rewardZeny}z</div>`;
      this.list.appendChild(row);
    }
  }
}

function isTyping(): boolean {
  const el = document.activeElement;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
}
