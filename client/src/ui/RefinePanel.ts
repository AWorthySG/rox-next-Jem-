import {
  ENCHANT_COST,
  enchantStatLabel,
  EquipSlot,
  getItem,
  MAX_ENCHANT_LINES,
  MAX_REFINE,
  refineBonus,
  refineCost,
  type EnchantLine,
  type SelfState,
} from "@rox/shared";

export interface RefineHandlers {
  onRefine(slot: EquipSlot): void;
  onEnchant(slot: EquipSlot): void;
  onToggleLock(slot: EquipSlot, index: number): void;
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
    const enchantMap = new Map((self.enchants ?? []).map((e) => [e.id, e.lines]));

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
      // before -> after stat preview
      const cur = refineBonus(item, level);
      const next = refineBonus(item, level + 1);
      const deltas: string[] = [];
      if (item.atk) deltas.push(`ATK +${cur.atk}<i>→</i>+${next.atk}`);
      if (item.matk) deltas.push(`MATK +${cur.matk}<i>→</i>+${next.matk}`);
      if (item.def) deltas.push(`DEF +${cur.def}<i>→</i>+${next.def}`);
      if (item.maxHp) deltas.push(`HP +${cur.maxHp}<i>→</i>+${next.maxHp}`);
      const preview = maxed || deltas.length === 0 ? "" : `<div class="rr-preview">${deltas.join(" · ")}</div>`;
      row.innerHTML =
        `<div class="rr-info"><span class="rr-name">${item.name} <b class="rr-lv">+${level}</b></span>${preview}</div>` +
        (maxed
          ? `<span class="rr-max">MAX</span>`
          : `<button class="refine-btn${afford ? "" : " dim"}" data-slot="${slot}">⚒ ${cost.toLocaleString()}z</button>`);
      this.list.appendChild(row);
      this.list.appendChild(this.enchantBlock(slot, enchantMap.get(id) ?? [], self.zeny >= ENCHANT_COST));
    }

    this.list.querySelectorAll<HTMLButtonElement>(".refine-btn[data-slot]").forEach((b) =>
      b.addEventListener("click", () => this.handlers.onRefine(b.dataset.slot as EquipSlot)),
    );
    this.list.querySelectorAll<HTMLButtonElement>(".enchant-btn[data-slot]").forEach((b) =>
      b.addEventListener("click", () => this.handlers.onEnchant(b.dataset.slot as EquipSlot)),
    );
    this.list.querySelectorAll<HTMLButtonElement>(".ench-line[data-slot]").forEach((b) =>
      b.addEventListener("click", () =>
        this.handlers.onToggleLock(b.dataset.slot as EquipSlot, Number(b.dataset.idx)),
      ),
    );
  }

  // "Overall Rating" enchant lines for one equipped item: tap a line to lock it
  // (locked lines survive a re-roll), then pay Zeny to re-roll the rest.
  private enchantBlock(slot: EquipSlot, lines: EnchantLine[], afford: boolean): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "ench-block";
    const rows: string[] = [];
    for (let i = 0; i < MAX_ENCHANT_LINES; i++) {
      const line = lines[i];
      if (line) {
        rows.push(
          `<button class="ench-line${line.locked ? " locked" : ""}" data-slot="${slot}" data-idx="${i}">` +
            `<span class="el-lock">${line.locked ? "🔒" : "🔓"}</span>` +
            `<span class="el-stat">${enchantStatLabel(line.stat)}</span>` +
            `<span class="el-val">+${line.value}</span></button>`,
        );
      } else {
        rows.push(`<div class="ench-line empty"><span class="el-stat">— empty slot —</span></div>`);
      }
    }
    const verb = lines.length ? "Re-roll" : "Enchant";
    wrap.innerHTML =
      `<div class="ench-lines">${rows.join("")}</div>` +
      `<button class="enchant-btn${afford ? "" : " dim"}" data-slot="${slot}">✦ ${verb} · ${ENCHANT_COST.toLocaleString()}z</button>`;
    return wrap;
  }
}
