import { PET_INTIMACY_PER_LEVEL, PET_LEVEL_CAP, PET_SKILL_UNLOCK_LEVEL } from "./constants.js";
import { DamageKind } from "./enums.js";
import type { Stats } from "./stats.js";

// A pet's signature active skill: once the pet levels up enough to learn it, it
// joins the owner's attacks, striking the same target on its own cooldown.
export interface PetSkillDef {
  id: string;
  name: string;
  power: number; // multiplier on the pet's contribution
  kind: DamageKind;
  cooldownMs: number;
  desc: string;
}

export interface PetDef {
  id: string;
  name: string;
  bonusStats?: Partial<Stats>;
  atk?: number;
  matk?: number;
  maxHp?: number;
  tint: number; // colour hint for the client-rendered companion
  skill?: PetSkillDef; // learned once the pet reaches PET_SKILL_UNLOCK_LEVEL
}

// Summonable companions. Each grants a small passive bonus while active.
export const PETS: Record<string, PetDef> = {
  poring_pet: {
    id: "poring_pet",
    name: "Poring",
    bonusStats: { luk: 3 },
    maxHp: 50,
    tint: 0xff9ec4,
    skill: { id: "pet_pounce", name: "Pounce", power: 1.4, kind: DamageKind.Physical, cooldownMs: 4000, desc: "The Poring bounces onto your foe." },
  },
  lunatic_pet: {
    id: "lunatic_pet",
    name: "Lunatic",
    bonusStats: { agi: 3, dex: 2 },
    tint: 0xe6dcc0,
    skill: { id: "pet_kick", name: "Bunny Kick", power: 1.6, kind: DamageKind.Physical, cooldownMs: 3600, desc: "A swift double-footed kick." },
  },
  baphomet_pet: {
    id: "baphomet_pet",
    name: "Baphomet Jr.",
    bonusStats: { str: 4, int: 4 },
    maxHp: 80,
    tint: 0x8a2030,
    skill: { id: "pet_hellfire", name: "Little Hellfire", power: 2.2, kind: DamageKind.Magic, cooldownMs: 5200, desc: "A mischievous gout of dark flame." },
  },
  marc_pet: {
    id: "marc_pet",
    name: "Marc",
    bonusStats: { vit: 3, agi: 2 },
    maxHp: 90,
    tint: 0x4aa6ff,
    skill: { id: "pet_splash", name: "Splash", power: 1.7, kind: DamageKind.Magic, cooldownMs: 4200, desc: "A bracing spray of seawater." },
  },
  garm_pet: {
    id: "garm_pet",
    name: "Garm Cub",
    bonusStats: { vit: 5 },
    maxHp: 220,
    tint: 0xbfe0ec,
    skill: { id: "pet_frostbite", name: "Frostbite", power: 2.0, kind: DamageKind.Magic, cooldownMs: 4800, desc: "A biting nip of frost." },
  },
  ifrit_pet: {
    id: "ifrit_pet",
    name: "Ifrit Spark",
    bonusStats: { str: 6 },
    atk: 14,
    tint: 0xff6a3a,
    skill: { id: "pet_ember", name: "Ember Burst", power: 2.4, kind: DamageKind.Magic, cooldownMs: 5000, desc: "A searing burst of ember." },
  },
  nidhoggr_pet: {
    id: "nidhoggr_pet",
    name: "Shadow Hatchling",
    bonusStats: { str: 3, agi: 3, vit: 3, int: 3, dex: 3, luk: 3 },
    maxHp: 160,
    tint: 0xb060ff,
    skill: { id: "pet_shadowbite", name: "Shadow Bite", power: 2.6, kind: DamageKind.Physical, cooldownMs: 5200, desc: "A hatchling's shadow-wreathed bite." },
  },
};

export function getPet(id: string): PetDef | undefined {
  return PETS[id];
}

// A pet's level from its accumulated intimacy (starts at 1, capped).
export function petLevelFromIntimacy(intimacy: number): number {
  return Math.min(PET_LEVEL_CAP, 1 + Math.floor(Math.max(0, intimacy) / PET_INTIMACY_PER_LEVEL));
}

// Scale factor applied to a pet's passive bonus at the given level (1.0 at Lv1).
export function petBonusScale(level: number): number {
  return 1 + (level - 1) * 0.1;
}

// Whether a pet has learned its active skill at the given level.
export function petSkillUnlocked(level: number): boolean {
  return level >= PET_SKILL_UNLOCK_LEVEL;
}
