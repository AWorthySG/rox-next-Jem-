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
};

// On each level-up a job gains a weighted bundle of stat points (auto-allocated
// for the slice). Weights roughly follow the job's identity.
export const JOB_GROWTH: Record<JobId, Stats> = {
  [JobId.Novice]: makeStats({ str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 }),
  [JobId.Swordsman]: makeStats({ str: 3, agi: 1, vit: 2, int: 0, dex: 1, luk: 0 }),
  [JobId.Mage]: makeStats({ str: 0, agi: 1, vit: 1, int: 3, dex: 2, luk: 0 }),
};

export function isMagicJob(job: JobId): boolean {
  return job === JobId.Mage;
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
