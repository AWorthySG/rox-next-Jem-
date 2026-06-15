import {
  deriveStats,
  Element,
  EntityKind,
  JobId,
  MonsterAIState,
  StatusType,
  type DerivedStats,
  type EntityFull,
  type EntitySnapshot,
} from "@rox/shared";
import type { MonsterTemplate } from "./data/spawns.js";

interface ActiveStatus {
  type: StatusType;
  expiresAt: number;
  magnitude: number; // slow: speed mult; burn: flat damage per tick
  sourceId: number;
  nextTickAt: number; // burn only
}

const BURN_TICK_MS = 600;

export class Monster {
  readonly id: number;
  readonly template: MonsterTemplate;
  readonly spawnZoneId: string;
  readonly mapId: string;
  readonly homeX: number;
  readonly homeZ: number;

  x: number;
  z: number;
  facing = 0;

  level: number;
  derived: DerivedStats;
  hp: number;
  readonly element: Element;

  aiState: MonsterAIState = MonsterAIState.Idle;
  wanderTarget: { x: number; z: number } | null = null;
  pauseUntil = 0; // timestamp; idle until then
  aggroTargetId: number | null = null;
  attackCooldown = 0;
  respawnAt = 0;

  constructor(id: number, template: MonsterTemplate, zoneId: string, mapId: string, x: number, z: number) {
    this.id = id;
    this.template = template;
    this.spawnZoneId = zoneId;
    this.mapId = mapId;
    this.homeX = x;
    this.homeZ = z;
    this.x = x;
    this.z = z;
    this.level = template.level;
    this.element = template.element ?? Element.Neutral;
    // Monsters derive combat stats the same way players do, then override maxHp
    // with the template's flat HP for predictable tuning.
    this.derived = { ...deriveStats(template.stats, template.level, JobId.Novice), maxHp: template.baseHp };
    this.hp = this.derived.maxHp;
  }

  statuses: ActiveStatus[] = [];
  // boss-mechanic state
  enraged = false;
  damageMult = 1;
  mechTimers: number[] = [];
  summonerId: number | null = null;
  temporary = false; // summoned add: removed on death rather than respawning
  pendingNova: { x: number; z: number; radius: number; powerMult: number; fireAt: number } | null = null;
  // Per-player damage tally for shared-HP world bosses (cleared on death/respawn).
  damageByPlayer = new Map<number, number>();

  get isDead(): boolean {
    return this.aiState === MonsterAIState.Dead;
  }

  // Tally damage dealt by a player toward this monster (drives world-boss rewards).
  recordDamage(playerId: number, amount: number): void {
    if (amount <= 0) return;
    this.damageByPlayer.set(playerId, (this.damageByPlayer.get(playerId) ?? 0) + amount);
  }

  addStatus(type: StatusType, durationMs: number, sourceId: number, now: number, magnitude = 0): void {
    this.statuses = this.statuses.filter((s) => s.type !== type); // refresh
    this.statuses.push({
      type,
      expiresAt: now + durationMs,
      magnitude,
      sourceId,
      nextTickAt: now + BURN_TICK_MS,
    });
  }

  clearStatuses(): void {
    this.statuses = [];
  }

  isStunned(now: number): boolean {
    return this.statuses.some((s) => s.type === StatusType.Stun && s.expiresAt > now);
  }

  speedMul(now: number): number {
    let m = 1;
    for (const s of this.statuses) {
      if (s.type === StatusType.Slow && s.expiresAt > now) m = Math.min(m, s.magnitude);
    }
    return m;
  }

  // Drop expired statuses and return any due burn ticks ({ amount, sourceId }).
  tickStatuses(now: number): Array<{ amount: number; sourceId: number }> {
    const ticks: Array<{ amount: number; sourceId: number }> = [];
    for (const s of this.statuses) {
      if (s.type === StatusType.Burn) {
        while (s.expiresAt > now && s.nextTickAt <= now) {
          ticks.push({ amount: s.magnitude, sourceId: s.sourceId });
          s.nextTickAt += BURN_TICK_MS;
        }
      }
    }
    this.statuses = this.statuses.filter((s) => s.expiresAt > now);
    return ticks;
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
      element: this.element,
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
      ...(this.enraged ? { enraged: true } : {}),
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
