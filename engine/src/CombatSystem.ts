import {
  DamageKind,
  Element,
  effectiveCastMs,
  environmentMultiplier,
  EXP_SHARE_RANGE,
  getSkill,
  GUILD_EXP_SHARE,
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
  afterCastDelayMs,
  skillCooldownMs,
  skillEffectDurationMs,
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
      // A skill with a cast time locks the caster until it resolves (or a move cancels it).
      if (p.castingSkillId) {
        this.tickCast(p, now);
        continue;
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
        m.recordDamage(tick.sourceId, tick.amount);
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
    // Global after-cast delay: keep the skill queued and retry once it expires.
    if (Date.now() < p.skillLockUntil) return false;

    // Self-cast heal.
    if (def.heal) {
      this.castHeal(p, def, lvl, cost);
      this.clearSkill(p);
      return true;
    }

    // Self-cast buff.
    if (def.buff) {
      p.sp -= cost;
      p.skillLockUntil = Date.now() + afterCastDelayMs(p.stats.agi);
      p.skillCooldowns[def.id] = skillCooldownMs(def, lvl);
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

    // Commit the cast: face the target, pay SP, start cooldown.
    p.moveTarget = null;
    p.facing = Math.atan2(target.x - p.x, target.z - p.z);
    p.sp -= cost;
    p.skillLockUntil = Date.now() + afterCastDelayMs(p.stats.agi);
    p.skillCooldowns[def.id] = skillCooldownMs(def, lvl);
    this.clearSkill(p);

    // Skills with a cast time wind up first (DEX shortens it); instant ones fire now.
    const castMs = effectiveCastMs(def, p.stats.dex);
    if (castMs > 0) {
      p.castingSkillId = def.id;
      p.castTargetId = target.id;
      p.castEndAt = Date.now() + castMs;
      this.world.broadcastToMap(p.mapId, { t: MsgType.SkillCast, casterId: p.id, skillId: def.id, durationMs: castMs });
    } else {
      this.deliverSkill(p, target, def, lvl);
    }
    return true;
  }

  // Resolve an in-progress cast: fire when the timer elapses, cancel if the
  // caster moves or the target is gone.
  private tickCast(p: Player, now: number): void {
    const def = p.castingSkillId ? getSkill(p.castingSkillId) : undefined;
    if (!def) {
      this.cancelCast(p);
      return;
    }
    if (p.moveTarget) {
      this.cancelCast(p); // moving interrupts the cast (SP already spent)
      return;
    }
    const target = p.castTargetId != null ? this.world.monsters.get(p.castTargetId) : undefined;
    if (!target || target.isDead || target.mapId !== p.mapId) {
      this.cancelCast(p);
      return;
    }
    p.facing = Math.atan2(target.x - p.x, target.z - p.z);
    if (now >= p.castEndAt) {
      this.deliverSkill(p, target, def, p.skillLevel(def.id));
      p.castingSkillId = null;
      p.castTargetId = null;
    }
  }

  private cancelCast(p: Player): void {
    if (!p.castingSkillId) return;
    this.world.broadcastToMap(p.mapId, { t: MsgType.SkillCast, casterId: p.id, skillId: p.castingSkillId, durationMs: 0 });
    p.castingSkillId = null;
    p.castTargetId = null;
  }

  // Deal a skill's damage to its primary target and any AoE splash.
  private deliverSkill(p: Player, target: Monster, def: SkillDef, lvl: number): void {
    this.applySkillHit(p, target, def, lvl);
    if (def.aoeRadius) {
      for (const m of this.world.monsters.values()) {
        if (m.id === target.id || m.isDead) continue;
        if (m.mapId !== target.mapId) continue;
        if (dist2d(m.x, m.z, target.x, target.z) <= def.aoeRadius) this.applySkillHit(p, m, def, lvl);
      }
    }
  }

  private castHeal(p: Player, def: SkillDef, lvl: number, cost: number): void {
    p.sp -= cost;
    p.skillLockUntil = Date.now() + afterCastDelayMs(p.stats.agi);
    p.skillCooldowns[def.id] = skillCooldownMs(def, lvl);
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
    // Day/night + weather amplify or dampen the skill's element (e.g. Water in rain).
    const envMul = environmentMultiplier(def.element ?? Element.Neutral, this.world.timeOfDay, this.world.weather);
    const result = resolveAttack(p.derived, target.derived, def.kind, Math.random, skillPower(def, lvl) * buffMul * envMul, {
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
    target.recordDamage(p.id, result.amount);
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
      target.addStatus(def.effect.type, skillEffectDurationMs(def.effect.durationMs, lvl), p.id, Date.now(), mag);
    }
  }

  private clearSkill(p: Player): void {
    p.pendingSkillId = null;
    p.pendingSkillTargetId = null;
  }

  // ---- auto-attack ----

  private updatePlayerAttack(p: Player): void {
    if (p.attackTargetId == null) return;
    // PvP: the target may be another player on a PvP map, or a duel opponent
    // fighting anywhere they agreed to duel.
    const pvpTarget = this.world.players.get(p.attackTargetId);
    if (
      pvpTarget &&
      pvpTarget.mapId === p.mapId &&
      pvpTarget.id !== p.id &&
      (this.world.isPvp(p.mapId) || this.world.duel.opponentOf(p.id) === pvpTarget.id)
    ) {
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
    target.recordDamage(p.id, result.amount);
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
      const dueling = this.world.duel.opponentOf(p.id) === target.id;
      this.world.broadcastToMap(p.mapId, {
        t: MsgType.ChatBroadcast,
        fromId: p.id,
        name: dueling ? "Duel" : "Arena",
        text: dueling ? `${p.name} won the duel against ${target.name}!` : `${p.name} defeated ${target.name}!`,
      });
      if (dueling) this.world.duel.leave(p); // clears + notifies both sides
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
    target.damageByPlayer.clear();
    target.respawnAt = Date.now() + (target.template.respawnMs ?? RESPAWN_MS);
    this.world.broadcastToMap(target.mapId, { t: MsgType.Despawn, id: target.id });
  }

  private killMonster(target: Monster, killer: Player): void {
    // Snapshot the damage tally before slay() clears it (shared-HP world bosses).
    const contributors = [...target.damageByPlayer.entries()].sort((a, b) => b[1] - a[1]);
    this.slay(target);

    // Shared-HP world boss: split rewards across everyone who landed a hit.
    if (target.template.worldBoss) {
      this.rewardWorldBoss(target, contributors, killer);
      this.clearKillTargets(target);
      return;
    }

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
      const guildBoosted = Math.round(share * this.world.guild.expMultiplier(r.guildId));
      if (r.gainExp(guildBoosted)) {
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
      if (r.guildId != null) this.world.guild.addExp(r.guildId, Math.round(share * GUILD_EXP_SHARE));
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

    this.clearKillTargets(target);
  }

  private clearKillTargets(target: Monster): void {
    for (const p of this.world.players.values()) {
      if (p.attackTargetId === target.id) p.attackTargetId = null;
      if (p.pendingSkillTargetId === target.id) this.clearSkill(p);
    }
  }

  // Distribute a world boss's rewards across every contributor by damage share
  // (with a floor so tag-alongs still earn), and shout a server-wide victory.
  private rewardWorldBoss(target: Monster, contributors: Array<[number, number]>, killer: Player): void {
    const tmpl = target.template;
    const mapName = MAPS[target.mapId]?.name ?? target.mapId;
    const topId = contributors[0]?.[0];
    const topName = (topId != null ? this.world.players.get(topId)?.name : undefined) ?? killer.name;

    // Empty the client-side world-boss bar, then shout the kill to everyone.
    this.world.broadcast({
      t: MsgType.BossStatus,
      bossId: target.id,
      name: tmpl.name,
      hp: 0,
      maxHp: target.derived.maxHp,
      mapName,
      defeatedBy: topName,
    });
    this.world.broadcast({
      t: MsgType.ChatBroadcast,
      fromId: 0,
      name: "World",
      text: `🐉 The world boss ${tmpl.name} has fallen! Top damage: ${topName}.`,
    });

    const totalDmg = contributors.reduce((s, [, d]) => s + d, 0) || 1;
    for (const [pid, dmg] of contributors) {
      const r = this.world.players.get(pid);
      if (!r) continue;
      const share = Math.max(0.05, dmg / totalDmg);
      const exp = Math.max(1, Math.round(tmpl.baseExp * share));
      const zeny = Math.max(1, Math.round((ZENY_MIN + ZENY_MAX) * 12 * share));
      r.zeny += zeny;
      const drops = rollDrops(tmpl.id); // every contributor rolls the loot table
      for (const d of drops) r.addItem(d.id, d.qty);
      this.world.connections.get(r.connId)?.send({ t: MsgType.Loot, items: drops, zeny });
      r.creditKill(tmpl.id);
      r.recordKill(tmpl.id, true);
      const guildBoostedExp = Math.round(exp * this.world.guild.expMultiplier(r.guildId));
      if (r.gainExp(guildBoostedExp)) {
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
      if (r.guildId != null) this.world.guild.addExp(r.guildId, Math.round(exp * GUILD_EXP_SHARE));
      for (const a of r.evaluateAchievements()) {
        this.world.connections.get(r.connId)?.send({
          t: MsgType.ChatBroadcast,
          fromId: 0,
          name: "Achievement",
          text: `${a.name} unlocked! +${a.rewardZeny} Zeny`,
        });
      }
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
    player.castingSkillId = null;
    player.castTargetId = null;
    this.clearSkill(player);
    for (const m of this.world.monsters.values()) {
      if (m.aggroTargetId === player.id) {
        m.aggroTargetId = null;
        m.aiState = MonsterAIState.Idle;
      }
    }
  }
}
