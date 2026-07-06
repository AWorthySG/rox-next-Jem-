import { JobId } from "./enums.js";

// The six classic Ragnarok primary stats.
export interface Stats {
  str: number;
  agi: number;
  vit: number;
  int: number;
  dex: number;
  luk: number;
}

export type StatKey = keyof Stats;
export const STAT_KEYS: StatKey[] = ["str", "agi", "vit", "int", "dex", "luk"];

export function isStatKey(s: string): s is StatKey {
  return (STAT_KEYS as string[]).includes(s);
}

// Stats derived from base stats + level. Recomputed on level-up / stat change.
export interface DerivedStats {
  maxHp: number;
  maxSp: number;
  atk: number; // physical attack
  matk: number; // magic attack
  def: number; // flat damage reduction
  hit: number; // accuracy
  flee: number; // evasion
  crit: number; // crit chance percent
}

export function makeStats(s: Partial<Stats>): Stats {
  return {
    str: s.str ?? 1,
    agi: s.agi ?? 1,
    vit: s.vit ?? 1,
    int: s.int ?? 1,
    dex: s.dex ?? 1,
    luk: s.luk ?? 1,
  };
}

// Base stat templates per job. Novice is the weakest baseline; the two starter
// classes lean into their primary attributes.
export const JOB_BASE_STATS: Record<JobId, Stats> = {
  [JobId.Novice]: makeStats({ str: 5, agi: 5, vit: 5, int: 5, dex: 5, luk: 5 }),
  [JobId.Swordsman]: makeStats({ str: 12, agi: 7, vit: 11, int: 3, dex: 8, luk: 4 }),
  [JobId.Mage]: makeStats({ str: 3, agi: 6, vit: 6, int: 13, dex: 10, luk: 5 }),
  [JobId.Archer]: makeStats({ str: 6, agi: 11, vit: 6, int: 5, dex: 14, luk: 7 }),
  [JobId.Acolyte]: makeStats({ str: 6, agi: 8, vit: 9, int: 12, dex: 8, luk: 8 }),
  [JobId.Knight]: makeStats({ str: 22, agi: 12, vit: 20, int: 4, dex: 14, luk: 6 }),
  [JobId.Wizard]: makeStats({ str: 5, agi: 10, vit: 12, int: 24, dex: 18, luk: 8 }),
  [JobId.Hunter]: makeStats({ str: 10, agi: 20, vit: 10, int: 8, dex: 26, luk: 12 }),
  [JobId.Priest]: makeStats({ str: 10, agi: 14, vit: 16, int: 24, dex: 14, luk: 12 }),
  [JobId.RuneKnight]: makeStats({ str: 40, agi: 20, vit: 34, int: 8, dex: 24, luk: 12 }),
  [JobId.HighWizard]: makeStats({ str: 8, agi: 18, vit: 20, int: 42, dex: 30, luk: 16 }),
  [JobId.Sniper]: makeStats({ str: 18, agi: 36, vit: 18, int: 14, dex: 46, luk: 22 }),
  [JobId.HighPriest]: makeStats({ str: 18, agi: 24, vit: 28, int: 42, dex: 24, luk: 22 }),
  [JobId.DragonKnight]: makeStats({ str: 60, agi: 28, vit: 50, int: 12, dex: 36, luk: 18 }),
  [JobId.ArchMage]: makeStats({ str: 12, agi: 26, vit: 30, int: 62, dex: 44, luk: 24 }),
  [JobId.Windhawk]: makeStats({ str: 26, agi: 52, vit: 26, int: 20, dex: 66, luk: 32 }),
  [JobId.Cardinal]: makeStats({ str: 26, agi: 34, vit: 40, int: 62, dex: 34, luk: 32 }),
  [JobId.Thief]: makeStats({ str: 7, agi: 15, vit: 7, int: 3, dex: 11, luk: 10 }),
  [JobId.Merchant]: makeStats({ str: 11, agi: 5, vit: 10, int: 6, dex: 9, luk: 5 }),
  [JobId.Assassin]: makeStats({ str: 13, agi: 28, vit: 13, int: 5, dex: 20, luk: 18 }),
  [JobId.Blacksmith]: makeStats({ str: 19, agi: 9, vit: 18, int: 9, dex: 15, luk: 8 }),
  [JobId.GuillotineCross]: makeStats({ str: 20, agi: 44, vit: 20, int: 8, dex: 32, luk: 26 }),
  [JobId.Whitesmith]: makeStats({ str: 36, agi: 16, vit: 32, int: 15, dex: 26, luk: 14 }),
  [JobId.ShadowCross]: makeStats({ str: 30, agi: 64, vit: 30, int: 12, dex: 48, luk: 38 }),
  [JobId.Mechanic]: makeStats({ str: 56, agi: 24, vit: 48, int: 20, dex: 38, luk: 20 }),
  [JobId.Crusader]: makeStats({ str: 18, agi: 8, vit: 26, int: 6, dex: 14, luk: 6 }),
  [JobId.Paladin]: makeStats({ str: 32, agi: 16, vit: 44, int: 10, dex: 24, luk: 12 }),
  [JobId.RoyalGuard]: makeStats({ str: 48, agi: 22, vit: 64, int: 14, dex: 34, luk: 16 }),
  [JobId.Sage]: makeStats({ str: 4, agi: 12, vit: 14, int: 20, dex: 22, luk: 8 }),
  [JobId.Professor]: makeStats({ str: 7, agi: 20, vit: 22, int: 36, dex: 38, luk: 15 }),
  [JobId.Monk]: makeStats({ str: 22, agi: 20, vit: 20, int: 6, dex: 16, luk: 8 }),
  [JobId.Champion]: makeStats({ str: 36, agi: 32, vit: 32, int: 8, dex: 26, luk: 14 }),
  [JobId.Rogue]: makeStats({ str: 10, agi: 24, vit: 12, int: 6, dex: 24, luk: 14 }),
  [JobId.Stalker]: makeStats({ str: 16, agi: 40, vit: 20, int: 10, dex: 38, luk: 22 }),
  [JobId.Bard]: makeStats({ str: 8, agi: 22, vit: 10, int: 10, dex: 24, luk: 12 }),
  [JobId.Minstrel]: makeStats({ str: 14, agi: 36, vit: 16, int: 16, dex: 38, luk: 20 }),
  [JobId.Alchemist]: makeStats({ str: 10, agi: 10, vit: 14, int: 20, dex: 20, luk: 8 }),
  [JobId.Creator]: makeStats({ str: 16, agi: 16, vit: 22, int: 34, dex: 34, luk: 14 }),
  [JobId.Chronomancer]: makeStats({ str: 10, agi: 28, vit: 32, int: 52, dex: 54, luk: 22 }),
  [JobId.DragonFist]: makeStats({ str: 52, agi: 46, vit: 46, int: 12, dex: 38, luk: 20 }),
  [JobId.PhantomDancer]: makeStats({ str: 24, agi: 58, vit: 30, int: 14, dex: 54, luk: 32 }),
  [JobId.Maestro]: makeStats({ str: 20, agi: 52, vit: 24, int: 24, dex: 54, luk: 29 }),
  [JobId.Begetter]: makeStats({ str: 24, agi: 24, vit: 32, int: 50, dex: 48, luk: 20 }),
};

// On each level-up a job gains a weighted bundle of stat points (auto-allocated
// for the slice). Weights roughly follow the job's identity.
export const JOB_GROWTH: Record<JobId, Stats> = {
  [JobId.Novice]: makeStats({ str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 }),
  [JobId.Swordsman]: makeStats({ str: 3, agi: 1, vit: 2, int: 0, dex: 1, luk: 0 }),
  [JobId.Mage]: makeStats({ str: 0, agi: 1, vit: 1, int: 3, dex: 2, luk: 0 }),
  [JobId.Archer]: makeStats({ str: 1, agi: 2, vit: 1, int: 0, dex: 3, luk: 1 }),
  [JobId.Acolyte]: makeStats({ str: 1, agi: 1, vit: 2, int: 2, dex: 1, luk: 1 }),
  [JobId.Knight]: makeStats({ str: 4, agi: 2, vit: 3, int: 0, dex: 2, luk: 1 }),
  [JobId.Wizard]: makeStats({ str: 0, agi: 2, vit: 2, int: 4, dex: 3, luk: 1 }),
  [JobId.Hunter]: makeStats({ str: 1, agi: 3, vit: 1, int: 1, dex: 4, luk: 2 }),
  [JobId.Priest]: makeStats({ str: 1, agi: 2, vit: 3, int: 4, dex: 2, luk: 2 }),
  [JobId.RuneKnight]: makeStats({ str: 5, agi: 3, vit: 4, int: 1, dex: 3, luk: 2 }),
  [JobId.HighWizard]: makeStats({ str: 1, agi: 3, vit: 3, int: 5, dex: 4, luk: 2 }),
  [JobId.Sniper]: makeStats({ str: 2, agi: 4, vit: 2, int: 2, dex: 5, luk: 3 }),
  [JobId.HighPriest]: makeStats({ str: 2, agi: 3, vit: 4, int: 5, dex: 3, luk: 3 }),
  [JobId.DragonKnight]: makeStats({ str: 6, agi: 4, vit: 5, int: 1, dex: 4, luk: 2 }),
  [JobId.ArchMage]: makeStats({ str: 1, agi: 4, vit: 4, int: 6, dex: 5, luk: 3 }),
  [JobId.Windhawk]: makeStats({ str: 3, agi: 5, vit: 3, int: 2, dex: 6, luk: 4 }),
  [JobId.Cardinal]: makeStats({ str: 2, agi: 4, vit: 5, int: 6, dex: 4, luk: 4 }),
  [JobId.Thief]: makeStats({ str: 1, agi: 2, vit: 1, int: 0, dex: 2, luk: 1 }),
  [JobId.Merchant]: makeStats({ str: 2, agi: 1, vit: 2, int: 1, dex: 1, luk: 0 }),
  [JobId.Assassin]: makeStats({ str: 2, agi: 3, vit: 2, int: 1, dex: 3, luk: 2 }),
  [JobId.Blacksmith]: makeStats({ str: 4, agi: 1, vit: 3, int: 1, dex: 2, luk: 1 }),
  [JobId.GuillotineCross]: makeStats({ str: 3, agi: 5, vit: 3, int: 1, dex: 4, luk: 3 }),
  [JobId.Whitesmith]: makeStats({ str: 6, agi: 2, vit: 5, int: 2, dex: 3, luk: 1 }),
  [JobId.ShadowCross]: makeStats({ str: 4, agi: 6, vit: 4, int: 2, dex: 6, luk: 4 }),
  [JobId.Mechanic]: makeStats({ str: 8, agi: 3, vit: 6, int: 2, dex: 4, luk: 2 }),
  [JobId.Crusader]: makeStats({ str: 3, agi: 1, vit: 5, int: 1, dex: 2, luk: 1 }),
  [JobId.Paladin]: makeStats({ str: 4, agi: 2, vit: 6, int: 1, dex: 3, luk: 2 }),
  [JobId.RoyalGuard]: makeStats({ str: 6, agi: 3, vit: 8, int: 2, dex: 4, luk: 2 }),
  [JobId.Sage]: makeStats({ str: 1, agi: 2, vit: 2, int: 3, dex: 4, luk: 1 }),
  [JobId.Professor]: makeStats({ str: 1, agi: 3, vit: 3, int: 5, dex: 6, luk: 2 }),
  [JobId.Monk]: makeStats({ str: 4, agi: 3, vit: 3, int: 0, dex: 2, luk: 1 }),
  [JobId.Champion]: makeStats({ str: 5, agi: 5, vit: 5, int: 1, dex: 3, luk: 2 }),
  [JobId.Rogue]: makeStats({ str: 1, agi: 3, vit: 2, int: 1, dex: 3, luk: 2 }),
  [JobId.Stalker]: makeStats({ str: 2, agi: 5, vit: 3, int: 1, dex: 5, luk: 3 }),
  [JobId.Bard]: makeStats({ str: 1, agi: 3, vit: 1, int: 2, dex: 3, luk: 2 }),
  [JobId.Minstrel]: makeStats({ str: 2, agi: 4, vit: 2, int: 3, dex: 5, luk: 3 }),
  [JobId.Alchemist]: makeStats({ str: 1, agi: 1, vit: 2, int: 3, dex: 3, luk: 1 }),
  [JobId.Creator]: makeStats({ str: 2, agi: 2, vit: 3, int: 5, dex: 5, luk: 2 }),
  [JobId.Chronomancer]: makeStats({ str: 1, agi: 4, vit: 4, int: 6, dex: 7, luk: 3 }),
  [JobId.DragonFist]: makeStats({ str: 7, agi: 6, vit: 6, int: 1, dex: 4, luk: 3 }),
  [JobId.PhantomDancer]: makeStats({ str: 3, agi: 7, vit: 4, int: 2, dex: 6, luk: 4 }),
  [JobId.Maestro]: makeStats({ str: 3, agi: 6, vit: 3, int: 4, dex: 6, luk: 4 }),
  [JobId.Begetter]: makeStats({ str: 3, agi: 3, vit: 4, int: 6, dex: 6, luk: 3 }),
};

const MAGIC_JOBS = new Set<JobId>([
  JobId.Mage,
  JobId.Wizard,
  JobId.HighWizard,
  JobId.ArchMage,
  JobId.Acolyte,
  JobId.Priest,
  JobId.HighPriest,
  JobId.Cardinal,
  JobId.Sage,
  JobId.Professor,
  JobId.Chronomancer,
  JobId.Alchemist,
  JobId.Creator,
  JobId.Begetter,
]);

export function isMagicJob(job: JobId): boolean {
  return MAGIC_JOBS.has(job);
}

export function deriveStats(stats: Stats, level: number, job: JobId): DerivedStats {
  const maxHp = Math.round(40 + level * (8 + stats.vit * 0.6) + stats.vit * 3);
  const maxSp = Math.round(15 + level * 2 + stats.int * 1.5);

  const atk = Math.round(
    level / 4 + stats.str + Math.pow(Math.floor(stats.str / 10), 2) + stats.dex / 5 + stats.luk / 5,
  );
  const matk = Math.round(level / 4 + stats.int + Math.pow(Math.floor(stats.int / 7), 2) + stats.dex / 5);
  const def = Math.round(stats.vit * 0.5 + level / 6);
  const hit = Math.round(level + stats.dex);
  const flee = Math.round(level + stats.agi);
  const crit = Math.min(60, Math.round(1 + stats.luk * 0.3));

  return { maxHp, maxSp, atk, matk, def, hit, flee, crit };
}

// Sum two stat blocks (used to apply growth on level-up).
export function addStats(a: Stats, b: Stats): Stats {
  return {
    str: a.str + b.str,
    agi: a.agi + b.agi,
    vit: a.vit + b.vit,
    int: a.int + b.int,
    dex: a.dex + b.dex,
    luk: a.luk + b.luk,
  };
}
