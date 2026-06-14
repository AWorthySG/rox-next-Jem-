import { REFINE_BASE_COST } from "./constants.js";
import { EquipSlot, ItemType } from "./enums.js";
import type { Stats } from "./stats.js";

// Zeny cost to take an item from `level` to `level + 1`.
export function refineCost(level: number): number {
  return REFINE_BASE_COST * (level + 1);
}

// Stat bonuses granted by `level` refines on an equipment item.
export function refineBonus(item: { atk?: number; matk?: number; def?: number; maxHp?: number }, level: number) {
  return {
    atk: item.atk ? level * 2 : 0,
    matk: item.matk ? level * 2 : 0,
    def: item.def ? level * 2 : 0,
    maxHp: item.maxHp ? level * 6 : 0,
  };
}

// A timed buff granted by eating a food/cooking item.
export interface FoodBuff {
  durationMs: number;
  bonusStats?: Partial<Stats>;
  atk?: number;
  matk?: number;
  def?: number;
  crit?: number;
  maxHp?: number;
  maxSp?: number;
}

export interface ItemDef {
  id: string;
  name: string;
  type: ItemType;
  desc: string;
  slot?: EquipSlot; // for equipment
  cardSlot?: EquipSlot; // for cards: which equipped item type it sockets into
  // equipment bonuses
  bonusStats?: Partial<Stats>;
  atk?: number;
  matk?: number;
  def?: number;
  maxHp?: number;
  maxSp?: number;
  // consumable effects
  healHp?: number;
  healSp?: number;
  food?: FoodBuff; // eating grants a timed stat buff
  pet?: string; // summons this pet when used
  mount?: boolean; // toggles riding a mount when used
  // economy
  price?: number; // buy cost at the shop (omitted = not sold)
  sellPrice?: number; // Zeny gained when sold
}

export type ItemRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

// Rarity is derived from value so the catalogue stays terse; colours the UI.
export function rarityOf(item: ItemDef): ItemRarity {
  const v = item.sellPrice ?? 0;
  if (v >= 2000) return "legendary";
  if (v >= 700) return "epic";
  if (v >= 150) return "rare";
  if (v >= 40) return "uncommon";
  return "common";
}

// A compact item catalogue. Both server and client read this; the client only
// needs the id + qty over the wire and looks the rest up here.
export const ITEMS: Record<string, ItemDef> = {
  // consumables
  apple: { id: "apple", name: "Apple", type: ItemType.Consumable, desc: "Restores 60 HP.", healHp: 60, price: 15, sellPrice: 4 },
  red_potion: { id: "red_potion", name: "Red Potion", type: ItemType.Consumable, desc: "Restores 150 HP.", healHp: 150, price: 50, sellPrice: 12 },
  blue_potion: { id: "blue_potion", name: "Blue Potion", type: ItemType.Consumable, desc: "Restores 80 SP.", healSp: 80, price: 60, sellPrice: 15 },

  // food / cooking (eat for a timed stat buff; 5 min unless noted)
  fried_egg: { id: "fried_egg", name: "Fried Egg", type: ItemType.Consumable, desc: "Eat: VIT +5, Max HP +80 for 5 min.", food: { durationMs: 300000, bonusStats: { vit: 5 }, maxHp: 80 }, price: 120, sellPrice: 20 },
  honey_pancake: { id: "honey_pancake", name: "Honey Pancake", type: ItemType.Consumable, desc: "Eat: INT +5, Max SP +60 for 5 min.", food: { durationMs: 300000, bonusStats: { int: 5 }, maxSp: 60 }, price: 120, sellPrice: 20 },
  spicy_skewer: { id: "spicy_skewer", name: "Spicy Skewer", type: ItemType.Consumable, desc: "Eat: STR +5, ATK +15 for 5 min.", food: { durationMs: 300000, bonusStats: { str: 5 }, atk: 15 }, price: 160, sellPrice: 28 },
  steamed_tuna: { id: "steamed_tuna", name: "Steamed Tuna", type: ItemType.Consumable, desc: "Eat: AGI +5, CRIT +6 for 5 min.", food: { durationMs: 300000, bonusStats: { agi: 5 }, crit: 6 }, price: 160, sellPrice: 28 },
  royal_feast: { id: "royal_feast", name: "Royal Feast", type: ItemType.Consumable, desc: "Eat: all stats +4, ATK/MATK +12 for 10 min.", food: { durationMs: 600000, bonusStats: { str: 4, agi: 4, vit: 4, int: 4, dex: 4, luk: 4 }, atk: 12, matk: 12 }, sellPrice: 200 },

  // pet eggs (use to summon a companion)
  poring_egg: { id: "poring_egg", name: "Poring Egg", type: ItemType.Consumable, desc: "Summons a Poring pet (LUK +3, Max HP +50).", pet: "poring_pet", price: 800, sellPrice: 100 },
  lunatic_egg: { id: "lunatic_egg", name: "Lunatic Egg", type: ItemType.Consumable, desc: "Summons a Lunatic pet (AGI +3, DEX +2).", pet: "lunatic_pet", sellPrice: 150 },
  baphomet_egg: { id: "baphomet_egg", name: "Baphomet Egg", type: ItemType.Consumable, desc: "Summons Baphomet Jr. (STR +4, INT +4, Max HP +80).", pet: "baphomet_pet", sellPrice: 1200 },
  peco_whistle: { id: "peco_whistle", name: "Peco Peco Whistle", type: ItemType.Consumable, desc: "Summon/dismiss a Peco Peco mount (faster movement). Reusable — not consumed.", mount: true, price: 1500, sellPrice: 200 },

  // weapons
  novice_knife: {
    id: "novice_knife",
    name: "Novice Knife",
    type: ItemType.Weapon,
    slot: EquipSlot.Weapon,
    desc: "A simple blade. ATK +6.",
    atk: 6,
    price: 120,
    sellPrice: 30,
  },
  apprentice_rod: {
    id: "apprentice_rod",
    name: "Apprentice Rod",
    type: ItemType.Weapon,
    slot: EquipSlot.Weapon,
    desc: "A novice wizard's rod. MATK +8.",
    matk: 8,
    price: 140,
    sellPrice: 35,
  },
  kings_cleaver: {
    id: "kings_cleaver",
    name: "King's Cleaver",
    type: ItemType.Weapon,
    slot: EquipSlot.Weapon,
    desc: "Dropped by the Poring King. ATK +22, STR +3.",
    atk: 22,
    bonusStats: { str: 3 },
    sellPrice: 800,
  },

  // armor
  cotton_shirt: {
    id: "cotton_shirt",
    name: "Cotton Shirt",
    type: ItemType.Armor,
    slot: EquipSlot.Armor,
    desc: "Light armor. DEF +4, Max HP +30.",
    def: 4,
    maxHp: 30,
    price: 100,
    sellPrice: 25,
  },
  leather_armor: {
    id: "leather_armor",
    name: "Leather Armor",
    type: ItemType.Armor,
    slot: EquipSlot.Armor,
    desc: "Sturdier armor. DEF +9, Max HP +70, VIT +2.",
    def: 9,
    maxHp: 70,
    bonusStats: { vit: 2 },
    price: 420,
    sellPrice: 105,
  },

  // accessories
  ring_of_power: {
    id: "ring_of_power",
    name: "Ring of Power",
    type: ItemType.Accessory,
    slot: EquipSlot.Accessory,
    desc: "STR +3, DEX +2.",
    bonusStats: { str: 3, dex: 2 },
    price: 600,
    sellPrice: 150,
  },
  poring_crown: {
    id: "poring_crown",
    name: "Poring Crown",
    type: ItemType.Accessory,
    slot: EquipSlot.Accessory,
    desc: "The King's crown. LUK +5, Max SP +30.",
    bonusStats: { luk: 5 },
    maxSp: 30,
    sellPrice: 500,
  },

  // ---- Glast Heim tier ----
  claymore: {
    id: "claymore",
    name: "Claymore",
    type: ItemType.Weapon,
    slot: EquipSlot.Weapon,
    desc: "A massive greatsword. ATK +34, STR +2.",
    atk: 34,
    bonusStats: { str: 2 },
    sellPrice: 600,
  },
  saint_robe: {
    id: "saint_robe",
    name: "Saint's Robe",
    type: ItemType.Armor,
    slot: EquipSlot.Armor,
    desc: "Blessed armor. DEF +14, Max HP +120, INT +3.",
    def: 14,
    maxHp: 120,
    bonusStats: { int: 3 },
    sellPrice: 480,
  },
  rosary: {
    id: "rosary",
    name: "Rosary",
    type: ItemType.Accessory,
    slot: EquipSlot.Accessory,
    desc: "A holy charm. INT +4, LUK +3.",
    bonusStats: { int: 4, luk: 3 },
    sellPrice: 420,
  },
  baphomet_horn: {
    id: "baphomet_horn",
    name: "Baphomet Horn",
    type: ItemType.Accessory,
    slot: EquipSlot.Accessory,
    desc: "Trophy of the demon lord. STR +5, INT +5, Max HP +150.",
    bonusStats: { str: 5, int: 5 },
    maxHp: 150,
    sellPrice: 2500,
  },

  // ---- Aldebaran / Clock Tower ----
  clock_gear: {
    id: "clock_gear",
    name: "Clock Gear",
    type: ItemType.Accessory,
    slot: EquipSlot.Accessory,
    desc: "A precise mechanism. AGI +5, DEX +4.",
    bonusStats: { agi: 5, dex: 4 },
    sellPrice: 1800,
  },

  // ---- Comodo / Umbala tier ----
  tidal_shoes: {
    id: "tidal_shoes",
    name: "Tidal Shoes",
    type: ItemType.Accessory,
    slot: EquipSlot.Accessory,
    desc: "Light as sea foam. AGI +6, VIT +3.",
    bonusStats: { agi: 6, vit: 3 },
    sellPrice: 2200,
  },
  spirit_staff: {
    id: "spirit_staff",
    name: "Spirit Staff",
    type: ItemType.Weapon,
    slot: EquipSlot.Weapon,
    desc: "Carved by shamans. MATK +44, INT +4.",
    matk: 44,
    bonusStats: { int: 4 },
    sellPrice: 3200,
  },

  // ---- Endless Tower tier ----
  valkyrie_armor: {
    id: "valkyrie_armor",
    name: "Valkyrie Armor",
    type: ItemType.Armor,
    slot: EquipSlot.Armor,
    desc: "Legendary plate. DEF +28, Max HP +300, VIT +5.",
    def: 28,
    maxHp: 300,
    bonusStats: { vit: 5 },
    sellPrice: 4000,
  },
  dragon_slayer: {
    id: "dragon_slayer",
    name: "Dragon Slayer",
    type: ItemType.Weapon,
    slot: EquipSlot.Weapon,
    desc: "A blade of legend. ATK +60, STR +5, DEX +3.",
    atk: 60,
    bonusStats: { str: 5, dex: 3 },
    sellPrice: 5000,
  },
  immortal_heart: {
    id: "immortal_heart",
    name: "Immortal Heart",
    type: ItemType.Accessory,
    slot: EquipSlot.Accessory,
    desc: "Pulsing with power. INT +8, STR +8, Max HP +250, Max SP +80.",
    bonusStats: { int: 8, str: 8 },
    maxHp: 250,
    maxSp: 80,
    sellPrice: 6000,
  },
  thanatos_sword: {
    id: "thanatos_sword",
    name: "Sword of Thanatos",
    type: ItemType.Weapon,
    slot: EquipSlot.Weapon,
    desc: "The cursed blade. ATK +90, MATK +60, STR +8, INT +8.",
    atk: 90,
    matk: 60,
    bonusStats: { str: 8, int: 8 },
    sellPrice: 9000,
  },
  fallen_angel_wing: {
    id: "fallen_angel_wing",
    name: "Fallen Angel Wing",
    type: ItemType.Armor,
    slot: EquipSlot.Armor,
    desc: "Wings of the abyss. DEF +40, Max HP +500, all stats +4.",
    def: 40,
    maxHp: 500,
    bonusStats: { str: 4, agi: 4, vit: 4, int: 4, dex: 4, luk: 4 },
    sellPrice: 12000,
  },

  // ---- headgear ----
  feather_beret: {
    id: "feather_beret",
    name: "Feather Beret",
    type: ItemType.Headgear,
    slot: EquipSlot.Headgear,
    desc: "A jaunty cap. DEF +3, AGI +2.",
    def: 3,
    bonusStats: { agi: 2 },
    price: 350,
    sellPrice: 80,
  },
  poring_hat: {
    id: "poring_hat",
    name: "Poring Hat",
    type: ItemType.Headgear,
    slot: EquipSlot.Headgear,
    desc: "A squishy pink hat. Max HP +60, LUK +3.",
    maxHp: 60,
    bonusStats: { luk: 3 },
    sellPrice: 300,
  },
  apprentice_circlet: {
    id: "apprentice_circlet",
    name: "Apprentice Circlet",
    type: ItemType.Headgear,
    slot: EquipSlot.Headgear,
    desc: "A focusing circlet. MATK +10, INT +3, Max SP +30.",
    matk: 10,
    bonusStats: { int: 3 },
    maxSp: 30,
    sellPrice: 600,
  },
  gem_crown: {
    id: "gem_crown",
    name: "Gemmed Crown",
    type: ItemType.Headgear,
    slot: EquipSlot.Headgear,
    desc: "A jeweled circlet. DEF +12, all stats +3, Max HP +120.",
    def: 12,
    bonusStats: { str: 3, agi: 3, vit: 3, int: 3, dex: 3, luk: 3 },
    maxHp: 120,
    sellPrice: 3000,
  },
  valkyrie_helm: {
    id: "valkyrie_helm",
    name: "Valkyrie Helm",
    type: ItemType.Headgear,
    slot: EquipSlot.Headgear,
    desc: "Helm of the war maidens. DEF +22, VIT +6, Max HP +260, ATK +12.",
    def: 22,
    atk: 12,
    bonusStats: { vit: 6 },
    maxHp: 260,
    sellPrice: 5500,
  },

  // ---- cards (socket into equipped gear) ----
  poring_card: { id: "poring_card", name: "Poring Card", type: ItemType.Card, cardSlot: EquipSlot.Accessory, desc: "Accessory card. LUK +4, Max HP +30.", bonusStats: { luk: 4 }, maxHp: 30, sellPrice: 400 },
  skeleton_card: { id: "skeleton_card", name: "Skeleton Card", type: ItemType.Card, cardSlot: EquipSlot.Weapon, desc: "Weapon card. ATK +12.", atk: 12, sellPrice: 800 },
  marc_card: { id: "marc_card", name: "Marc Card", type: ItemType.Card, cardSlot: EquipSlot.Armor, desc: "Armor card. DEF +6, Max HP +120.", def: 6, maxHp: 120, sellPrice: 900 },
  baphomet_card: { id: "baphomet_card", name: "Baphomet Card", type: ItemType.Card, cardSlot: EquipSlot.Weapon, desc: "Weapon card. ATK +18, STR +4.", atk: 18, bonusStats: { str: 4 }, sellPrice: 3000 },
  doppelganger_card: { id: "doppelganger_card", name: "Doppelganger Card", type: ItemType.Card, cardSlot: EquipSlot.Weapon, desc: "Weapon card. ATK +20, MATK +20.", atk: 20, matk: 20, sellPrice: 5000 },
  ghostring_card: { id: "ghostring_card", name: "Ghostring Card", type: ItemType.Card, cardSlot: EquipSlot.Armor, desc: "Armor card. Max HP +400, VIT +6.", maxHp: 400, bonusStats: { vit: 6 }, sellPrice: 6000 },
  thanatos_card: { id: "thanatos_card", name: "Thanatos Card", type: ItemType.Card, cardSlot: EquipSlot.Weapon, desc: "Weapon card. ATK +30, MATK +30, STR +5, INT +5.", atk: 30, matk: 30, bonusStats: { str: 5, int: 5 }, sellPrice: 12000 },
  willow_card: { id: "willow_card", name: "Willow Card", type: ItemType.Card, cardSlot: EquipSlot.Headgear, desc: "Headgear card. Max SP +60, INT +3.", maxSp: 60, bonusStats: { int: 3 }, sellPrice: 700 },
  stainer_card: { id: "stainer_card", name: "Stainer Card", type: ItemType.Card, cardSlot: EquipSlot.Headgear, desc: "Headgear card. AGI +5, FLEE via DEF +4.", def: 4, bonusStats: { agi: 5 }, sellPrice: 1500 },
};

// What the town shop sells.
export const SHOP_STOCK: string[] = [
  "apple",
  "red_potion",
  "blue_potion",
  "fried_egg",
  "honey_pancake",
  "spicy_skewer",
  "steamed_tuna",
  "novice_knife",
  "apprentice_rod",
  "cotton_shirt",
  "leather_armor",
  "feather_beret",
  "ring_of_power",
  "poring_egg",
  "peco_whistle",
];

export function getItem(id: string): ItemDef | undefined {
  return ITEMS[id];
}

export interface DropEntry {
  itemId: string;
  chance: number; // 0..1
  qty?: number; // default 1
}

// Per-monster loot tables.
export const DROP_TABLES: Record<string, DropEntry[]> = {
  poring: [
    { itemId: "apple", chance: 0.25 },
    { itemId: "cotton_shirt", chance: 0.05 },
    { itemId: "poring_egg", chance: 0.02 },
  ],
  fabre: [
    { itemId: "apple", chance: 0.22 },
    { itemId: "novice_knife", chance: 0.06 },
    { itemId: "blue_potion", chance: 0.1 },
  ],
  drops: [
    { itemId: "red_potion", chance: 0.16 },
    { itemId: "cotton_shirt", chance: 0.08 },
    { itemId: "apprentice_rod", chance: 0.05 },
    { itemId: "feather_beret", chance: 0.04 },
  ],
  lunatic: [
    { itemId: "red_potion", chance: 0.18 },
    { itemId: "leather_armor", chance: 0.06 },
    { itemId: "ring_of_power", chance: 0.05 },
    { itemId: "lunatic_egg", chance: 0.02 },
  ],
  poring_king: [
    { itemId: "red_potion", chance: 1, qty: 3 },
    { itemId: "poring_crown", chance: 0.8 },
    { itemId: "poring_hat", chance: 0.6 },
    { itemId: "kings_cleaver", chance: 0.55 },
    { itemId: "leather_armor", chance: 0.5 },
    { itemId: "poring_card", chance: 0.1 },
  ],
  spore: [
    { itemId: "apple", chance: 0.3 },
    { itemId: "blue_potion", chance: 0.12 },
  ],
  wolf: [
    { itemId: "red_potion", chance: 0.2 },
    { itemId: "leather_armor", chance: 0.05 },
    { itemId: "ring_of_power", chance: 0.04 },
  ],
  zombie: [
    { itemId: "red_potion", chance: 0.3 },
    { itemId: "saint_robe", chance: 0.05 },
  ],
  skeleton: [
    { itemId: "red_potion", chance: 0.3 },
    { itemId: "claymore", chance: 0.06 },
    { itemId: "rosary", chance: 0.05 },
    { itemId: "skeleton_card", chance: 0.03 },
  ],
  baphomet: [
    { itemId: "red_potion", chance: 1, qty: 5 },
    { itemId: "baphomet_horn", chance: 0.7 },
    { itemId: "claymore", chance: 0.5 },
    { itemId: "saint_robe", chance: 0.5 },
    { itemId: "baphomet_egg", chance: 0.25 },
    { itemId: "baphomet_card", chance: 0.08 },
  ],
  punk: [
    { itemId: "red_potion", chance: 0.35 },
    { itemId: "blue_potion", chance: 0.2 },
  ],
  clock: [
    { itemId: "red_potion", chance: 0.4 },
    { itemId: "clock_gear", chance: 0.05 },
  ],
  clock_tower_manager: [
    { itemId: "red_potion", chance: 1, qty: 6 },
    { itemId: "clock_gear", chance: 0.7 },
    { itemId: "claymore", chance: 0.4 },
    { itemId: "saint_robe", chance: 0.4 },
  ],
  sandman: [
    { itemId: "red_potion", chance: 0.4 },
    { itemId: "tidal_shoes", chance: 0.04 },
  ],
  anolian: [
    { itemId: "red_potion", chance: 0.4 },
    { itemId: "tidal_shoes", chance: 0.05 },
    { itemId: "clock_gear", chance: 0.05 },
  ],
  dryad: [
    { itemId: "red_potion", chance: 0.45 },
    { itemId: "spirit_staff", chance: 0.04 },
  ],
  stem_worm: [
    { itemId: "red_potion", chance: 0.45 },
    { itemId: "spirit_staff", chance: 0.05 },
  ],
  hardrock_mammoth: [
    { itemId: "red_potion", chance: 1, qty: 8 },
    { itemId: "spirit_staff", chance: 0.5 },
    { itemId: "tidal_shoes", chance: 0.6 },
    { itemId: "valkyrie_armor", chance: 0.35 },
  ],
  wraith: [
    { itemId: "red_potion", chance: 0.4 },
    { itemId: "valkyrie_armor", chance: 0.03 },
  ],
  gargoyle: [
    { itemId: "red_potion", chance: 0.4 },
    { itemId: "dragon_slayer", chance: 0.03 },
    { itemId: "rosary", chance: 0.08 },
  ],
  dark_lord: [
    { itemId: "red_potion", chance: 1, qty: 10 },
    { itemId: "immortal_heart", chance: 0.6 },
    { itemId: "dragon_slayer", chance: 0.4 },
    { itemId: "valkyrie_armor", chance: 0.4 },
    { itemId: "doppelganger_card", chance: 0.06 },
  ],
};

// Drops for the expanded bestiary (extra regulars + per-map second bosses + the
// Juno/Einbroch/Rachel chains). Bosses reward potions + a shot at elite gear.
const HI = (extra: DropEntry[]): DropEntry[] => [{ itemId: "red_potion", chance: 1, qty: 6 }, ...extra];
Object.assign(DROP_TABLES, {
  chonchon: [{ itemId: "apple", chance: 0.25 }],
  coco: [{ itemId: "apple", chance: 0.25 }, { itemId: "blue_potion", chance: 0.1 }],
  angeling: HI([{ itemId: "poring_crown", chance: 0.6 }, { itemId: "ring_of_power", chance: 0.5 }]),
  eddga: HI([{ itemId: "leather_armor", chance: 0.6 }, { itemId: "novice_knife", chance: 0.5 }]),
  moonlight: HI([{ itemId: "ring_of_power", chance: 0.6 }, { itemId: "apprentice_rod", chance: 0.5 }]),
  mistress: HI([{ itemId: "cotton_shirt", chance: 0.6 }, { itemId: "ring_of_power", chance: 0.5 }]),
  amon_ra: HI([{ itemId: "saint_robe", chance: 0.6 }, { itemId: "claymore", chance: 0.45 }, { itemId: "apprentice_circlet", chance: 0.5 }, { itemId: "royal_feast", chance: 0.3 }, { itemId: "marc_card", chance: 0.08 }]),
  owl_duke: HI([{ itemId: "clock_gear", chance: 0.7 }, { itemId: "apprentice_circlet", chance: 0.5 }, { itemId: "claymore", chance: 0.4 }]),
  kraken: HI([{ itemId: "tidal_shoes", chance: 0.7 }, { itemId: "claymore", chance: 0.4 }]),
  tao_gunka: HI([{ itemId: "valkyrie_armor", chance: 0.4 }, { itemId: "tidal_shoes", chance: 0.6 }]),
  gloom: HI([{ itemId: "valkyrie_armor", chance: 0.5 }, { itemId: "gem_crown", chance: 0.4 }, { itemId: "dragon_slayer", chance: 0.35 }]),
  valkyrie_randgris: HI([{ itemId: "valkyrie_armor", chance: 0.6 }, { itemId: "valkyrie_helm", chance: 0.55 }, { itemId: "immortal_heart", chance: 0.5 }]),
  sleeper: [{ itemId: "red_potion", chance: 0.45 }, { itemId: "willow_card", chance: 0.03 }],
  hill_wind: [{ itemId: "red_potion", chance: 0.45 }, { itemId: "spirit_staff", chance: 0.03 }],
  kiel: HI([{ itemId: "immortal_heart", chance: 0.5 }, { itemId: "dragon_slayer", chance: 0.45 }]),
  vesper: HI([{ itemId: "spirit_staff", chance: 0.6 }, { itemId: "immortal_heart", chance: 0.45 }]),
  metaling: [{ itemId: "red_potion", chance: 0.45 }],
  venatu: [{ itemId: "red_potion", chance: 0.45 }, { itemId: "dragon_slayer", chance: 0.03 }],
  boitata: HI([{ itemId: "dragon_slayer", chance: 0.55 }, { itemId: "valkyrie_armor", chance: 0.45 }]),
  tendrilion: HI([{ itemId: "immortal_heart", chance: 0.55 }, { itemId: "spirit_staff", chance: 0.5 }]),
  vanberk: [{ itemId: "red_potion", chance: 0.5 }, { itemId: "stainer_card", chance: 0.03 }],
  hodremlin: [{ itemId: "red_potion", chance: 0.5 }, { itemId: "valkyrie_armor", chance: 0.03 }],
  ktullanux: HI([{ itemId: "immortal_heart", chance: 0.6 }, { itemId: "valkyrie_armor", chance: 0.5 }]),
  beelzebub: HI([{ itemId: "immortal_heart", chance: 0.8 }, { itemId: "valkyrie_helm", chance: 0.6 }, { itemId: "dragon_slayer", chance: 0.6 }, { itemId: "ghostring_card", chance: 0.1 }]),
  aliot: [{ itemId: "red_potion", chance: 0.5 }],
  aliza: [{ itemId: "red_potion", chance: 0.5 }, { itemId: "immortal_heart", chance: 0.02 }],
  thanatos_phantom: HI([{ itemId: "thanatos_sword", chance: 0.5 }, { itemId: "immortal_heart", chance: 0.5 }]),
  memory_of_thanatos: HI([{ itemId: "fallen_angel_wing", chance: 0.7 }, { itemId: "thanatos_sword", chance: 0.6 }, { itemId: "thanatos_card", chance: 0.12 }]),
});

// ---- Gear enchantment ----

// A single rolled enchant line on an equipment piece. `stat` is either a base
// stat key (str/agi/…) folded into effective stats, or one of the flat derived
// keys (atk/matk/def/maxHp/maxSp/crit). `locked` lines survive a re-roll.
export interface EnchantLine {
  stat: string;
  value: number;
  locked: boolean;
}

interface EnchantPoolEntry {
  stat: string;
  min: number;
  max: number;
  weight: number; // relative roll weight
}

// Weighted pool of possible enchant outcomes. Flat combat stats are rarer and
// rolled in bigger numbers; base stats are common and small.
export const ENCHANT_POOL: EnchantPoolEntry[] = [
  { stat: "str", min: 1, max: 6, weight: 10 },
  { stat: "agi", min: 1, max: 6, weight: 10 },
  { stat: "vit", min: 1, max: 6, weight: 10 },
  { stat: "int", min: 1, max: 6, weight: 10 },
  { stat: "dex", min: 1, max: 6, weight: 10 },
  { stat: "luk", min: 1, max: 6, weight: 10 },
  { stat: "atk", min: 4, max: 18, weight: 7 },
  { stat: "matk", min: 4, max: 18, weight: 7 },
  { stat: "def", min: 2, max: 10, weight: 6 },
  { stat: "maxHp", min: 30, max: 180, weight: 6 },
  { stat: "maxSp", min: 15, max: 80, weight: 5 },
  { stat: "crit", min: 1, max: 5, weight: 3 },
];

const ENCHANT_TOTAL_WEIGHT = ENCHANT_POOL.reduce((s, e) => s + e.weight, 0);

// Human-friendly label for an enchant stat key.
export function enchantStatLabel(stat: string): string {
  switch (stat) {
    case "maxHp":
      return "Max HP";
    case "maxSp":
      return "Max SP";
    case "atk":
      return "ATK";
    case "matk":
      return "MATK";
    case "def":
      return "DEF";
    case "crit":
      return "CRIT";
    default:
      return stat.toUpperCase();
  }
}

// Roll a single random enchant line from the weighted pool.
export function rollEnchantLine(rng: () => number = Math.random): EnchantLine {
  let r = rng() * ENCHANT_TOTAL_WEIGHT;
  let chosen = ENCHANT_POOL[0];
  for (const e of ENCHANT_POOL) {
    if (r < e.weight) {
      chosen = e;
      break;
    }
    r -= e.weight;
  }
  const value = chosen.min + Math.floor(rng() * (chosen.max - chosen.min + 1));
  return { stat: chosen.stat, value, locked: false };
}

// Roll a monster's drop table into a concrete item list.
export function rollDrops(templateId: string, rng: () => number = Math.random): Array<{ id: string; qty: number }> {
  const table = DROP_TABLES[templateId];
  if (!table) return [];
  const out: Array<{ id: string; qty: number }> = [];
  for (const d of table) {
    if (rng() < d.chance) out.push({ id: d.itemId, qty: d.qty ?? 1 });
  }
  return out;
}
