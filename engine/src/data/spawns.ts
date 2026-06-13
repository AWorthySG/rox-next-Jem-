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
  // ---- Aldebaran / Clock Tower ----
  punk: {
    id: "punk",
    name: "Punk",
    level: 38,
    stats: makeStats({ str: 42, agi: 30, vit: 26, int: 20, dex: 38, luk: 18 }),
    baseHp: 900,
    baseExp: 1600,
  },
  clock: {
    id: "clock",
    name: "Clock",
    level: 52,
    stats: makeStats({ str: 64, agi: 34, vit: 50, int: 24, dex: 50, luk: 22 }),
    baseHp: 2000,
    baseExp: 3400,
  },
  clock_tower_manager: {
    id: "clock_tower_manager",
    name: "Clock Tower Manager",
    level: 72,
    stats: makeStats({ str: 100, agi: 50, vit: 90, int: 50, dex: 75, luk: 45 }),
    baseHp: 24000,
    baseExp: 30000,
    respawnMs: 150000,
    boss: true,
  },
  // ---- Comodo (beach) ----
  sandman: {
    id: "sandman",
    name: "Sandman",
    level: 58,
    stats: makeStats({ str: 72, agi: 30, vit: 60, int: 20, dex: 52, luk: 24 }),
    baseHp: 2400,
    baseExp: 4000,
  },
  anolian: {
    id: "anolian",
    name: "Anolian",
    level: 66,
    stats: makeStats({ str: 84, agi: 50, vit: 58, int: 28, dex: 64, luk: 30 }),
    baseHp: 3200,
    baseExp: 5600,
  },
  // ---- Umbala (jungle) ----
  dryad: {
    id: "dryad",
    name: "Dryad",
    level: 70,
    stats: makeStats({ str: 90, agi: 44, vit: 72, int: 40, dex: 66, luk: 30 }),
    baseHp: 4200,
    baseExp: 7000,
  },
  stem_worm: {
    id: "stem_worm",
    name: "Stem Worm",
    level: 78,
    stats: makeStats({ str: 100, agi: 70, vit: 66, int: 36, dex: 80, luk: 34 }),
    baseHp: 5200,
    baseExp: 9000,
  },
  hardrock_mammoth: {
    id: "hardrock_mammoth",
    name: "Hardrock Mammoth",
    level: 85,
    stats: makeStats({ str: 120, agi: 50, vit: 100, int: 40, dex: 80, luk: 45 }),
    baseHp: 30000,
    baseExp: 42000,
    respawnMs: 160000,
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

// Compact factory: stats auto-scale with level so additional content stays terse.
function mk(id: string, name: string, level: number, baseHp: number, baseExp: number, boss = false): MonsterTemplate {
  return {
    id,
    name,
    level,
    stats: makeStats({
      str: Math.round(level * 1.4) + 4,
      agi: Math.round(level * 0.7) + 2,
      vit: Math.round(level * 1.1) + 4,
      int: Math.round(level * 0.5) + 2,
      dex: Math.round(level * 1.0) + 4,
      luk: Math.round(level * 0.5) + 2,
    }),
    baseHp,
    baseExp,
    ...(boss ? { boss: true, respawnMs: 150000 } : {}),
  };
}

Object.assign(MONSTER_TEMPLATES, {
  // extra regulars
  chonchon: mk("chonchon", "Chonchon", 3, 45, 32),
  coco: mk("coco", "Coco", 7, 150, 95),
  // map 2nd bosses (and Payon/Comodo bosses)
  angeling: mk("angeling", "Angeling", 20, 2600, 1500, true),
  eddga: mk("eddga", "Eddga", 14, 1900, 1100, true),
  moonlight: mk("moonlight", "Moonlight Flower", 17, 2300, 1400, true),
  mistress: mk("mistress", "Mistress", 18, 2500, 1500, true),
  amon_ra: mk("amon_ra", "Amon Ra", 42, 9000, 6200, true),
  owl_duke: mk("owl_duke", "Owl Duke", 62, 16000, 19000, true),
  kraken: mk("kraken", "Kraken", 64, 18000, 21000, true),
  tao_gunka: mk("tao_gunka", "Tao Gunka", 70, 28000, 33000, true),
  gloom: mk("gloom", "Gloom Under Night", 92, 36000, 50000, true),
  valkyrie_randgris: mk("valkyrie_randgris", "Valkyrie Randgris", 115, 66000, 100000, true),
  // Juno
  sleeper: mk("sleeper", "Sleeper", 76, 4800, 7600),
  hill_wind: mk("hill_wind", "Hill Wind", 82, 5600, 9200),
  kiel: mk("kiel", "Kiel D-01", 95, 46000, 66000, true),
  vesper: mk("vesper", "Vesper", 100, 54000, 80000, true),
  // Einbroch
  metaling: mk("metaling", "Metaling", 86, 6200, 10500),
  venatu: mk("venatu", "Venatu", 94, 7400, 13000),
  boitata: mk("boitata", "Boitata", 108, 62000, 96000, true),
  tendrilion: mk("tendrilion", "Tendrilion", 112, 70000, 112000, true),
  // Rachel
  vanberk: mk("vanberk", "Vanberk", 98, 8200, 15500),
  hodremlin: mk("hodremlin", "Hodremlin", 106, 9800, 19000),
  ktullanux: mk("ktullanux", "Ktullanux", 118, 82000, 140000, true),
  beelzebub: mk("beelzebub", "Beelzebub", 125, 115000, 210000, true),
});

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
