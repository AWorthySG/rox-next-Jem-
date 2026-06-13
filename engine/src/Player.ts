import {
  addStats,
  deriveStats,
  EntityKind,
  JOB_BASE_STATS,
  JOB_GROWTH,
  JobId,
  isMagicJob,
  xpToNext,
  type DerivedStats,
  type EntityFull,
  type EntitySnapshot,
  type SelfState,
  type Stats,
} from "@rox/shared";

export class Player {
  readonly id: number;
  readonly connId: number;
  name: string;
  job: JobId;
  colorSeed: number;

  x: number;
  z: number;
  facing = 0;

  level = 1;
  exp = 0;
  zeny = 0;
  stats: Stats;
  derived: DerivedStats;
  hp: number;
  sp: number;

  // intents
  moveTarget: { x: number; z: number } | null = null;
  attackTargetId: number | null = null;
  attackCooldown = 0; // ms remaining
  pendingSkillId: string | null = null;
  pendingSkillTargetId: number | null = null;
  skillCooldowns: Record<string, number> = {}; // skillId -> ms remaining

  constructor(id: number, connId: number, name: string, job: JobId, x: number, z: number) {
    this.id = id;
    this.connId = connId;
    this.name = name;
    this.job = job;
    this.colorSeed = Math.floor(Math.random() * 360);
    this.x = x;
    this.z = z;
    this.stats = { ...JOB_BASE_STATS[job] };
    this.derived = deriveStats(this.stats, this.level, this.job);
    this.hp = this.derived.maxHp;
    this.sp = this.derived.maxSp;
  }

  get isMagic(): boolean {
    return isMagicJob(this.job);
  }

  recompute(): void {
    this.derived = deriveStats(this.stats, this.level, this.job);
  }

  // Returns true if a level-up occurred.
  gainExp(amount: number): boolean {
    this.exp += amount;
    let leveled = false;
    while (this.exp >= xpToNext(this.level)) {
      this.exp -= xpToNext(this.level);
      this.level += 1;
      this.stats = addStats(this.stats, JOB_GROWTH[this.job]);
      this.recompute();
      // Full heal on level-up (classic RO).
      this.hp = this.derived.maxHp;
      this.sp = this.derived.maxSp;
      leveled = true;
      if (!isFinite(xpToNext(this.level))) {
        this.exp = 0;
        break;
      }
    }
    return leveled;
  }

  toFull(): EntityFull {
    return {
      id: this.id,
      kind: EntityKind.Player,
      name: this.name,
      x: this.x,
      z: this.z,
      facing: this.facing,
      hp: this.hp,
      maxHp: this.derived.maxHp,
      level: this.level,
      job: this.job,
      colorSeed: this.colorSeed,
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
    };
  }

  toSelfState(): SelfState {
    return {
      id: this.id,
      name: this.name,
      job: this.job,
      level: this.level,
      hp: Math.round(this.hp),
      maxHp: this.derived.maxHp,
      sp: Math.round(this.sp),
      maxSp: this.derived.maxSp,
      exp: Math.round(this.exp),
      expToNext: isFinite(xpToNext(this.level)) ? xpToNext(this.level) : 0,
      zeny: this.zeny,
      stats: { ...this.stats },
      x: round2(this.x),
      z: round2(this.z),
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
