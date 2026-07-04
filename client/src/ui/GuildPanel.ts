import { getItem, ItemType, JOB_NAME, rarityOf, type GuildInfo, type ItemDef, type SelfState } from "@rox/shared";

export interface GuildHandlers {
  onCreate(name: string): void;
  onJoin(name: string): void;
  onLeave(): void;
  onStore(itemId: string, qty: number): void;
  onRetrieve(itemId: string, qty: number): void;
}

// A small glyph per item, matching the bag/storage panels.
function iconFor(item: ItemDef): string {
  if (item.pet) return "🥚";
  if (item.mount) return "🐎";
  if (item.costume) return "👘";
  if (item.type === ItemType.Card) return "🃏";
  if (item.type === ItemType.Consumable) return item.healSp ? "🔷" : "🧪";
  if (item.type === ItemType.Weapon) return item.matk ? "🪄" : "⚔️";
  if (item.type === ItemType.Headgear) return "🎩";
  if (item.type === ItemType.Armor) return "🛡️";
  return "💍";
}

// Guild window (key "G"): create or join a guild by name, or view the roster,
// level/EXP progress, shared storage, and leave. Driven by GuildUpdate
// messages plus each SelfSync (for the bag half of the storage view).
export class GuildPanel {
  private root = document.getElementById("guild")!;
  private body = document.getElementById("guild-body")!;
  private guild: GuildInfo | null = null;
  private selfId = -1;
  private inventory: Array<{ id: string; qty: number }> = [];

  constructor(private handlers: GuildHandlers) {
    document.getElementById("guild-close")!.addEventListener("click", () => this.close());
    window.addEventListener("keydown", (e) => {
      if (isTyping() && (e.key === "g" || e.key === "G")) return;
      if (e.key === "g" || e.key === "G") this.toggle();
      else if (e.key === "Escape" && this.isOpen) this.close();
    });
  }

  setSelf(id: number): void {
    this.selfId = id;
  }

  sync(self: SelfState): void {
    this.inventory = self.inventory;
    if (this.isOpen) this.render();
  }

  get isOpen(): boolean {
    return !this.root.classList.contains("hidden");
  }

  toggle(): void {
    this.root.classList.toggle("hidden");
    if (this.isOpen) this.render();
  }

  close(): void {
    this.root.classList.add("hidden");
  }

  setGuild(guild: GuildInfo | null): void {
    this.guild = guild;
    if (this.isOpen) this.render();
  }

  private render(): void {
    this.body.innerHTML = "";
    if (!this.guild) {
      this.body.innerHTML = `
        <p class="guild-hint">You are not in a guild.</p>
        <label class="field"><span>Create a guild</span>
          <div class="guild-row"><input id="guild-create-name" maxlength="20" placeholder="Guild name" />
          <button class="quest-btn" id="guild-create-btn">Create</button></div>
        </label>
        <label class="field"><span>Join a guild</span>
          <div class="guild-row"><input id="guild-join-name" maxlength="20" placeholder="Existing guild name" />
          <button class="quest-btn" id="guild-join-btn">Join</button></div>
        </label>`;
      const createName = this.body.querySelector("#guild-create-name") as HTMLInputElement;
      const joinName = this.body.querySelector("#guild-join-name") as HTMLInputElement;
      this.body.querySelector("#guild-create-btn")!.addEventListener("click", () => {
        if (createName.value.trim()) this.handlers.onCreate(createName.value.trim());
      });
      this.body.querySelector("#guild-join-btn")!.addEventListener("click", () => {
        if (joinName.value.trim()) this.handlers.onJoin(joinName.value.trim());
      });
      return;
    }

    const rows = this.guild.members
      .map((m) => {
        const lead = m.id === this.guild!.masterId ? "★ " : "";
        const you = m.id === this.selfId ? " (you)" : "";
        return `<div class="guild-member">${lead}${m.name}${you} <span class="pm-job">Lv${m.level} ${JOB_NAME[m.job]}</span></div>`;
      })
      .join("");
    const expPct = this.guild.expToNext > 0 && isFinite(this.guild.expToNext) ? Math.min(100, Math.round((this.guild.exp / this.guild.expToNext) * 100)) : 100;
    this.body.innerHTML =
      `<div class="guild-title">⚑ ${this.guild.name} <span class="pm-job">(${this.guild.members.length})</span></div>` +
      `<div class="guild-level">Guild Lv ${this.guild.level}` +
      `<div class="guild-exp-bar"><div class="guild-exp-fill" style="width:${expPct}%"></div></div>` +
      `<span class="pm-job">${this.guild.exp}/${isFinite(this.guild.expToNext) ? this.guild.expToNext : "MAX"} EXP</span></div>` +
      `<div class="guild-members">${rows}</div>` +
      `<div class="storage-cols">` +
      `<div class="storage-col"><h4>Bag</h4><div class="storage-grid" id="guild-bag"></div></div>` +
      `<div class="storage-col"><h4>Guild Storage</h4><div class="storage-grid" id="guild-vault"></div></div>` +
      `</div>` +
      `<button class="party-leave" id="guild-leave-btn">Leave Guild</button>`;
    this.body.querySelector("#guild-leave-btn")!.addEventListener("click", () => this.handlers.onLeave());
    this.fill(this.body.querySelector("#guild-bag") as HTMLElement, this.inventory, "store");
    this.fill(this.body.querySelector("#guild-vault") as HTMLElement, this.guild!.storage, "retrieve");
  }

  private fill(container: HTMLElement, entries: Array<{ id: string; qty: number }>, action: "store" | "retrieve"): void {
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
