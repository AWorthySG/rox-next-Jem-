import { makeStats, type Stats } from "@rox/shared";

export interface MonsterTemplate {
  id: string;
  name: string;
  level: number;
  stats: Stats;
  baseHp: number;
  baseExp: number;
  respawnMs?: number; // overrides the default respawn delay (bosses respawn slowly)
  boss?: boolean;
}

// A small bestiary of classic-feeling field monsters plus an MVP-style boss.
export const MONSTER_TEMPLATES: Record<string, MonsterTemplate> = {
  poring: {
    id: "poring",
    name: "Poring",
    level: 1,
    stats: makeStats({ str: 4, agi: 1, vit: 3, int: 1, dex: 6, luk: 5 }),
    baseHp: 50,
    baseExp: 28,
  },
  fabre: {
    id: "fabre",
    name: "Fabre",
    level: 2,
    stats: makeStats({ str: 6, agi: 2, vit: 4, int: 1, dex: 7, luk: 3 }),
    baseHp: 72,
    baseExp: 40,
  },
  drops: {
    id: "drops",
    name: "Drops",
    level: 3,
    stats: makeStats({ str: 9, agi: 3, vit: 5, int: 1, dex: 9, luk: 4 }),
    baseHp: 95,
    baseExp: 58,
  },
  lunatic: {
    id: "lunatic",
    name: "Lunatic",
    level: 5,
    stats: makeStats({ str: 12, agi: 8, vit: 6, int: 1, dex: 12, luk: 8 }),
    baseHp: 130,
    baseExp: 86,
  },
  poring_king: {
    id: "poring_king",
    name: "Poring King",
    level: 14,
    stats: makeStats({ str: 38, agi: 14, vit: 30, int: 5, dex: 26, luk: 18 }),
    baseHp: 1600,
    baseExp: 900,
    respawnMs: 90000,
    boss: true,
  },
  // ---- Payon Forest ----
  spore: {
    id: "spore",
    name: "Spore",
    level: 4,
    stats: makeStats({ str: 8, agi: 3, vit: 6, int: 1, dex: 8, luk: 4 }),
    baseHp: 110,
    baseExp: 70,
  },
  wolf: {
    id: "wolf",
    name: "Wolf",
    level: 9,
    stats: makeStats({ str: 18, agi: 14, vit: 10, int: 2, dex: 16, luk: 8 }),
    baseHp: 210,
    baseExp: 140,
  },
  // ---- Glast Heim dungeon ----
  zombie: {
    id: "zombie",
    name: "Zombie",
    level: 16,
    stats: makeStats({ str: 24, agi: 6, vit: 18, int: 4, dex: 18, luk: 6 }),
    baseHp: 320,
    baseExp: 200,
  },
  skeleton: {
    id: "skeleton",
    name: "Skeleton",
    level: 20,
    stats: makeStats({ str: 30, agi: 14, vit: 18, int: 6, dex: 24, luk: 10 }),
    baseHp: 420,
    baseExp: 280,
  },
  baphomet: {
    id: "baphomet",
    name: "Baphomet",
    level: 35,
    stats: makeStats({ str: 70, agi: 30, vit: 55, int: 20, dex: 45, luk: 30 }),
    baseHp: 6000,
    baseExp: 4200,
    respawnMs: 120000,
    boss: true,
  },
  // ---- Endless Tower (end-game grind to 130) ----
  wraith: {
    id: "wraith",
    name: "Wraith",
    level: 48,
    stats: makeStats({ str: 50, agi: 28, vit: 30, int: 30, dex: 40, luk: 20 }),
    baseHp: 1400,
    baseExp: 2600,
  },
  gargoyle: {
    id: "gargoyle",
    name: "Gargoyle",
    level: 60,
    stats: makeStats({ str: 70, agi: 40, vit: 45, int: 20, dex: 55, luk: 25 }),
    baseHp: 2600,
    baseExp: 4800,
  },
  dark_lord: {
    id: "dark_lord",
    name: "Dark Lord",
    level: 90,
    stats: makeStats({ str: 130, agi: 60, vit: 110, int: 60, dex: 90, luk: 60 }),
    baseHp: 40000,
    baseExp: 60000,
    respawnMs: 180000,
    boss: true,
  },
};

export interface SpawnZone {
  id: string;
  templateId: string;
  cx: number;
  cz: number;
  radius: number;
  count: number;
}

// Field zones by difficulty band, plus a lone boss arena to the far north.
export const SPAWN_ZONES: SpawnZone[] = [
  { id: "poring-field-w", templateId: "poring", cx: -34, cz: 4, radius: 13, count: 6 },
  { id: "poring-field-s", templateId: "poring", cx: 6, cz: 34, radius: 13, count: 6 },
  { id: "fabre-glade", templateId: "fabre", cx: 30, cz: 24, radius: 11, count: 5 },
  { id: "drops-dunes", templateId: "drops", cx: 34, cz: -8, radius: 12, count: 5 },
  { id: "lunatic-meadow", templateId: "lunatic", cx: -30, cz: -26, radius: 12, count: 5 },
  { id: "boss-arena", templateId: "poring_king", cx: 0, cz: -48, radius: 4, count: 1 },
];
