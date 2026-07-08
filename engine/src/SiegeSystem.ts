import {
  MsgType,
  SIEGE_INTERVAL_MS,
  SIEGE_MIN_LEVEL,
  SIEGE_REWARD_INTERVAL_MS,
  SIEGE_REWARD_ZENY,
  SIEGE_WINDOW_MS,
} from "@rox/shared";
import type { World } from "./World.js";
import type { Player } from "./Player.js";
import { Monster } from "./Monster.js";
import { MONSTER_TEMPLATES } from "./data/spawns.js";
import { MAPS } from "./data/maps.js";

const CASTLE_MAP = "valkyrie_castle";
const EMPERIUM_POS = { x: 0, z: -8 };
const STATUS_BROADCAST_MS = 2000;

// War of Emperium — a single contested castle (Valkyrie Castle). A siege window
// opens on a recurring schedule (or on demand when a guild declares one); while
// open the castle flips to PvP and an Emperium crystal stands vulnerable. The
// guild whose member lands the breaking blow claims the castle, holding it until
// the next siege is won. Holders draw a recurring occupancy payout to their
// online members and a small guild-wide EXP edge (in GuildSystem.expMultiplier).
export class SiegeSystem {
  ownerGuildId: number | null = null;
  private active = false;
  private windowRemaining = 0; // ms left in the open siege window (counted down each tick)
  private emperiumId: number | null = null;
  private autoTimer = SIEGE_INTERVAL_MS;
  private rewardTimer = SIEGE_REWARD_INTERVAL_MS;
  private statusTimer = 0;

  constructor(private world: World) {}

  isActive(mapId: string): boolean {
    return this.active && mapId === CASTLE_MAP;
  }

  isEmperium(id: number): boolean {
    return this.emperiumId === id;
  }

  ownerName(): string | null {
    return this.world.guild.getById(this.ownerGuildId)?.name ?? null;
  }

  // Warp a qualified player to the castle (viewable any time; the Emperium is
  // only present and vulnerable while a siege window is open).
  enter(player: Player): { ok: boolean; error?: string } {
    if (player.level < SIEGE_MIN_LEVEL) {
      return { ok: false, error: `You must be Lv${SIEGE_MIN_LEVEL} to approach the castle.` };
    }
    const spawn = MAPS[CASTLE_MAP].spawn;
    this.world.travelPlayer(player, { toMap: CASTLE_MAP, toX: spawn.x, toZ: spawn.z });
    this.sendStatusTo(player);
    return { ok: true };
  }

  // A guild member declares war, opening a siege window now if none is running.
  declare(player: Player): { ok: boolean; error?: string } {
    if (player.guildId == null) return { ok: false, error: "Only a guild may declare a siege." };
    if (this.active) return { ok: false, error: "A siege is already under way." };
    this.startSiege();
    return { ok: true };
  }

  // Open the siege window and raise the Emperium.
  startSiege(): void {
    if (this.active) return;
    this.active = true;
    this.windowRemaining = SIEGE_WINDOW_MS;
    const emp = new Monster(this.world.allocId(), MONSTER_TEMPLATES.emperium, "siege", CASTLE_MAP, EMPERIUM_POS.x, EMPERIUM_POS.z);
    this.world.monsters.set(emp.id, emp);
    this.emperiumId = emp.id;
    this.world.broadcastToMap(CASTLE_MAP, { t: MsgType.Spawn, entity: emp.toFull() });
    this.world.broadcast({
      t: MsgType.ChatBroadcast,
      fromId: 0,
      name: "War of Emperium",
      text: `The siege of ${MAPS[CASTLE_MAP].name} has begun! Break the Emperium to claim it.`,
    });
    this.broadcastStatus();
  }

  // Called from CombatSystem when the Emperium's HP hits zero. The breaker's
  // guild claims the castle; the window closes and the winners are paid.
  onEmperiumBroken(breaker: Player): void {
    this.removeEmperium();
    const prevOwner = this.ownerGuildId;
    const guild = this.world.guild.getById(breaker.guildId);
    if (guild) {
      if (prevOwner != null && prevOwner !== guild.id) {
        const prev = this.world.guild.getById(prevOwner);
        if (prev) {
          prev.ownedCastle = null;
          this.world.guild.refresh(prev.id);
        }
      }
      this.ownerGuildId = guild.id;
      guild.ownedCastle = MAPS[CASTLE_MAP].name;
      this.world.guild.refresh(guild.id);
      // Immediate conquest bounty to the online members present.
      for (const p of this.world.guild.getById(guild.id)!.members) {
        const member = this.world.players.get(p);
        if (!member) continue;
        member.addItem("emperium_fragment", 3);
        member.zeny += 5000;
        this.world.connections.get(member.connId)?.send({ t: MsgType.Loot, items: [{ id: "emperium_fragment", qty: 3 }], zeny: 5000 });
      }
      this.world.broadcast({
        t: MsgType.ChatBroadcast,
        fromId: 0,
        name: "War of Emperium",
        text: `⚔ ${guild.name} has broken the Emperium and now holds ${MAPS[CASTLE_MAP].name}!`,
      });
    }
    this.endWindow();
  }

  update(dtMs: number): void {
    if (this.active) {
      this.windowRemaining -= dtMs;
    }

    if (this.active && this.windowRemaining <= 0) {
      // Time ran out with the Emperium still standing — the siege is repelled.
      this.removeEmperium();
      this.world.broadcast({
        t: MsgType.ChatBroadcast,
        fromId: 0,
        name: "War of Emperium",
        text: this.ownerName()
          ? `The siege ended — ${this.ownerName()} holds ${MAPS[CASTLE_MAP].name}.`
          : `The siege ended with ${MAPS[CASTLE_MAP].name} still unclaimed.`,
      });
      this.endWindow();
    }

    if (!this.active) {
      this.autoTimer -= dtMs;
      if (this.autoTimer <= 0) {
        this.autoTimer = SIEGE_INTERVAL_MS;
        this.startSiege();
      }
    }

    // Occupancy payout: the holding guild's online members draw a Zeny stipend.
    this.rewardTimer -= dtMs;
    if (this.rewardTimer <= 0) {
      this.rewardTimer = SIEGE_REWARD_INTERVAL_MS;
      this.payOccupancy();
    }

    // Keep the castle's status banner fresh while a siege runs.
    if (this.active) {
      this.statusTimer -= dtMs;
      if (this.statusTimer <= 0) {
        this.statusTimer = STATUS_BROADCAST_MS;
        this.broadcastStatus();
      }
    }
  }

  private payOccupancy(): void {
    const guild = this.world.guild.getById(this.ownerGuildId);
    if (!guild) return;
    for (const id of guild.members) {
      const member = this.world.players.get(id);
      if (!member) continue;
      member.zeny += SIEGE_REWARD_ZENY;
      member.addItem("emperium_fragment", 1);
      this.world.connections.get(member.connId)?.send({
        t: MsgType.Loot,
        items: [{ id: "emperium_fragment", qty: 1 }],
        zeny: SIEGE_REWARD_ZENY,
      });
    }
  }

  private removeEmperium(): void {
    if (this.emperiumId == null) return;
    const id = this.emperiumId;
    this.world.monsters.delete(id);
    this.world.broadcastToMap(CASTLE_MAP, { t: MsgType.Despawn, id });
    this.emperiumId = null;
  }

  private endWindow(): void {
    this.active = false;
    this.windowRemaining = 0;
    this.broadcastStatus();
  }

  private statusMsg() {
    const emp = this.emperiumId != null ? this.world.monsters.get(this.emperiumId) : undefined;
    return {
      t: MsgType.SiegeUpdate as const,
      castle: MAPS[CASTLE_MAP].name,
      ownerGuild: this.ownerName(),
      active: this.active,
      emperiumHp: emp ? Math.max(0, Math.round(emp.hp)) : 0,
      emperiumMaxHp: emp ? emp.derived.maxHp : MONSTER_TEMPLATES.emperium.baseHp,
      endsInMs: this.active ? Math.max(0, this.windowRemaining) : 0,
    };
  }

  private broadcastStatus(): void {
    this.world.broadcastToMap(CASTLE_MAP, this.statusMsg());
  }

  private sendStatusTo(player: Player): void {
    this.world.connections.get(player.connId)?.send(this.statusMsg());
  }
}
