export interface CostumeDef {
  id: string;
  name: string;
  // HSL hues (0..1) for the outfit/accent/hair — a themed palette swap, purely
  // cosmetic and independent of whatever armor is actually equipped.
  outfitHue: number;
  accentHue: number;
  hairHue: number;
}

// Purely cosmetic outfit skins. Toggled on/off by a reusable costume item,
// same "not consumed" pattern as a mount whistle — mix and match freely,
// with zero effect on stats.
export const COSTUMES: Record<string, CostumeDef> = {
  crimson_duelist: {
    id: "crimson_duelist",
    name: "Crimson Duelist",
    outfitHue: 0.98,
    accentHue: 0.02,
    hairHue: 0.0,
  },
  azure_mystic: {
    id: "azure_mystic",
    name: "Azure Mystic",
    outfitHue: 0.58,
    accentHue: 0.53,
    hairHue: 0.6,
  },
  verdant_ranger: {
    id: "verdant_ranger",
    name: "Verdant Ranger",
    outfitHue: 0.33,
    accentHue: 0.1,
    hairHue: 0.09,
  },
  golden_regalia: {
    id: "golden_regalia",
    name: "Golden Regalia",
    outfitHue: 0.13,
    accentHue: 0.11,
    hairHue: 0.03,
  },
};

export function getCostume(id: string | null | undefined): CostumeDef | undefined {
  return id ? COSTUMES[id] : undefined;
}
