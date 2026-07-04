import { GUILD_LEVEL_CAP, LEVEL_CAP } from "./constants.js";

// EXP required to advance FROM `level` to `level + 1`.
export function xpToNext(level: number): number {
  if (level >= LEVEL_CAP) return Infinity;
  return Math.round(20 * level * level + 30 * level + 40);
}

export function isMaxLevel(level: number): boolean {
  return level >= LEVEL_CAP;
}

// Guild EXP required to advance FROM `level` to `level + 1`. Steeper than a
// player's own curve since a whole roster's kills feed the same pool.
export function guildXpToNext(level: number): number {
  if (level >= GUILD_LEVEL_CAP) return Infinity;
  return Math.round(2000 * level * level + 3000 * level + 5000);
}

export function isGuildMaxLevel(level: number): boolean {
  return level >= GUILD_LEVEL_CAP;
}
