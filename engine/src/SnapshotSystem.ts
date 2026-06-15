import { MsgType, type EntitySnapshot } from "@rox/shared";
import type { World } from "./World.js";
import { MAPS } from "./data/maps.js";

// Builds and broadcasts the periodic world snapshot (10 Hz), scoped per map so
// players only receive entities on their own map. Each player also gets a
// private SelfSync of their full state.
export class SnapshotSystem {
  constructor(private world: World) {}

  broadcast(tick: number): void {
    const time = Date.now();
    for (const mapId of this.world.mapIds) {
      const entities: EntitySnapshot[] = [];
      for (const p of this.world.playersOnMap(mapId)) entities.push(p.toSnapshot());
      for (const m of this.world.monsters.values()) {
        if (m.mapId === mapId && !m.isDead) entities.push(m.toSnapshot());
      }
      if (entities.length === 0) continue;
      this.world.broadcastToMap(mapId, { t: MsgType.Snapshot, tick, time, entities });
    }

    // Broadcast the live HP of any engaged world boss to EVERY player (cross-map),
    // so the whole server sees the raid bar and can rally.
    for (const m of this.world.monsters.values()) {
      if (!m.template.worldBoss || m.isDead || m.damageByPlayer.size === 0) continue;
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
