// Life skills: Fishing, Mining and Gardening. Each is worked at a dedicated
// gathering spot NPC in the world; successful gathers grant skill EXP and a
// weighted-random raw material, with rarer yields unlocking at higher levels.
export type LifeSkillId = "fishing" | "mining" | "gardening";

export const LIFE_SKILLS: LifeSkillId[] = ["fishing", "mining", "gardening"];

export const LIFE_SKILL_LABEL: Record<LifeSkillId, string> = {
  fishing: "Fishing",
  mining: "Mining",
  gardening: "Gardening",
};

export const LIFE_SKILL_CAP = 30;
export const GATHER_COOLDOWN_MS = 3000;
export const GATHER_XP = 8;

// EXP required to advance a life skill from `level` to `level + 1`.
export function lifeSkillXpToNext(level: number): number {
  if (level >= LIFE_SKILL_CAP) return Infinity;
  return Math.round(20 * level + 30);
}

export interface GatherYield {
  itemId: string;
  weight: number; // relative chance among yields unlocked at the gatherer's level
  minLevel: number;
}

// Weighted material tables per skill. Rarer/better materials need a higher
// level to appear at all, so leveling up genuinely opens new loot.
export const GATHER_TABLE: Record<LifeSkillId, GatherYield[]> = {
  fishing: [
    { itemId: "sardine", weight: 10, minLevel: 1 },
    { itemId: "tuna", weight: 5, minLevel: 5 },
    { itemId: "golden_carp", weight: 1, minLevel: 15 },
  ],
  mining: [
    { itemId: "oridecon", weight: 8, minLevel: 1 },
    { itemId: "elunium", weight: 5, minLevel: 3 },
    { itemId: "mithril_ore", weight: 1, minLevel: 15 },
  ],
  gardening: [
    { itemId: "turnip", weight: 10, minLevel: 1 },
    { itemId: "pumpkin", weight: 5, minLevel: 5 },
    { itemId: "moonflower", weight: 1, minLevel: 15 },
  ],
};

// Roll one item from the skill's yield table, restricted to what the given
// level has unlocked. Returns null if somehow nothing is unlocked yet.
export function rollGather(skill: LifeSkillId, level: number, rng: () => number = Math.random): string | null {
  const table = GATHER_TABLE[skill].filter((g) => level >= g.minLevel);
  if (table.length === 0) return null;
  const total = table.reduce((sum, g) => sum + g.weight, 0);
  let r = rng() * total;
  for (const g of table) {
    if (r < g.weight) return g.itemId;
    r -= g.weight;
  }
  return table[table.length - 1].itemId;
}
