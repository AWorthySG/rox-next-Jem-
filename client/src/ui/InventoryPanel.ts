import { EquipSlot, getItem, ItemType, rarityOf, type SelfState } from "@rox/shared";

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

type Filter = "all" | ItemType;
const TABS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: ItemType.Weapon, label: "Weapon" },
  { id: ItemType.Armor, label: "Armor" },
  { id: ItemType.Accessory, label: "Accessory" },
  { id: ItemType.Consumable, label: "Use" },
];

// Toggleable bag + equipment panel (key "I"), styled like the ROX gear screen:
// category tab pills, item slots with +refine badges, equipment slots up top.
export class InventoryPanel {
  private root = document.getElementById("inventory")!;
  private grid = document.getElementById("inv-grid")!;
  private slotsEl = document.getElementById("equip-slots")!;
  private tabsEl = document.getElementById("inv-tabs")!;
  private zenyEl = document.getElementById("inv-zeny")!;
  private last: SelfState | null = null;
  private filter: Filter = "all";

  constructor(private handlers: InventoryHandlers) {
    document.getElementById("inv-close")!.addEventListener("click", () => this.close());
    this.buildTabs();
    window.addEventListener("keydown", (e) => {
      if (isTyping()) return;
      if (e.key === "i" || e.key === "I") this.toggle();
      else if (e.key === "Escape" && this.isOpen) this.close();
    });
  }

  private buildTabs(): void {
    this.tabsEl.innerHTML = "";
    for (const tab of TABS) {
      const btn = document.createElement("button");
      btn.className = `inv-tab${tab.id === this.filter ? " active" : ""}`;
      btn.textContent = tab.label;
      btn.dataset.tab = tab.id;
      btn.addEventListener("click", () => {
        this.filter = tab.id;
        this.buildTabs();
        if (this.last) this.render(this.last);
      });
      this.tabsEl.appendChild(btn);
    }
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
    const refineOf = new Map(self.refine.map((r) => [r.id, r.level]));

    // equipment slots
    this.slotsEl.innerHTML = "";
    const equippedBySlot = new Map(self.equipped.map((e) => [e.slot, e.id]));
    for (const slot of SLOT_ORDER) {
      const id = equippedBySlot.get(slot);
      const item = id ? getItem(id) : undefined;
      const cell = document.createElement("button");
      cell.className = `equip-cell${item ? ` filled rar-${rarityOf(item)}` : ""}`;
      const refine = item && (refineOf.get(item.id) ?? 0) > 0 ? `<span class="refine-badge">+${refineOf.get(item.id)}</span>` : "";
      cell.innerHTML =
        `<span class="slot-label">${SLOT_LABEL[slot]}</span><span class="slot-item">${item ? item.name : "—"}</span>${refine}`;
      if (item) {
        cell.title = `${item.desc}\n(click to unequip)`;
        cell.addEventListener("click", () => this.handlers.onUnequip(slot));
      }
      this.slotsEl.appendChild(cell);
    }

    // bag (filtered)
    this.grid.innerHTML = "";
    const entries = self.inventory.filter((e) => {
      const item = getItem(e.id);
      return item && (this.filter === "all" || item.type === this.filter);
    });
    if (entries.length === 0) {
      const empty = document.createElement("div");
      empty.className = "inv-empty";
      empty.textContent = "No items in this category.";
      this.grid.appendChild(empty);
      return;
    }
    for (const entry of entries) {
      const item = getItem(entry.id);
      if (!item) continue;
      const isConsumable = item.type === ItemType.Consumable;
      const lvl = refineOf.get(entry.id) ?? 0;
      const cell = document.createElement("button");
      cell.className = `inv-cell ${item.type} rar-${rarityOf(item)}`;
      cell.title = item.desc;
      cell.innerHTML =
        `<span class="iname">${item.name}${lvl > 0 ? ` <span class="refine-badge">+${lvl}</span>` : ""}</span>` +
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
