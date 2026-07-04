import { getItem, GUILD_EXP_BONUS_PER_LEVEL, GUILD_LEVEL_CAP, guildXpToNext, MsgType, type GuildInfo } from "@rox/shared";
import type { World } from "./World.js";
import type { Player } from "./Player.js";

export interface Guild {
  id: number;
  name: string;
  masterId: number;
  members: number[]; // player entity ids
  level: number;
  exp: number;
  storage: Record<string, number>; // itemId -> qty, shared by every member
}

// Named, join-by-name social groups (larger and more persistent-feeling than a
// party). Members show a [guild] tag above their head. Guilds level up from a
// slice of every member's kill EXP, granting a small EXP bonus back to the
// roster, and share a common item storage.
export class GuildSystem {
  private guilds = new Map<number, Guild>();
  private byName = new Map<string, number>(); // lowercased name -> id
  private nextId = 1;

  constructor(private world: World) {}

  private sanitize(raw: string): string {
    return (raw ?? "").toString().replace(/[^\w \-]/g, "").trim().slice(0, 20);
  }

  create(player: Player, rawName: string): void {
    if (player.guildId != null) return;
    const name = this.sanitize(rawName);
    if (!name || this.byName.has(name.toLowerCase())) return; // empty or taken
    const guild: Guild = { id: this.nextId++, name, masterId: player.id, members: [player.id], level: 1, exp: 0, storage: {} };
    this.guilds.set(guild.id, guild);
    this.byName.set(name.toLowerCase(), guild.id);
    this.attach(player, guild);
    this.broadcast(guild);
  }

  join(player: Player, rawName: string): void {
    if (player.guildId != null) return;
    const id = this.byName.get(this.sanitize(rawName).toLowerCase());
    const guild = id != null ? this.guilds.get(id) : undefined;
    if (!guild) return;
    guild.members.push(player.id);
    this.attach(player, guild);
    this.broadcast(guild);
  }

  leave(player: Player): void {
    const id = player.guildId;
    if (id == null) return;
    const guild = this.guilds.get(id);
    player.guildId = null;
    player.guildName = null;
    this.refreshTag(player);
    this.sendUpdate(player, null);
    if (!guild) return;
    guild.members = guild.members.filter((m) => m !== player.id);
    if (guild.members.length === 0) {
      this.byName.delete(guild.name.toLowerCase());
      this.guilds.delete(guild.id);
      return;
    }
    if (guild.masterId === player.id) guild.masterId = guild.members[0];
    this.broadcast(guild);
  }

  // The EXP multiplier a guild member's kills earn from guild leveling
  // (1.0 = no bonus). Called by CombatSystem when awarding kill EXP.
  expMultiplier(guildId: number | null): number {
    const guild = guildId != null ? this.guilds.get(guildId) : undefined;
    return guild ? 1 + (guild.level - 1) * GUILD_EXP_BONUS_PER_LEVEL : 1;
  }

  // Feed a slice of a member's kill EXP into their guild's level pool.
  addExp(guildId: number | null, amount: number): void {
    const guild = guildId != null ? this.guilds.get(guildId) : undefined;
    if (!guild || guild.level >= GUILD_LEVEL_CAP || amount <= 0) return;
    guild.exp += amount;
    let leveled = false;
    while (guild.level < GUILD_LEVEL_CAP && guild.exp >= guildXpToNext(guild.level)) {
      guild.exp -= guildXpToNext(guild.level);
      guild.level += 1;
      leveled = true;
    }
    if (leveled) {
      for (const id of guild.members) {
        const p = this.world.players.get(id);
        if (!p) continue;
        this.world.connections.get(p.connId)?.send({
          t: MsgType.ChatBroadcast,
          fromId: 0,
          name: "Guild",
          text: `${guild.name} reached guild level ${guild.level}! (+${Math.round((guild.level - 1) * GUILD_EXP_BONUS_PER_LEVEL * 100)}% member EXP)`,
        });
      }
    }
    this.broadcast(guild);
  }

  // Move an item from a member's bag into the shared guild storage.
  storeItem(player: Player, itemId: string, qty: number): boolean {
    const guild = player.guildId != null ? this.guilds.get(player.guildId) : undefined;
    if (!guild || !getItem(itemId) || qty <= 0 || !player.takeItem(itemId, qty)) return false;
    guild.storage[itemId] = (guild.storage[itemId] ?? 0) + qty;
    this.broadcast(guild);
    return true;
  }

  // Move an item from the shared guild storage into a member's bag.
  retrieveItem(player: Player, itemId: string, qty: number): boolean {
    const guild = player.guildId != null ? this.guilds.get(player.guildId) : undefined;
    if (!guild || qty <= 0) return false;
    const have = guild.storage[itemId] ?? 0;
    if (have < qty) return false;
    const left = have - qty;
    if (left <= 0) delete guild.storage[itemId];
    else guild.storage[itemId] = left;
    player.addItem(itemId, qty);
    this.broadcast(guild);
    return true;
  }

  private attach(player: Player, guild: Guild): void {
    player.guildId = guild.id;
    player.guildName = guild.name;
    this.refreshTag(player);
  }

  // Re-announce the player so their nameplate tag updates for others.
  private refreshTag(player: Player): void {
    this.world.broadcastToMap(player.mapId, { t: MsgType.Spawn, entity: player.toFull() });
  }

  private info(guild: Guild): GuildInfo {
    const members = guild.members
      .map((id) => this.world.players.get(id))
      .filter((p): p is Player => !!p)
      .map((p) => ({ id: p.id, name: p.name, level: p.level, job: p.job }));
    return {
      id: guild.id,
      name: guild.name,
      masterId: guild.masterId,
      members,
      level: guild.level,
      exp: guild.exp,
      expToNext: guildXpToNext(guild.level),
      storage: Object.entries(guild.storage).map(([id, qty]) => ({ id, qty })),
    };
  }

  private broadcast(guild: Guild): void {
    const payload = this.info(guild);
    for (const id of guild.members) {
      const p = this.world.players.get(id);
      if (p) this.sendUpdate(p, payload);
    }
  }

  private sendUpdate(player: Player, info: GuildInfo | null): void {
    this.world.connections.get(player.connId)?.send({ t: MsgType.GuildUpdate, guild: info });
  }
}
