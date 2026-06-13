import { getItem, SHOP_STOCK, type SelfState } from "@rox/shared";

export interface ShopHandlers {
  onBuy(itemId: string): void;
  onSell(itemId: string): void;
}

// Town shop: buy stocked goods or sell loot for Zeny. Opened by clicking the
// shop NPC; re-renders from each SelfSync while open.
export class ShopPanel {
  private root = document.getElementById("shop")!;
  private buyList = document.getElementById("shop-buy-list")!;
  private sellList = document.getElementById("shop-sell-list")!;
  private zenyEl = document.getElementById("shop-zeny")!;
  private last: SelfState | null = null;

  constructor(private handlers: ShopHandlers) {
    document.getElementById("shop-close")!.addEventListener("click", () => this.close());
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

    this.buyList.innerHTML = "";
    for (const id of SHOP_STOCK) {
      const item = getItem(id);
      if (!item || item.price == null) continue;
      const afford = self.zeny >= item.price;
      const row = document.createElement("button");
      row.className = `shop-row${afford ? "" : " dim"}`;
      row.title = item.desc;
      row.innerHTML = `<span class="sr-name">${item.name}</span><span class="sr-price">${item.price}z</span>`;
      row.addEventListener("click", () => this.handlers.onBuy(id));
      this.buyList.appendChild(row);
    }

    this.sellList.innerHTML = "";
    const sellable = self.inventory.filter((e) => getItem(e.id)?.sellPrice != null);
    if (sellable.length === 0) {
      const empty = document.createElement("div");
      empty.className = "inv-empty";
      empty.textContent = "Nothing to sell.";
      this.sellList.appendChild(empty);
    }
    for (const entry of sellable) {
      const item = getItem(entry.id)!;
      const row = document.createElement("button");
      row.className = "shop-row";
      row.title = item.desc;
      row.innerHTML =
        `<span class="sr-name">${item.name} ×${entry.qty}</span><span class="sr-price">${item.sellPrice}z</span>`;
      row.addEventListener("click", () => this.handlers.onSell(entry.id));
      this.sellList.appendChild(row);
    }
  }
}
