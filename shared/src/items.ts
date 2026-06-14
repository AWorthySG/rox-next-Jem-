import { REFINE_BASE_COST, REFINE_SAFE } from "./constants.js";
import { EquipSlot, ItemType } from "./enums.js";
import type { Stats } from "./stats.js";

// Zeny cost to take an item from `level` to `level + 1` (steeper past the safe line).
export function refineCost(level: number): number {
  const over = Math.max(0, level - REFINE_SAFE + 1);
  return Math.round(REFINE_BASE_COST * (level + 1) * (1 + over * 0.6));
}

// Stat bonuses granted by `level` refines, by equipment slot — so EVERY gear
// type (including accessories that only carry base-stat bonuses) gains from
// refining. Weapons gain ATK/MATK, defensive gear gains DEF/HP, accessories a
// balanced sliver of everything.
export function refineBonus(
  item: { slot?: EquipSlot; atk?: number; matk?: number; def?: number; maxHp?: number },
  level: number,
) {
  const out = { atk: 0, matk: 0, def: 0, maxHp: 0 };
  if (level <= 0) return out;
  switch (item.slot) {
    case EquipSlot.Weapon:
      // physical weapons gain ATK, magic weapons (matk) gain MATK; mixed gain both
      if (item.matk) out.matk = level * 2;
      if (item.atk || !item.matk) out.atk = level * 2;
      break;
    case EquipSlot.Armor:
      out.def = level * 2;
      out.maxHp = level * 8;
      break;
    case EquipSlot.Headgear:
      out.def = level * 2;
      out.maxHp = level * 6;
      break;
    case EquipSlot.Accessory:
      out.maxHp = level * 5;
      out.atk = level;
      out.matk = level;
      break;
    default:
      // fallback for slotless/unknown: scale whatever stats the item has
      out.atk = item.atk ? level * 2 : 0;
      out.matk = item.matk ? level * 2 : 0;
      out.def = item.def ? level * 2 : 0;
      out.maxHp = item.maxHp ? level * 6 : 0;
  }
  return out;
}

// Success chance for the attempt that takes an item from `level` to `level+1`.
// Guaranteed up to the safe line, then steadily harder.
export function refineChance(level: number): number {
  if (level < REFINE_SAFE) return 1;
  const table = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4]; // +4→5 … +9→10
  return table[level - REFINE_SAFE] ?? 0.4;
}

// Which ore an item consumes per refine attempt.
export function refineMaterial(item: { slot?: EquipSlot }): string {
  return item.slot === EquipSlot.Weapon || item.slot === EquipSlot.Headgear ? "oridecon" : "elunium";
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
  yellow_potion: { id: "yellow_potion", name: "Yellow Potion", type: ItemType.Consumable, desc: "Restores 350 HP.", healHp: 350, price: 140, sellPrice: 34 },
  white_potion: { id: "white_potion", name: "White Potion", type: ItemType.Consumable, desc: "Restores 700 HP.", healHp: 700, price: 320, sellPrice: 78 },
  purple_potion: { id: "purple_potion", name: "Purple Potion", type: ItemType.Consumable, desc: "Restores 220 SP.", healSp: 220, price: 280, sellPrice: 66 },

  // food / cooking (eat for a timed stat buff; 5 min unless noted)
  fried_egg: { id: "fried_egg", name: "Fried Egg", type: ItemType.Consumable, desc: "Eat: VIT +5, Max HP +80 for 5 min.", food: { durationMs: 300000, bonusStats: { vit: 5 }, maxHp: 80 }, price: 120, sellPrice: 20 },
  honey_pancake: { id: "honey_pancake", name: "Honey Pancake", type: ItemType.Consumable, desc: "Eat: INT +5, Max SP +60 for 5 min.", food: { durationMs: 300000, bonusStats: { int: 5 }, maxSp: 60 }, price: 120, sellPrice: 20 },
  spicy_skewer: { id: "spicy_skewer", name: "Spicy Skewer", type: ItemType.Consumable, desc: "Eat: STR +5, ATK +15 for 5 min.", food: { durationMs: 300000, bonusStats: { str: 5 }, atk: 15 }, price: 160, sellPrice: 28 },
  steamed_tuna: { id: "steamed_tuna", name: "Steamed Tuna", type: ItemType.Consumable, desc: "Eat: AGI +5, CRIT +6 for 5 min.", food: { durationMs: 300000, bonusStats: { agi: 5 }, crit: 6 }, price: 160, sellPrice: 28 },
  royal_feast: { id: "royal_feast", name: "Royal Feast", type: ItemType.Consumable, desc: "Eat: all stats +4, ATK/MATK +12 for 10 min.", food: { durationMs: 600000, bonusStats: { str: 4, agi: 4, vit: 4, int: 4, dex: 4, luk: 4 }, atk: 12, matk: 12 }, sellPrice: 200 },
  meat_stew: { id: "meat_stew", name: "Meat Stew", type: ItemType.Consumable, desc: "Eat: VIT +6, Max HP +160 for 8 min.", food: { durationMs: 480000, bonusStats: { vit: 6 }, maxHp: 160 }, price: 260, sellPrice: 48 },
  dragon_brew: { id: "dragon_brew", name: "Dragon Brew", type: ItemType.Consumable, desc: "Eat: STR +6, ATK +20, CRIT +5 for 8 min.", food: { durationMs: 480000, bonusStats: { str: 6 }, atk: 20, crit: 5 }, sellPrice: 90 },

  // refine ores (materials consumed per refine attempt)
  oridecon: { id: "oridecon", name: "Oridecon", type: ItemType.Material, desc: "Refine ore for weapons & headgear.", price: 1200, sellPrice: 300 },
  elunium: { id: "elunium", name: "Elunium", type: ItemType.Material, desc: "Refine ore for armor & accessories.", price: 1200, sellPrice: 300 },

  // pet eggs (use to summon a companion)
  poring_egg: { id: "poring_egg", name: "Poring Egg", type: ItemType.Consumable, desc: "Summons a Poring pet (LUK +3, Max HP +50).", pet: "poring_pet", price: 800, sellPrice: 100 },
  lunatic_egg: { id: "lunatic_egg", name: "Lunatic Egg", type: ItemType.Consumable, desc: "Summons a Lunatic pet (AGI +3, DEX +2).", pet: "lunatic_pet", sellPrice: 150 },
  baphomet_egg: { id: "baphomet_egg", name: "Baphomet Egg", type: ItemType.Consumable, desc: "Summons Baphomet Jr. (STR +4, INT +4, Max HP +80).", pet: "baphomet_pet", sellPrice: 1200 },
  peco_whistle: { id: "peco_whistle", name: "Peco Peco Whistle", type: ItemType.Consumable, desc: "Summon/dismiss a Peco Peco mount (faster movement). Reusable — not consumed.", mount: true, price: 1500, sellPrice: 200 },
  marc_egg: { id: "marc_egg", name: "Marc Egg", type: ItemType.Consumable, desc: "Summons a Marc pet (VIT +3, AGI +2, Max HP +90).", pet: "marc_pet", sellPrice: 300 },
  garm_egg: { id: "garm_egg", name: "Garm Egg", type: ItemType.Consumable, desc: "Summons a Garm Cub (VIT +5, Max HP +220).", pet: "garm_pet", sellPrice: 1500 },
  ifrit_egg: { id: "ifrit_egg", name: "Ifrit Egg", type: ItemType.Consumable, desc: "Summons an Ifrit Spark (STR +6, ATK +14).", pet: "ifrit_pet", sellPrice: 3000 },
  nidhoggr_egg: { id: "nidhoggr_egg", name: "Shadow Egg", type: ItemType.Consumable, desc: "Summons a Shadow Hatchling (all stats +3, Max HP +160).", pet: "nidhoggr_pet", sellPrice: 6000 },

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

  // ---- Geffen Tower (mid-level mage gear) ----
  mage_staff: {
    id: "mage_staff", name: "Geffen Mage Staff", type: ItemType.Weapon, slot: EquipSlot.Weapon,
    desc: "A tournament staff. MATK +30, INT +5.", matk: 30, bonusStats: { int: 5 }, sellPrice: 700,
  },
  wizard_hat: {
    id: "wizard_hat", name: "Wizard Hat", type: ItemType.Headgear, slot: EquipSlot.Headgear,
    desc: "A pointed hat. MATK +8, INT +4, Max SP +40.", matk: 8, maxSp: 40, bonusStats: { int: 4 }, sellPrice: 650,
  },
  geffen_robe: {
    id: "geffen_robe", name: "Geffen Robe", type: ItemType.Armor, slot: EquipSlot.Armor,
    desc: "An enchanter's robe. DEF +16, Max HP +80, Max SP +70, INT +4.", def: 16, maxHp: 80, maxSp: 70, bonusStats: { int: 4 }, sellPrice: 600,
  },

  // ---- Scaraba Hole gear ----
  chitin_blade: {
    id: "chitin_blade", name: "Chitin Blade", type: ItemType.Weapon, slot: EquipSlot.Weapon,
    desc: "A razor carapace edge. ATK +90, STR +6.", atk: 90, bonusStats: { str: 6 }, sellPrice: 5400,
  },
  antenna_crown: {
    id: "antenna_crown", name: "Antenna Crown", type: ItemType.Headgear, slot: EquipSlot.Headgear,
    desc: "Twitching feelers. MATK +12, INT +6, Max SP +50.", matk: 12, maxSp: 50, bonusStats: { int: 6 }, sellPrice: 5000,
  },
  carapace_armor: {
    id: "carapace_armor", name: "Carapace Armor", type: ItemType.Armor, slot: EquipSlot.Armor,
    desc: "Layered insect shell. DEF +36, Max HP +400, VIT +6.", def: 36, maxHp: 400, bonusStats: { vit: 6 }, sellPrice: 5600,
  },

  // ---- Veins Canyon gear ----
  sand_spear: {
    id: "sand_spear", name: "Sand Spear", type: ItemType.Weapon, slot: EquipSlot.Weapon,
    desc: "A canyon hunter's lance. ATK +64, STR +4.", atk: 64, bonusStats: { str: 4 }, sellPrice: 3100,
  },
  desert_cowl: {
    id: "desert_cowl", name: "Desert Cowl", type: ItemType.Headgear, slot: EquipSlot.Headgear,
    desc: "Sand-proof hood. DEF +18, AGI +4, Max HP +100.", def: 18, maxHp: 100, bonusStats: { agi: 4 }, sellPrice: 2800,
  },
  sandstorm_robe: {
    id: "sandstorm_robe", name: "Sandstorm Robe", type: ItemType.Armor, slot: EquipSlot.Armor,
    desc: "Flowing canyon garb. DEF +22, Max HP +200, AGI +4.", def: 22, maxHp: 200, bonusStats: { agi: 4 }, sellPrice: 3000,
  },

  // ---- Brasilis gear ----
  machete: {
    id: "machete", name: "Machete", type: ItemType.Weapon, slot: EquipSlot.Weapon,
    desc: "A jungle blade. ATK +54, AGI +3.", atk: 54, bonusStats: { agi: 3 }, sellPrice: 2500,
  },
  feather_crown: {
    id: "feather_crown", name: "Feathered Crown", type: ItemType.Headgear, slot: EquipSlot.Headgear,
    desc: "A tribal crown. AGI +5, DEX +3, Max HP +90.", maxHp: 90, bonusStats: { agi: 5, dex: 3 }, sellPrice: 2300,
  },
  jungle_vest: {
    id: "jungle_vest", name: "Jungle Vest", type: ItemType.Armor, slot: EquipSlot.Armor,
    desc: "Light river-hunter gear. DEF +20, Max HP +180, AGI +4.", def: 20, maxHp: 180, bonusStats: { agi: 4 }, sellPrice: 2500,
  },

  // ---- Bifrost gear ----
  fairy_bow: {
    id: "fairy_bow", name: "Fairy Bow", type: ItemType.Weapon, slot: EquipSlot.Weapon,
    desc: "Strung with moonlight. ATK +80, DEX +6.", atk: 80, bonusStats: { dex: 6 }, sellPrice: 4600,
  },
  spider_circlet: {
    id: "spider_circlet", name: "Spider Circlet", type: ItemType.Headgear, slot: EquipSlot.Headgear,
    desc: "Woven of silver silk. MATK +10, INT +5, Max SP +50.", matk: 10, maxSp: 50, bonusStats: { int: 5 }, sellPrice: 4200,
  },
  bifrost_garb: {
    id: "bifrost_garb", name: "Bifrost Garb", type: ItemType.Armor, slot: EquipSlot.Armor,
    desc: "Shimmering rainbow weave. DEF +30, Max HP +320, AGI +5.", def: 30, maxHp: 320, bonusStats: { agi: 5 }, sellPrice: 4600,
  },

  // ---- Gonryun Shrine gear ----
  tachi: {
    id: "tachi", name: "Tachi", type: ItemType.Weapon, slot: EquipSlot.Weapon,
    desc: "A long curved sword. ATK +66, AGI +4.", atk: 66, bonusStats: { agi: 4 }, sellPrice: 3300,
  },
  oni_mask: {
    id: "oni_mask", name: "Oni Mask", type: ItemType.Headgear, slot: EquipSlot.Headgear,
    desc: "A fearsome demon mask. DEF +18, STR +4, Max HP +120.", def: 18, maxHp: 120, bonusStats: { str: 4 }, sellPrice: 3000,
  },
  spirit_robe: {
    id: "spirit_robe", name: "Spirit Robe", type: ItemType.Armor, slot: EquipSlot.Armor,
    desc: "Robe blessed by shrine spirits. DEF +24, Max SP +90, INT +5.", def: 24, maxSp: 90, bonusStats: { int: 5 }, sellPrice: 3200,
  },

  // ---- Glast Heim Abyss gear ----
  bloody_sword: {
    id: "bloody_sword", name: "Bloody Sword", type: ItemType.Weapon, slot: EquipSlot.Weapon,
    desc: "A blade slick with old blood. ATK +84, STR +6.", atk: 84, bonusStats: { str: 6 }, sellPrice: 5000,
  },
  baron_circlet: {
    id: "baron_circlet", name: "Baron's Circlet", type: ItemType.Headgear, slot: EquipSlot.Headgear,
    desc: "A noble's dark circlet. MATK +12, INT +6, Max SP +50.", matk: 12, maxSp: 50, bonusStats: { int: 6 }, sellPrice: 4800,
  },
  abyss_plate: {
    id: "abyss_plate", name: "Abyss Plate", type: ItemType.Armor, slot: EquipSlot.Armor,
    desc: "Plate from the deep crypts. DEF +34, Max HP +380, VIT +6.", def: 34, maxHp: 380, bonusStats: { vit: 6 }, sellPrice: 5200,
  },

  // ---- Louyang gear ----
  serpent_spear: {
    id: "serpent_spear", name: "Serpent Spear", type: ItemType.Weapon, slot: EquipSlot.Weapon,
    desc: "A coiled-dragon polearm. ATK +62, DEX +4.", atk: 62, bonusStats: { dex: 4 }, sellPrice: 3000,
  },
  jade_crown: {
    id: "jade_crown", name: "Jade Crown", type: ItemType.Headgear, slot: EquipSlot.Headgear,
    desc: "An imperial crown. MATK +10, INT +5, Max SP +40.", matk: 10, maxSp: 40, bonusStats: { int: 5 }, sellPrice: 2700,
  },
  silk_robe: {
    id: "silk_robe", name: "Imperial Silk Robe", type: ItemType.Armor, slot: EquipSlot.Armor,
    desc: "Robe of the eastern court. DEF +22, Max SP +70, INT +4.", def: 22, maxSp: 70, bonusStats: { int: 4 }, sellPrice: 2800,
  },

  // ---- Turtle Island gear ----
  shell_blade: {
    id: "shell_blade", name: "Shell Blade", type: ItemType.Weapon, slot: EquipSlot.Weapon,
    desc: "Carved from a great shell. ATK +56, VIT +3.", atk: 56, bonusStats: { vit: 3 }, sellPrice: 2600,
  },
  turtle_cap: {
    id: "turtle_cap", name: "Turtle Shell Cap", type: ItemType.Headgear, slot: EquipSlot.Headgear,
    desc: "A hardy shell helm. DEF +20, VIT +4, Max HP +120.", def: 20, maxHp: 120, bonusStats: { vit: 4 }, sellPrice: 2400,
  },
  shell_plate: {
    id: "shell_plate", name: "Shell Plate", type: ItemType.Armor, slot: EquipSlot.Armor,
    desc: "Layered carapace armor. DEF +26, Max HP +240, VIT +4.", def: 26, maxHp: 240, bonusStats: { vit: 4 }, sellPrice: 2700,
  },

  // ---- Pyramid of the Sphinx gear ----
  ankh_staff: {
    id: "ankh_staff", name: "Ankh Staff", type: ItemType.Weapon, slot: EquipSlot.Weapon,
    desc: "A staff topped with an ankh. MATK +42, INT +5.", matk: 42, bonusStats: { int: 5 }, sellPrice: 1300,
  },
  pharaoh_mask: {
    id: "pharaoh_mask", name: "Pharaoh Mask", type: ItemType.Headgear, slot: EquipSlot.Headgear,
    desc: "A golden death-mask. MATK +8, INT +4, Max SP +40.", matk: 8, maxSp: 40, bonusStats: { int: 4 }, sellPrice: 1200,
  },
  mummy_wrap: {
    id: "mummy_wrap", name: "Mummy Wrappings", type: ItemType.Armor, slot: EquipSlot.Armor,
    desc: "Ancient linen bindings. DEF +20, Max HP +160, AGI +3.", def: 20, maxHp: 160, bonusStats: { agi: 3 }, sellPrice: 1300,
  },

  // ---- Glast Heim Churchyard gear ----
  knight_sword: {
    id: "knight_sword", name: "Knight Sword", type: ItemType.Weapon, slot: EquipSlot.Weapon,
    desc: "A crusader's blade. ATK +46, STR +4.", atk: 46, bonusStats: { str: 4 }, sellPrice: 900,
  },
  great_helm: {
    id: "great_helm", name: "Great Helm", type: ItemType.Headgear, slot: EquipSlot.Headgear,
    desc: "Heavy plate helm. DEF +18, VIT +3, Max HP +100.", def: 18, maxHp: 100, bonusStats: { vit: 3 }, sellPrice: 800,
  },
  chain_mail: {
    id: "chain_mail", name: "Chain Mail", type: ItemType.Armor, slot: EquipSlot.Armor,
    desc: "Interlocking steel rings. DEF +22, Max HP +160, VIT +3.", def: 22, maxHp: 160, bonusStats: { vit: 3 }, sellPrice: 900,
  },

  // ---- Orc Village gear ----
  orc_axe: {
    id: "orc_axe", name: "Orcish Axe", type: ItemType.Weapon, slot: EquipSlot.Weapon,
    desc: "A crude but heavy axe. ATK +38, STR +3.", atk: 38, bonusStats: { str: 3 }, sellPrice: 700,
  },
  orc_helm: {
    id: "orc_helm", name: "Orcish Helm", type: ItemType.Headgear, slot: EquipSlot.Headgear,
    desc: "A tusked war-helm. DEF +14, STR +3, Max HP +80.", def: 14, maxHp: 80, bonusStats: { str: 3 }, sellPrice: 650,
  },
  orc_mail: {
    id: "orc_mail", name: "Orcish Mail", type: ItemType.Armor, slot: EquipSlot.Armor,
    desc: "Scavenged plate. DEF +18, Max HP +150, VIT +3.", def: 18, maxHp: 150, bonusStats: { vit: 3 }, sellPrice: 700,
  },

  // ---- Byalan Sunken Cave gear ----
  coral_blade: {
    id: "coral_blade", name: "Coral Blade", type: ItemType.Weapon, slot: EquipSlot.Weapon,
    desc: "A jagged coral sword. ATK +28, AGI +2.", atk: 28, bonusStats: { agi: 2 }, price: 900, sellPrice: 220,
  },
  shell_helm: {
    id: "shell_helm", name: "Shell Helm", type: ItemType.Headgear, slot: EquipSlot.Headgear,
    desc: "A hardy shell. DEF +10, VIT +2, Max HP +60.", def: 10, maxHp: 60, bonusStats: { vit: 2 }, price: 700, sellPrice: 170,
  },
  diver_suit: {
    id: "diver_suit", name: "Diver Suit", type: ItemType.Armor, slot: EquipSlot.Armor,
    desc: "Sleek and watertight. DEF +12, Max HP +90, AGI +2.", def: 12, maxHp: 90, bonusStats: { agi: 2 }, price: 800, sellPrice: 200,
  },

  // ---- Thor Volcano gear ----
  magma_axe: {
    id: "magma_axe", name: "Magma Axe", type: ItemType.Weapon, slot: EquipSlot.Weapon,
    desc: "Forged in lava. ATK +78, STR +6.", atk: 78, bonusStats: { str: 6 }, sellPrice: 4200,
  },
  ifrit_mask: {
    id: "ifrit_mask", name: "Mask of Ifrit", type: ItemType.Headgear, slot: EquipSlot.Headgear,
    desc: "A burning visage. ATK +12, STR +5, Max HP +140.", atk: 12, maxHp: 140, bonusStats: { str: 5 }, sellPrice: 4000,
  },
  volcanic_plate: {
    id: "volcanic_plate", name: "Volcanic Plate", type: ItemType.Armor, slot: EquipSlot.Armor,
    desc: "Tempered in fire. DEF +32, Max HP +340, VIT +5.", def: 32, maxHp: 340, bonusStats: { vit: 5 }, sellPrice: 4400,
  },

  // ---- Moscovia (northern forest) gear ----
  bear_claw: {
    id: "bear_claw", name: "Bear Claw", type: ItemType.Weapon, slot: EquipSlot.Weapon,
    desc: "Torn from a forest beast. ATK +60, STR +5.", atk: 60, bonusStats: { str: 5 }, sellPrice: 3200,
  },
  ushanka: {
    id: "ushanka", name: "Ushanka", type: ItemType.Headgear, slot: EquipSlot.Headgear,
    desc: "Warm fur cap. DEF +18, VIT +4, Max HP +110.", def: 18, maxHp: 110, bonusStats: { vit: 4 }, sellPrice: 2700,
  },
  forest_garb: {
    id: "forest_garb", name: "Forest Garb", type: ItemType.Armor, slot: EquipSlot.Armor,
    desc: "Hide of the deep woods. DEF +22, Max HP +200, AGI +4.", def: 22, maxHp: 200, bonusStats: { agi: 4 }, sellPrice: 2900,
  },

  // ---- Ayothaya (jungle temple) gear ----
  jade_spear: {
    id: "jade_spear", name: "Jade Spear", type: ItemType.Weapon, slot: EquipSlot.Weapon,
    desc: "A temple guardian's spear. ATK +58, DEX +4, STR +2.", atk: 58, bonusStats: { dex: 4, str: 2 }, sellPrice: 3000,
  },
  monkey_circlet: {
    id: "monkey_circlet", name: "Monkey Circlet", type: ItemType.Headgear, slot: EquipSlot.Headgear,
    desc: "Blessing of the forest. MATK +10, INT +4, Max SP +30.", matk: 10, maxSp: 30, bonusStats: { int: 4 }, sellPrice: 2600,
  },
  temple_robe: {
    id: "temple_robe", name: "Temple Robe", type: ItemType.Armor, slot: EquipSlot.Armor,
    desc: "Woven by monks. DEF +24, Max SP +80, INT +5.", def: 24, maxSp: 80, bonusStats: { int: 5 }, sellPrice: 2800,
  },

  // ---- Lutie Snowfield gear ----
  frost_blade: {
    id: "frost_blade", name: "Frost Blade", type: ItemType.Weapon, slot: EquipSlot.Weapon,
    desc: "A blade of eternal winter. ATK +44, AGI +3, DEX +2.", atk: 44, bonusStats: { agi: 3, dex: 2 }, sellPrice: 1900,
  },
  santa_hat: {
    id: "santa_hat", name: "Santa Hat", type: ItemType.Headgear, slot: EquipSlot.Headgear,
    desc: "Ho ho ho! Max HP +90, LUK +5.", maxHp: 90, bonusStats: { luk: 5 }, sellPrice: 1600,
  },
  fur_coat: {
    id: "fur_coat", name: "Fur Coat", type: ItemType.Armor, slot: EquipSlot.Armor,
    desc: "Warm against the cold. DEF +16, Max HP +160, VIT +3.", def: 16, maxHp: 160, bonusStats: { vit: 3 }, sellPrice: 1800,
  },

  // ---- Amatsu (eastern lands) gear ----
  katana: {
    id: "katana", name: "Katana", type: ItemType.Weapon, slot: EquipSlot.Weapon,
    desc: "A folded-steel blade. ATK +50, AGI +4, DEX +2.", atk: 50, bonusStats: { agi: 4, dex: 2 }, sellPrice: 2400,
  },
  kabuto: {
    id: "kabuto", name: "Kabuto", type: ItemType.Headgear, slot: EquipSlot.Headgear,
    desc: "A samurai's helm. DEF +16, VIT +4, Max HP +100.", def: 16, maxHp: 100, bonusStats: { vit: 4 }, sellPrice: 2200,
  },
  kimono: {
    id: "kimono", name: "Silk Kimono", type: ItemType.Armor, slot: EquipSlot.Armor,
    desc: "Light eastern silk. DEF +18, Max HP +140, AGI +3.", def: 18, maxHp: 140, bonusStats: { agi: 3 }, sellPrice: 2400,
  },

  // ---- Niflheim (realm of the dead) gear ----
  necro_staff: {
    id: "necro_staff", name: "Necromancer Staff", type: ItemType.Weapon, slot: EquipSlot.Weapon,
    desc: "Whispers of the dead. MATK +50, INT +6, DEX +3.", matk: 50, bonusStats: { int: 6, dex: 3 }, sellPrice: 3400,
  },
  skull_cap: {
    id: "skull_cap", name: "Skull Cap", type: ItemType.Headgear, slot: EquipSlot.Headgear,
    desc: "A grim helm. DEF +14, Max HP +120, VIT +3.", def: 14, maxHp: 120, bonusStats: { vit: 3 }, sellPrice: 2800,
  },
  grim_cloak: {
    id: "grim_cloak", name: "Grim Cloak", type: ItemType.Armor, slot: EquipSlot.Armor,
    desc: "Woven from shadow. DEF +22, Max HP +200, AGI +4, LUK +4.", def: 22, maxHp: 200, bonusStats: { agi: 4, luk: 4 }, sellPrice: 3200,
  },

  // ---- Morocc / Bio Lab / Abyss endgame gear ----
  desert_sabre: {
    id: "desert_sabre", name: "Desert Sabre", type: ItemType.Weapon, slot: EquipSlot.Weapon,
    desc: "A curved scimitar. ATK +72, STR +4, DEX +3.", atk: 72, bonusStats: { str: 4, dex: 3 }, sellPrice: 5500,
  },
  morrigane_helm: {
    id: "morrigane_helm", name: "Morrigane's Helm", type: ItemType.Headgear, slot: EquipSlot.Headgear,
    desc: "Helm of the war witch. DEF +20, LUK +8, ATK +10.", def: 20, atk: 10, bonusStats: { luk: 8 }, sellPrice: 5500,
  },
  bio_coat: {
    id: "bio_coat", name: "Bio Lab Coat", type: ItemType.Armor, slot: EquipSlot.Armor,
    desc: "An experimental coat. DEF +30, Max HP +320, INT +6.", def: 30, maxHp: 320, bonusStats: { int: 6 }, sellPrice: 5800,
  },
  mad_bunny: {
    id: "mad_bunny", name: "Mad Bunny", type: ItemType.Accessory, slot: EquipSlot.Accessory,
    desc: "A twitchy charm. AGI +8, ATK +15.", atk: 15, bonusStats: { agi: 8 }, sellPrice: 6000,
  },
  abyssal_blade: {
    id: "abyssal_blade", name: "Abyssal Greatsword", type: ItemType.Weapon, slot: EquipSlot.Weapon,
    desc: "Forged in the deep. ATK +105, STR +8, DEX +5.", atk: 105, bonusStats: { str: 8, dex: 5 }, sellPrice: 9500,
  },
  dragon_scale_mail: {
    id: "dragon_scale_mail", name: "Dragon Scale Mail", type: ItemType.Armor, slot: EquipSlot.Armor,
    desc: "Scales of a true dragon. DEF +44, Max HP +560, VIT +6.", def: 44, maxHp: 560, bonusStats: { vit: 6 }, sellPrice: 11000,
  },
  nidhoggr_eye: {
    id: "nidhoggr_eye", name: "Nidhoggr's Eye", type: ItemType.Accessory, slot: EquipSlot.Accessory,
    desc: "An eye of the world-serpent. INT +10, DEX +10, Max SP +120.", maxSp: 120, bonusStats: { int: 10, dex: 10 }, sellPrice: 13000,
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
  drake_card: { id: "drake_card", name: "Drake Card", type: ItemType.Card, cardSlot: EquipSlot.Weapon, desc: "Weapon card. ATK +25, STR +3.", atk: 25, bonusStats: { str: 3 }, sellPrice: 4500 },
  nidhoggr_card: { id: "nidhoggr_card", name: "Nidhoggr Shadow Card", type: ItemType.Card, cardSlot: EquipSlot.Armor, desc: "Armor card. Max HP +550, all stats +3.", maxHp: 550, bonusStats: { str: 3, agi: 3, vit: 3, int: 3, dex: 3, luk: 3 }, sellPrice: 14000 },
  ifrit_card: { id: "ifrit_card", name: "Ifrit Card", type: ItemType.Card, cardSlot: EquipSlot.Weapon, desc: "Weapon card. ATK +26, STR +4, CRIT-ish via DEX +4.", atk: 26, bonusStats: { str: 4, dex: 4 }, sellPrice: 8000 },
  garm_card: { id: "garm_card", name: "Garm Card", type: ItemType.Card, cardSlot: EquipSlot.Armor, desc: "Armor card. Max HP +320, VIT +5.", maxHp: 320, bonusStats: { vit: 5 }, sellPrice: 6000 },
  gigantes_card: { id: "gigantes_card", name: "Gigantes Card", type: ItemType.Card, cardSlot: EquipSlot.Armor, desc: "Armor card. DEF +10, Max HP +220.", def: 10, maxHp: 220, sellPrice: 5500 },
  baba_card: { id: "baba_card", name: "Baba Yaga Card", type: ItemType.Card, cardSlot: EquipSlot.Headgear, desc: "Headgear card. MATK +16, INT +4.", matk: 16, bonusStats: { int: 4 }, sellPrice: 6500 },
  leak_card: { id: "leak_card", name: "Leak Card", type: ItemType.Card, cardSlot: EquipSlot.Accessory, desc: "Accessory card. AGI +6, DEX +4.", bonusStats: { agi: 6, dex: 4 }, sellPrice: 5000 },
  phreeoni_card: { id: "phreeoni_card", name: "Phreeoni Card", type: ItemType.Card, cardSlot: EquipSlot.Accessory, desc: "Accessory card. DEX +9 (sharp aim).", bonusStats: { dex: 9 }, sellPrice: 4000 },
  stainer_card: { id: "stainer_card", name: "Stainer Card", type: ItemType.Card, cardSlot: EquipSlot.Headgear, desc: "Headgear card. AGI +5, FLEE via DEF +4.", def: 4, bonusStats: { agi: 5 }, sellPrice: 1500 },
};

// What the town shop sells.
export const SHOP_STOCK: string[] = [
  "apple",
  "red_potion",
  "yellow_potion",
  "white_potion",
  "blue_potion",
  "purple_potion",
  "meat_stew",
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
  "oridecon",
  "elunium",
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
  // Morocc desert
  anubis: [{ itemId: "red_potion", chance: 0.5 }, { itemId: "morrigane_helm", chance: 0.03 }],
  pasana: [{ itemId: "red_potion", chance: 0.5 }, { itemId: "desert_sabre", chance: 0.03 }],
  drake: HI([{ itemId: "desert_sabre", chance: 0.6 }, { itemId: "morrigane_helm", chance: 0.5 }, { itemId: "drake_card", chance: 0.08 }]),
  satan_morroc: HI([{ itemId: "desert_sabre", chance: 0.6 }, { itemId: "abyssal_blade", chance: 0.4 }, { itemId: "immortal_heart", chance: 0.5 }, { itemId: "drake_card", chance: 0.1 }]),
  // Bio Lab
  cecil: [{ itemId: "red_potion", chance: 0.5 }, { itemId: "bio_coat", chance: 0.03 }],
  wickebine: [{ itemId: "red_potion", chance: 0.5 }, { itemId: "mad_bunny", chance: 0.03 }],
  egnigem: HI([{ itemId: "bio_coat", chance: 0.6 }, { itemId: "mad_bunny", chance: 0.5 }, { itemId: "valkyrie_armor", chance: 0.4 }]),
  kathryne: HI([{ itemId: "bio_coat", chance: 0.6 }, { itemId: "nidhoggr_eye", chance: 0.4 }, { itemId: "ghostring_card", chance: 0.08 }]),
  // Abyss Lake
  ferus: [{ itemId: "red_potion", chance: 0.5 }, { itemId: "dragon_scale_mail", chance: 0.025 }],
  acidus: [{ itemId: "red_potion", chance: 0.5 }, { itemId: "abyssal_blade", chance: 0.025 }],
  detale: HI([{ itemId: "dragon_scale_mail", chance: 0.6 }, { itemId: "abyssal_blade", chance: 0.5 }, { itemId: "nidhoggr_eye", chance: 0.4 }]),
  nidhoggr: HI([{ itemId: "dragon_scale_mail", chance: 0.7 }, { itemId: "abyssal_blade", chance: 0.6 }, { itemId: "nidhoggr_eye", chance: 0.5 }, { itemId: "nidhoggr_card", chance: 0.12 }, { itemId: "nidhoggr_egg", chance: 0.25 }]),
  // Geffen Tower
  marionette: [{ itemId: "red_potion", chance: 0.3 }, { itemId: "wizard_hat", chance: 0.04 }],
  nightmare: [{ itemId: "red_potion", chance: 0.3 }, { itemId: "geffen_robe", chance: 0.04 }],
  marduk: [{ itemId: "red_potion", chance: 0.3 }, { itemId: "mage_staff", chance: 0.04 }],
  doppelganger: HI([{ itemId: "mage_staff", chance: 0.6 }, { itemId: "geffen_robe", chance: 0.5 }, { itemId: "doppelganger_card", chance: 0.1 }]),
  dark_priest: HI([{ itemId: "wizard_hat", chance: 0.6 }, { itemId: "geffen_robe", chance: 0.5 }, { itemId: "rosary", chance: 0.3 }]),
  // Niflheim
  loli_ruri: [{ itemId: "red_potion", chance: 0.4 }, { itemId: "skull_cap", chance: 0.035 }],
  quve: [{ itemId: "red_potion", chance: 0.4 }, { itemId: "grim_cloak", chance: 0.035 }],
  gibbet: [{ itemId: "red_potion", chance: 0.4 }, { itemId: "necro_staff", chance: 0.03 }],
  bacsojin: HI([{ itemId: "necro_staff", chance: 0.6 }, { itemId: "grim_cloak", chance: 0.5 }, { itemId: "ghostring_card", chance: 0.08 }]),
  fallen_bishop: HI([{ itemId: "skull_cap", chance: 0.6 }, { itemId: "grim_cloak", chance: 0.5 }, { itemId: "immortal_heart", chance: 0.3 }]),
  // Amatsu
  poison_spore: [{ itemId: "red_potion", chance: 0.35 }, { itemId: "kabuto", chance: 0.035 }],
  karakasa: [{ itemId: "red_potion", chance: 0.35 }, { itemId: "kimono", chance: 0.035 }],
  tengu: [{ itemId: "red_potion", chance: 0.35 }, { itemId: "katana", chance: 0.03 }],
  samurai_specter: HI([{ itemId: "katana", chance: 0.6 }, { itemId: "kabuto", chance: 0.5 }, { itemId: "skeleton_card", chance: 0.06 }]),
  kapha: HI([{ itemId: "kimono", chance: 0.6 }, { itemId: "katana", chance: 0.45 }, { itemId: "tidal_shoes", chance: 0.3 }]),
  // Lutie
  cookie: [{ itemId: "apple", chance: 0.3 }, { itemId: "santa_hat", chance: 0.03 }],
  myst_case: [{ itemId: "red_potion", chance: 0.35 }, { itemId: "fur_coat", chance: 0.035 }],
  antonio: [{ itemId: "red_potion", chance: 0.3 }, { itemId: "frost_blade", chance: 0.03 }],
  stormy_knight: HI([{ itemId: "frost_blade", chance: 0.6 }, { itemId: "fur_coat", chance: 0.5 }, { itemId: "santa_hat", chance: 0.3 }]),
  garm: HI([{ itemId: "frost_blade", chance: 0.6 }, { itemId: "fur_coat", chance: 0.5 }, { itemId: "garm_card", chance: 0.08 }, { itemId: "garm_egg", chance: 0.2 }]),
  // Ayothaya
  kobold: [{ itemId: "red_potion", chance: 0.4 }, { itemId: "jade_spear", chance: 0.03 }],
  elder_willow: [{ itemId: "red_potion", chance: 0.4 }, { itemId: "temple_robe", chance: 0.035 }],
  brilight: [{ itemId: "red_potion", chance: 0.4 }, { itemId: "monkey_circlet", chance: 0.035 }],
  lady_tanee: HI([{ itemId: "temple_robe", chance: 0.6 }, { itemId: "monkey_circlet", chance: 0.5 }, { itemId: "spirit_staff", chance: 0.3 }]),
  leak: HI([{ itemId: "jade_spear", chance: 0.6 }, { itemId: "temple_robe", chance: 0.5 }, { itemId: "leak_card", chance: 0.08 }]),
  // Moscovia
  les: [{ itemId: "red_potion", chance: 0.4 }, { itemId: "bear_claw", chance: 0.03 }],
  mavka: [{ itemId: "red_potion", chance: 0.4 }, { itemId: "forest_garb", chance: 0.035 }],
  uzhas: [{ itemId: "red_potion", chance: 0.4 }, { itemId: "ushanka", chance: 0.035 }],
  gopinich: HI([{ itemId: "bear_claw", chance: 0.6 }, { itemId: "forest_garb", chance: 0.5 }, { itemId: "baphomet_card", chance: 0.05 }]),
  baba_yaga: HI([{ itemId: "ushanka", chance: 0.6 }, { itemId: "forest_garb", chance: 0.5 }, { itemId: "baba_card", chance: 0.08 }]),
  // Thor Volcano
  magmaring: [{ itemId: "red_potion", chance: 0.45 }, { itemId: "ifrit_mask", chance: 0.025 }],
  kasa: [{ itemId: "red_potion", chance: 0.45 }, { itemId: "magma_axe", chance: 0.025 }],
  salamander: [{ itemId: "red_potion", chance: 0.45 }, { itemId: "volcanic_plate", chance: 0.025 }],
  gigantes: HI([{ itemId: "volcanic_plate", chance: 0.6 }, { itemId: "magma_axe", chance: 0.5 }, { itemId: "gigantes_card", chance: 0.08 }]),
  ifrit: HI([{ itemId: "magma_axe", chance: 0.6 }, { itemId: "ifrit_mask", chance: 0.55 }, { itemId: "volcanic_plate", chance: 0.5 }, { itemId: "ifrit_card", chance: 0.08 }, { itemId: "ifrit_egg", chance: 0.2 }]),
  // Byalan
  marc: [{ itemId: "apple", chance: 0.3 }, { itemId: "shell_helm", chance: 0.04 }],
  vadon: [{ itemId: "red_potion", chance: 0.2 }, { itemId: "diver_suit", chance: 0.04 }],
  kukre: [{ itemId: "red_potion", chance: 0.2 }, { itemId: "coral_blade", chance: 0.04 }],
  phreeoni: HI([{ itemId: "coral_blade", chance: 0.6 }, { itemId: "diver_suit", chance: 0.5 }, { itemId: "phreeoni_card", chance: 0.1 }, { itemId: "marc_egg", chance: 0.2 }]),
  deviace: HI([{ itemId: "shell_helm", chance: 0.6 }, { itemId: "diver_suit", chance: 0.5 }, { itemId: "marc_card", chance: 0.06 }]),
  // Orc Village
  orc_warrior: [{ itemId: "red_potion", chance: 0.3 }, { itemId: "orc_axe", chance: 0.04 }],
  orc_archer: [{ itemId: "red_potion", chance: 0.3 }, { itemId: "orc_helm", chance: 0.04 }],
  orc_zombie: [{ itemId: "red_potion", chance: 0.3 }, { itemId: "orc_mail", chance: 0.04 }],
  orc_lord: HI([{ itemId: "orc_axe", chance: 0.6 }, { itemId: "orc_mail", chance: 0.5 }, { itemId: "orc_helm", chance: 0.4 }]),
  orc_hero: HI([{ itemId: "orc_axe", chance: 0.6 }, { itemId: "orc_helm", chance: 0.55 }, { itemId: "baphomet_card", chance: 0.05 }]),
  // Glast Heim Churchyard
  raydric: [{ itemId: "red_potion", chance: 0.35 }, { itemId: "knight_sword", chance: 0.035 }],
  khalitzburg: [{ itemId: "red_potion", chance: 0.35 }, { itemId: "chain_mail", chance: 0.035 }],
  evil_druid: [{ itemId: "red_potion", chance: 0.35 }, { itemId: "great_helm", chance: 0.035 }],
  abysmal_knight: HI([{ itemId: "knight_sword", chance: 0.6 }, { itemId: "chain_mail", chance: 0.5 }, { itemId: "great_helm", chance: 0.4 }]),
  amdarais: HI([{ itemId: "chain_mail", chance: 0.6 }, { itemId: "knight_sword", chance: 0.45 }, { itemId: "skeleton_card", chance: 0.06 }]),
  // Pyramid
  mummy: [{ itemId: "red_potion", chance: 0.35 }, { itemId: "mummy_wrap", chance: 0.035 }],
  matyr: [{ itemId: "red_potion", chance: 0.35 }, { itemId: "ankh_staff", chance: 0.03 }],
  minorous: [{ itemId: "red_potion", chance: 0.35 }, { itemId: "pharaoh_mask", chance: 0.03 }],
  pharaoh: HI([{ itemId: "ankh_staff", chance: 0.6 }, { itemId: "pharaoh_mask", chance: 0.5 }, { itemId: "mummy_wrap", chance: 0.4 }]),
  osiris: HI([{ itemId: "pharaoh_mask", chance: 0.6 }, { itemId: "mummy_wrap", chance: 0.5 }, { itemId: "marc_card", chance: 0.06 }]),
  // Scaraba Hole
  scaraba: [{ itemId: "red_potion", chance: 0.45 }, { itemId: "carapace_armor", chance: 0.022 }],
  dolomedes: [{ itemId: "red_potion", chance: 0.45 }, { itemId: "antenna_crown", chance: 0.022 }],
  centipede: [{ itemId: "red_potion", chance: 0.45 }, { itemId: "chitin_blade", chance: 0.022 }],
  queen_scaraba: HI([{ itemId: "chitin_blade", chance: 0.6 }, { itemId: "carapace_armor", chance: 0.5 }, { itemId: "antenna_crown", chance: 0.4 }, { itemId: "ghostring_card", chance: 0.05 }]),
  kublin: HI([{ itemId: "chitin_blade", chance: 0.6 }, { itemId: "carapace_armor", chance: 0.55 }, { itemId: "ifrit_card", chance: 0.05 }]),
  // Veins Canyon
  dustiness: [{ itemId: "red_potion", chance: 0.4 }, { itemId: "desert_cowl", chance: 0.03 }],
  hode: [{ itemId: "red_potion", chance: 0.4 }, { itemId: "sandstorm_robe", chance: 0.03 }],
  galapago: [{ itemId: "red_potion", chance: 0.4 }, { itemId: "sand_spear", chance: 0.03 }],
  gold_acidus: HI([{ itemId: "sand_spear", chance: 0.6 }, { itemId: "desert_cowl", chance: 0.5 }, { itemId: "sandstorm_robe", chance: 0.4 }]),
  tatacho: HI([{ itemId: "sandstorm_robe", chance: 0.6 }, { itemId: "sand_spear", chance: 0.45 }, { itemId: "marc_card", chance: 0.05 }]),
  // Brasilis
  piranha: [{ itemId: "red_potion", chance: 0.4 }, { itemId: "jungle_vest", chance: 0.03 }],
  curupira: [{ itemId: "red_potion", chance: 0.4 }, { itemId: "feather_crown", chance: 0.03 }],
  iara: [{ itemId: "red_potion", chance: 0.4 }, { itemId: "machete", chance: 0.03 }],
  jaguar_king: HI([{ itemId: "machete", chance: 0.6 }, { itemId: "feather_crown", chance: 0.5 }, { itemId: "jungle_vest", chance: 0.4 }]),
  anaconda: HI([{ itemId: "jungle_vest", chance: 0.6 }, { itemId: "machete", chance: 0.45 }, { itemId: "tidal_shoes", chance: 0.3 }]),
  // Bifrost
  miming: [{ itemId: "red_potion", chance: 0.45 }, { itemId: "bifrost_garb", chance: 0.025 }],
  pom_spider: [{ itemId: "red_potion", chance: 0.45 }, { itemId: "spider_circlet", chance: 0.025 }],
  luciola_vespa: [{ itemId: "red_potion", chance: 0.45 }, { itemId: "fairy_bow", chance: 0.025 }],
  bangungot: HI([{ itemId: "fairy_bow", chance: 0.6 }, { itemId: "bifrost_garb", chance: 0.5 }, { itemId: "ghostring_card", chance: 0.06 }]),
  bungisngis: HI([{ itemId: "fairy_bow", chance: 0.6 }, { itemId: "spider_circlet", chance: 0.5 }, { itemId: "bifrost_garb", chance: 0.4 }]),
  // Gonryun Shrine
  ronin: [{ itemId: "red_potion", chance: 0.4 }, { itemId: "tachi", chance: 0.03 }],
  shrine_spirit: [{ itemId: "red_potion", chance: 0.4 }, { itemId: "spirit_robe", chance: 0.03 }],
  stone_lion: [{ itemId: "red_potion", chance: 0.4 }, { itemId: "oni_mask", chance: 0.03 }],
  jade_warlord: HI([{ itemId: "tachi", chance: 0.6 }, { itemId: "oni_mask", chance: 0.5 }, { itemId: "spirit_robe", chance: 0.4 }]),
  spirit_empress: HI([{ itemId: "spirit_robe", chance: 0.6 }, { itemId: "oni_mask", chance: 0.5 }, { itemId: "ghostring_card", chance: 0.06 }]),
  // Glast Heim Abyss
  bloody_knight: [{ itemId: "red_potion", chance: 0.45 }, { itemId: "bloody_sword", chance: 0.025 }],
  wanderer: [{ itemId: "red_potion", chance: 0.45 }, { itemId: "abyss_plate", chance: 0.025 }],
  owl_baron: [{ itemId: "red_potion", chance: 0.45 }, { itemId: "baron_circlet", chance: 0.025 }],
  dark_illusion: HI([{ itemId: "bloody_sword", chance: 0.6 }, { itemId: "abyss_plate", chance: 0.5 }, { itemId: "doppelganger_card", chance: 0.06 }]),
  corrupt_monk: HI([{ itemId: "baron_circlet", chance: 0.6 }, { itemId: "abyss_plate", chance: 0.5 }, { itemId: "ghostring_card", chance: 0.06 }]),
  // Louyang
  increase_soil: [{ itemId: "red_potion", chance: 0.4 }, { itemId: "silk_robe", chance: 0.03 }],
  mao_guai: [{ itemId: "red_potion", chance: 0.4 }, { itemId: "jade_crown", chance: 0.03 }],
  zhu_po_long: [{ itemId: "red_potion", chance: 0.4 }, { itemId: "serpent_spear", chance: 0.03 }],
  chung_e: HI([{ itemId: "silk_robe", chance: 0.6 }, { itemId: "jade_crown", chance: 0.5 }, { itemId: "spirit_staff", chance: 0.3 }]),
  evil_snake_lord: HI([{ itemId: "serpent_spear", chance: 0.6 }, { itemId: "silk_robe", chance: 0.5 }, { itemId: "doppelganger_card", chance: 0.05 }]),
  // Turtle Island
  solid_skull: [{ itemId: "red_potion", chance: 0.4 }, { itemId: "turtle_cap", chance: 0.035 }],
  assaulter: [{ itemId: "red_potion", chance: 0.4 }, { itemId: "shell_blade", chance: 0.03 }],
  permeter: [{ itemId: "red_potion", chance: 0.4 }, { itemId: "shell_plate", chance: 0.03 }],
  freezer: HI([{ itemId: "shell_plate", chance: 0.6 }, { itemId: "turtle_cap", chance: 0.5 }, { itemId: "tidal_shoes", chance: 0.3 }]),
  turtle_general: HI([{ itemId: "shell_blade", chance: 0.6 }, { itemId: "shell_plate", chance: 0.5 }, { itemId: "turtle_cap", chance: 0.4 }, { itemId: "ghostring_card", chance: 0.05 }]),
  // extra early regulars
  pupa: [{ itemId: "apple", chance: 0.25 }],
  roda_frog: [{ itemId: "apple", chance: 0.25 }, { itemId: "blue_potion", chance: 0.08 }],
  thief_bug: [{ itemId: "apple", chance: 0.22 }, { itemId: "novice_knife", chance: 0.05 }],
  creamy: [{ itemId: "apple", chance: 0.25 }, { itemId: "feather_beret", chance: 0.03 }],
  willow: [{ itemId: "apple", chance: 0.25 }, { itemId: "apprentice_rod", chance: 0.04 }],
});

// Sprinkle refine ores across the bestiary so refining has a farming loop:
// regular monsters drop them rarely; bosses reliably.
const ORE_REGULARS = [
  "skeleton", "zombie", "clock", "punk", "sandman", "anolian", "dryad", "stem_worm",
  "wraith", "gargoyle", "sleeper", "hill_wind", "metaling", "venatu", "vanberk",
  "hodremlin", "aliot", "aliza", "coco", "spore",
  "anubis", "pasana", "cecil", "wickebine", "ferus", "acidus",
  "marionette", "nightmare", "marduk",
  "loli_ruri", "quve", "gibbet",
  "poison_spore", "karakasa", "tengu",
  "cookie", "myst_case", "antonio",
  "kobold", "elder_willow", "brilight",
  "les", "mavka", "uzhas",
  "magmaring", "kasa", "salamander",
  "marc", "vadon", "kukre",
  "orc_warrior", "orc_archer", "orc_zombie",
  "raydric", "khalitzburg", "evil_druid",
  "mummy", "matyr", "minorous",
  "solid_skull", "assaulter", "permeter",
  "increase_soil", "mao_guai", "zhu_po_long",
  "bloody_knight", "wanderer", "owl_baron",
  "ronin", "shrine_spirit", "stone_lion",
  "miming", "pom_spider", "luciola_vespa",
  "piranha", "curupira", "iara",
  "dustiness", "hode", "galapago",
  "scaraba", "dolomedes", "centipede",
];
for (const id of ORE_REGULARS) {
  const t = DROP_TABLES[id];
  if (t) {
    t.push({ itemId: "oridecon", chance: 0.06 });
    t.push({ itemId: "elunium", chance: 0.06 });
  }
}
const ORE_BOSSES = [
  "poring_king", "baphomet", "clock_tower_manager", "hardrock_mammoth", "dark_lord",
  "amon_ra", "owl_duke", "kraken", "tao_gunka", "gloom", "valkyrie_randgris", "kiel",
  "vesper", "boitata", "tendrilion", "ktullanux", "beelzebub", "thanatos_phantom",
  "memory_of_thanatos", "eddga", "moonlight", "mistress", "angeling",
  "drake", "satan_morroc", "egnigem", "kathryne", "detale", "nidhoggr",
  "doppelganger", "dark_priest", "bacsojin", "fallen_bishop", "samurai_specter", "kapha",
  "stormy_knight", "garm", "lady_tanee", "leak", "gopinich", "baba_yaga", "gigantes", "ifrit",
  "phreeoni", "deviace", "orc_lord", "orc_hero", "abysmal_knight", "amdarais", "pharaoh", "osiris",
  "freezer", "turtle_general", "chung_e", "evil_snake_lord", "dark_illusion", "corrupt_monk",
  "jade_warlord", "spirit_empress", "bangungot", "bungisngis", "jaguar_king", "anaconda",
  "gold_acidus", "tatacho", "queen_scaraba", "kublin",
];
for (const id of ORE_BOSSES) {
  const t = DROP_TABLES[id];
  if (t) {
    t.push({ itemId: "oridecon", chance: 0.7, qty: 2 });
    t.push({ itemId: "elunium", chance: 0.7, qty: 2 });
  }
}

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
