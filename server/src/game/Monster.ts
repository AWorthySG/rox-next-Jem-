import {
  deriveStats,
  EntityKind,
  JobId,
  MonsterAIState,
  type DerivedStats,
  type EntityFull,
  type EntitySnapshot,
} from "@rox/shared";
import type { MonsterTemplate } from "../data/spawns.js";

export class Monster {
  readonly id: number;
  readonly template: MonsterTemplate;
  readonly spawnZoneId: string;
  readonly homeX: number;
  readonly homeZ: number;

  x: number;
  z: number;
  facing = 0;

  level: number;
  derived: DerivedStats;
  hp: number;

  aiState: MonsterAIState = MonsterAIState.Idle;
  wanderTarget: { x: number; z: number } | null = null;
  pauseUntil = 0; // timestamp; idle until then
  aggroTargetId: number | null = null;
  attackCooldown = 0;
  respawnAt = 0;

  constructor(id: number, template: MonsterTemplate, zoneId: string, x: number, z: number) {
    this.id = id;
    this.template = template;
    this.spawnZoneId = zoneId;
    this.homeX = x;
    this.homeZ = z;
    this.x = x;
    this.z = z;
    this.level = template.level;
    // Monsters derive combat stats the same way players do, then override maxHp
    // with the template's flat HP for predictable tuning.
    this.derived = { ...deriveStats(template.stats, template.level, JobId.Novice), maxHp: template.baseHp };
    this.hp = this.derived.maxHp;
  }

  get isDead(): boolean {
    return this.aiState === MonsterAIState.Dead;
  }

  toFull(): EntityFull {
    return {
      id: this.id,
      kind: EntityKind.Monster,
      name: this.template.name,
      x: this.x,
      z: this.z,
      facing: this.facing,
      hp: this.hp,
      maxHp: this.derived.maxHp,
      level: this.level,
      templateId: this.template.id,
      aiState: this.aiState,
    };
  }

  toSnapshot(): EntitySnapshot {
    return {
      id: this.id,
      x: round2(this.x),
      z: round2(this.z),
      facing: round2(this.facing),
      hp: Math.round(this.hp),
      maxHp: this.derived.maxHp,
      aiState: this.aiState,
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
