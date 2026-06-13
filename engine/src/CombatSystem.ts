import {
  DamageKind,
  EXP_SHARE_RANGE,
  getSkill,
  HP_REGEN_PER_SEC,
  jobHasSkill,
  MonsterAIState,
  PARTY_EXP_BONUS,
  MsgType,
  PLAYER_ATTACK_COOLDOWN_MS,
  PLAYER_ATTACK_RANGE,
  RESPAWN_MS,
  resolveAttack,
  rollDrops,
  SP_REGEN_PER_SEC,
  ZENY_MAX,
  ZENY_MIN,
  type SkillDef,
} from "@rox/shared";
import type { World } from "./World.js";
import type { Player } from "./Player.js";
import type { Monster } from "./Monster.js";
import { dist2d } from "./MovementSystem.js";

// Resolves player auto-attacks and skills, applies monster-dealt damage, and
// handles regen, kills, EXP/Zeny rewards and respawns.
export class CombatSystem {
  constructor(private world: World) {}

  update(dtMs: number): void {
    const dt = dtMs / 1000;
    for (const p of this.world.players.values()) {
      this.regen(p, dt);
      if (p.attackCooldown > 0) p.attackCooldown -= dtMs;
      for (const id of Object.keys(p.skillCooldowns)) {
        if (p.skillCooldowns[id] > 0) p.skillCooldowns[id] = Math.max(0, p.skillCooldowns[id] - dtMs);
      }
      // Skills take priority; if one is being cast or chased this tick, skip auto-attack.
      if (this.processSkill(p)) continue;
      this.updatePlayerAttack(p);
    }
  }

  private regen(p: Player, dt: number): void {
    if (p.hp < p.derived.maxHp) p.hp = Math.min(p.derived.maxHp, p.hp + HP_REGEN_PER_SEC * dt);
    if (p.sp < p.derived.maxSp) p.sp = Math.min(p.derived.maxSp, p.sp + SP_REGEN_PER_SEC * dt);
  }

  // ---- skills ----

  private processSkill(p: Player): boolean {
    if (p.pendingSkillId == null) return false;
    const def = getSkill(p.pendingSkillId);
    if (!def || !jobHasSkill(p.job, def.id)) {
      this.clearSkill(p);
      return false;
    }
    if ((p.skillCooldowns[def.id] ?? 0) > 0 || p.sp < def.spCost) {
      this.clearSkill(p);
      return false;
    }

    // Self-cast heal.
    if (def.heal) {
      this.castHeal(p, def);
      this.clearSkill(p);
      return true;
    }

    const target = p.pendingSkillTargetId != null ? this.world.monsters.get(p.pendingSkillTargetId) : undefined;
    if (!target || target.isDead) {
      this.clearSkill(p);
      return false;
    }

    if (dist2d(p.x, p.z, target.x, target.z) > def.range) {
      // Move into range, keep the skill queued.
      p.moveTarget = { x: target.x, z: target.z };
      return true;
    }

    // Cast.
    p.moveTarget = null;
    p.facing = Math.atan2(target.x - p.x, target.z - p.z);
    p.sp -= def.spCost;
    p.skillCooldowns[def.id] = def.cooldownMs;

    this.applySkillHit(p, target, def);
    if (def.aoeRadius) {
      for (const m of this.world.monsters.values()) {
        if (m.id === target.id || m.isDead) continue;
        if (dist2d(m.x, m.z, target.x, target.z) <= def.aoeRadius) this.applySkillHit(p, m, def);
      }
    }
    this.clearSkill(p);
    return true;
  }

  private castHeal(p: Player, def: SkillDef): void {
    p.sp -= def.spCost;
    p.skillCooldowns[def.id] = def.cooldownMs;
    const amount = Math.round(p.derived.maxHp * 0.3 + p.derived.matk);
    p.hp = Math.min(p.derived.maxHp, p.hp + amount);
    this.world.broadcast({
      t: MsgType.DamageEvent,
      sourceId: p.id,
      targetId: p.id,
      amount,
      crit: false,
      miss: false,
      kind: DamageKind.Magic,
      skillId: def.id,
      heal: true,
    });
  }

  private applySkillHit(p: Player, target: Monster, def: SkillDef): void {
    const result = resolveAttack(p.derived, target.derived, def.kind, Math.random, def.power);
    this.world.broadcast({
      t: MsgType.DamageEvent,
      sourceId: p.id,
      targetId: target.id,
      amount: result.amount,
      crit: result.crit,
      miss: result.miss,
      kind: result.kind,
      skillId: def.id,
    });
    if (result.miss) return;
    target.hp -= result.amount;
    if (target.aiState !== MonsterAIState.Attack) {
      target.aggroTargetId = p.id;
      target.aiState = MonsterAIState.Aggro;
    }
    if (target.hp <= 0) this.killMonster(target, p);
  }

  private clearSkill(p: Player): void {
    p.pendingSkillId = null;
    p.pendingSkillTargetId = null;
  }

  // ---- auto-attack ----

  private updatePlayerAttack(p: Player): void {
    if (p.attackTargetId == null) return;
    const target = this.world.monsters.get(p.attackTargetId);
    if (!target || target.isDead) {
      p.attackTargetId = null;
      return;
    }

    const d = dist2d(p.x, p.z, target.x, target.z);
    if (d > PLAYER_ATTACK_RANGE) {
      p.moveTarget = { x: target.x, z: target.z };
      return;
    }

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
    if (target.aiState !== MonsterAIState.Attack) {
      target.aggroTargetId = p.id;
      target.aiState = MonsterAIState.Aggro;
    }
    if (target.hp <= 0) this.killMonster(target, p);
  }

  // ---- shared outcomes ----

  private killMonster(target: Monster, killer: Player): void {
    target.hp = 0;
    target.aiState = MonsterAIState.Dead;
    target.aggroTargetId = null;
    target.respawnAt = Date.now() + (target.template.respawnMs ?? RESPAWN_MS);
    this.world.broadcast({ t: MsgType.Despawn, id: target.id });

    // Zeny + loot (auto-pickup to the killer's bag), then notify them.
    const zenyGain =
      (ZENY_MIN + Math.floor(Math.random() * (ZENY_MAX - ZENY_MIN + 1))) * (target.template.boss ? 25 : 1);
    killer.zeny += zenyGain;
    const drops = rollDrops(target.template.id);
    for (const d of drops) killer.addItem(d.id, d.qty);
    if (drops.length || zenyGain) {
      const conn = this.world.connections.get(killer.connId);
      conn?.send({ t: MsgType.Loot, items: drops, zeny: zenyGain });
    }

    // EXP sharing: split among nearby party members (with a bonus), else solo.
    let recipients = [killer];
    let total = target.template.baseExp;
    if (killer.partyId != null) {
      const near = this.world.party
        .membersOf(killer.partyId)
        .filter((m) => dist2d(m.x, m.z, target.x, target.z) <= EXP_SHARE_RANGE);
      if (near.length > 0) {
        recipients = near;
        total = Math.round(target.template.baseExp * PARTY_EXP_BONUS);
      }
    }
    const share = Math.max(1, Math.floor(total / recipients.length));
    for (const r of recipients) {
      r.creditKill(target.template.id);
      if (r.gainExp(share)) {
        this.world.broadcast({
          t: MsgType.LevelUp,
          id: r.id,
          newLevel: r.level,
          maxHp: r.derived.maxHp,
          maxSp: r.derived.maxSp,
          stats: { ...r.stats },
          expToNext: r.toSelfState().expToNext,
        });
      }
    }

    for (const p of this.world.players.values()) {
      if (p.attackTargetId === target.id) p.attackTargetId = null;
      if (p.pendingSkillTargetId === target.id) this.clearSkill(p);
    }
  }

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
    if (player.hp <= 0) this.respawnPlayer(player);
  }

  private respawnPlayer(player: Player): void {
    player.hp = player.derived.maxHp;
    player.sp = player.derived.maxSp;
    player.x = 0;
    player.z = 0;
    player.moveTarget = null;
    player.attackTargetId = null;
    this.clearSkill(player);
    for (const m of this.world.monsters.values()) {
      if (m.aggroTargetId === player.id) {
        m.aggroTargetId = null;
        m.aiState = MonsterAIState.Idle;
      }
    }
  }
}
