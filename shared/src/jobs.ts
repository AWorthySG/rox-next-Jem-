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
};

// Advancement tree: which jobs each job may become next.
export const JOB_TREE: Record<JobId, JobId[]> = {
  [JobId.Novice]: [JobId.Swordsman, JobId.Mage, JobId.Archer, JobId.Acolyte, JobId.Thief, JobId.Merchant],
  [JobId.Swordsman]: [JobId.Knight],
  [JobId.Mage]: [JobId.Wizard],
  [JobId.Archer]: [JobId.Hunter],
  [JobId.Acolyte]: [JobId.Priest],
  [JobId.Thief]: [JobId.Assassin],
  [JobId.Merchant]: [JobId.Blacksmith],
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
};

const SECOND_JOBS = new Set<JobId>([
  JobId.Knight,
  JobId.Wizard,
  JobId.Hunter,
  JobId.Priest,
  JobId.Assassin,
  JobId.Blacksmith,
]);
const THIRD_JOBS = new Set<JobId>([
  JobId.RuneKnight,
  JobId.HighWizard,
  JobId.Sniper,
  JobId.HighPriest,
  JobId.GuillotineCross,
  JobId.Whitesmith,
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
  sword: [JobId.Swordsman, JobId.Knight, JobId.RuneKnight, JobId.DragonKnight],
  mage: [JobId.Mage, JobId.Wizard, JobId.HighWizard, JobId.ArchMage],
  archer: [JobId.Archer, JobId.Hunter, JobId.Sniper, JobId.Windhawk],
  acolyte: [JobId.Acolyte, JobId.Priest, JobId.HighPriest, JobId.Cardinal],
  thief: [JobId.Thief, JobId.Assassin, JobId.GuillotineCross, JobId.ShadowCross],
  merchant: [JobId.Merchant, JobId.Blacksmith, JobId.Whitesmith, JobId.Mechanic],
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

// Advancement tier of a job: 0 = Novice, 1 = 1st job … 4 = 4th job. The family
// arrays are ordered by tier, so the index gives the tier directly.
export function jobTierOf(job: JobId): number {
  const fam = JOB_TO_FAMILY[job];
  if (!fam) return 0;
  return FAMILY_JOBS[fam].indexOf(job) + 1;
}

