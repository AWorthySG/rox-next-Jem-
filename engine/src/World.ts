import { EntityKind, MAP_HALF, MsgType, type ServerMessage } from "@rox/shared";
import type { ClientLink } from "./ClientLink.js";
import { Player } from "./Player.js";
import { Monster } from "./Monster.js";
import { Npc } from "./Npc.js";
import type { PortalDest } from "./Npc.js";
import { PartySystem } from "./PartySystem.js";
import { MONSTER_TEMPLATES } from "./data/spawns.js";
import { MAPS } from "./data/maps.js";

// Authoritative world state across all maps. Entities are tagged with a mapId;
// broadcasts and snapshots are scoped per map so players only see their map.
export class World {
  readonly connections = new Map<number, ClientLink>();
  readonly players = new Map<number, Player>();
  readonly monsters = new Map<number, Monster>();
  readonly npcs = new Map<number, Npc>();
  readonly party = new PartySystem(this);
  readonly mapIds = Object.keys(MAPS);
  private nextEntityId = 1;

  constructor() {
    this.initWorld();
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
    if (link.playerId != null) this.removePlayer(link.playerId);
  }

  // ---- players ----

  addPlayer(player: Player): void {
    this.players.set(player.id, player);
    this.broadcastToMap(player.mapId, { t: MsgType.Spawn, entity: player.toFull() });
  }

  removePlayer(id: number): void {
    const player = this.players.get(id);
    if (player) this.party.leave(player);
    if (this.players.delete(id)) {
      this.broadcastToMap(player?.mapId ?? "", { t: MsgType.Despawn, id });
    }
  }

  // ---- world init ----

  private initWorld(): void {
    for (const map of Object.values(MAPS)) {
      for (const zone of map.zones) {
        const tmpl = MONSTER_TEMPLATES[zone.templateId];
        for (let i = 0; i < zone.count; i++) {
          const { x, z } = this.randomPointInZone(zone.cx, zone.cz, zone.radius);
          const mon = new Monster(this.allocId(), tmpl, zone.id, map.id, x, z);
          this.monsters.set(mon.id, mon);
        }
      }
      for (const s of map.npcs) {
        const npc = new Npc(this.allocId(), s.name, s.role, s.x, s.z, s.facing ?? 0, s.dest);
        npc.mapId = map.id;
        this.npcs.set(npc.id, npc);
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
    if (this.npcs.has(id)) return EntityKind.Npc;
    return null;
  }

  *playersOnMap(mapId: string): IterableIterator<Player> {
    for (const p of this.players.values()) if (p.mapId === mapId) yield p;
  }

  // ---- messaging ----

  // Send to every connected client (rarely needed; prefer broadcastToMap).
  broadcast(msg: ServerMessage): void {
    for (const link of this.connections.values()) link.send(msg);
  }

  broadcastToMap(mapId: string, msg: ServerMessage, excludeConnId?: number): void {
    for (const p of this.playersOnMap(mapId)) {
      if (p.connId === excludeConnId) continue;
      this.connections.get(p.connId)?.send(msg);
    }
  }

  // Send the full set of entities on a link's current map.
  spawnAllFor(link: ClientLink): void {
    const player = link.playerId != null ? this.players.get(link.playerId) : undefined;
    const mapId = player?.mapId ?? "field";
    for (const npc of this.npcs.values()) if (npc.mapId === mapId) link.send({ t: MsgType.Spawn, entity: npc.toFull() });
    for (const p of this.playersOnMap(mapId)) link.send({ t: MsgType.Spawn, entity: p.toFull() });
    for (const m of this.monsters.values()) {
      if (m.mapId === mapId && !m.isDead) link.send({ t: MsgType.Spawn, entity: m.toFull() });
    }
  }

  // ---- map travel ----

  // Send the player their current map's theme + entities (used on join and on
  // restoring a saved character).
  enterCurrentMap(player: Player): void {
    const conn = this.connections.get(player.connId);
    if (!conn) return;
    const map = MAPS[player.mapId] ?? MAPS.field;
    conn.send({ t: MsgType.MapChange, mapId: map.id, name: map.name, theme: map.theme, x: player.x, z: player.z });
    this.spawnAllFor(conn);
  }

  travelPlayer(player: Player, dest: PortalDest): void {
    const conn = this.connections.get(player.connId);
    if (!conn || !MAPS[dest.toMap]) return;
    // Leave the old map: others there see the player vanish.
    this.broadcastToMap(player.mapId, { t: MsgType.Despawn, id: player.id }, conn.id);
    // Drop any aggro the old map's monsters had on this player.
    for (const m of this.monsters.values()) {
      if (m.aggroTargetId === player.id) m.aggroTargetId = null;
    }
    player.mapId = dest.toMap;
    player.x = dest.toX;
    player.z = dest.toZ;
    player.moveTarget = null;
    player.attackTargetId = null;
    player.pendingSkillId = null;
    player.pendingSkillTargetId = null;
    // Arrive on the new map.
    this.enterCurrentMap(player);
    this.broadcastToMap(dest.toMap, { t: MsgType.Spawn, entity: player.toFull() }, conn.id);
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
