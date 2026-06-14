import {
  addStats,
  canAdvanceTo,
  deriveStats,
  EntityKind,
  EquipSlot,
  ACHIEVEMENTS,
  type AchievementDef,
  getItem,
  getPet,
  getQuest,
  getRune,
  isStatKey,
  jobHasSkill,
  JOB_BASE_STATS,
  JOB_GROWTH,
  JobId,
  ItemType,
  isMagicJob,
  ENCHANT_COST,
  MAX_ENCHANT_LINES,
  MAX_REFINE,
  refineBonus,
  refineCost,
  rollEnchantLine,
  SKILL_MAX_LEVEL,
  SKILLS_BY_JOB,
  STAT_POINTS_PER_LEVEL,
  xpToNext,
  type DerivedStats,
  type EnchantLine,
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
  mapId = "field";

  level = 1;
  exp = 0;
  zeny = 0;
  stats: Stats;
  derived: DerivedStats;
  hp: number;
  sp: number;

  statPoints = 0;
  skillPoints = 0;
  runePoints = 0;
  runes: string[] = []; // unlocked Aesir rune ids
  skillLevels: Record<string, number> = {}; // skillId -> level (>=1 when learned)
  inventory: Record<string, number> = {}; // itemId -> qty
  storage: Record<string, number> = {}; // Kafra storage: itemId -> qty
  equipped: Partial<Record<EquipSlot, string>> = {}; // slot -> itemId
  cards: Partial<Record<EquipSlot, string>> = {}; // slot -> socketed card itemId
  refineByItem: Record<string, number> = {}; // itemId -> refine level
  enchantByItem: Record<string, EnchantLine[]> = {}; // itemId -> rolled enchant lines
  partyId: number | null = null;
  guildId: number | null = null;
  guildName: string | null = null;
  activePet: string | null = null;
  mounted = false;
  activeQuests: Record<string, number> = {}; // questId -> kill progress
  completedQuests: string[] = [];
  totalKills = 0;
  bossesKilled: string[] = [];
  achievements: string[] = [];

  // intents
  moveTarget: { x: number; z: number } | null = null;
  attackTargetId: number | null = null;
  attackCooldown = 0; // ms remaining
  pendingSkillId: string | null = null;
  pendingSkillTargetId: number | null = null;
  skillCooldowns: Record<string, number> = {}; // skillId -> ms remaining
  buffs: Array<{ stat: "atk" | "matk"; mult: number; expiresAt: number }> = [];

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
    this.learnJobSkills();
  }

  // Ensure every skill in the current job's kit is known at least at level 1.
  learnJobSkills(): void {
    for (const def of SKILLS_BY_JOB[this.job] ?? []) {
      if (!(def.id in this.skillLevels)) this.skillLevels[def.id] = 1;
    }
  }

  skillLevel(skillId: string): number {
    return this.skillLevels[skillId] ?? 1;
  }

  levelSkill(skillId: string): boolean {
    if (!jobHasSkill(this.job, skillId) || this.skillPoints <= 0) return false;
    const lvl = this.skillLevels[skillId] ?? 1;
    if (lvl >= SKILL_MAX_LEVEL) return false;
    this.skillLevels[skillId] = lvl + 1;
    this.skillPoints -= 1;
    return true;
  }

  unlockRune(runeId: string): boolean {
    const rune = getRune(runeId);
    if (!rune || this.runes.includes(runeId)) return false;
    if (rune.requires && !this.runes.includes(rune.requires)) return false;
    if (this.runePoints < rune.cost) return false;
    this.runePoints -= rune.cost;
    this.runes.push(runeId);
    this.recompute();
    return true;
  }

  get isMagic(): boolean {
    return isMagicJob(this.job);
  }

  // ---- buffs ----

  addBuff(stat: "atk" | "matk", mult: number, durationMs: number, now: number): void {
    this.buffs = this.buffs.filter((b) => b.stat !== stat); // refresh
    this.buffs.push({ stat, mult, expiresAt: now + durationMs });
  }

  buffMul(stat: "atk" | "matk", now: number): number {
    let m = 1;
    for (const b of this.buffs) if (b.stat === stat && b.expiresAt > now) m *= b.mult;
    return m;
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
    let flatCrit = 0;
    for (const itemId of Object.values(this.equipped)) {
      const item = itemId ? getItem(itemId) : undefined;
      if (!item || !itemId) continue;
      if (item.bonusStats) effective = addStats(effective, fullStats(item.bonusStats));
      flatAtk += item.atk ?? 0;
      flatMatk += item.matk ?? 0;
      flatDef += item.def ?? 0;
      flatHp += item.maxHp ?? 0;
      flatSp += item.maxSp ?? 0;
      // refinement bonuses
      const rb = refineBonus(item, this.refineByItem[itemId] ?? 0);
      flatAtk += rb.atk;
      flatMatk += rb.matk;
      flatDef += rb.def;
      flatHp += rb.maxHp;
      // enchant lines
      for (const line of this.enchantByItem[itemId] ?? []) {
        if (isStatKey(line.stat)) {
          effective[line.stat] += line.value;
        } else if (line.stat === "atk") flatAtk += line.value;
        else if (line.stat === "matk") flatMatk += line.value;
        else if (line.stat === "def") flatDef += line.value;
        else if (line.stat === "maxHp") flatHp += line.value;
        else if (line.stat === "maxSp") flatSp += line.value;
        else if (line.stat === "crit") flatCrit += line.value;
      }
    }
    // socketed card bonuses
    for (const cardId of Object.values(this.cards)) {
      const card = cardId ? getItem(cardId) : undefined;
      if (!card) continue;
      if (card.bonusStats) effective = addStats(effective, fullStats(card.bonusStats));
      flatAtk += card.atk ?? 0;
      flatMatk += card.matk ?? 0;
      flatDef += card.def ?? 0;
      flatHp += card.maxHp ?? 0;
      flatSp += card.maxSp ?? 0;
    }
    // active pet bonus
    const pet = this.activePet ? getPet(this.activePet) : undefined;
    if (pet) {
      if (pet.bonusStats) effective = addStats(effective, fullStats(pet.bonusStats));
      flatAtk += pet.atk ?? 0;
      flatMatk += pet.matk ?? 0;
      flatHp += pet.maxHp ?? 0;
    }
    // unlocked Aesir rune bonuses
    for (const runeId of this.runes) {
      const rune = getRune(runeId);
      if (!rune) continue;
      if (rune.bonusStats) effective = addStats(effective, fullStats(rune.bonusStats));
      flatAtk += rune.atk ?? 0;
      flatMatk += rune.matk ?? 0;
      flatDef += rune.def ?? 0;
      flatHp += rune.maxHp ?? 0;
      flatSp += rune.maxSp ?? 0;
      flatCrit += rune.crit ?? 0;
    }
    const d = deriveStats(effective, this.level, this.job);
    this.derived = {
      ...d,
      atk: d.atk + flatAtk,
      matk: d.matk + flatMatk,
      def: d.def + flatDef,
      maxHp: d.maxHp + flatHp,
      maxSp: d.maxSp + flatSp,
      crit: Math.min(100, d.crit + flatCrit),
    };
    if (this.hp > this.derived.maxHp) this.hp = this.derived.maxHp;
    if (this.sp > this.derived.maxSp) this.sp = this.derived.maxSp;
  }

  // ---- stat allocation ----

  allocateStat(stat: string): boolean {
    if (!isStatKey(stat) || this.statPoints <= 0) return false;
    this.stats[stat] += 1;
    this.statPoints -= 1;
    this.recompute();
    return true;
  }

  // ---- refinement ----

  refineEquipped(slot: EquipSlot): boolean {
    const itemId = this.equipped[slot];
    if (!itemId || !getItem(itemId)) return false;
    const level = this.refineByItem[itemId] ?? 0;
    if (level >= MAX_REFINE) return false;
    const cost = refineCost(level);
    if (this.zeny < cost) return false;
    this.zeny -= cost;
    this.refineByItem[itemId] = level + 1;
    this.recompute();
    return true;
  }

  // ---- enchantment ----

  // Re-roll the enchant lines on the item equipped in `slot`. Locked lines are
  // preserved; the remaining slots are re-rolled to fill up to MAX_ENCHANT_LINES.
  enchantItem(slot: EquipSlot, rng: () => number = Math.random): boolean {
    const itemId = this.equipped[slot];
    if (!itemId || !getItem(itemId)) return false;
    if (this.zeny < ENCHANT_COST) return false;
    const existing = this.enchantByItem[itemId] ?? [];
    const kept = existing.filter((l) => l.locked).slice(0, MAX_ENCHANT_LINES);
    const next: EnchantLine[] = [...kept];
    while (next.length < MAX_ENCHANT_LINES) next.push(rollEnchantLine(rng));
    this.zeny -= ENCHANT_COST;
    this.enchantByItem[itemId] = next;
    this.recompute();
    return true;
  }

  // Toggle the lock flag on a single enchant line (so it survives the next roll).
  toggleEnchantLock(slot: EquipSlot, index: number): boolean {
    const itemId = this.equipped[slot];
    if (!itemId) return false;
    const lines = this.enchantByItem[itemId];
    if (!lines || index < 0 || index >= lines.length) return false;
    lines[index].locked = !lines[index].locked;
    return true;
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
    // A mount whistle is reusable — toggle without consuming it.
    if (item.mount) {
      this.mounted = !this.mounted;
      return true;
    }
    this.removeItem(itemId, 1);
    if (item.pet) {
      this.activePet = item.pet;
      this.recompute();
      return true;
    }
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
    this.returnCard(item.slot); // any socketed card pops back to the bag
    this.equipped[item.slot] = itemId;
    this.recompute();
    return true;
  }

  unequip(slot: EquipSlot): boolean {
    const itemId = this.equipped[slot];
    if (!itemId) return false;
    delete this.equipped[slot];
    this.addItem(itemId, 1);
    this.returnCard(slot);
    this.recompute();
    return true;
  }

  private returnCard(slot: EquipSlot): void {
    const card = this.cards[slot];
    if (card) {
      this.addItem(card, 1);
      delete this.cards[slot];
    }
  }

  // Socket a card into the matching equipped item's slot.
  socketCard(cardId: string): boolean {
    const card = getItem(cardId);
    if (!card || card.type !== ItemType.Card || !card.cardSlot) return false;
    if ((this.inventory[cardId] ?? 0) <= 0) return false;
    if (!this.equipped[card.cardSlot]) return false; // need an item equipped there
    this.removeItem(cardId, 1);
    this.returnCard(card.cardSlot); // swap out any existing card
    this.cards[card.cardSlot] = cardId;
    this.recompute();
    return true;
  }

  unsocketCard(slot: EquipSlot): boolean {
    if (!this.cards[slot]) return false;
    this.returnCard(slot);
    this.recompute();
    return true;
  }

  // ---- Kafra storage ----

  // Move items from the bag into storage. Returns true if anything moved.
  storeItem(itemId: string, qty: number): boolean {
    if (qty <= 0) return false;
    const have = this.inventory[itemId] ?? 0;
    const move = Math.min(have, qty);
    if (move <= 0) return false;
    this.removeItem(itemId, move);
    this.storage[itemId] = (this.storage[itemId] ?? 0) + move;
    return true;
  }

  // Move items from storage back into the bag. Returns true if anything moved.
  retrieveItem(itemId: string, qty: number): boolean {
    if (qty <= 0) return false;
    const have = this.storage[itemId] ?? 0;
    const move = Math.min(have, qty);
    if (move <= 0) return false;
    const left = have - move;
    if (left <= 0) delete this.storage[itemId];
    else this.storage[itemId] = left;
    this.addItem(itemId, move);
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

  // ---- achievements ----

  recordKill(templateId: string, boss: boolean): void {
    this.totalKills += 1;
    if (boss && !this.bossesKilled.includes(templateId)) this.bossesKilled.push(templateId);
  }

  // Unlock any newly-met achievements (granting their Zeny). Returns the ones
  // unlocked this call so the caller can notify the player.
  evaluateAchievements(): AchievementDef[] {
    const unlocked: AchievementDef[] = [];
    for (const a of Object.values(ACHIEVEMENTS)) {
      if (this.achievements.includes(a.id)) continue;
      const met =
        (a.kind === "level" && this.level >= (a.value as number)) ||
        (a.kind === "kills" && this.totalKills >= (a.value as number)) ||
        (a.kind === "boss" && this.bossesKilled.includes(a.value as string));
      if (met) {
        this.achievements.push(a.id);
        this.zeny += a.rewardZeny;
        unlocked.push(a);
      }
    }
    return unlocked;
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
    this.learnJobSkills();
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
      this.statPoints += STAT_POINTS_PER_LEVEL;
      this.skillPoints += 1;
      this.runePoints += 1;
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

  // Restore a previously-saved character (used by solo/offline persistence).
  restore(s: SelfState): void {
    this.name = s.name;
    this.job = s.job;
    this.level = s.level;
    this.exp = s.exp;
    this.zeny = s.zeny;
    this.statPoints = s.statPoints;
    this.skillPoints = s.skillPoints;
    this.runePoints = s.runePoints ?? 0;
    this.runes = [...(s.runes ?? [])];
    this.stats = { ...s.stats };
    this.skillLevels = {};
    for (const sk of s.skillLevels) this.skillLevels[sk.id] = sk.level;
    this.inventory = {};
    for (const it of s.inventory) this.inventory[it.id] = it.qty;
    this.storage = {};
    for (const it of s.storage ?? []) this.storage[it.id] = it.qty;
    this.equipped = {};
    for (const e of s.equipped) this.equipped[e.slot] = e.id;
    this.cards = {};
    for (const c of s.cards ?? []) this.cards[c.slot] = c.id;
    this.refineByItem = {};
    for (const r of s.refine) this.refineByItem[r.id] = r.level;
    this.enchantByItem = {};
    for (const e of s.enchants ?? []) this.enchantByItem[e.id] = e.lines.map((l) => ({ ...l }));
    this.activeQuests = {};
    for (const q of s.quests.active) this.activeQuests[q.id] = q.progress;
    this.completedQuests = [...s.quests.completed];
    this.achievements = [...(s.achievements ?? [])];
    this.mapId = s.mapId ?? "field";
    this.activePet = s.pet ?? null;
    this.mounted = !!s.mounted;
    this.buffs = [];
    this.learnJobSkills();
    this.recompute();
    this.hp = Math.min(s.hp, this.derived.maxHp);
    this.sp = Math.min(s.sp, this.derived.maxSp);
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
      guildName: this.guildName ?? undefined,
      headgear: this.equipped[EquipSlot.Headgear] ?? undefined,
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
      statPoints: this.statPoints,
      skillPoints: this.skillPoints,
      runePoints: this.runePoints,
      runes: [...this.runes],
      skillLevels: Object.entries(this.skillLevels).map(([id, level]) => ({ id, level })),
      inventory: Object.entries(this.inventory).map(([id, qty]) => ({ id, qty })),
      storage: Object.entries(this.storage).map(([id, qty]) => ({ id, qty })),
      equipped: Object.entries(this.equipped)
        .filter(([, id]) => !!id)
        .map(([slot, id]) => ({ slot: slot as EquipSlot, id: id as string })),
      cards: Object.entries(this.cards)
        .filter(([, id]) => !!id)
        .map(([slot, id]) => ({ slot: slot as EquipSlot, id: id as string })),
      refine: Object.entries(this.refineByItem)
        .filter(([, level]) => level > 0)
        .map(([id, level]) => ({ id, level })),
      enchants: Object.entries(this.enchantByItem)
        .filter(([, lines]) => lines.length > 0)
        .map(([id, lines]) => ({ id, lines: lines.map((l) => ({ ...l })) })),
      quests: {
        active: Object.entries(this.activeQuests).map(([id, progress]) => ({ id, progress })),
        completed: [...this.completedQuests],
      },
      achievements: [...this.achievements],
      buffs: this.buffs
        .filter((b) => b.expiresAt > Date.now())
        .map((b) => ({ type: b.stat, remainingMs: Math.round(b.expiresAt - Date.now()) })),
      pet: this.activePet,
      mounted: this.mounted,
      mapId: this.mapId,
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
