import { EquipSlot, getItem, MAX_REFINE, refineCost, type SelfState } from "@rox/shared";

export interface RefineHandlers {
  onRefine(slot: EquipSlot): void;
}

const SLOTS: EquipSlot[] = [EquipSlot.Weapon, EquipSlot.Armor, EquipSlot.Accessory];
const SLOT_LABEL: Record<EquipSlot, string> = {
  [EquipSlot.Weapon]: "Weapon",
  [EquipSlot.Armor]: "Armor",
  [EquipSlot.Accessory]: "Accessory",
};

// Blacksmith: upgrade equipped gear with Zeny. Each refine adds flat ATK/MATK/
// DEF/HP. Re-renders from each SelfSync while open.
export class RefinePanel {
  private root = document.getElementById("refine")!;
  private list = document.getElementById("refine-list")!;
  private zenyEl = document.getElementById("refine-zeny")!;
  private last: SelfState | null = null;

  constructor(private handlers: RefineHandlers) {
    document.getElementById("refine-close")!.addEventListener("click", () => this.close());
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
    this.zenyEl.textContent = self.zeny.toLocaleString();
    const equippedBySlot = new Map(self.equipped.map((e) => [e.slot, e.id]));
    const refineMap = new Map(self.refine.map((r) => [r.id, r.level]));

    this.list.innerHTML = "";
    for (const slot of SLOTS) {
      const id = equippedBySlot.get(slot);
      const item = id ? getItem(id) : undefined;
      const row = document.createElement("div");
      row.className = "refine-row";
      if (!item || !id) {
        row.classList.add("empty");
        row.innerHTML = `<span class="rr-name">${SLOT_LABEL[slot]}: —</span>`;
        this.list.appendChild(row);
        continue;
      }
      const level = refineMap.get(id) ?? 0;
      const maxed = level >= MAX_REFINE;
      const cost = refineCost(level);
      const afford = self.zeny >= cost;
      row.innerHTML =
        `<span class="rr-name">${item.name} <b class="rr-lv">+${level}</b></span>` +
        (maxed
          ? `<span class="rr-max">MAX</span>`
          : `<button class="refine-btn${afford ? "" : " dim"}" data-slot="${slot}">+1 · ${cost}z</button>`);
      this.list.appendChild(row);
    }

    this.list.querySelectorAll<HTMLButtonElement>("[data-slot]").forEach((b) =>
      b.addEventListener("click", () => this.handlers.onRefine(b.dataset.slot as EquipSlot)),
    );
  }
}
