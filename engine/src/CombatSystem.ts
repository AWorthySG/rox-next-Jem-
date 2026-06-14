import {
  DamageKind,
  Element,
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
  skillPower,
  skillSpCost,
  SP_REGEN_PER_SEC,
  StatusType,
  ZENY_MAX,
  ZENY_MIN,
  type SkillDef,
} from "@rox/shared";
import type { World } from "./World.js";
import type { Player } from "./Player.js";
import { Monster } from "./Monster.js";
import { dist2d } from "./MovementSystem.js";
import { MAPS } from "./data/maps.js";
import { MONSTER_TEMPLATES } from "./data/spawns.js";

// Resolves player auto-attacks and skills, applies monster-dealt damage, and
// handles regen, kills, EXP/Zeny rewards and respawns.
export class CombatSystem {
  constructor(private world: World) {}

  update(dtMs: number): void {
    const dt = dtMs / 1000;
    const now = Date.now();
    for (const p of this.world.players.values()) {
      this.regen(p, dt);
      p.tickFoodBuffs(now);
      if (p.attackCooldown > 0) p.attackCooldown -= dtMs;
      for (const id of Object.keys(p.skillCooldowns)) {
        if (p.skillCooldowns[id] > 0) p.skillCooldowns[id] = Math.max(0, p.skillCooldowns[id] - dtMs);
      }
      // Skills take priority; if one is being cast or chased this tick, skip auto-attack.
      if (this.processSkill(p)) continue;
      this.updatePlayerAttack(p);
    }
    this.processStatuses();
    this.processBosses(dtMs);
  }

  // ---- boss mechanics ----

  private processBosses(dtMs: number): void {
    const now = Date.now();
    for (const m of this.world.monsters.values()) {
      const mechs = m.template.mechanics;
      if (!mechs || m.isDead) continue;
      // resolve a telegraphed nova once its warning elapses
      if (m.pendingNova && now >= m.pendingNova.fireAt) this.executeNova(m);
      if (m.mechTimers.length !== mechs.length) m.mechTimers = mechs.map((me) => ("intervalMs" in me ? me.intervalMs : 0));
      mechs.forEach((mech, i) => {
        if (mech.kind === "enrage") {
          if (!m.enraged && m.hp / m.derived.maxHp <= mech.hpPct) {
            m.enraged = true;
            m.damageMult = mech.atkMult;
            this.bossAnnounce(m, `${m.template.name} enrages!`);
          }
          return;
        }
        m.mechTimers[i] -= dtMs;
        if (m.mechTimers[i] > 0) return;
        m.mechTimers[i] = mech.intervalMs;
        if (mech.kind === "nova") this.bossNova(m, mech.radius, mech.powerMult);
        else if (mech.kind === "summon") this.bossSummon(m, mech.templateId, mech.count, mech.max);
        else if (mech.kind === "heal") this.bossHeal(m, mech.pct);
      });
    }
  }

  // Telegraph the nova: warn clients now, deal damage after a short delay so
  // players can step out of the marked area.
  private bossNova(m: Monster, radius: number, powerMult: number): void {
    if (m.pendingNova) return; // one at a time
    const delayMs = 1200;
    m.pendingNova = { x: m.x, z: m.z, radius, powerMult, fireAt: Date.now() + delayMs };
    this.bossAnnounce(m, `${m.template.name} is charging a nova!`);
    this.world.broadcastToMap(m.mapId, { t: MsgType.BossTelegraph, x: m.x, z: m.z, radius, delayMs });
  }

  private executeNova(m: Monster): void {
    const pn = m.pendingNova;
    m.pendingNova = null;
    if (!pn) return;
    const dmg = Math.max(1, Math.round(m.derived.atk * pn.powerMult));
    for (const p of this.world.playersOnMap(m.mapId)) {
      if (dist2d(p.x, p.z, pn.x, pn.z) > pn.radius) continue; // dodged it
      this.world.broadcastToMap(m.mapId, {
        t: MsgType.DamageEvent,
        sourceId: m.id,
        targetId: p.id,
        amount: dmg,
        crit: false,
        miss: false,
        kind: DamageKind.Physical,
      });
      p.hp -= dmg;
      if (p.hp <= 0) this.respawnPlayer(p, m.template.name);
    }
  }

  private bossSummon(m: Monster, templateId: string, count: number, max: number): void {
    const tmpl = MONSTER_TEMPLATES[templateId];
    if (!tmpl) return;
    let alive = 0;
    for (const o of this.world.monsters.values()) if (o.summonerId === m.id && !o.isDead) alive++;
    const toSpawn = Math.min(count, max - alive);
    if (toSpawn <= 0) return;
    this.bossAnnounce(m, `${m.template.name} summons minions!`);
    for (let i = 0; i < toSpawn; i++) {
      const pt = this.world.randomPointInZone(m.x, m.z, 5);
      const add = new Monster(this.world.allocId(), tmpl, "summon", m.mapId, pt.x, pt.z);
      add.summonerId = m.id;
      add.temporary = true;
      this.world.monsters.set(add.id, add);
      this.world.broadcastToMap(m.mapId, { t: MsgType.Spawn, entity: add.toFull() });
    }
  }

  private bossHeal(m: Monster, pct: number): void {
    const heal = Math.round(m.derived.maxHp * pct);
    m.hp = Math.min(m.derived.maxHp, m.hp + heal);
    this.world.broadcastToMap(m.mapId, {
      t: MsgType.DamageEvent,
      sourceId: m.id,
      targetId: m.id,
      amount: heal,
      crit: false,
      miss: false,
      kind: DamageKind.Magic,
      heal: true,
    });
  }

  private bossAnnounce(m: Monster, text: string): void {
    this.world.broadcastToMap(m.mapId, { t: MsgType.ChatBroadcast, fromId: 0, name: "Boss", text });
  }

  // Apply damage-over-time ticks from status effects (e.g. Burn).
  private processStatuses(): void {
    const now = Date.now();
    for (const m of this.world.monsters.values()) {
      if (m.isDead || m.statuses.length === 0) continue;
      const ticks = m.tickStatuses(now);
      for (const tick of ticks) {
        if (tick.amount <= 0) continue;
        m.hp -= tick.amount;
        this.world.broadcastToMap(m.mapId, {
          t: MsgType.DamageEvent,
          sourceId: tick.sourceId,
          targetId: m.id,
          amount: tick.amount,
          crit: false,
          miss: false,
          kind: DamageKind.Magic,
          skillId: "burn",
        });
        if (m.hp <= 0) {
          const src = this.world.players.get(tick.sourceId);
          if (src) this.killMonster(m, src);
          else this.slay(m);
          break;
        }
      }
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
    const lvl = p.skillLevel(def.id);
    const cost = skillSpCost(def, lvl);
    if ((p.skillCooldowns[def.id] ?? 0) > 0 || p.sp < cost) {
      this.clearSkill(p);
      return false;
    }

    // Self-cast heal.
    if (def.heal) {
      this.castHeal(p, def, lvl, cost);
      this.clearSkill(p);
      return true;
    }

    // Self-cast buff.
    if (def.buff) {
      p.sp -= cost;
      p.skillCooldowns[def.id] = def.cooldownMs;
      p.addBuff(def.buff.stat, def.buff.mult, def.buff.durationMs, Date.now());
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
    p.sp -= cost;
    p.skillCooldowns[def.id] = def.cooldownMs;

    this.applySkillHit(p, target, def, lvl);
    if (def.aoeRadius) {
      for (const m of this.world.monsters.values()) {
        if (m.id === target.id || m.isDead) continue;
        if (m.mapId !== target.mapId) continue;
        if (dist2d(m.x, m.z, target.x, target.z) <= def.aoeRadius) this.applySkillHit(p, m, def, lvl);
      }
    }
    this.clearSkill(p);
    return true;
  }

  private castHeal(p: Player, def: SkillDef, lvl: number, cost: number): void {
    p.sp -= cost;
    p.skillCooldowns[def.id] = def.cooldownMs;
    const amount = Math.round((p.derived.maxHp * 0.3 + p.derived.matk) * (1 + 0.2 * (lvl - 1)));
    p.hp = Math.min(p.derived.maxHp, p.hp + amount);
    this.world.broadcastToMap(p.mapId, {
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

  private applySkillHit(p: Player, target: Monster, def: SkillDef, lvl: number): void {
    const buffMul = p.buffMul(def.kind === DamageKind.Magic ? "matk" : "atk", Date.now());
    const result = resolveAttack(p.derived, target.derived, def.kind, Math.random, skillPower(def, lvl) * buffMul, {
      attack: def.element ?? Element.Neutral,
      defense: target.element,
    });
    this.world.broadcastToMap(target.mapId, {
      t: MsgType.DamageEvent,
      sourceId: p.id,
      targetId: target.id,
      amount: result.amount,
      crit: result.crit,
      miss: result.miss,
      kind: result.kind,
      skillId: def.id,
      elementMult: result.elementMult,
    });
    if (result.miss) return;
    target.hp -= result.amount;
    if (target.aiState !== MonsterAIState.Attack) {
      target.aggroTargetId = p.id;
      target.aiState = MonsterAIState.Aggro;
    }
    if (target.hp <= 0) {
      this.killMonster(target, p);
      return;
    }
    // Apply the skill's status effect (slow / stun / burn) to the survivor.
    if (def.effect) {
      const mag =
        def.effect.type === StatusType.Burn
          ? Math.max(1, Math.round(p.derived.matk * (def.effect.magnitude ?? 0.25)))
          : (def.effect.magnitude ?? 0);
      target.addStatus(def.effect.type, def.effect.durationMs, p.id, Date.now(), mag);
    }
  }

  private clearSkill(p: Player): void {
    p.pendingSkillId = null;
    p.pendingSkillTargetId = null;
  }

  // ---- auto-attack ----

  private updatePlayerAttack(p: Player): void {
    if (p.attackTargetId == null) return;
    // PvP: the target may be another player on a PvP map.
    const pvpTarget = this.world.players.get(p.attackTargetId);
    if (pvpTarget && this.world.isPvp(p.mapId) && pvpTarget.mapId === p.mapId && pvpTarget.id !== p.id) {
      this.updatePvpAttack(p, pvpTarget);
      return;
    }
    const target = this.world.monsters.get(p.attackTargetId);
    if (!target || target.isDead || target.mapId !== p.mapId) {
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
    const buffMul = p.buffMul(kind === DamageKind.Magic ? "matk" : "atk", Date.now());
    const result = resolveAttack(p.derived, target.derived, kind, Math.random, buffMul, {
      attack: Element.Neutral,
      defense: target.element,
    });
    this.world.broadcastToMap(p.mapId, {
      t: MsgType.DamageEvent,
      sourceId: p.id,
      targetId: target.id,
      amount: result.amount,
      crit: result.crit,
      miss: result.miss,
      kind: result.kind,
      elementMult: result.elementMult,
    });
    if (result.miss) return;

    target.hp -= result.amount;
    if (target.aiState !== MonsterAIState.Attack) {
      target.aggroTargetId = p.id;
      target.aiState = MonsterAIState.Aggro;
    }
    if (target.hp <= 0) this.killMonster(target, p);
  }

  // Player-vs-player auto-attack in a PvP map.
  private updatePvpAttack(p: Player, target: Player): void {
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
    const buffMul = p.buffMul(kind === DamageKind.Magic ? "matk" : "atk", Date.now());
    const result = resolveAttack(p.derived, target.derived, kind, Math.random, buffMul);
    this.world.broadcastToMap(p.mapId, {
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
    if (target.hp <= 0) {
      this.world.broadcastToMap(p.mapId, {
        t: MsgType.ChatBroadcast,
        fromId: p.id,
        name: "Arena",
        text: `${p.name} defeated ${target.name}!`,
      });
      this.respawnPlayer(target, p.name);
      p.attackTargetId = null;
    }
  }

  // ---- shared outcomes ----

  // Mark a monster dead + schedule respawn, without rewards (e.g. an unattributed
  // DoT kill).
  private slay(target: Monster): void {
    target.hp = 0;
    target.aiState = MonsterAIState.Dead;
    target.aggroTargetId = null;
    target.clearStatuses();
    target.respawnAt = Date.now() + (target.template.respawnMs ?? RESPAWN_MS);
    this.world.broadcastToMap(target.mapId, { t: MsgType.Despawn, id: target.id });
  }

  private killMonster(target: Monster, killer: Player): void {
    this.slay(target);

    // World-wide MVP announcement (the classic "an MVP has fallen" broadcast).
    if (target.template.boss) {
      this.world.broadcast({
        t: MsgType.ChatBroadcast,
        fromId: 0,
        name: "World",
        text: `⚔ ${killer.name} has slain the MVP ${target.template.name}!`,
      });
    }

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
        .filter((m) => m.mapId === target.mapId && dist2d(m.x, m.z, target.x, target.z) <= EXP_SHARE_RANGE);
      if (near.length > 0) {
        recipients = near;
        total = Math.round(target.template.baseExp * PARTY_EXP_BONUS);
      }
    }
    const share = Math.max(1, Math.floor(total / recipients.length));
    for (const r of recipients) {
      r.creditKill(target.template.id);
      r.recordKill(target.template.id, !!target.template.boss);
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

    // Unlock any achievements newly satisfied by this kill / level-up.
    for (const r of recipients) {
      for (const a of r.evaluateAchievements()) {
        this.world.connections.get(r.connId)?.send({
          t: MsgType.ChatBroadcast,
          fromId: 0,
          name: "Achievement",
          text: `${a.name} unlocked! +${a.rewardZeny} Zeny`,
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
    this.world.broadcastToMap(monster.mapId, {
      t: MsgType.DamageEvent,
      sourceId: monster.id,
      targetId: player.id,
      amount: result.amount,
      crit: result.crit,
      miss: result.miss,
      kind: result.kind,
    });
    if (result.miss) return;
    const dmg = Math.round(result.amount * monster.damageMult); // enrage multiplier
    player.hp -= dmg;
    if (player.hp <= 0) this.respawnPlayer(player, monster.template.name);
  }

  private respawnPlayer(player: Player, byName: string): void {
    // Notify the defeated player, then revive them at their current map's spawn.
    this.world.connections.get(player.connId)?.send({ t: MsgType.Defeated, byName });
    const spawn = MAPS[player.mapId]?.spawn ?? { x: 0, z: 0 };
    player.hp = player.derived.maxHp;
    player.sp = player.derived.maxSp;
    player.x = spawn.x;
    player.z = spawn.z;
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
