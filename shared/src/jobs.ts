import { JobId } from "./enums.js";

export const JOB_NAME: Record<JobId, string> = {
  [JobId.Novice]: "Novice",
  [JobId.Swordsman]: "Swordsman",
  [JobId.Mage]: "Mage",
  [JobId.Knight]: "Knight",
  [JobId.Wizard]: "Wizard",
};

// Advancement tree: which jobs each job may become next.
export const JOB_TREE: Record<JobId, JobId[]> = {
  [JobId.Novice]: [JobId.Swordsman, JobId.Mage],
  [JobId.Swordsman]: [JobId.Knight],
  [JobId.Mage]: [JobId.Wizard],
  [JobId.Knight]: [],
  [JobId.Wizard]: [],
};

// Base level required for each tier of advancement.
export const FIRST_JOB_LEVEL = 10; // Novice -> 1st job
export const SECOND_JOB_LEVEL = 25; // 1st job -> 2nd job

export function advanceLevelFor(job: JobId): number {
  return job === JobId.Novice ? FIRST_JOB_LEVEL : SECOND_JOB_LEVEL;
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
