import { Element, makeStats, type Stats } from "@rox/shared";

// Distinct boss behaviours, driven on the server tick.
export type BossMechanic =
  | { kind: "enrage"; hpPct: number; atkMult: number } // hits harder below hpPct
  | { kind: "nova"; intervalMs: number; radius: number; powerMult: number } // periodic AoE around the boss
  | { kind: "summon"; intervalMs: number; templateId: string; count: number; max: number } // spawn minions
  | { kind: "heal"; intervalMs: number; pct: number }; // periodic self-heal

export interface MonsterTemplate {
  id: string;
  name: string;
  level: number;
  stats: Stats;
  baseHp: number;
  baseExp: number;
  respawnMs?: number; // overrides the default respawn delay (bosses respawn slowly)
  boss?: boolean;
  mechanics?: BossMechanic[];
  element?: Element; // defensive element (defaults to Neutral)
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
  // Thanatos Tower
  aliot: mk("aliot", "Aliot", 100, 9000, 17000),
  aliza: mk("aliza", "Aliza", 106, 10500, 20000),
  thanatos_phantom: mk("thanatos_phantom", "Thanatos Phantom", 122, 95000, 160000, true),
  memory_of_thanatos: mk("memory_of_thanatos", "Memory of Thanatos", 128, 140000, 260000, true),
  // ---- Morocc desert ----
  anubis: mk("anubis", "Anubis", 116, 11000, 21000),
  pasana: mk("pasana", "Pasana", 118, 12000, 23000),
  drake: mk("drake", "Drake", 120, 100000, 180000, true),
  satan_morroc: mk("satan_morroc", "Satan Morroc", 125, 150000, 260000, true),
  // ---- Bio Lab ----
  cecil: mk("cecil", "Cecil Damon", 122, 13000, 26000),
  wickebine: mk("wickebine", "Wickebine", 124, 14000, 28000),
  egnigem: mk("egnigem", "Egnigem Cenia", 124, 120000, 210000, true),
  kathryne: mk("kathryne", "Kathryne Keyron", 127, 135000, 240000, true),
  // ---- Abyss Lake ----
  ferus: mk("ferus", "Ferus", 126, 15000, 31000),
  acidus: mk("acidus", "Acidus", 128, 16000, 34000),
  detale: mk("detale", "Detardeurus", 128, 160000, 280000, true),
  nidhoggr: mk("nidhoggr", "Nidhoggr's Shadow", 130, 200000, 350000, true),
  // ---- Geffen Tower (mid-level mage tournament) ----
  marionette: mk("marionette", "Marionette", 30, 1500, 950),
  nightmare: mk("nightmare", "Nightmare", 36, 1900, 1300),
  marduk: mk("marduk", "Marduk", 33, 1650, 1100),
  doppelganger: mk("doppelganger", "Doppelganger", 45, 6500, 9500, true),
  dark_priest: mk("dark_priest", "Dark Priest", 48, 7500, 11500, true),
  // ---- Niflheim (realm of the dead) ----
  loli_ruri: mk("loli_ruri", "Loli Ruri", 88, 6800, 11500),
  quve: mk("quve", "Quve", 90, 7200, 12500),
  gibbet: mk("gibbet", "Gibbet", 92, 7800, 13500),
  bacsojin: mk("bacsojin", "White Lady Bacsojin", 95, 48000, 70000, true),
  fallen_bishop: mk("fallen_bishop", "Fallen Bishop", 98, 56000, 84000, true),
  // ---- Amatsu (eastern lands) ----
  poison_spore: mk("poison_spore", "Poison Spore", 55, 2800, 6500),
  karakasa: mk("karakasa", "Karakasa", 58, 3100, 7200),
  tengu: mk("tengu", "Tengu", 62, 3600, 8500),
  samurai_specter: mk("samurai_specter", "Samurai Specter", 66, 22000, 38000, true),
  kapha: mk("kapha", "Kapha", 70, 26000, 46000, true),
  // ---- Lutie Snowfield ----
  cookie: mk("cookie", "Christmas Cookie", 42, 2000, 4200),
  myst_case: mk("myst_case", "Myst Case", 45, 2300, 5000),
  antonio: mk("antonio", "Antonio", 40, 1800, 3800),
  stormy_knight: mk("stormy_knight", "Stormy Knight", 50, 9500, 16000, true),
  garm: mk("garm", "Garm", 55, 12000, 21000, true),
  // ---- Ayothaya (jungle temple) ----
  kobold: mk("kobold", "Kobold", 72, 4200, 9000),
  elder_willow: mk("elder_willow", "Elder Willow", 74, 4500, 9800),
  brilight: mk("brilight", "Brilight", 76, 4800, 10500),
  lady_tanee: mk("lady_tanee", "Lady Tanee", 80, 30000, 52000, true),
  leak: mk("leak", "Leak", 85, 36000, 64000, true),
  // ---- Moscovia (northern forest) ----
  les: mk("les", "Les", 78, 5000, 11000),
  mavka: mk("mavka", "Mavka", 80, 5300, 11800),
  uzhas: mk("uzhas", "Uzhas", 82, 5600, 12600),
  gopinich: mk("gopinich", "Gopinich", 88, 38000, 58000, true),
  baba_yaga: mk("baba_yaga", "Baba Yaga", 90, 42000, 66000, true),
  // ---- Thor Volcano ----
  magmaring: mk("magmaring", "Magmaring", 92, 6000, 13500),
  kasa: mk("kasa", "Kasa", 95, 6600, 14500),
  salamander: mk("salamander", "Salamander", 98, 7200, 15800),
  gigantes: mk("gigantes", "Gigantes", 105, 60000, 92000, true),
  ifrit: mk("ifrit", "Ifrit", 110, 78000, 130000, true),
  // ---- Byalan Sunken Cave ----
  marc: mk("marc", "Marc", 18, 520, 320),
  vadon: mk("vadon", "Vadon", 20, 600, 380),
  kukre: mk("kukre", "Kukre", 22, 680, 440),
  phreeoni: mk("phreeoni", "Phreeoni", 28, 5200, 8500, true),
  deviace: mk("deviace", "Deviace", 32, 6200, 10000, true),
  // ---- Orc Village ----
  orc_warrior: mk("orc_warrior", "Orc Warrior", 32, 1600, 1100),
  orc_archer: mk("orc_archer", "Orc Archer", 34, 1750, 1250),
  orc_zombie: mk("orc_zombie", "Orc Zombie", 36, 1900, 1400),
  orc_lord: mk("orc_lord", "Orc Lord", 42, 6000, 9000, true),
  orc_hero: mk("orc_hero", "Orc Hero", 45, 7000, 11000, true),
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

// ---- per-boss fight mechanics ----
const BOSS_MECHANICS: Record<string, BossMechanic[]> = {
  poring_king: [
    { kind: "summon", intervalMs: 9000, templateId: "poring", count: 3, max: 6 },
    { kind: "heal", intervalMs: 12000, pct: 0.06 },
  ],
  baphomet: [
    { kind: "enrage", hpPct: 0.3, atkMult: 1.6 },
    { kind: "nova", intervalMs: 7000, radius: 9, powerMult: 1.4 },
  ],
  clock_tower_manager: [
    { kind: "summon", intervalMs: 8000, templateId: "punk", count: 2, max: 5 },
    { kind: "enrage", hpPct: 0.35, atkMult: 1.5 },
  ],
  hardrock_mammoth: [
    { kind: "nova", intervalMs: 6000, radius: 10, powerMult: 1.5 },
    { kind: "heal", intervalMs: 14000, pct: 0.05 },
  ],
  kraken: [{ kind: "nova", intervalMs: 6500, radius: 11, powerMult: 1.3 }],
  tao_gunka: [{ kind: "enrage", hpPct: 0.5, atkMult: 1.8 }],
  gloom: [
    { kind: "nova", intervalMs: 6000, radius: 9, powerMult: 1.6 },
    { kind: "enrage", hpPct: 0.3, atkMult: 1.5 },
  ],
  dark_lord: [
    { kind: "enrage", hpPct: 0.4, atkMult: 1.6 },
    { kind: "nova", intervalMs: 6000, radius: 10, powerMult: 1.5 },
    { kind: "summon", intervalMs: 11000, templateId: "skeleton", count: 2, max: 4 },
  ],
  kiel: [
    { kind: "nova", intervalMs: 5500, radius: 9, powerMult: 1.7 },
    { kind: "enrage", hpPct: 0.3, atkMult: 1.6 },
  ],
  vesper: [
    { kind: "summon", intervalMs: 10000, templateId: "venatu", count: 2, max: 4 },
    { kind: "nova", intervalMs: 6500, radius: 10, powerMult: 1.5 },
  ],
  boitata: [{ kind: "nova", intervalMs: 6000, radius: 11, powerMult: 1.6 }],
  tendrilion: [
    { kind: "summon", intervalMs: 9000, templateId: "venatu", count: 3, max: 5 },
    { kind: "heal", intervalMs: 13000, pct: 0.05 },
  ],
  valkyrie_randgris: [
    { kind: "heal", intervalMs: 11000, pct: 0.06 },
    { kind: "nova", intervalMs: 6000, radius: 10, powerMult: 1.6 },
  ],
  ktullanux: [
    { kind: "nova", intervalMs: 5500, radius: 11, powerMult: 1.7 },
    { kind: "enrage", hpPct: 0.3, atkMult: 1.6 },
  ],
  beelzebub: [
    { kind: "enrage", hpPct: 0.5, atkMult: 1.8 },
    { kind: "nova", intervalMs: 5000, radius: 12, powerMult: 1.8 },
    { kind: "summon", intervalMs: 9000, templateId: "venatu", count: 3, max: 6 },
    { kind: "heal", intervalMs: 15000, pct: 0.04 },
  ],
  thanatos_phantom: [
    { kind: "enrage", hpPct: 0.4, atkMult: 1.7 },
    { kind: "nova", intervalMs: 5500, radius: 11, powerMult: 1.7 },
  ],
  memory_of_thanatos: [
    { kind: "enrage", hpPct: 0.5, atkMult: 1.9 },
    { kind: "nova", intervalMs: 4500, radius: 13, powerMult: 1.9 },
    { kind: "summon", intervalMs: 8000, templateId: "aliot", count: 3, max: 6 },
    { kind: "heal", intervalMs: 14000, pct: 0.05 },
  ],
  drake: [
    { kind: "summon", intervalMs: 9000, templateId: "pasana", count: 2, max: 4 },
    { kind: "nova", intervalMs: 6500, radius: 10, powerMult: 1.5 },
  ],
  satan_morroc: [
    { kind: "enrage", hpPct: 0.5, atkMult: 1.9 },
    { kind: "nova", intervalMs: 5000, radius: 12, powerMult: 1.8 },
    { kind: "summon", intervalMs: 9000, templateId: "anubis", count: 3, max: 6 },
    { kind: "heal", intervalMs: 15000, pct: 0.04 },
  ],
  egnigem: [
    { kind: "enrage", hpPct: 0.35, atkMult: 1.6 },
    { kind: "summon", intervalMs: 8000, templateId: "wickebine", count: 2, max: 5 },
  ],
  kathryne: [
    { kind: "nova", intervalMs: 5500, radius: 11, powerMult: 1.8 },
    { kind: "heal", intervalMs: 11000, pct: 0.06 },
  ],
  detale: [
    { kind: "enrage", hpPct: 0.4, atkMult: 1.7 },
    { kind: "nova", intervalMs: 5000, radius: 12, powerMult: 1.8 },
  ],
  nidhoggr: [
    { kind: "enrage", hpPct: 0.5, atkMult: 2.0 },
    { kind: "nova", intervalMs: 4500, radius: 13, powerMult: 1.9 },
    { kind: "summon", intervalMs: 8000, templateId: "ferus", count: 3, max: 6 },
    { kind: "heal", intervalMs: 13000, pct: 0.05 },
  ],
  doppelganger: [
    { kind: "summon", intervalMs: 8000, templateId: "marionette", count: 2, max: 4 },
    { kind: "enrage", hpPct: 0.3, atkMult: 1.5 },
  ],
  dark_priest: [
    { kind: "nova", intervalMs: 6000, radius: 9, powerMult: 1.5 },
    { kind: "heal", intervalMs: 10000, pct: 0.07 },
  ],
  bacsojin: [
    { kind: "nova", intervalMs: 5500, radius: 10, powerMult: 1.6 },
    { kind: "heal", intervalMs: 10000, pct: 0.06 },
  ],
  fallen_bishop: [
    { kind: "enrage", hpPct: 0.35, atkMult: 1.6 },
    { kind: "summon", intervalMs: 8500, templateId: "gibbet", count: 2, max: 5 },
    { kind: "nova", intervalMs: 6000, radius: 10, powerMult: 1.6 },
  ],
  samurai_specter: [
    { kind: "enrage", hpPct: 0.3, atkMult: 1.6 },
    { kind: "summon", intervalMs: 8000, templateId: "karakasa", count: 2, max: 4 },
  ],
  kapha: [
    { kind: "nova", intervalMs: 6000, radius: 10, powerMult: 1.5 },
    { kind: "heal", intervalMs: 11000, pct: 0.06 },
  ],
  stormy_knight: [
    { kind: "nova", intervalMs: 5500, radius: 10, powerMult: 1.6 },
    { kind: "enrage", hpPct: 0.3, atkMult: 1.5 },
  ],
  garm: [
    { kind: "summon", intervalMs: 8000, templateId: "antonio", count: 2, max: 4 },
    { kind: "nova", intervalMs: 6000, radius: 11, powerMult: 1.6 },
  ],
  lady_tanee: [
    { kind: "summon", intervalMs: 8000, templateId: "elder_willow", count: 2, max: 5 },
    { kind: "heal", intervalMs: 10000, pct: 0.06 },
  ],
  leak: [
    { kind: "enrage", hpPct: 0.35, atkMult: 1.6 },
    { kind: "nova", intervalMs: 5500, radius: 11, powerMult: 1.7 },
  ],
  gopinich: [
    { kind: "enrage", hpPct: 0.35, atkMult: 1.6 },
    { kind: "nova", intervalMs: 5500, radius: 11, powerMult: 1.7 },
  ],
  baba_yaga: [
    { kind: "nova", intervalMs: 5500, radius: 10, powerMult: 1.6 },
    { kind: "summon", intervalMs: 8000, templateId: "uzhas", count: 2, max: 5 },
    { kind: "heal", intervalMs: 11000, pct: 0.06 },
  ],
  gigantes: [
    { kind: "enrage", hpPct: 0.4, atkMult: 1.6 },
    { kind: "nova", intervalMs: 6000, radius: 11, powerMult: 1.6 },
  ],
  ifrit: [
    { kind: "enrage", hpPct: 0.5, atkMult: 1.8 },
    { kind: "nova", intervalMs: 5000, radius: 12, powerMult: 1.8 },
    { kind: "summon", intervalMs: 8500, templateId: "kasa", count: 2, max: 5 },
    { kind: "heal", intervalMs: 14000, pct: 0.04 },
  ],
  phreeoni: [
    { kind: "enrage", hpPct: 0.3, atkMult: 1.5 },
    { kind: "summon", intervalMs: 9000, templateId: "marc", count: 2, max: 4 },
  ],
  deviace: [
    { kind: "nova", intervalMs: 6000, radius: 9, powerMult: 1.4 },
    { kind: "heal", intervalMs: 12000, pct: 0.05 },
  ],
  orc_lord: [
    { kind: "summon", intervalMs: 8000, templateId: "orc_warrior", count: 2, max: 5 },
    { kind: "enrage", hpPct: 0.3, atkMult: 1.5 },
  ],
  orc_hero: [
    { kind: "enrage", hpPct: 0.4, atkMult: 1.7 },
    { kind: "nova", intervalMs: 5500, radius: 10, powerMult: 1.6 },
  ],
};
for (const [id, mechs] of Object.entries(BOSS_MECHANICS)) {
  if (MONSTER_TEMPLATES[id]) MONSTER_TEMPLATES[id].mechanics = mechs;
}

// ---- defensive elements ----
// Thematic element per monster so the combat chart rewards exploiting weaknesses
// (e.g. Water magic melts the fiery Boitata; Holy scorches the undead). Anything
// unlisted stays Neutral.
const MONSTER_ELEMENTS: Record<string, Element> = {
  // plants / insects lean Earth; water creatures Water; undead Shadow; etc.
  poring: Element.Water,
  drops: Element.Fire,
  spore: Element.Earth,
  dryad: Element.Earth,
  stem_worm: Element.Earth,
  tendrilion: Element.Earth,
  zombie: Element.Shadow,
  skeleton: Element.Shadow,
  wraith: Element.Shadow,
  dark_lord: Element.Shadow,
  baphomet: Element.Shadow,
  gloom: Element.Shadow,
  beelzebub: Element.Shadow,
  thanatos_phantom: Element.Shadow,
  memory_of_thanatos: Element.Shadow,
  sandman: Element.Earth,
  anolian: Element.Water,
  kraken: Element.Water,
  hardrock_mammoth: Element.Earth,
  tao_gunka: Element.Earth,
  hill_wind: Element.Wind,
  gargoyle: Element.Wind,
  vesper: Element.Wind,
  boitata: Element.Fire,
  ktullanux: Element.Water,
  metaling: Element.Fire,
  venatu: Element.Wind,
  angeling: Element.Holy,
  valkyrie_randgris: Element.Holy,
  amon_ra: Element.Holy,
  kiel: Element.Wind,
  moonlight: Element.Wind,
  mistress: Element.Wind,
  vanberk: Element.Fire,
  hodremlin: Element.Earth,
  anubis: Element.Shadow,
  pasana: Element.Fire,
  drake: Element.Water,
  satan_morroc: Element.Shadow,
  cecil: Element.Wind,
  wickebine: Element.Shadow,
  egnigem: Element.Earth,
  kathryne: Element.Shadow,
  ferus: Element.Fire,
  acidus: Element.Wind,
  detale: Element.Fire,
  nidhoggr: Element.Shadow,
  marionette: Element.Shadow,
  nightmare: Element.Shadow,
  marduk: Element.Wind,
  doppelganger: Element.Shadow,
  dark_priest: Element.Holy,
  loli_ruri: Element.Shadow,
  quve: Element.Wind,
  gibbet: Element.Shadow,
  bacsojin: Element.Wind,
  fallen_bishop: Element.Shadow,
  poison_spore: Element.Earth,
  karakasa: Element.Wind,
  tengu: Element.Wind,
  samurai_specter: Element.Shadow,
  kapha: Element.Water,
  cookie: Element.Water,
  myst_case: Element.Earth,
  antonio: Element.Fire,
  stormy_knight: Element.Water,
  garm: Element.Water,
  kobold: Element.Fire,
  elder_willow: Element.Earth,
  brilight: Element.Wind,
  lady_tanee: Element.Earth,
  leak: Element.Water,
  les: Element.Wind,
  mavka: Element.Earth,
  uzhas: Element.Shadow,
  gopinich: Element.Fire,
  baba_yaga: Element.Shadow,
  magmaring: Element.Fire,
  kasa: Element.Fire,
  salamander: Element.Fire,
  gigantes: Element.Earth,
  ifrit: Element.Fire,
  marc: Element.Water,
  vadon: Element.Water,
  kukre: Element.Earth,
  phreeoni: Element.Water,
  deviace: Element.Water,
  orc_warrior: Element.Earth,
  orc_archer: Element.Wind,
  orc_zombie: Element.Shadow,
  orc_lord: Element.Earth,
  orc_hero: Element.Fire,
};
for (const [id, el] of Object.entries(MONSTER_ELEMENTS)) {
  if (MONSTER_TEMPLATES[id]) MONSTER_TEMPLATES[id].element = el;
}
