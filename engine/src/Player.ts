import {
  addStats,
  canAdvanceTo,
  deriveStats,
  EntityKind,
  EquipSlot,
  getItem,
  getQuest,
  JOB_BASE_STATS,
  JOB_GROWTH,
  JobId,
  ItemType,
  isMagicJob,
  xpToNext,
  type DerivedStats,
  type EntityFull,
  type EntitySnapshot,
  type SelfState,
  type Stats,
} from "@rox/shared";

export class Player {
  readonly id: number;
  readonly connId: number;
  name: string;
  job: JobId;
  colorSeed: number;

  x: number;
  z: number;
  facing = 0;

  level = 1;
  exp = 0;
  zeny = 0;
  stats: Stats;
  derived: DerivedStats;
  hp: number;
  sp: number;

  inventory: Record<string, number> = {}; // itemId -> qty
  equipped: Partial<Record<EquipSlot, string>> = {}; // slot -> itemId
  partyId: number | null = null;
  activeQuests: Record<string, number> = {}; // questId -> kill progress
  completedQuests: string[] = [];

  // intents
  moveTarget: { x: number; z: number } | null = null;
  attackTargetId: number | null = null;
  attackCooldown = 0; // ms remaining
  pendingSkillId: string | null = null;
  pendingSkillTargetId: number | null = null;
  skillCooldowns: Record<string, number> = {}; // skillId -> ms remaining

  constructor(id: number, connId: number, name: string, job: JobId, x: number, z: number) {
    this.id = id;
    this.connId = connId;
    this.name = name;
    this.job = job;
    this.colorSeed = Math.floor(Math.random() * 360);
    this.x = x;
    this.z = z;
    this.stats = { ...JOB_BASE_STATS[job] };
    this.derived = deriveStats(this.stats, this.level, this.job);
    this.hp = this.derived.maxHp;
    this.sp = this.derived.maxSp;
  }

  get isMagic(): boolean {
    return isMagicJob(this.job);
  }

  // Recompute derived stats, folding in bonuses from equipped gear. Clamps
  // current HP/SP to the (possibly changed) maximums.
  recompute(): void {
    let effective = { ...this.stats };
    let flatAtk = 0;
    let flatMatk = 0;
    let flatDef = 0;
    let flatHp = 0;
    let flatSp = 0;
    for (const itemId of Object.values(this.equipped)) {
      const item = itemId ? getItem(itemId) : undefined;
      if (!item) continue;
      if (item.bonusStats) effective = addStats(effective, fullStats(item.bonusStats));
      flatAtk += item.atk ?? 0;
      flatMatk += item.matk ?? 0;
      flatDef += item.def ?? 0;
      flatHp += item.maxHp ?? 0;
      flatSp += item.maxSp ?? 0;
    }
    const d = deriveStats(effective, this.level, this.job);
    this.derived = {
      ...d,
      atk: d.atk + flatAtk,
      matk: d.matk + flatMatk,
      def: d.def + flatDef,
      maxHp: d.maxHp + flatHp,
      maxSp: d.maxSp + flatSp,
    };
    if (this.hp > this.derived.maxHp) this.hp = this.derived.maxHp;
    if (this.sp > this.derived.maxSp) this.sp = this.derived.maxSp;
  }

  // ---- inventory / equipment ----

  addItem(itemId: string, qty = 1): void {
    if (!getItem(itemId)) return;
    this.inventory[itemId] = (this.inventory[itemId] ?? 0) + qty;
  }

  private removeItem(itemId: string, qty = 1): boolean {
    const have = this.inventory[itemId] ?? 0;
    if (have < qty) return false;
    const left = have - qty;
    if (left <= 0) delete this.inventory[itemId];
    else this.inventory[itemId] = left;
    return true;
  }

  // Returns true if an HP/SP-affecting change happened (so combat can resync).
  useItem(itemId: string): boolean {
    const item = getItem(itemId);
    if (!item || item.type !== ItemType.Consumable) return false;
    if ((this.inventory[itemId] ?? 0) <= 0) return false;
    this.removeItem(itemId, 1);
    if (item.healHp) this.hp = Math.min(this.derived.maxHp, this.hp + item.healHp);
    if (item.healSp) this.sp = Math.min(this.derived.maxSp, this.sp + item.healSp);
    return true;
  }

  equip(itemId: string): boolean {
    const item = getItem(itemId);
    if (!item || !item.slot) return false;
    if ((this.inventory[itemId] ?? 0) <= 0) return false;
    this.removeItem(itemId, 1);
    const prev = this.equipped[item.slot];
    if (prev) this.addItem(prev, 1); // return previously-equipped item to bag
    this.equipped[item.slot] = itemId;
    this.recompute();
    return true;
  }

  unequip(slot: EquipSlot): boolean {
    const itemId = this.equipped[slot];
    if (!itemId) return false;
    delete this.equipped[slot];
    this.addItem(itemId, 1);
    this.recompute();
    return true;
  }

  // ---- shop ----

  buy(itemId: string, qty: number): boolean {
    const item = getItem(itemId);
    if (!item || !item.price || qty <= 0) return false;
    const cost = item.price * qty;
    if (this.zeny < cost) return false;
    this.zeny -= cost;
    this.addItem(itemId, qty);
    return true;
  }

  sell(itemId: string, qty: number): boolean {
    const item = getItem(itemId);
    if (!item || !item.sellPrice || qty <= 0) return false;
    if ((this.inventory[itemId] ?? 0) < qty) return false;
    this.removeItem(itemId, qty);
    this.zeny += item.sellPrice * qty;
    return true;
  }

  // ---- quests ----

  acceptQuest(id: string): boolean {
    const quest = getQuest(id);
    if (!quest) return false;
    if (this.level < quest.requiredLevel) return false;
    if (id in this.activeQuests || this.completedQuests.includes(id)) return false;
    this.activeQuests[id] = 0;
    return true;
  }

  // Credit a kill toward any active quest targeting that monster.
  creditKill(templateId: string): void {
    for (const [id, progress] of Object.entries(this.activeQuests)) {
      const quest = getQuest(id);
      if (quest && quest.targetTemplate === templateId && progress < quest.count) {
        this.activeQuests[id] = progress + 1;
      }
    }
  }

  // Turn in a completed quest. Returns whether a level-up occurred (for the
  // caller to broadcast), or null if the quest could not be claimed.
  claimQuest(id: string): { leveled: boolean } | null {
    const quest = getQuest(id);
    if (!quest) return null;
    if ((this.activeQuests[id] ?? -1) < quest.count) return null;
    delete this.activeQuests[id];
    this.completedQuests.push(id);
    this.zeny += quest.reward.zeny;
    for (const it of quest.reward.items ?? []) this.addItem(it.id, it.qty);
    const leveled = this.gainExp(quest.reward.exp);
    return { leveled };
  }

  // ---- job advancement ----

  // Returns true if the change was applied. Keeps accumulated stats; future
  // level-ups use the new job's growth, and the new job's skill kit unlocks.
  advanceJob(target: JobId): boolean {
    if (!canAdvanceTo(this.job, target, this.level)) return false;
    this.job = target;
    // A modest bonus on advancement, then full restore.
    this.stats = addStats(this.stats, JOB_GROWTH[target]);
    this.recompute();
    this.hp = this.derived.maxHp;
    this.sp = this.derived.maxSp;
    return true;
  }

  // Returns true if a level-up occurred.
  gainExp(amount: number): boolean {
    this.exp += amount;
    let leveled = false;
    while (this.exp >= xpToNext(this.level)) {
      this.exp -= xpToNext(this.level);
      this.level += 1;
      this.stats = addStats(this.stats, JOB_GROWTH[this.job]);
      this.recompute();
      // Full heal on level-up (classic RO).
      this.hp = this.derived.maxHp;
      this.sp = this.derived.maxSp;
      leveled = true;
      if (!isFinite(xpToNext(this.level))) {
        this.exp = 0;
        break;
      }
    }
    return leveled;
  }

  toFull(): EntityFull {
    return {
      id: this.id,
      kind: EntityKind.Player,
      name: this.name,
      x: this.x,
      z: this.z,
      facing: this.facing,
      hp: this.hp,
      maxHp: this.derived.maxHp,
      level: this.level,
      job: this.job,
      colorSeed: this.colorSeed,
    };
  }

  toSnapshot(): EntitySnapshot {
    return {
      id: this.id,
      x: round2(this.x),
      z: round2(this.z),
      facing: round2(this.facing),
      hp: Math.round(this.hp),
      maxHp: this.derived.maxHp,
    };
  }

  toSelfState(): SelfState {
    return {
      id: this.id,
      name: this.name,
      job: this.job,
      level: this.level,
      hp: Math.round(this.hp),
      maxHp: this.derived.maxHp,
      sp: Math.round(this.sp),
      maxSp: this.derived.maxSp,
      exp: Math.round(this.exp),
      expToNext: isFinite(xpToNext(this.level)) ? xpToNext(this.level) : 0,
      zeny: this.zeny,
      stats: { ...this.stats },
      inventory: Object.entries(this.inventory).map(([id, qty]) => ({ id, qty })),
      equipped: Object.entries(this.equipped)
        .filter(([, id]) => !!id)
        .map(([slot, id]) => ({ slot: slot as EquipSlot, id: id as string })),
      quests: {
        active: Object.entries(this.activeQuests).map(([id, progress]) => ({ id, progress })),
        completed: [...this.completedQuests],
      },
      x: round2(this.x),
      z: round2(this.z),
    };
  }
}

function fullStats(p: Partial<Stats>): Stats {
  return {
    str: p.str ?? 0,
    agi: p.agi ?? 0,
    vit: p.vit ?? 0,
    int: p.int ?? 0,
    dex: p.dex ?? 0,
    luk: p.luk ?? 0,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
