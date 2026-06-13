import type { Stats } from "./stats.js";

export interface PetDef {
  id: string;
  name: string;
  bonusStats?: Partial<Stats>;
  atk?: number;
  matk?: number;
  maxHp?: number;
  tint: number; // colour hint for the client-rendered companion
}

// Summonable companions. Each grants a small passive bonus while active.
export const PETS: Record<string, PetDef> = {
  poring_pet: {
    id: "poring_pet",
    name: "Poring",
    bonusStats: { luk: 3 },
    maxHp: 50,
    tint: 0xff9ec4,
  },
  lunatic_pet: {
    id: "lunatic_pet",
    name: "Lunatic",
    bonusStats: { agi: 3, dex: 2 },
    tint: 0xe6dcc0,
  },
  baphomet_pet: {
    id: "baphomet_pet",
    name: "Baphomet Jr.",
    bonusStats: { str: 4, int: 4 },
    maxHp: 80,
    tint: 0x8a2030,
  },
};

export function getPet(id: string): PetDef | undefined {
  return PETS[id];
}
