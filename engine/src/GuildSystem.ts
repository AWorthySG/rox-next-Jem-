import { MsgType, type GuildInfo } from "@rox/shared";
import type { World } from "./World.js";
import type { Player } from "./Player.js";

export interface Guild {
  id: number;
  name: string;
  masterId: number;
  members: number[]; // player entity ids
}

// Named, join-by-name social groups (larger and more persistent-feeling than a
// party). Members show a [guild] tag above their head.
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
    const guild: Guild = { id: this.nextId++, name, masterId: player.id, members: [player.id] };
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
    return { id: guild.id, name: guild.name, masterId: guild.masterId, members };
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
