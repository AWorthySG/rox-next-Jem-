import { getItem, ItemType, rarityOf, type ItemDef, type SelfState } from "@rox/shared";

export interface StorageHandlers {
  onStore(itemId: string, qty: number): void;
  onRetrieve(itemId: string, qty: number): void;
}

// A small glyph per item, matching the bag panel.
function iconFor(item: ItemDef): string {
  if (item.pet) return "🥚";
  if (item.mount) return "🐎";
  if (item.type === ItemType.Card) return "🃏";
  if (item.type === ItemType.Consumable) return item.healSp ? "🔷" : "🧪";
  if (item.type === ItemType.Weapon) return item.matk ? "🪄" : "⚔️";
  if (item.type === ItemType.Headgear) return "🎩";
  if (item.type === ItemType.Armor) return "🛡️";
  return "💍";
}

// Kafra Storage (key "B"): a persistent item bank. Left column is your bag
// (click to deposit), right column is storage (click to withdraw). Hold Shift to
// move a whole stack instead of one. Re-renders from each SelfSync while open.
export class StoragePanel {
  private root = document.getElementById("storage")!;
  private bagEl = document.getElementById("storage-bag")!;
  private storeEl = document.getElementById("storage-vault")!;
  private last: SelfState | null = null;

  constructor(private handlers: StorageHandlers) {
    document.getElementById("storage-close")!.addEventListener("click", () => this.close());
    window.addEventListener("keydown", (e) => {
      if (isTyping()) return;
      if (e.key === "b" || e.key === "B") this.toggle();
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
    this.fill(this.bagEl, self.inventory, "store");
    this.fill(this.storeEl, self.storage ?? [], "retrieve");
  }

  private fill(
    container: HTMLElement,
    entries: Array<{ id: string; qty: number }>,
    action: "store" | "retrieve",
  ): void {
    container.innerHTML = "";
    const list = entries.filter((e) => getItem(e.id));
    if (list.length === 0) {
      const empty = document.createElement("div");
      empty.className = "inv-empty";
      empty.textContent = action === "store" ? "Bag is empty." : "Storage is empty.";
      container.appendChild(empty);
      return;
    }
    for (const entry of list) {
      const item = getItem(entry.id)!;
      const cell = document.createElement("button");
      cell.className = `inv-cell ${item.type} rar-${rarityOf(item)}`;
      cell.title = `${item.desc}\n(click: 1 · shift-click: all)`;
      cell.innerHTML =
        `<span class="iicon">${iconFor(item)}</span>` +
        `<span class="iname">${item.name}</span>` +
        `<span class="iqty">×${entry.qty}</span>` +
        `<span class="iact">${action === "store" ? "Deposit ▸" : "◂ Withdraw"}</span>`;
      cell.addEventListener("click", (ev) => {
        // immediate feedback: the cell is torn down and rebuilt only once the
        // server confirms the move on the next sync, which would otherwise
        // read as an unresponsive click during that round-trip
        cell.classList.add("inv-cell-flash");
        setTimeout(() => cell.classList.remove("inv-cell-flash"), 300);
        const qty = ev.shiftKey ? entry.qty : 1;
        if (action === "store") this.handlers.onStore(entry.id, qty);
        else this.handlers.onRetrieve(entry.id, qty);
      });
      container.appendChild(cell);
    }
  }
}

function isTyping(): boolean {
  const a = document.activeElement;
  return !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA");
}
