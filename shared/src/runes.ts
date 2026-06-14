import type { Stats } from "./stats.js";

export interface RuneDef {
  id: string;
  name: string;
  line: string; // which path it belongs to
  tier: number; // 1-based position in the path
  cost: number; // rune points to unlock
  requires?: string; // must unlock this rune first
  desc: string;
  bonusStats?: Partial<Stats>;
  atk?: number;
  matk?: number;
  def?: number;
  maxHp?: number;
  maxSp?: number;
  crit?: number;
}

// The Aesir Monument: five passive paths, each a small chain of runes unlocked
// with rune points (earned on level-up).
export const RUNE_LINES = ["Might", "Guard", "Mystic", "Swift", "Fortune"] as const;

function line(line: string, defs: Array<Omit<RuneDef, "line" | "tier" | "requires"> & { req?: string }>): RuneDef[] {
  return defs.map((d, i) => ({
    ...d,
    line,
    tier: i + 1,
    requires: i > 0 ? defs[i - 1].id : undefined,
  }));
}

const ALL: RuneDef[] = [
  ...line("Might", [
    { id: "might1", name: "Power I", cost: 1, desc: "STR +3", bonusStats: { str: 3 } },
    { id: "might2", name: "Power II", cost: 2, desc: "ATK +15", atk: 15 },
    { id: "might3", name: "Power III", cost: 3, desc: "STR +5", bonusStats: { str: 5 } },
    { id: "might4", name: "Berserk", cost: 5, desc: "ATK +35, STR +5", atk: 35, bonusStats: { str: 5 } },
  ]),
  ...line("Guard", [
    { id: "guard1", name: "Vigor I", cost: 1, desc: "VIT +3", bonusStats: { vit: 3 } },
    { id: "guard2", name: "Bulwark", cost: 2, desc: "Max HP +150", maxHp: 150 },
    { id: "guard3", name: "Iron Skin", cost: 3, desc: "DEF +8", def: 8 },
    { id: "guard4", name: "Fortress", cost: 5, desc: "Max HP +400, VIT +5", maxHp: 400, bonusStats: { vit: 5 } },
  ]),
  ...line("Mystic", [
    { id: "mystic1", name: "Insight I", cost: 1, desc: "INT +3", bonusStats: { int: 3 } },
    { id: "mystic2", name: "Spell Power", cost: 2, desc: "MATK +15", matk: 15 },
    { id: "mystic3", name: "Deep Well", cost: 3, desc: "Max SP +80", maxSp: 80 },
    { id: "mystic4", name: "Archmagic", cost: 5, desc: "MATK +35, INT +5", matk: 35, bonusStats: { int: 5 } },
  ]),
  ...line("Swift", [
    { id: "swift1", name: "Agility I", cost: 1, desc: "AGI +3", bonusStats: { agi: 3 } },
    { id: "swift2", name: "Precision", cost: 2, desc: "DEX +3", bonusStats: { dex: 3 } },
    { id: "swift3", name: "Keen Eye", cost: 3, desc: "Crit +8%", crit: 8 },
    { id: "swift4", name: "Tempest", cost: 5, desc: "AGI +5, DEX +5", bonusStats: { agi: 5, dex: 5 } },
  ]),
  ...line("Fortune", [
    { id: "fortune1", name: "Luck I", cost: 1, desc: "LUK +3", bonusStats: { luk: 3 } },
    { id: "fortune2", name: "Luck II", cost: 2, desc: "LUK +5", bonusStats: { luk: 5 } },
    { id: "fortune3", name: "Blessing", cost: 3, desc: "All stats +2", bonusStats: { str: 2, agi: 2, vit: 2, int: 2, dex: 2, luk: 2 } },
    { id: "fortune4", name: "Destiny", cost: 5, desc: "LUK +8, Max HP +200", bonusStats: { luk: 8 }, maxHp: 200 },
  ]),
];

export const RUNES: Record<string, RuneDef> = Object.fromEntries(ALL.map((r) => [r.id, r]));

export function getRune(id: string): RuneDef | undefined {
  return RUNES[id];
}

export function runesByLine(line: string): RuneDef[] {
  return ALL.filter((r) => r.line === line);
}
