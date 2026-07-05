import type { Stats } from "./stats.js";

export interface MountDef {
  id: string;
  name: string;
  speedMult: number; // multiplies PLAYER_SPEED while ridden
  bonusStats?: Partial<Stats>;
  tint: number; // colour hint for the client-rendered mount
}

// Ridden companions. Toggled on/off by a reusable summon item; only one may
// be active at a time. Each grants a distinct speed boost and a small passive
// stat bonus, matching the real game's mount collection (not a single toggle).
export const MOUNTS: Record<string, MountDef> = {
  peco: {
    id: "peco",
    name: "Peco Peco",
    speedMult: 1.6,
    tint: 0xf4c542,
  },
  grand_peco: {
    id: "grand_peco",
    name: "Grand Peco",
    speedMult: 1.8,
    bonusStats: { vit: 5 },
    tint: 0xe8e0c8,
  },
  dune_wolf: {
    id: "dune_wolf",
    name: "Dune Wolf",
    speedMult: 1.7,
    bonusStats: { agi: 5 },
    tint: 0x8a7a68,
  },
  baby_dragon: {
    id: "baby_dragon",
    name: "Baby Dragon",
    speedMult: 2.0,
    bonusStats: { str: 3, int: 3 },
    tint: 0xc23a3a,
  },
};

export function getMount(id: string | null | undefined): MountDef | undefined {
  return id ? MOUNTS[id] : undefined;
}
