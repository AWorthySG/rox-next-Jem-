import type { CraftSkillId } from "./lifeSkills.js";

export interface Recipe {
  id: string;
  name: string;
  desc: string;
  skill: CraftSkillId; // which craft skill works (and levels from) this recipe
  minLevel: number; // craft-skill level required to attempt it
  inputs: Array<{ itemId: string; qty: number }>;
  outputId: string;
  outputQty: number;
}

// Cooking turns gathered food (fishing/gardening) into stat-buff meals.
// Smelting turns mined ore into ingots. Crafting turns ingots into wearable
// equipment — closing the full gather -> smelt -> craft production chain.
export const RECIPES: Record<string, Recipe> = {
  // ---- cooking ----
  grilled_sardine_recipe: {
    id: "grilled_sardine_recipe",
    name: "Grilled Sardine",
    desc: "3 Sardine -> a smoky snack that sharpens your attacks.",
    skill: "cooking",
    minLevel: 1,
    inputs: [{ itemId: "sardine", qty: 3 }],
    outputId: "grilled_sardine",
    outputQty: 1,
  },
  pumpkin_stew_recipe: {
    id: "pumpkin_stew_recipe",
    name: "Pumpkin Stew",
    desc: "2 Pumpkin + 1 Turnip -> a hearty stew that toughens you up.",
    skill: "cooking",
    minLevel: 1,
    inputs: [
      { itemId: "pumpkin", qty: 2 },
      { itemId: "turnip", qty: 1 },
    ],
    outputId: "pumpkin_stew",
    outputQty: 1,
  },
  moonflower_tonic_recipe: {
    id: "moonflower_tonic_recipe",
    name: "Moonflower Tonic",
    desc: "1 Moonflower + 1 Tuna -> a rare tonic that sharpens the mind.",
    skill: "cooking",
    minLevel: 1,
    inputs: [
      { itemId: "moonflower", qty: 1 },
      { itemId: "tuna", qty: 1 },
    ],
    outputId: "moonflower_tonic",
    outputQty: 1,
  },

  // ---- smelting (mined ore -> ingots) ----
  oridecon_ingot_recipe: {
    id: "oridecon_ingot_recipe",
    name: "Oridecon Ingot",
    desc: "2 Oridecon -> a bar of weapon-grade metal.",
    skill: "smelting",
    minLevel: 1,
    inputs: [{ itemId: "oridecon", qty: 2 }],
    outputId: "oridecon_ingot",
    outputQty: 1,
  },
  elunium_ingot_recipe: {
    id: "elunium_ingot_recipe",
    name: "Elunium Ingot",
    desc: "2 Elunium -> a bar of armor-grade metal.",
    skill: "smelting",
    minLevel: 1,
    inputs: [{ itemId: "elunium", qty: 2 }],
    outputId: "elunium_ingot",
    outputQty: 1,
  },
  mithril_ingot_recipe: {
    id: "mithril_ingot_recipe",
    name: "Mithril Ingot",
    desc: "2 Mithril Ore -> a gleaming bar only a master smelter can pour.",
    skill: "smelting",
    minLevel: 10,
    inputs: [{ itemId: "mithril_ore", qty: 2 }],
    outputId: "mithril_ingot",
    outputQty: 1,
  },

  // ---- crafting (ingots -> equipment) ----
  miners_band_recipe: {
    id: "miners_band_recipe",
    name: "Miner's Band",
    desc: "2 Oridecon Ingot + 1 Elunium Ingot -> a sturdy ring for a working hand.",
    skill: "crafting",
    minLevel: 1,
    inputs: [
      { itemId: "oridecon_ingot", qty: 2 },
      { itemId: "elunium_ingot", qty: 1 },
    ],
    outputId: "miners_band",
    outputQty: 1,
  },
  artisan_charm_recipe: {
    id: "artisan_charm_recipe",
    name: "Artisan's Charm",
    desc: "2 Elunium Ingot + 1 Oridecon Ingot -> a charm that steadies the wearer's aim.",
    skill: "crafting",
    minLevel: 5,
    inputs: [
      { itemId: "elunium_ingot", qty: 2 },
      { itemId: "oridecon_ingot", qty: 1 },
    ],
    outputId: "artisan_charm",
    outputQty: 1,
  },
  mithril_circlet_recipe: {
    id: "mithril_circlet_recipe",
    name: "Mithril Circlet",
    desc: "2 Mithril Ingot + 1 Elunium Ingot -> a masterwork circlet.",
    skill: "crafting",
    minLevel: 10,
    inputs: [
      { itemId: "mithril_ingot", qty: 2 },
      { itemId: "elunium_ingot", qty: 1 },
    ],
    outputId: "mithril_circlet",
    outputQty: 1,
  },
};

export function getRecipe(id: string): Recipe | undefined {
  return RECIPES[id];
}
