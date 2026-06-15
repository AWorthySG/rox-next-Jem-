import { getItem, type ExchangeListing, type SelfState } from "@rox/shared";

export interface ExchangeHandlers {
  onBrowse(): void;
  onList(itemId: string, qty: number, unitPrice: number): void;
  onBuy(listingId: number, qty: number): void;
  onCancel(listingId: number): void;
}

// The Exchange Centre: a player marketplace. Browse and buy others' listings,
// list your own items for sale, and cancel your offers. Opened by clicking an
// Exchange Broker NPC; the market is pushed live via ExchangeUpdate.
export class ExchangePanel {
  private root = document.getElementById("exchange")!;
  private zenyEl = document.getElementById("exchange-zeny")!;
  private marketEl = document.getElementById("exchange-market")!;
  private mineEl = document.getElementById("exchange-mine")!;
  private sellEl = document.getElementById("exchange-sell-form")!;
  private listings: ExchangeListing[] = [];
  private self: SelfState | null = null;
  private selfId = -1;
  private sellItemId = "";
  private sellQty = 1;
  private sellPrice = 100;

  constructor(private handlers: ExchangeHandlers) {
    document.getElementById("exchange-close")!.addEventListener("click", () => this.close());
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isOpen) this.close();
    });
  }

  get isOpen(): boolean {
    return !this.root.classList.contains("hidden");
  }

  setSelfId(id: number): void {
    this.selfId = id;
  }

  open(): void {
    this.root.classList.remove("hidden");
    this.handlers.onBrowse();
    this.render();
  }

  close(): void {
    this.root.classList.add("hidden");
  }

  setListings(listings: ExchangeListing[]): void {
    this.listings = listings;
    if (this.isOpen) this.render();
  }

  sync(self: SelfState): void {
    this.self = self;
    if (this.isOpen) this.render();
  }

  private render(): void {
    if (this.self) this.zenyEl.textContent = this.self.zeny.toLocaleString();
    this.renderMarket();
    this.renderMine();
    this.renderSellForm();
  }

  private renderMarket(): void {
    this.marketEl.innerHTML = "";
    const market = this.listings.filter((l) => l.sellerId !== this.selfId);
    if (market.length === 0) {
      this.marketEl.appendChild(emptyRow("No listings on the market yet."));
      return;
    }
    for (const l of market) {
      const item = getItem(l.itemId);
      const row = document.createElement("div");
      row.className = "ex-row";
      const afford = (this.self?.zeny ?? 0) >= l.unitPrice;
      row.innerHTML =
        `<span class="ex-name">${item?.name ?? l.itemId} ×${l.qty}</span>` +
        `<span class="ex-meta">${l.unitPrice.toLocaleString()}z ea · ${l.sellerName}</span>`;
      const qtyInput = numberInput(1, 1, l.qty);
      const buy = document.createElement("button");
      buy.className = `ex-btn${afford ? "" : " dim"}`;
      buy.textContent = "Buy";
      buy.addEventListener("click", () => {
        const q = clampInt(qtyInput.value, 1, l.qty);
        this.handlers.onBuy(l.id, q);
      });
      const controls = document.createElement("div");
      controls.className = "ex-controls";
      controls.append(qtyInput, buy);
      row.appendChild(controls);
      this.marketEl.appendChild(row);
    }
  }

  private renderMine(): void {
    this.mineEl.innerHTML = "";
    const mine = this.listings.filter((l) => l.sellerId === this.selfId);
    if (mine.length === 0) {
      this.mineEl.appendChild(emptyRow("You have no active listings."));
      return;
    }
    for (const l of mine) {
      const item = getItem(l.itemId);
      const row = document.createElement("div");
      row.className = "ex-row";
      row.innerHTML =
        `<span class="ex-name">${item?.name ?? l.itemId} ×${l.qty}</span>` +
        `<span class="ex-meta">${l.unitPrice.toLocaleString()}z ea</span>`;
      const cancel = document.createElement("button");
      cancel.className = "ex-btn cancel";
      cancel.textContent = "Cancel";
      cancel.addEventListener("click", () => this.handlers.onCancel(l.id));
      const controls = document.createElement("div");
      controls.className = "ex-controls";
      controls.appendChild(cancel);
      row.appendChild(controls);
      this.mineEl.appendChild(row);
    }
  }

  private renderSellForm(): void {
    this.sellEl.innerHTML = "";
    const sellable = (this.self?.inventory ?? []).filter((e) => getItem(e.id) && e.qty > 0);
    if (sellable.length === 0) {
      this.sellEl.appendChild(emptyRow("Nothing in your bag to list."));
      return;
    }
    // keep a valid selection
    if (!sellable.some((e) => e.id === this.sellItemId)) this.sellItemId = sellable[0].id;
    const selected = sellable.find((e) => e.id === this.sellItemId)!;

    const select = document.createElement("select");
    select.className = "ex-select";
    for (const e of sellable) {
      const opt = document.createElement("option");
      opt.value = e.id;
      opt.textContent = `${getItem(e.id)!.name} ×${e.qty}`;
      if (e.id === this.sellItemId) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener("change", () => {
      this.sellItemId = select.value;
      this.renderSellForm();
    });

    const qty = numberInput(Math.min(this.sellQty, selected.qty), 1, selected.qty);
    qty.title = "Quantity";
    const price = numberInput(this.sellPrice, 1, 100_000_000);
    price.title = "Price per unit (Zeny)";

    const list = document.createElement("button");
    list.className = "ex-btn list";
    list.textContent = "List for Sale";
    list.addEventListener("click", () => {
      const q = clampInt(qty.value, 1, selected.qty);
      const p = clampInt(price.value, 1, 100_000_000);
      this.sellQty = q;
      this.sellPrice = p;
      this.handlers.onList(this.sellItemId, q, p);
    });

    const labelQty = field("Qty", qty);
    const labelPrice = field("Unit price", price);
    this.sellEl.append(select, labelQty, labelPrice, list);
  }
}

function numberInput(value: number, min: number, max: number): HTMLInputElement {
  const el = document.createElement("input");
  el.type = "number";
  el.className = "ex-num";
  el.min = String(min);
  el.max = String(max);
  el.value = String(value);
  return el;
}

function field(label: string, input: HTMLElement): HTMLLabelElement {
  const l = document.createElement("label");
  l.className = "ex-field";
  l.textContent = label;
  l.appendChild(input);
  return l;
}

function emptyRow(text: string): HTMLDivElement {
  const d = document.createElement("div");
  d.className = "inv-empty";
  d.textContent = text;
  return d;
}

function clampInt(raw: string, min: number, max: number): number {
  const n = Math.floor(Number(raw) || min);
  return Math.min(max, Math.max(min, n));
}
