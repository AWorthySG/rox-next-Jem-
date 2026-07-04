import {
  EquipSlot,
  FAMILY_LABEL,
  getItem,
  itemEquippableBy,
  ItemType,
  jobFamilyOf,
  rarityOf,
  type ItemDef,
  type SelfState,
} from "@rox/shared";

export interface InventoryHandlers {
  onUse(itemId: string): void;
  onEquip(itemId: string): void;
  onUnequip(slot: EquipSlot): void;
  onSocket(cardId: string): void;
}

// A small glyph per item, ROX-icon style.
function iconFor(item: ItemDef): string {
  if (item.pet) return "🥚";
  if (item.mount) return "🐎";
  if (item.costume) return "👘";
  if (item.type === ItemType.Card) return "🃏";
  if (item.type === ItemType.Material) return "⛏️";
  if (item.type === ItemType.Consumable) return item.food ? "🍙" : item.healSp ? "🔷" : "🧪";
  if (item.type === ItemType.Weapon) return item.matk ? "🪄" : "⚔️";
  if (item.type === ItemType.Headgear) return "🎩";
  if (item.type === ItemType.Armor) return "🛡️";
  return "💍"; // accessory
}

const SLOT_ORDER: EquipSlot[] = [EquipSlot.Weapon, EquipSlot.Headgear, EquipSlot.Armor, EquipSlot.Accessory];
const SLOT_LABEL: Record<EquipSlot, string> = {
  [EquipSlot.Weapon]: "Weapon",
  [EquipSlot.Headgear]: "Headgear",
  [EquipSlot.Armor]: "Armor",
  [EquipSlot.Accessory]: "Accessory",
};

type Filter = "all" | ItemType;
const TABS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: ItemType.Weapon, label: "Weapon" },
  { id: ItemType.Headgear, label: "Head" },
  { id: ItemType.Armor, label: "Armor" },
  { id: ItemType.Accessory, label: "Accessory" },
  { id: ItemType.Card, label: "Card" },
  { id: ItemType.Material, label: "Mat" },
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
    const cardOf = new Map(self.cards.map((c) => [c.slot, c.id]));

    // equipment slots
    this.slotsEl.innerHTML = "";
    const equippedBySlot = new Map(self.equipped.map((e) => [e.slot, e.id]));
    for (const slot of SLOT_ORDER) {
      const id = equippedBySlot.get(slot);
      const item = id ? getItem(id) : undefined;
      const cell = document.createElement("button");
      cell.className = `equip-cell${item ? ` filled rar-${rarityOf(item)}` : ""}`;
      const refine = item && (refineOf.get(item.id) ?? 0) > 0 ? `<span class="refine-badge">+${refineOf.get(item.id)}</span>` : "";
      const icon = item ? `<span class="iicon">${iconFor(item)}</span>` : "";
      const cardId = cardOf.get(slot);
      const cardName = cardId ? getItem(cardId)?.name : undefined;
      const socket = cardName ? `<span class="socket">🃏 ${cardName}</span>` : "";
      cell.innerHTML =
        `<span class="slot-label">${SLOT_LABEL[slot]}</span>${icon}<span class="slot-item">${item ? item.name : "—"}</span>${socket}${refine}`;
      if (item) {
        cell.title = `${item.desc}\n(click to unequip)`;
        cell.addEventListener("click", () => {
          this.flash(cell);
          this.handlers.onUnequip(slot);
        });
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
      const isCard = item.type === ItemType.Card;
      const isMaterial = item.type === ItemType.Material;
      // Class-restricted equipment the current job can't wear.
      const classLocked = !!item.slot && !itemEquippableBy(item, self.job);
      const reqFam = item.jobs?.length ? jobFamilyOf(item.jobs[0]) : null;
      const lvl = refineOf.get(entry.id) ?? 0;
      const action = isMaterial
        ? ""
        : isCard
          ? "Socket"
          : isConsumable
            ? "Use"
            : classLocked && reqFam
              ? `🔒 ${FAMILY_LABEL[reqFam]}`
              : "Equip";
      const cell = document.createElement("button");
      cell.className = `inv-cell ${item.type} rar-${rarityOf(item)}${isMaterial ? " inert" : ""}${classLocked ? " locked" : ""}`;
      cell.title = classLocked && reqFam ? `${item.desc}\nRequires the ${FAMILY_LABEL[reqFam]} class line.` : item.desc;
      cell.innerHTML =
        `<span class="iicon">${iconFor(item)}</span>` +
        `<span class="iname">${item.name}${lvl > 0 ? ` <span class="refine-badge">+${lvl}</span>` : ""}</span>` +
        `<span class="iqty">×${entry.qty}</span>` +
        `<span class="iact">${action}</span>`;
      if (!isMaterial && !classLocked) {
        cell.addEventListener("click", () => {
          this.flash(cell);
          if (isCard) this.handlers.onSocket(entry.id);
          else if (isConsumable) this.handlers.onUse(entry.id);
          else this.handlers.onEquip(entry.id);
        });
      }
      this.grid.appendChild(cell);
    }
  }

  // Immediate click feedback: the cell is only rebuilt once the server
  // confirms the equip/use/socket on the next sync, same idea as the shop
  // and storage panels' transaction flash.
  private flash(cell: HTMLElement): void {
    cell.classList.add("inv-cell-flash");
    setTimeout(() => cell.classList.remove("inv-cell-flash"), 300);
  }
}

function isTyping(): boolean {
  const a = document.activeElement;
  return !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA");
}
