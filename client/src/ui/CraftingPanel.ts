import {
  getItem,
  LIFE_SKILL_LABEL,
  LIFE_SKILLS,
  RECIPES,
  type CraftSkillId,
  type SelfState,
} from "@rox/shared";

export interface CraftingHandlers {
  onCraft(recipeId: string): void;
}

const CRAFT_SECTIONS: CraftSkillId[] = ["cooking", "smelting", "crafting"];

// Workshop panel (the "Cook" and "Forge" NPCs): shows life-skill levels, the
// gathering stamina pool, and recipes grouped by craft skill. Recipes the
// player is under-leveled for (or short ingredients for) are greyed out.
// Re-renders from each SelfSync while open.
export class CraftingPanel {
  private root = document.getElementById("crafting")!;
  private levelsEl = document.getElementById("crafting-levels")!;
  private listEl = document.getElementById("crafting-list")!;
  private last: SelfState | null = null;

  constructor(private handlers: CraftingHandlers) {
    document.getElementById("crafting-close")!.addEventListener("click", () => this.close());
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
    const levelOf = new Map(self.lifeSkills.map((s) => [s.id, s]));
    this.levelsEl.innerHTML =
      LIFE_SKILLS.map((id) => {
        const s = levelOf.get(id);
        return `<span class="ls-chip">${LIFE_SKILL_LABEL[id]} Lv${s?.level ?? 1}</span>`;
      }).join("") +
      `<span class="ls-chip ls-stamina">Stamina ${self.stamina}/${self.staminaMax}</span>`;

    const bag = new Map(self.inventory.map((e) => [e.id, e.qty]));
    const have = (id: string) => bag.get(id) ?? 0;
    this.listEl.innerHTML = "";
    for (const skill of CRAFT_SECTIONS) {
      const header = document.createElement("div");
      header.className = "craft-section";
      header.textContent = LIFE_SKILL_LABEL[skill];
      this.listEl.appendChild(header);
      for (const recipe of Object.values(RECIPES)) {
        if (recipe.skill !== skill) continue;
        const skillLevel = levelOf.get(skill)?.level ?? 1;
        const unlocked = skillLevel >= recipe.minLevel;
        const canCraft = unlocked && recipe.inputs.every((i) => have(i.itemId) >= i.qty);
        const ingredients = recipe.inputs
          .map((i) => {
            const short = have(i.itemId) < i.qty;
            return `<span class="${short ? "craft-short" : ""}">${getItem(i.itemId)?.name ?? i.itemId} ${have(i.itemId)}/${i.qty}</span>`;
          })
          .join(", ");
        const lock = unlocked ? "" : ` <span class="craft-short">(needs ${LIFE_SKILL_LABEL[skill]} Lv${recipe.minLevel})</span>`;
        const row = document.createElement("div");
        row.className = "craft-row";
        row.innerHTML =
          `<div class="craft-main"><div class="craft-name">${recipe.name}${lock}</div>` +
          `<div class="craft-desc">${recipe.desc}</div>` +
          `<div class="craft-ingredients">${ingredients}</div></div>` +
          `<button class="quest-btn${canCraft ? "" : " dim"}" ${canCraft ? "" : "disabled"}>Craft</button>`;
        row.querySelector("button")!.addEventListener("click", () => {
          row.classList.add("inv-cell-flash");
          setTimeout(() => row.classList.remove("inv-cell-flash"), 300);
          this.handlers.onCraft(recipe.id);
        });
        this.listEl.appendChild(row);
      }
    }
  }
}
