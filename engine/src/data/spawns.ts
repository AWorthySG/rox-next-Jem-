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
