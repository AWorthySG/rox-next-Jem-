import { DamageKind, JobId, StatusType } from "./enums.js";

export interface SkillEffect {
  type: StatusType;
  durationMs: number;
  magnitude?: number; // slow: speed multiplier; burn: fraction of MATK per tick
}

export interface SkillDef {
  id: string;
  name: string;
  job: JobId;
  hotkey: number; // 1-based slot
  spCost: number;
  cooldownMs: number;
  range: number;
  kind: DamageKind;
  power: number; // multiplier applied to ATK/MATK
  aoeRadius?: number; // if set, also hits enemies within this radius of the target
  heal?: boolean; // restores the caster's HP instead of dealing damage
  buff?: { stat: "atk" | "matk"; mult: number; durationMs: number }; // self-buff
  effect?: SkillEffect; // status applied to enemies hit
  desc: string;
}

// Iconic-feeling starter skills per job. Damage is server-authoritative; the
// client uses the same defs for the skill bar, SP gating and cooldown display.
export const SKILLS: Record<string, SkillDef> = {
  first_aid: {
    id: "first_aid",
    name: "First Aid",
    job: JobId.Novice,
    hotkey: 1,
    spCost: 8,
    cooldownMs: 4000,
    range: 0,
    kind: DamageKind.Magic,
    power: 0,
    heal: true,
    desc: "Restore a small amount of HP.",
  },
  bash: {
    id: "bash",
    name: "Bash",
    job: JobId.Swordsman,
    hotkey: 1,
    spCost: 8,
    cooldownMs: 1600,
    range: 2.6,
    kind: DamageKind.Physical,
    power: 2.4,
    desc: "A heavy strike on a single target.",
  },
  magnum_break: {
    id: "magnum_break",
    name: "Magnum Break",
    job: JobId.Swordsman,
    hotkey: 2,
    spCost: 18,
    cooldownMs: 5000,
    range: 3.2,
    kind: DamageKind.Physical,
    power: 1.8,
    aoeRadius: 5,
    effect: { type: StatusType.Slow, durationMs: 2500, magnitude: 0.5 },
    desc: "Fiery area blast that slows enemies.",
  },
  fire_bolt: {
    id: "fire_bolt",
    name: "Fire Bolt",
    job: JobId.Mage,
    hotkey: 1,
    spCost: 12,
    cooldownMs: 1500,
    range: 11,
    kind: DamageKind.Magic,
    power: 2.6,
    effect: { type: StatusType.Burn, durationMs: 3000, magnitude: 0.25 },
    desc: "Hurl a bolt of fire that burns over time.",
  },
  thunder_storm: {
    id: "thunder_storm",
    name: "Thunder Storm",
    job: JobId.Mage,
    hotkey: 2,
    spCost: 24,
    cooldownMs: 5500,
    range: 11,
    kind: DamageKind.Magic,
    power: 1.9,
    aoeRadius: 5.5,
    effect: { type: StatusType.Stun, durationMs: 1200 },
    desc: "Call lightning that stuns enemies briefly.",
  },

  // ---- 2nd-job skills ----
  pierce: {
    id: "pierce",
    name: "Pierce",
    job: JobId.Knight,
    hotkey: 3,
    spCost: 14,
    cooldownMs: 1800,
    range: 2.8,
    kind: DamageKind.Physical,
    power: 3.4,
    desc: "Run a spear through a single foe.",
  },
  bowling_bash: {
    id: "bowling_bash",
    name: "Bowling Bash",
    job: JobId.Knight,
    hotkey: 4,
    spCost: 28,
    cooldownMs: 6000,
    range: 3.2,
    kind: DamageKind.Physical,
    power: 2.6,
    aoeRadius: 6,
    effect: { type: StatusType.Stun, durationMs: 1500 },
    desc: "Knock enemies around in a wide arc, stunning them.",
  },
  jupitel_thunder: {
    id: "jupitel_thunder",
    name: "Jupitel Thunder",
    job: JobId.Wizard,
    hotkey: 3,
    spCost: 22,
    cooldownMs: 2200,
    range: 12,
    kind: DamageKind.Magic,
    power: 3.8,
    desc: "A piercing bolt of wind and lightning.",
  },
  meteor_storm: {
    id: "meteor_storm",
    name: "Meteor Storm",
    job: JobId.Wizard,
    hotkey: 4,
    spCost: 40,
    cooldownMs: 8000,
    range: 12,
    kind: DamageKind.Magic,
    power: 2.8,
    aoeRadius: 7,
    effect: { type: StatusType.Burn, durationMs: 4000, magnitude: 0.3 },
    desc: "Rain meteors that scorch a wide area over time.",
  },

  // ---- self-buff skills ----
  battle_focus: {
    id: "battle_focus",
    name: "Battle Focus",
    job: JobId.Swordsman,
    hotkey: 5,
    spCost: 18,
    cooldownMs: 20000,
    range: 0,
    kind: DamageKind.Physical,
    power: 0,
    buff: { stat: "atk", mult: 1.3, durationMs: 15000 },
    desc: "Steel your resolve: +30% ATK for 15s.",
  },
  mystic_focus: {
    id: "mystic_focus",
    name: "Mystic Focus",
    job: JobId.Mage,
    hotkey: 5,
    spCost: 22,
    cooldownMs: 20000,
    range: 0,
    kind: DamageKind.Magic,
    power: 0,
    buff: { stat: "matk", mult: 1.3, durationMs: 15000 },
    desc: "Channel arcane power: +30% MATK for 15s.",
  },
};

export const SKILLS_BY_JOB: Record<JobId, SkillDef[]> = {
  [JobId.Novice]: [SKILLS.first_aid],
  [JobId.Swordsman]: [SKILLS.bash, SKILLS.magnum_break, SKILLS.battle_focus],
  [JobId.Mage]: [SKILLS.fire_bolt, SKILLS.thunder_storm, SKILLS.mystic_focus],
  // 2nd jobs keep their 1st-job kit and gain new skills.
  [JobId.Knight]: [SKILLS.bash, SKILLS.magnum_break, SKILLS.pierce, SKILLS.bowling_bash, SKILLS.battle_focus],
  [JobId.Wizard]: [SKILLS.fire_bolt, SKILLS.thunder_storm, SKILLS.jupitel_thunder, SKILLS.meteor_storm, SKILLS.mystic_focus],
};

export function getSkill(id: string): SkillDef | undefined {
  return SKILLS[id];
}

// Skills can be leveled 1..SKILL_MAX_LEVEL; power and SP cost scale with level.
export const SKILL_MAX_LEVEL = 5;

export function skillPower(def: SkillDef, level: number): number {
  return def.power * (1 + 0.25 * (Math.max(1, level) - 1));
}

export function skillSpCost(def: SkillDef, level: number): number {
  return Math.round(def.spCost * (1 + 0.1 * (Math.max(1, level) - 1)));
}

// A skill is usable by a job if it appears in that job's kit (covers inherited
// 1st-job skills on 2nd jobs).
export function jobHasSkill(job: JobId, skillId: string): boolean {
  return (SKILLS_BY_JOB[job] ?? []).some((s) => s.id === skillId);
}
