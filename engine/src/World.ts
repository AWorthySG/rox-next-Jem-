import {
  EntityKind,
  MAP_HALF,
  MsgType,
  type ServerMessage,
} from "@rox/shared";
import type { ClientLink } from "./ClientLink.js";
import { Player } from "./Player.js";
import { Monster } from "./Monster.js";
import { MONSTER_TEMPLATES, SPAWN_ZONES } from "./data/spawns.js";

// Authoritative world state: all connected clients and entities live here.
export class World {
  readonly connections = new Map<number, ClientLink>();
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

  addConnection(link: ClientLink): void {
    this.connections.set(link.id, link);
  }

  removeConnection(link: ClientLink): void {
    this.connections.delete(link.id);
    if (link.playerId != null) {
      this.removePlayer(link.playerId);
    }
  }

  // ---- players ----

  addPlayer(player: Player): void {
    this.players.set(player.id, player);
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
    for (const link of this.connections.values()) {
      link.send(msg);
    }
  }

  // Full snapshot of the current world for a freshly joined client.
  spawnAllFor(link: ClientLink): void {
    for (const p of this.players.values()) {
      link.send({ t: MsgType.Spawn, entity: p.toFull() });
    }
    for (const m of this.monsters.values()) {
      if (!m.isDead) link.send({ t: MsgType.Spawn, entity: m.toFull() });
    }
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
