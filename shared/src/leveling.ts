import { LEVEL_CAP } from "./constants.js";

// EXP required to advance FROM `level` to `level + 1`.
export function xpToNext(level: number): number {
  if (level >= LEVEL_CAP) return Infinity;
  return Math.round(20 * level * level + 30 * level + 40);
}

export function isMaxLevel(level: number): boolean {
  return level >= LEVEL_CAP;
}
