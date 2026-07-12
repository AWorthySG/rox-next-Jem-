// The Glory Pass — a seasonal reward track. Players earn pass EXP from play
// (kills and quest turn-ins), which advances the pass level; each level has a
// free reward everyone can claim and a premium reward unlocked by the Glory
// Pass. Rewards are claimed one tier at a time.
export type PassTrack = "free" | "premium";

export interface PassReward {
  itemId: string;
  qty: number;
}

export interface PassTier {
  level: number; // 1-based
  free?: PassReward;
  premium?: PassReward;
}

export const PASS_SEASON_NAME = "Raging Flame";
export const PASS_EXP_PER_TIER = 100; // pass EXP for each tier
export const PASS_EXP_PER_KILL = 5; // pass EXP per monster kill
export const PASS_EXP_PER_QUEST = 40; // pass EXP per quest turned in

// Ten tiers. Free track is steady consumables/materials; premium adds refine
// ore, Emperium Fragments, and cosmetic milestones (a costume, then a mount).
export const PASS_TIERS: PassTier[] = [
  { level: 1, free: { itemId: "red_potion", qty: 5 }, premium: { itemId: "pet_treat", qty: 5 } },
  { level: 2, free: { itemId: "apple", qty: 10 }, premium: { itemId: "oridecon", qty: 3 } },
  { level: 3, free: { itemId: "pet_treat", qty: 3 }, premium: { itemId: "elunium", qty: 3 } },
  { level: 4, free: { itemId: "yellow_potion", qty: 5 }, premium: { itemId: "emperium_fragment", qty: 2 } },
  { level: 5, free: { itemId: "oridecon", qty: 2 }, premium: { itemId: "crimson_duelist_ticket", qty: 1 } },
  { level: 6, free: { itemId: "blue_potion", qty: 5 }, premium: { itemId: "oridecon", qty: 4 } },
  { level: 7, free: { itemId: "elunium", qty: 2 }, premium: { itemId: "elunium", qty: 4 } },
  { level: 8, free: { itemId: "white_potion", qty: 5 }, premium: { itemId: "emperium_fragment", qty: 3 } },
  { level: 9, free: { itemId: "pet_treat", qty: 5 }, premium: { itemId: "azure_mystic_ticket", qty: 1 } },
  { level: 10, free: { itemId: "emperium_fragment", qty: 3 }, premium: { itemId: "grand_peco_whistle", qty: 1 } },
];

export const PASS_MAX_TIER = PASS_TIERS.length;

// Pass level reached at the given accumulated pass EXP (capped at the last tier).
export function passLevelFromExp(exp: number): number {
  return Math.min(PASS_MAX_TIER, Math.floor(Math.max(0, exp) / PASS_EXP_PER_TIER));
}

export function passTierAt(level: number): PassTier | undefined {
  return PASS_TIERS.find((t) => t.level === level);
}

export function passRewardAt(level: number, track: PassTrack): PassReward | undefined {
  const tier = passTierAt(level);
  return track === "free" ? tier?.free : tier?.premium;
}
