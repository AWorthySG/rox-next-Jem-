import { allAchievements, type SelfState } from "@rox/shared";

// Achievements window (key "V"): shows unlocked/locked milestones. Read-only;
// progress is tracked server-side and surfaced via SelfState.
export class AchievementsPanel {
  private root = document.getElementById("achievements")!;
  private list = document.getElementById("ach-list")!;
  private last: SelfState | null = null;
  private knownUnlocked: Set<string> | null = null; // null until the first sync, so we don't toast every existing unlock on load
  private toastHost: HTMLElement;

  constructor() {
    document.getElementById("ach-close")!.addEventListener("click", () => this.close());
    window.addEventListener("keydown", (e) => {
      if (isTyping()) return;
      if (e.key === "v" || e.key === "V") this.toggle();
      else if (e.key === "Escape" && !this.root.classList.contains("hidden")) this.close();
    });
    this.toastHost = document.createElement("div");
    this.toastHost.id = "ach-toast-host";
    document.body.appendChild(this.toastHost);
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
    if (this.knownUnlocked === null) {
      // first sync after login: seed from whatever's already unlocked, so we
      // don't fire a toast for every past achievement on page load
      this.knownUnlocked = new Set(self.achievements);
    } else {
      for (const id of self.achievements) {
        if (!this.knownUnlocked.has(id)) {
          this.knownUnlocked.add(id);
          this.showToast(id);
        }
      }
    }
    if (this.isOpen) this.render(self);
  }

  // A brief on-screen banner the instant an achievement unlocks, even if the
  // achievements window isn't open — the panel alone would only surface it
  // the next time the player thinks to check.
  private showToast(id: string): void {
    const def = allAchievements().find((a) => a.id === id);
    if (!def) return;
    const toast = document.createElement("div");
    toast.className = "ach-toast";
    toast.innerHTML =
      `<div class="ach-toast-title">Achievement Unlocked</div>` +
      `<div class="ach-toast-name">★ ${def.name}</div>` +
      `<div class="ach-toast-reward">+${def.rewardZeny}z</div>`;
    this.toastHost.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("out");
      setTimeout(() => toast.remove(), 400);
    }, 3200);
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
