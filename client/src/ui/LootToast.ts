import { rarityOf, type ItemDef } from "@rox/shared";

// A brief rarity-tinted banner for notable drops (rare and above). Common/
// uncommon loot is already covered by the plain chat log line — a toast for
// every gray potion pickup would just be noise, so this only fires for the
// drops worth calling attention to.
export class LootToast {
  private host: HTMLElement;

  constructor() {
    this.host = document.createElement("div");
    this.host.id = "loot-toast-host";
    document.body.appendChild(this.host);
  }

  show(item: ItemDef, qty: number): void {
    const rarity = rarityOf(item);
    if (rarity === "common" || rarity === "uncommon") return;
    const toast = document.createElement("div");
    toast.className = `loot-toast rar-${rarity}`;
    toast.innerHTML =
      `<div class="loot-toast-name">${item.name}${qty > 1 ? ` ×${qty}` : ""}</div>` +
      `<div class="loot-toast-rarity">${rarity}</div>`;
    this.host.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("out");
      setTimeout(() => toast.remove(), 400);
    }, 2800);
  }
}
