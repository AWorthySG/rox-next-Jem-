import { EquipSlot, getItem, ItemType, type SelfState } from "@rox/shared";

export interface InventoryHandlers {
  onUse(itemId: string): void;
  onEquip(itemId: string): void;
  onUnequip(slot: EquipSlot): void;
}

const SLOT_ORDER: EquipSlot[] = [EquipSlot.Weapon, EquipSlot.Armor, EquipSlot.Accessory];
const SLOT_LABEL: Record<EquipSlot, string> = {
  [EquipSlot.Weapon]: "Weapon",
  [EquipSlot.Armor]: "Armor",
  [EquipSlot.Accessory]: "Accessory",
};

// Toggleable bag + equipment panel (key "I"). Click a consumable to use it, a
// piece of gear to equip it, or an equipped slot to take it off. The server is
// authoritative; the panel re-renders from each SelfSync while open.
export class InventoryPanel {
  private root = document.getElementById("inventory")!;
  private grid = document.getElementById("inv-grid")!;
  private slotsEl = document.getElementById("equip-slots")!;
  private zenyEl = document.getElementById("inv-zeny")!;
  private last: SelfState | null = null;

  constructor(private handlers: InventoryHandlers) {
    document.getElementById("inv-close")!.addEventListener("click", () => this.close());
    window.addEventListener("keydown", (e) => {
      if (isTyping()) return;
      if (e.key === "i" || e.key === "I") this.toggle();
      else if (e.key === "Escape" && this.isOpen) this.close();
    });
  }

  get isOpen(): boolean {
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
    this.zenyEl.textContent = self.zeny.toLocaleString();

    // equipment slots
    this.slotsEl.innerHTML = "";
    const equippedBySlot = new Map(self.equipped.map((e) => [e.slot, e.id]));
    for (const slot of SLOT_ORDER) {
      const id = equippedBySlot.get(slot);
      const item = id ? getItem(id) : undefined;
      const cell = document.createElement("button");
      cell.className = `equip-cell${item ? " filled" : ""}`;
      cell.innerHTML = `<span class="slot-label">${SLOT_LABEL[slot]}</span><span class="slot-item">${item ? item.name : "—"}</span>`;
      if (item) {
        cell.title = `${item.desc}\n(click to unequip)`;
        cell.addEventListener("click", () => this.handlers.onUnequip(slot));
      }
      this.slotsEl.appendChild(cell);
    }

    // bag
    this.grid.innerHTML = "";
    if (self.inventory.length === 0) {
      const empty = document.createElement("div");
      empty.className = "inv-empty";
      empty.textContent = "Your bag is empty. Defeat monsters to find loot!";
      this.grid.appendChild(empty);
      return;
    }
    for (const entry of self.inventory) {
      const item = getItem(entry.id);
      if (!item) continue;
      const isConsumable = item.type === ItemType.Consumable;
      const cell = document.createElement("button");
      cell.className = `inv-cell ${item.type}`;
      cell.title = item.desc;
      cell.innerHTML =
        `<span class="iname">${item.name}</span>` +
        `<span class="iqty">×${entry.qty}</span>` +
        `<span class="iact">${isConsumable ? "Use" : "Equip"}</span>`;
      cell.addEventListener("click", () => {
        if (isConsumable) this.handlers.onUse(entry.id);
        else this.handlers.onEquip(entry.id);
      });
      this.grid.appendChild(cell);
    }
  }
}

function isTyping(): boolean {
  const a = document.activeElement;
  return !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA");
}
