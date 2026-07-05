import { JobId } from "./enums.js";

export const JOB_NAME: Record<JobId, string> = {
  [JobId.Novice]: "Novice",
  [JobId.Swordsman]: "Swordsman",
  [JobId.Mage]: "Mage",
  [JobId.Archer]: "Archer",
  [JobId.Acolyte]: "Acolyte",
  [JobId.Knight]: "Knight",
  [JobId.Wizard]: "Wizard",
  [JobId.Hunter]: "Hunter",
  [JobId.Priest]: "Priest",
  [JobId.RuneKnight]: "Rune Knight",
  [JobId.HighWizard]: "High Wizard",
  [JobId.Sniper]: "Sniper",
  [JobId.HighPriest]: "High Priest",
  [JobId.DragonKnight]: "Dragon Knight",
  [JobId.ArchMage]: "Arch Mage",
  [JobId.Windhawk]: "Windhawk",
  [JobId.Cardinal]: "Cardinal",
  [JobId.Thief]: "Thief",
  [JobId.Merchant]: "Merchant",
  [JobId.Assassin]: "Assassin",
  [JobId.Blacksmith]: "Blacksmith",
  [JobId.GuillotineCross]: "Guillotine Cross",
  [JobId.Whitesmith]: "Whitesmith",
  [JobId.ShadowCross]: "Shadow Cross",
  [JobId.Mechanic]: "Mechanic",
  [JobId.Crusader]: "Crusader",
  [JobId.Paladin]: "Paladin",
  [JobId.RoyalGuard]: "Royal Guard",
  [JobId.Sage]: "Sage",
  [JobId.Professor]: "Professor",
  [JobId.Monk]: "Monk",
  [JobId.Champion]: "Champion",
  [JobId.Rogue]: "Rogue",
  [JobId.Stalker]: "Stalker",
  [JobId.Bard]: "Bard",
  [JobId.Minstrel]: "Minstrel",
  [JobId.Alchemist]: "Alchemist",
  [JobId.Creator]: "Creator",
};

// Advancement tree: which jobs each job may become next.
export const JOB_TREE: Record<JobId, JobId[]> = {
  [JobId.Novice]: [JobId.Swordsman, JobId.Mage, JobId.Archer, JobId.Acolyte, JobId.Thief, JobId.Merchant],
  [JobId.Swordsman]: [JobId.Knight, JobId.Crusader],
  [JobId.Mage]: [JobId.Wizard, JobId.Sage],
  [JobId.Archer]: [JobId.Hunter, JobId.Bard],
  [JobId.Acolyte]: [JobId.Priest, JobId.Monk],
  [JobId.Thief]: [JobId.Assassin, JobId.Rogue],
  [JobId.Merchant]: [JobId.Blacksmith, JobId.Alchemist],
  [JobId.Knight]: [JobId.RuneKnight],
  [JobId.Wizard]: [JobId.HighWizard],
  [JobId.Hunter]: [JobId.Sniper],
  [JobId.Priest]: [JobId.HighPriest],
  [JobId.Assassin]: [JobId.GuillotineCross],
  [JobId.Blacksmith]: [JobId.Whitesmith],
  [JobId.RuneKnight]: [JobId.DragonKnight],
  [JobId.HighWizard]: [JobId.ArchMage],
  [JobId.Sniper]: [JobId.Windhawk],
  [JobId.HighPriest]: [JobId.Cardinal],
  [JobId.GuillotineCross]: [JobId.ShadowCross],
  [JobId.Whitesmith]: [JobId.Mechanic],
  [JobId.DragonKnight]: [],
  [JobId.ArchMage]: [],
  [JobId.Windhawk]: [],
  [JobId.Cardinal]: [],
  [JobId.ShadowCross]: [],
  [JobId.Mechanic]: [],
  [JobId.Crusader]: [JobId.Paladin],
  [JobId.Paladin]: [JobId.RoyalGuard],
  [JobId.RoyalGuard]: [],
  [JobId.Sage]: [JobId.Professor],
  [JobId.Professor]: [],
  [JobId.Monk]: [JobId.Champion],
  [JobId.Champion]: [],
  [JobId.Rogue]: [JobId.Stalker],
  [JobId.Stalker]: [],
  [JobId.Bard]: [JobId.Minstrel],
  [JobId.Minstrel]: [],
  [JobId.Alchemist]: [JobId.Creator],
  [JobId.Creator]: [],
};

const SECOND_JOBS = new Set<JobId>([
  JobId.Knight,
  JobId.Wizard,
  JobId.Hunter,
  JobId.Priest,
  JobId.Assassin,
  JobId.Blacksmith,
  JobId.Crusader,
  JobId.Sage,
  JobId.Monk,
  JobId.Rogue,
  JobId.Bard,
  JobId.Alchemist,
]);
const THIRD_JOBS = new Set<JobId>([
  JobId.RuneKnight,
  JobId.HighWizard,
  JobId.Sniper,
  JobId.HighPriest,
  JobId.GuillotineCross,
  JobId.Whitesmith,
  JobId.Paladin,
  JobId.Professor,
  JobId.Champion,
  JobId.Stalker,
  JobId.Minstrel,
  JobId.Creator,
]);

// Base level required for each tier of advancement.
export const FIRST_JOB_LEVEL = 10; // Novice -> 1st job
export const SECOND_JOB_LEVEL = 25; // 1st job -> 2nd job
export const THIRD_JOB_LEVEL = 45; // 2nd job -> 3rd (transcendent) job
export const FOURTH_JOB_LEVEL = 70; // 3rd -> 4th job

export function advanceLevelFor(job: JobId): number {
  if (job === JobId.Novice) return FIRST_JOB_LEVEL;
  if (THIRD_JOBS.has(job)) return FOURTH_JOB_LEVEL;
  if (SECOND_JOBS.has(job)) return THIRD_JOB_LEVEL;
  return SECOND_JOB_LEVEL;
}

// Jobs a player at the given level may advance into right now.
export function advanceOptions(job: JobId, level: number): JobId[] {
  const opts = JOB_TREE[job] ?? [];
  if (opts.length === 0) return [];
  return level >= advanceLevelFor(job) ? opts : [];
}

export function canAdvanceTo(job: JobId, target: JobId, level: number): boolean {
  return advanceOptions(job, level).includes(target);
}

// ---- job families (archetype lineages) ----
// Equipment is tailored to a family: a sword line weapon suits Swordsman →
// Knight → Rune Knight → Dragon Knight, and so on.
export type JobFamily = "sword" | "mage" | "archer" | "acolyte" | "thief" | "merchant";

export const FAMILY_JOBS: Record<JobFamily, JobId[]> = {
  sword: [
    JobId.Swordsman,
    JobId.Knight,
    JobId.RuneKnight,
    JobId.DragonKnight,
    JobId.Crusader,
    JobId.Paladin,
    JobId.RoyalGuard,
  ],
  mage: [JobId.Mage, JobId.Wizard, JobId.HighWizard, JobId.ArchMage, JobId.Sage, JobId.Professor],
  archer: [JobId.Archer, JobId.Hunter, JobId.Sniper, JobId.Windhawk, JobId.Bard, JobId.Minstrel],
  acolyte: [JobId.Acolyte, JobId.Priest, JobId.HighPriest, JobId.Cardinal, JobId.Monk, JobId.Champion],
  thief: [JobId.Thief, JobId.Assassin, JobId.GuillotineCross, JobId.ShadowCross, JobId.Rogue, JobId.Stalker],
  merchant: [
    JobId.Merchant,
    JobId.Blacksmith,
    JobId.Whitesmith,
    JobId.Mechanic,
    JobId.Alchemist,
    JobId.Creator,
  ],
};

export const FAMILY_LABEL: Record<JobFamily, string> = {
  sword: "Swordsman",
  mage: "Mage",
  archer: "Archer",
  acolyte: "Acolyte",
  thief: "Thief",
  merchant: "Merchant",
};

const JOB_TO_FAMILY: Partial<Record<JobId, JobFamily>> = {};
for (const fam of Object.keys(FAMILY_JOBS) as JobFamily[]) {
  for (const j of FAMILY_JOBS[fam]) JOB_TO_FAMILY[j] = fam;
}

// The archetype family a job belongs to (Novice belongs to none).
export function jobFamilyOf(job: JobId): JobFamily | null {
  return JOB_TO_FAMILY[job] ?? null;
}

// Advancement tier of a job: 0 = Novice, 1 = 1st job, 2 = 2nd job, 3 = 3rd
// (transcendent) job, 4 = 4th job. Computed as each job's depth in the
// advancement tree (BFS from Novice) so branching lines — e.g. Swordsman's
// Knight and Crusader paths — both resolve correctly, unlike a flat
// family-array index which only works for a single unbranched chain.
const JOB_TIER: Partial<Record<JobId, number>> = { [JobId.Novice]: 0 };
{
  const queue: JobId[] = [JobId.Novice];
  while (queue.length > 0) {
    const job = queue.shift()!;
    const depth = JOB_TIER[job]!;
    for (const next of JOB_TREE[job] ?? []) {
      if (JOB_TIER[next] == null) {
        JOB_TIER[next] = depth + 1;
        queue.push(next);
      }
    }
  }
}

export function jobTierOf(job: JobId): number {
  return JOB_TIER[job] ?? 0;
}

