import { makeStats, type Stats } from "@rox/shared";

export interface MonsterTemplate {
  id: string;
  name: string;
  level: number;
  stats: Stats;
  baseHp: number;
  baseExp: number;
}

// A single starter monster for the slice: the iconic pink jelly, "Poring".
export const MONSTER_TEMPLATES: Record<string, MonsterTemplate> = {
  poring: {
    id: "poring",
    name: "Poring",
    level: 1,
    stats: makeStats({ str: 4, agi: 1, vit: 3, int: 1, dex: 6, luk: 5 }),
    baseHp: 50,
    baseExp: 28,
  },
};

export interface SpawnZone {
  id: string;
  templateId: string;
  cx: number; // center x
  cz: number; // center z
  radius: number;
  count: number; // how many alive monsters to maintain
}

// A few Poring fields scattered around the map.
export const SPAWN_ZONES: SpawnZone[] = [
  { id: "field-n", templateId: "poring", cx: 0, cz: -30, radius: 14, count: 6 },
  { id: "field-e", templateId: "poring", cx: 32, cz: 8, radius: 12, count: 5 },
  { id: "field-w", templateId: "poring", cx: -34, cz: 4, radius: 12, count: 5 },
  { id: "field-s", templateId: "poring", cx: 6, cz: 34, radius: 13, count: 6 },
];
