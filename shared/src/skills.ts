import { DamageKind, JobId } from "./enums.js";

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
    desc: "Fiery area blast around the target.",
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
    desc: "Hurl a bolt of fire at a single enemy.",
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
    desc: "Call lightning over an area.",
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
    desc: "Knock enemies around in a wide arc.",
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
    desc: "Rain meteors across a wide area.",
  },
};

export const SKILLS_BY_JOB: Record<JobId, SkillDef[]> = {
  [JobId.Novice]: [SKILLS.first_aid],
  [JobId.Swordsman]: [SKILLS.bash, SKILLS.magnum_break],
  [JobId.Mage]: [SKILLS.fire_bolt, SKILLS.thunder_storm],
  // 2nd jobs keep their 1st-job kit and gain new skills.
  [JobId.Knight]: [SKILLS.bash, SKILLS.magnum_break, SKILLS.pierce, SKILLS.bowling_bash],
  [JobId.Wizard]: [SKILLS.fire_bolt, SKILLS.thunder_storm, SKILLS.jupitel_thunder, SKILLS.meteor_storm],
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
