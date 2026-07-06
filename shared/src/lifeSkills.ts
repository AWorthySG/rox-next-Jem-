// Life skills, matching the real game's six: three gathering skills
// (Fishing, Mining, Gardening) worked at dedicated spots in the world, and
// three crafting skills (Cooking, Smelting, Crafting) worked at recipe NPCs.
// Gathers grant skill EXP and a weighted-random raw material, with rarer
// yields unlocking at higher levels; crafts grant EXP to their craft skill,
// with better recipes gated behind higher levels.
export type GatherSkillId = "fishing" | "mining" | "gardening";
export type CraftSkillId = "cooking" | "smelting" | "crafting";
export type LifeSkillId = GatherSkillId | CraftSkillId;

export const GATHER_SKILLS: GatherSkillId[] = ["fishing", "mining", "gardening"];
export const LIFE_SKILLS: LifeSkillId[] = [
  "fishing",
  "mining",
  "gardening",
  "cooking",
  "smelting",
  "crafting",
];

export const LIFE_SKILL_LABEL: Record<LifeSkillId, string> = {
  fishing: "Fishing",
  mining: "Mining",
  gardening: "Gardening",
  cooking: "Cooking",
  smelting: "Smelting",
  crafting: "Crafting",
};

export const LIFE_SKILL_CAP = 30;
export const GATHER_COOLDOWN_MS = 3000;
export const GATHER_XP = 8;
export const CRAFT_XP = 10;

// Gathering runs on a stamina pool (the real game gates life skills behind
// daily stamina). Each gather costs a slice; the pool trickles back over time.
export const STAMINA_MAX = 100;
export const GATHER_STAMINA_COST = 5;
export const STAMINA_REGEN_MS = 10_000; // 1 point per 10s

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
export const GATHER_TABLE: Record<GatherSkillId, GatherYield[]> = {
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
export function rollGather(skill: GatherSkillId, level: number, rng: () => number = Math.random): string | null {
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
