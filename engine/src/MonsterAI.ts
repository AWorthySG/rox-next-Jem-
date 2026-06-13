import {
  AGGRO_RANGE,
  ATTACK_RANGE,
  LEASH_RANGE,
  MONSTER_ATTACK_COOLDOWN_MS,
  MONSTER_SPEED,
  MonsterAIState,
  MsgType,
  WANDER_PAUSE_MAX_MS,
  WANDER_PAUSE_MIN_MS,
  WANDER_RADIUS,
} from "@rox/shared";
import type { World } from "./World.js";
import type { Monster } from "./Monster.js";
import type { Player } from "./Player.js";
import type { CombatSystem } from "./CombatSystem.js";
import { dist2d, stepToward } from "./MovementSystem.js";

// Per-monster finite state machine: idle -> wander -> aggro -> attack -> dead -> respawn.
export class MonsterAI {
  constructor(
    private world: World,
    private combat: CombatSystem,
  ) {}

  update(dt: number, dtMs: number): void {
    const now = Date.now();
    for (const m of this.world.monsters.values()) {
      if (m.attackCooldown > 0) m.attackCooldown -= dtMs;

      // Stunned monsters can't act (but dead ones still process respawn).
      if (m.aiState !== MonsterAIState.Dead && m.isStunned(now)) continue;

      switch (m.aiState) {
        case MonsterAIState.Dead:
          if (now >= m.respawnAt) {
            if (m.temporary) this.world.monsters.delete(m.id); // summoned adds don't respawn
            else this.respawn(m);
          }
          break;
        case MonsterAIState.Idle:
          this.tickIdle(m, now);
          break;
        case MonsterAIState.Wander:
          this.tickWander(m, dt);
          break;
        case MonsterAIState.Aggro:
          this.tickAggro(m, dt);
          break;
        case MonsterAIState.Attack:
          this.tickAttack(m);
          break;
      }
    }
  }

  private tickIdle(m: Monster, now: number): void {
    if (this.tryAcquireTarget(m)) return;
    if (now >= m.pauseUntil) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * WANDER_RADIUS;
      m.wanderTarget = { x: m.homeX + Math.cos(a) * r, z: m.homeZ + Math.sin(a) * r };
      m.aiState = MonsterAIState.Wander;
    }
  }

  private tickWander(m: Monster, dt: number): void {
    if (this.tryAcquireTarget(m)) return;
    if (!m.wanderTarget) {
      m.aiState = MonsterAIState.Idle;
      return;
    }
    const reached = stepToward(m, m.wanderTarget.x, m.wanderTarget.z, MONSTER_SPEED * m.speedMul(Date.now()), dt);
    if (reached) {
      m.wanderTarget = null;
      m.pauseUntil = Date.now() + rand(WANDER_PAUSE_MIN_MS, WANDER_PAUSE_MAX_MS);
      m.aiState = MonsterAIState.Idle;
    }
  }

  private tickAggro(m: Monster, dt: number): void {
    const target = this.resolveAggroTarget(m);
    if (!target) {
      this.giveUp(m);
      return;
    }
    // Leash: too far from home -> return and reset.
    if (dist2d(m.x, m.z, m.homeX, m.homeZ) > LEASH_RANGE) {
      this.giveUp(m);
      return;
    }
    const d = dist2d(m.x, m.z, target.x, target.z);
    if (d <= ATTACK_RANGE) {
      m.aiState = MonsterAIState.Attack;
      return;
    }
    stepToward(m, target.x, target.z, MONSTER_SPEED * m.speedMul(Date.now()), dt);
  }

  private tickAttack(m: Monster): void {
    const target = this.resolveAggroTarget(m);
    if (!target) {
      this.giveUp(m);
      return;
    }
    const d = dist2d(m.x, m.z, target.x, target.z);
    if (d > ATTACK_RANGE) {
      m.aiState = MonsterAIState.Aggro;
      return;
    }
    m.facing = Math.atan2(target.x - m.x, target.z - m.z);
    if (m.attackCooldown <= 0) {
      m.attackCooldown = MONSTER_ATTACK_COOLDOWN_MS;
      this.combat.monsterAttack(m, target);
    }
  }

  private tryAcquireTarget(m: Monster): boolean {
    let best: Player | null = null;
    let bestD = AGGRO_RANGE;
    for (const p of this.world.players.values()) {
      if (p.mapId !== m.mapId) continue;
      const d = dist2d(m.x, m.z, p.x, p.z);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (best) {
      m.aggroTargetId = best.id;
      m.aiState = MonsterAIState.Aggro;
      return true;
    }
    return false;
  }

  private resolveAggroTarget(m: Monster): Player | null {
    if (m.aggroTargetId == null) return null;
    const p = this.world.players.get(m.aggroTargetId);
    // Drop the target if it left the map.
    return p && p.mapId === m.mapId ? p : null;
  }

  private giveUp(m: Monster): void {
    m.aggroTargetId = null;
    m.wanderTarget = null;
    m.aiState = MonsterAIState.Idle;
    m.pauseUntil = Date.now() + 500;
  }

  private respawn(m: Monster): void {
    const pt = this.world.randomPointInZone(m.homeX, m.homeZ, 2);
    m.x = pt.x;
    m.z = pt.z;
    m.hp = m.derived.maxHp;
    m.aiState = MonsterAIState.Idle;
    m.aggroTargetId = null;
    m.wanderTarget = null;
    m.clearStatuses();
    m.enraged = false;
    m.damageMult = 1;
    m.mechTimers = [];
    m.pendingNova = null;
    m.pauseUntil = Date.now() + rand(500, 1500);
    this.world.broadcastToMap(m.mapId, { t: MsgType.Spawn, entity: m.toFull() });
  }
}

function rand(lo: number, hi: number): number {
  return lo + Math.random() * (hi - lo);
}
