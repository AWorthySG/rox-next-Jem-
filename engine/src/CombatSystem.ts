import {
  DamageKind,
  MonsterAIState,
  MsgType,
  PLAYER_ATTACK_COOLDOWN_MS,
  PLAYER_ATTACK_RANGE,
  RESPAWN_MS,
  resolveAttack,
} from "@rox/shared";
import type { World } from "./World.js";
import type { Player } from "./Player.js";
import type { Monster } from "./Monster.js";
import { dist2d } from "./MovementSystem.js";

// Resolves player attack intents and applies monster-dealt damage. Emits
// DamageEvent / LevelUp / Despawn messages as outcomes occur.
export class CombatSystem {
  constructor(private world: World) {}

  update(dtMs: number): void {
    for (const p of this.world.players.values()) {
      if (p.attackCooldown > 0) p.attackCooldown -= dtMs;
      this.updatePlayerAttack(p, dtMs);
    }
  }

  private updatePlayerAttack(p: Player, _dtMs: number): void {
    if (p.attackTargetId == null) return;
    const target = this.world.monsters.get(p.attackTargetId);
    if (!target || target.isDead) {
      p.attackTargetId = null;
      return;
    }

    const d = dist2d(p.x, p.z, target.x, target.z);
    if (d > PLAYER_ATTACK_RANGE) {
      // Out of range: chase by moving toward the target each tick.
      p.moveTarget = { x: target.x, z: target.z };
      return;
    }

    // In range: stop moving and face the target.
    p.moveTarget = null;
    p.facing = Math.atan2(target.x - p.x, target.z - p.z);

    if (p.attackCooldown > 0) return;
    p.attackCooldown = PLAYER_ATTACK_COOLDOWN_MS;

    const kind = p.isMagic ? DamageKind.Magic : DamageKind.Physical;
    const result = resolveAttack(p.derived, target.derived, kind);
    this.world.broadcast({
      t: MsgType.DamageEvent,
      sourceId: p.id,
      targetId: target.id,
      amount: result.amount,
      crit: result.crit,
      miss: result.miss,
      kind: result.kind,
    });
    if (result.miss) return;

    target.hp -= result.amount;
    // Aggro the monster onto its attacker.
    if (target.aiState !== MonsterAIState.Attack) {
      target.aggroTargetId = p.id;
      target.aiState = MonsterAIState.Aggro;
    }

    if (target.hp <= 0) {
      this.killMonster(target, p);
    }
  }

  private killMonster(target: Monster, killer: Player): void {
    target.hp = 0;
    target.aiState = MonsterAIState.Dead;
    target.aggroTargetId = null;
    target.respawnAt = Date.now() + RESPAWN_MS;
    this.world.broadcast({ t: MsgType.Despawn, id: target.id });

    // Award EXP and clear any players targeting this monster.
    const leveled = killer.gainExp(target.template.baseExp);
    for (const p of this.world.players.values()) {
      if (p.attackTargetId === target.id) p.attackTargetId = null;
    }
    if (leveled) {
      this.world.broadcast({
        t: MsgType.LevelUp,
        id: killer.id,
        newLevel: killer.level,
        maxHp: killer.derived.maxHp,
        maxSp: killer.derived.maxSp,
        stats: { ...killer.stats },
        expToNext: isFiniteExp(killer),
      });
    }
  }

  // Called by MonsterAI when a monster lands a hit on a player.
  monsterAttack(monster: Monster, player: Player): void {
    const result = resolveAttack(monster.derived, player.derived, DamageKind.Physical);
    this.world.broadcast({
      t: MsgType.DamageEvent,
      sourceId: monster.id,
      targetId: player.id,
      amount: result.amount,
      crit: result.crit,
      miss: result.miss,
      kind: result.kind,
    });
    if (result.miss) return;
    player.hp -= result.amount;
    if (player.hp <= 0) {
      this.respawnPlayer(player);
    }
  }

  private respawnPlayer(player: Player): void {
    player.hp = player.derived.maxHp;
    player.sp = player.derived.maxSp;
    player.x = 0;
    player.z = 0;
    player.moveTarget = null;
    player.attackTargetId = null;
    // Drop aggro from any monster chasing this player.
    for (const m of this.world.monsters.values()) {
      if (m.aggroTargetId === player.id) {
        m.aggroTargetId = null;
        m.aiState = MonsterAIState.Idle;
      }
    }
  }
}

function isFiniteExp(p: Player): number {
  const v = p.toSelfState().expToNext;
  return v;
}
