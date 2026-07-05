export interface Recipe {
  id: string;
  name: string;
  desc: string;
  inputs: Array<{ itemId: string; qty: number }>;
  outputId: string;
  outputQty: number;
}

// Cooking recipes: turn gathered raw materials (fishing/gardening) into
// finished food. Mining's yields (oridecon/elunium/mithril) feed the
// existing refine economy directly instead of a separate recipe.
export const RECIPES: Record<string, Recipe> = {
  grilled_sardine_recipe: {
    id: "grilled_sardine_recipe",
    name: "Grilled Sardine",
    desc: "3 Sardine -> a smoky snack that sharpens your attacks.",
    inputs: [{ itemId: "sardine", qty: 3 }],
    outputId: "grilled_sardine",
    outputQty: 1,
  },
  pumpkin_stew_recipe: {
    id: "pumpkin_stew_recipe",
    name: "Pumpkin Stew",
    desc: "2 Pumpkin + 1 Turnip -> a hearty stew that toughens you up.",
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
    inputs: [
      { itemId: "moonflower", qty: 1 },
      { itemId: "tuna", qty: 1 },
    ],
    outputId: "moonflower_tonic",
    outputQty: 1,
  },
};

export function getRecipe(id: string): Recipe | undefined {
  return RECIPES[id];
}
