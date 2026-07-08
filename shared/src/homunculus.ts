import type { Stats } from "./stats.js";

// Homunculi — the Alchemist line's summonable combat familiars. Each of the
// four archetypes behaves differently: Lif mends its master, Amistr is a
// passive bulwark, and Filir/Vanilmirth harry the master's foes with physical
// or magic strikes. Only the Merchant→Alchemist→Creator→Begetter branch may
// call one (gated in Player.useItem).
export type HomunKind = "heal" | "guard" | "physical" | "magic";

export interface HomunDef {
  id: string;
  name: string;
  kind: HomunKind;
  power: number; // damage skills: multiplier; heal: fraction of the master's max HP
  cooldownMs: number; // action cadence (0 for the passive guard)
  range: number; // how far the familiar will reach for a target
  tint: number; // colour hint for the client-rendered companion
  bonusStats?: Partial<Stats>; // guard passive bonus applied to the master
  maxHp?: number; // guard passive max-HP bonus
  desc: string;
}

export const HOMUNCULI: Record<string, HomunDef> = {
  lif: {
    id: "lif",
    name: "Lif",
    kind: "heal",
    power: 0.08, // heals 8% of the master's max HP per pulse
    cooldownMs: 5000,
    range: 0,
    tint: 0xbfe0ff,
    desc: "A gentle familiar that mends its master's wounds.",
  },
  amistr: {
    id: "amistr",
    name: "Amistr",
    kind: "guard",
    power: 0,
    cooldownMs: 0,
    range: 0,
    tint: 0xd9a066,
    bonusStats: { vit: 8 },
    maxHp: 240,
    desc: "A woolly guardian whose presence toughens its master.",
  },
  filir: {
    id: "filir",
    name: "Filir",
    kind: "physical",
    power: 1.8,
    cooldownMs: 2600,
    range: 11,
    tint: 0xffd27a,
    desc: "A swift raptor that dives on the master's foes.",
  },
  vanilmirth: {
    id: "vanilmirth",
    name: "Vanilmirth",
    kind: "magic",
    power: 2.0,
    cooldownMs: 3000,
    range: 11,
    tint: 0xb59cff,
    desc: "A curious blob that flings raw mana at nearby enemies.",
  },
};

export function getHomun(id: string | null): HomunDef | undefined {
  return id ? HOMUNCULI[id] : undefined;
}
