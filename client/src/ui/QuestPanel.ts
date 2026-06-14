import { getItem, QUESTS, type SelfState } from "@rox/shared";

export interface QuestHandlers {
  onAccept(questId: string): void;
  onClaim(questId: string): void;
}

// The Guide's quest board: accept kill-quests, watch progress, and claim rewards.
// Re-renders from each SelfSync while open.
export class QuestPanel {
  private root = document.getElementById("quests")!;
  private list = document.getElementById("quest-list")!;
  private last: SelfState | null = null;

  constructor(private handlers: QuestHandlers) {
    document.getElementById("quests-close")!.addEventListener("click", () => this.close());
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isOpen) this.close();
    });
  }

  get isOpen(): boolean {
    return !this.root.classList.contains("hidden");
  }

  open(): void {
    this.root.classList.remove("hidden");
    if (this.last) this.render(this.last);
  }

  close(): void {
    this.root.classList.add("hidden");
  }

  sync(self: SelfState): void {
    this.last = self;
    if (this.isOpen) this.render(self);
  }

  private render(self: SelfState): void {
    const activeMap = new Map(self.quests.active.map((q) => [q.id, q.progress]));
    const completed = new Set(self.quests.completed);

    this.list.innerHTML = "";
    for (const quest of Object.values(QUESTS)) {
      const row = document.createElement("div");
      row.className = "quest-row";
      const rewardItems = (quest.reward.items ?? [])
        .map((i) => `${getItem(i.id)?.name ?? i.id}${i.qty > 1 ? `×${i.qty}` : ""}`)
        .join(", ");
      const reward = `${quest.reward.exp} EXP · ${quest.reward.zeny}z${rewardItems ? ` · ${rewardItems}` : ""}`;

      let status = "";
      let action = "";
      if (completed.has(quest.id)) {
        row.classList.add("done");
        status = "✓ Completed";
      } else if (activeMap.has(quest.id)) {
        const progress = activeMap.get(quest.id)!;
        const ready = progress >= quest.count;
        status = `Progress: ${Math.min(progress, quest.count)}/${quest.count}`;
        action = ready ? `<button class="quest-btn claim" data-claim="${quest.id}">Claim</button>` : "";
        if (ready) row.classList.add("ready");
      } else if (self.level >= quest.requiredLevel) {
        action = `<button class="quest-btn" data-accept="${quest.id}">Accept</button>`;
      } else {
        row.classList.add("locked");
        status = `Requires Lv ${quest.requiredLevel}`;
      }

      const repeatTag = quest.repeatable ? ` <span class="quest-repeat">↻ Repeatable</span>` : "";
      row.innerHTML =
        `<div class="quest-main"><div class="quest-name">${quest.name}${repeatTag}</div>` +
        `<div class="quest-desc">${quest.desc}</div>` +
        `<div class="quest-meta">Slay ${quest.count} ${quest.targetName} · Reward: ${reward}</div>` +
        `<div class="quest-status">${status}</div></div><div class="quest-act">${action}</div>`;
      this.list.appendChild(row);
    }

    this.list.querySelectorAll<HTMLButtonElement>("[data-accept]").forEach((b) =>
      b.addEventListener("click", () => this.handlers.onAccept(b.dataset.accept!)),
    );
    this.list.querySelectorAll<HTMLButtonElement>("[data-claim]").forEach((b) =>
      b.addEventListener("click", () => this.handlers.onClaim(b.dataset.claim!)),
    );
  }
}
