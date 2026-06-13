import { MsgType, type EntitySnapshot } from "@rox/shared";
import type { World } from "./World.js";

// Builds and broadcasts the periodic world snapshot (10 Hz).
export class SnapshotSystem {
  constructor(private world: World) {}

  broadcast(tick: number): void {
    const entities: EntitySnapshot[] = [];
    for (const p of this.world.players.values()) entities.push(p.toSnapshot());
    for (const m of this.world.monsters.values()) {
      if (!m.isDead) entities.push(m.toSnapshot());
    }
    this.world.broadcast({
      t: MsgType.Snapshot,
      tick,
      time: Date.now(),
      entities,
    });

    // Each player also gets a private sync of their full state (hp/sp/exp/stats)
    // so the HUD stays accurate without bloating the shared snapshot.
    for (const p of this.world.players.values()) {
      const conn = this.world.connections.get(p.connId);
      conn?.send({ t: MsgType.SelfSync, self: p.toSelfState() });
    }
  }
}
