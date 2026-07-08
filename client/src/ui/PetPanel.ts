import {
  getPet,
  PET_INTIMACY_PER_LEVEL,
  PET_LEVEL_CAP,
  PET_SKILL_UNLOCK_LEVEL,
  type SelfState,
} from "@rox/shared";

export interface PetHandlers {
  onFeed(): void;
}

// The active pet's panel: shows its level, an intimacy bar toward the next
// level, its signature skill (once learned), and a Feed button. Re-renders
// from each SelfSync while open.
export class PetPanel {
  private root = document.getElementById("pet-panel")!;
  private body = document.getElementById("pet-body")!;
  private last: SelfState | null = null;

  constructor(private handlers: PetHandlers) {
    document.getElementById("pet-close")!.addEventListener("click", () => this.close());
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isOpen) this.close();
    });
  }

  get isOpen(): boolean {
    return !this.root.classList.contains("hidden");
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
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
    const info = self.petInfo;
    this.body.innerHTML = "";
    if (!info) {
      this.body.innerHTML = `<div class="pet-empty">No active pet. Use a pet egg from your bag to summon one.</div>`;
      return;
    }
    const treats = self.inventory.find((i) => i.id === "pet_treat")?.qty ?? 0;
    const intoLevel = info.intimacy % PET_INTIMACY_PER_LEVEL;
    const pct = info.level >= PET_LEVEL_CAP ? 100 : Math.round((intoLevel / PET_INTIMACY_PER_LEVEL) * 100);
    const pet = getPet(info.id);
    const skillLine = info.skillName
      ? `<div class="pet-skill">⚔ ${info.skillName}${info.skillReady ? " · ready" : ""}</div>`
      : `<div class="pet-skill dim">Learns ${pet?.skill?.name ?? "its skill"} at Lv${PET_SKILL_UNLOCK_LEVEL}</div>`;
    this.body.innerHTML =
      `<div class="pet-name">${info.name} <span class="pet-lvl">Lv${info.level}${info.level >= PET_LEVEL_CAP ? " (max)" : ""}</span></div>` +
      `<div class="pet-bar"><div class="pet-bar-fill" style="width:${pct}%"></div></div>` +
      `<div class="pet-intimacy">Intimacy ${info.intimacy} · ${pct}% to next</div>` +
      skillLine +
      `<button class="quest-btn${treats > 0 ? "" : " dim"}" id="pet-feed" ${treats > 0 ? "" : "disabled"}>Feed (${treats} treats)</button>`;
    const feed = this.body.querySelector("#pet-feed");
    feed?.addEventListener("click", () => this.handlers.onFeed());
  }
}
