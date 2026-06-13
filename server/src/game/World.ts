import {
  EntityKind,
  MAP_HALF,
  MsgType,
  type ServerMessage,
} from "@rox/shared";
import { Connection } from "../net/Connection.js";
import { Player } from "./Player.js";
import { Monster } from "./Monster.js";
import { MONSTER_TEMPLATES, SPAWN_ZONES } from "../data/spawns.js";

// Authoritative world state: all connections and entities live here.
export class World {
  readonly connections = new Map<number, Connection>();
  readonly players = new Map<number, Player>();
  readonly monsters = new Map<number, Monster>();
  private nextEntityId = 1;

  constructor() {
    this.initMonsters();
  }

  allocId(): number {
    return this.nextEntityId++;
  }

  // ---- connections ----

  addConnection(conn: Connection): void {
    this.connections.set(conn.id, conn);
  }

  removeConnection(conn: Connection): void {
    this.connections.delete(conn.id);
    if (conn.playerId != null) {
      this.removePlayer(conn.playerId);
    }
  }

  // ---- players ----

  addPlayer(player: Player): void {
    this.players.set(player.id, player);
    // Tell everyone (including the joiner) about the new player.
    this.broadcast({ t: MsgType.Spawn, entity: player.toFull() });
  }

  removePlayer(id: number): void {
    if (this.players.delete(id)) {
      this.broadcast({ t: MsgType.Despawn, id });
    }
  }

  // ---- monsters ----

  private initMonsters(): void {
    for (const zone of SPAWN_ZONES) {
      const tmpl = MONSTER_TEMPLATES[zone.templateId];
      for (let i = 0; i < zone.count; i++) {
        const { x, z } = this.randomPointInZone(zone.cx, zone.cz, zone.radius);
        const mon = new Monster(this.allocId(), tmpl, zone.id, x, z);
        this.monsters.set(mon.id, mon);
      }
    }
  }

  randomPointInZone(cx: number, cz: number, radius: number): { x: number; z: number } {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius;
    return {
      x: clamp(cx + Math.cos(a) * r, -MAP_HALF, MAP_HALF),
      z: clamp(cz + Math.sin(a) * r, -MAP_HALF, MAP_HALF),
    };
  }

  // ---- lookup ----

  getEntity(id: number): Player | Monster | undefined {
    return this.players.get(id) ?? this.monsters.get(id);
  }

  kindOf(id: number): EntityKind | null {
    if (this.players.has(id)) return EntityKind.Player;
    if (this.monsters.has(id)) return EntityKind.Monster;
    return null;
  }

  // ---- messaging ----

  broadcast(msg: ServerMessage): void {
    for (const conn of this.connections.values()) {
      conn.send(msg);
    }
  }

  // Full snapshot of the current world for a freshly joined client.
  spawnAllFor(conn: Connection): void {
    for (const p of this.players.values()) {
      conn.send({ t: MsgType.Spawn, entity: p.toFull() });
    }
    for (const m of this.monsters.values()) {
      if (!m.isDead) conn.send({ t: MsgType.Spawn, entity: m.toFull() });
    }
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
