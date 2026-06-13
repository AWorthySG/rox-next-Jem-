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

export interface ItemDef {
  id: string;
  name: string;
  type: ItemType;
  desc: string;
  slot?: EquipSlot; // for equipment
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
  // economy
  price?: number; // buy cost at the shop (omitted = not sold)
  sellPrice?: number; // Zeny gained when sold
}

// A compact item catalogue. Both server and client read this; the client only
// needs the id + qty over the wire and looks the rest up here.
export const ITEMS: Record<string, ItemDef> = {
  // consumables
  apple: { id: "apple", name: "Apple", type: ItemType.Consumable, desc: "Restores 60 HP.", healHp: 60, price: 15, sellPrice: 4 },
  red_potion: { id: "red_potion", name: "Red Potion", type: ItemType.Consumable, desc: "Restores 150 HP.", healHp: 150, price: 50, sellPrice: 12 },
  blue_potion: { id: "blue_potion", name: "Blue Potion", type: ItemType.Consumable, desc: "Restores 80 SP.", healSp: 80, price: 60, sellPrice: 15 },

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
};

// What the town shop sells.
export const SHOP_STOCK: string[] = [
  "apple",
  "red_potion",
  "blue_potion",
  "novice_knife",
  "apprentice_rod",
  "cotton_shirt",
  "leather_armor",
  "ring_of_power",
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
  ],
  lunatic: [
    { itemId: "red_potion", chance: 0.18 },
    { itemId: "leather_armor", chance: 0.06 },
    { itemId: "ring_of_power", chance: 0.05 },
  ],
  poring_king: [
    { itemId: "red_potion", chance: 1, qty: 3 },
    { itemId: "poring_crown", chance: 0.8 },
    { itemId: "kings_cleaver", chance: 0.55 },
    { itemId: "leather_armor", chance: 0.5 },
  ],
  zombie: [
    { itemId: "red_potion", chance: 0.3 },
    { itemId: "saint_robe", chance: 0.05 },
  ],
  skeleton: [
    { itemId: "red_potion", chance: 0.3 },
    { itemId: "claymore", chance: 0.06 },
    { itemId: "rosary", chance: 0.05 },
  ],
  baphomet: [
    { itemId: "red_potion", chance: 1, qty: 5 },
    { itemId: "baphomet_horn", chance: 0.7 },
    { itemId: "claymore", chance: 0.5 },
    { itemId: "saint_robe", chance: 0.5 },
  ],
};

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
