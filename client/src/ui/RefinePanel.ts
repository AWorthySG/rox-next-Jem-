import {
  ENCHANT_COST,
  enchantStatLabel,
  EquipSlot,
  getItem,
  MAX_ENCHANT_LINES,
  MAX_REFINE,
  refineBonus,
  refineChance,
  refineCost,
  refineMaterial,
  type EnchantLine,
  type SelfState,
} from "@rox/shared";

export interface RefineHandlers {
  onRefine(slot: EquipSlot): void;
  onEnchant(slot: EquipSlot): void;
  onToggleLock(slot: EquipSlot, index: number): void;
}

const SLOTS: EquipSlot[] = [EquipSlot.Weapon, EquipSlot.Headgear, EquipSlot.Armor, EquipSlot.Accessory];
const SLOT_LABEL: Record<EquipSlot, string> = {
  [EquipSlot.Weapon]: "Weapon",
  [EquipSlot.Headgear]: "Headgear",
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

  // Flash a success/failure banner after a refine attempt.
  showResult(itemName: string, success: boolean, level: number): void {
    let toast = document.getElementById("refine-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "refine-toast";
      this.root.appendChild(toast);
    }
    toast.className = `refine-toast ${success ? "ok" : "fail"}`;
    toast.textContent = success ? `✦ Success!  ${itemName} +${level}` : `✗ Refine failed — ${itemName} stays +${level}`;
    // restart the fade animation
    toast.classList.remove("show");
    void toast.offsetWidth;
    toast.classList.add("show");
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
      const ore = refineMaterial(item);
      const oreName = getItem(ore)?.name ?? ore;
      const oreHave = self.inventory.find((e) => e.id === ore)?.qty ?? 0;
      const chance = Math.round(refineChance(level) * 100);
      const afford = self.zeny >= cost && oreHave >= 1;
      // before -> after stat preview, from the slot-aware bonus (every type gains)
      const cur = refineBonus(item, level);
      const next = refineBonus(item, level + 1);
      const deltas: string[] = [];
      const L: Array<[keyof typeof next, string]> = [["atk", "ATK"], ["matk", "MATK"], ["def", "DEF"], ["maxHp", "HP"]];
      for (const [k, label] of L) if (next[k] > 0) deltas.push(`${label} +${cur[k]}<i>→</i>+${next[k]}`);
      const preview = maxed || deltas.length === 0 ? "" : `<div class="rr-preview">${deltas.join(" · ")}</div>`;
      const meta = maxed
        ? ""
        : `<div class="rr-meta"><span class="${chance < 100 ? "rr-risk" : ""}">${chance}%</span> · ⛏ ${oreName} <b class="${oreHave >= 1 ? "" : "rr-risk"}">${oreHave}</b></div>`;
      row.innerHTML =
        `<div class="rr-info"><span class="rr-name">${item.name} <b class="rr-lv">+${level}</b></span>${preview}${meta}</div>` +
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
