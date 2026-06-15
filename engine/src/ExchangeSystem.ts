import { getItem, ItemType, MsgType, type ExchangeListing } from "@rox/shared";
import type { World } from "./World.js";
import type { Player } from "./Player.js";

// The Exchange Centre: a server-wide player marketplace. Sellers list items at a
// per-unit Zeny price (the items are held in escrow on the listing); any other
// player can buy whole or partial stacks. The seller is paid the proceeds minus
// a small tax. Listings live in memory for the session.
const MAX_LISTINGS_PER_PLAYER = 12;
const MAX_UNIT_PRICE = 100_000_000;
const TAX_RATE = 0.05; // 5% marketplace fee on the seller's proceeds

interface Listing extends ExchangeListing {}

export class ExchangeSystem {
  private listings = new Map<number, Listing>();
  private nextId = 1;

  constructor(private world: World) {}

  // ---- queries ----

  snapshot(): ExchangeListing[] {
    return [...this.listings.values()]
      .map((l) => ({ ...l }))
      .sort((a, b) => a.itemId.localeCompare(b.itemId) || a.unitPrice - b.unitPrice);
  }

  private listingCountFor(playerId: number): number {
    let n = 0;
    for (const l of this.listings.values()) if (l.sellerId === playerId) n++;
    return n;
  }

  // ---- mutations ----

  // List `qty` of `itemId` at `unitPrice` each. Items are escrowed off the bag.
  list(seller: Player, itemId: string, qty: number, unitPrice: number): boolean {
    const item = getItem(itemId);
    if (!item) return false;
    // Materials/cards are tradeable; only the truly untradeable (none yet) would
    // be blocked here. Quest-bound items could be excluded in future.
    if (item.type === ItemType.Consumable && item.mount) return false; // mounts are bound
    qty = Math.floor(qty);
    unitPrice = Math.floor(unitPrice);
    if (qty <= 0 || unitPrice <= 0 || unitPrice > MAX_UNIT_PRICE) return false;
    if (this.listingCountFor(seller.id) >= MAX_LISTINGS_PER_PLAYER) return false;
    if (seller.countItem(itemId) < qty) return false;
    if (!seller.takeItem(itemId, qty)) return false; // escrow

    const id = this.nextId++;
    this.listings.set(id, { id, sellerId: seller.id, sellerName: seller.name, itemId, qty, unitPrice });
    this.broadcast();
    return true;
  }

  // Cancel a listing and return the escrowed items to the owner.
  cancel(player: Player, listingId: number): boolean {
    const l = this.listings.get(listingId);
    if (!l || l.sellerId !== player.id) return false;
    player.addItem(l.itemId, l.qty);
    this.listings.delete(listingId);
    this.broadcast();
    return true;
  }

  // Buy up to `qty` units of a listing. Pays the seller (minus tax) if online.
  buy(buyer: Player, listingId: number, qty: number): boolean {
    const l = this.listings.get(listingId);
    if (!l) return false;
    if (l.sellerId === buyer.id) return false; // cancel your own listings instead
    qty = Math.min(Math.floor(qty), l.qty);
    if (qty <= 0) return false;
    const cost = l.unitPrice * qty;
    if (buyer.zeny < cost) return false;

    buyer.zeny -= cost;
    buyer.addItem(l.itemId, qty);
    const proceeds = Math.max(0, Math.floor(cost * (1 - TAX_RATE)));
    const seller = this.world.players.get(l.sellerId);
    if (seller) {
      seller.zeny += proceeds;
      const item = getItem(l.itemId);
      this.world.connections.get(seller.connId)?.send({
        t: MsgType.ChatBroadcast,
        fromId: 0,
        name: "Exchange",
        text: `Sold ${qty}× ${item?.name ?? l.itemId} for ${proceeds}z (after tax).`,
      });
    }

    l.qty -= qty;
    if (l.qty <= 0) this.listings.delete(listingId);
    this.broadcast();
    return true;
  }

  // ---- net ----

  sendTo(player: Player): void {
    this.world.connections.get(player.connId)?.send({ t: MsgType.ExchangeUpdate, listings: this.snapshot() });
  }

  // Push the live marketplace to everyone (clients only render it if open).
  private broadcast(): void {
    this.world.broadcast({ t: MsgType.ExchangeUpdate, listings: this.snapshot() });
  }
}
