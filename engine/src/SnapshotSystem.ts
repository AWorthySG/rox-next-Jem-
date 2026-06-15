import { MsgType, type EntitySnapshot } from "@rox/shared";
import type { World } from "./World.js";
import type { Monster } from "./Monster.js";
import type { Player } from "./Player.js";
import { MAPS } from "./data/maps.js";

// Builds and broadcasts the periodic world snapshot (10 Hz), scoped per map so
// players only receive entities on their own map. Each player also gets a
// private SelfSync of their full state.
//
// Cost is O(players + monsters): players and monsters are bucketed by map in one
// pass each, and maps with no players are skipped entirely (no one would receive
// their snapshot). This stays flat as more (mostly-empty) maps are added.
export class SnapshotSystem {
  constructor(private world: World) {}

  broadcast(tick: number): void {
    const time = Date.now();

    // Bucket players by their current map; this also tells us which maps are
    // "active" (have at least one player to receive a snapshot).
    const playersByMap = new Map<string, Player[]>();
    for (const p of this.world.players.values()) {
      let arr = playersByMap.get(p.mapId);
      if (!arr) playersByMap.set(p.mapId, (arr = []));
      arr.push(p);
    }

    // Single pass over monsters: bucket the live ones on active maps, and collect
    // engaged world bosses (their HP bar is broadcast server-wide regardless of
    // who is standing on their map).
    const monstersByMap = new Map<string, Monster[]>();
    const worldBosses: Monster[] = [];
    for (const m of this.world.monsters.values()) {
      if (m.isDead) continue;
      if (m.template.worldBoss && m.damageByPlayer.size > 0) worldBosses.push(m);
      if (!playersByMap.has(m.mapId)) continue;
      let arr = monstersByMap.get(m.mapId);
      if (!arr) monstersByMap.set(m.mapId, (arr = []));
      arr.push(m);
    }

    // Assemble and broadcast each active map's snapshot.
    for (const [mapId, players] of playersByMap) {
      const entities: EntitySnapshot[] = [];
      for (const p of players) entities.push(p.toSnapshot());
      for (const m of monstersByMap.get(mapId) ?? []) entities.push(m.toSnapshot());
      this.world.broadcastToMap(mapId, { t: MsgType.Snapshot, tick, time, entities });
    }

    // World-boss HP bars to EVERY player (cross-map) so the server can rally.
    for (const m of worldBosses) {
      this.world.broadcast({
        t: MsgType.BossStatus,
        bossId: m.id,
        name: m.template.name,
        hp: Math.max(0, Math.round(m.hp)),
        maxHp: m.derived.maxHp,
        mapName: MAPS[m.mapId]?.name ?? m.mapId,
      });
    }

    // Each player gets a private sync of their full state (hp/sp/exp/stats…).
    for (const p of this.world.players.values()) {
      this.world.connections.get(p.connId)?.send({ t: MsgType.SelfSync, self: p.toSelfState() });
    }
  }
}
