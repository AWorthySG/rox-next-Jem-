import { MsgType } from "@rox/shared";
import type { World } from "./World.js";
import type { Player } from "./Player.js";

// 1v1 duel requests: any two players sharing a map can challenge each other
// to a friendly duel, independent of whether the map itself is flagged PvP.
// CombatSystem consults `opponentOf` to allow mutual damage only between the
// two duelists, and calls `leave()` to end the duel once one side is downed.
export class DuelSystem {
  private pending = new Map<number, number>(); // requesterId -> targetId
  private active = new Map<number, number>(); // playerId -> opponentId (both directions stored)

  constructor(private world: World) {}

  request(from: Player, targetId: number): void {
    if (from.id === targetId || this.active.has(from.id) || this.pending.has(from.id)) return;
    const target = this.world.players.get(targetId);
    if (!target || target.mapId !== from.mapId || this.active.has(targetId)) return;
    this.pending.set(from.id, targetId);
    this.world.connections.get(target.connId)?.send({
      t: MsgType.DuelRequestRecv,
      fromId: from.id,
      fromName: from.name,
    });
  }

  accept(target: Player, fromId: number): void {
    if (this.pending.get(fromId) !== target.id) return;
    this.pending.delete(fromId);
    const requester = this.world.players.get(fromId);
    if (!requester || requester.mapId !== target.mapId || this.active.has(fromId) || this.active.has(target.id)) return;
    this.active.set(fromId, target.id);
    this.active.set(target.id, fromId);
    this.sendUpdate(requester, target);
    this.sendUpdate(target, requester);
    this.world.broadcastToMap(target.mapId, {
      t: MsgType.ChatBroadcast,
      fromId: 0,
      name: "Duel",
      text: `${requester.name} and ${target.name} have begun a duel!`,
    });
  }

  decline(target: Player, fromId: number): void {
    if (this.pending.get(fromId) === target.id) this.pending.delete(fromId);
  }

  // Cancel whatever duel state `player` is in: a pending outgoing request, an
  // incoming request targeting them, or an active duel (forfeiting it). Safe
  // to call unconditionally on disconnect, map change, or explicit forfeit.
  leave(player: Player): void {
    this.pending.delete(player.id);
    for (const [reqId, tgtId] of this.pending) {
      if (tgtId === player.id) this.pending.delete(reqId);
    }
    const opponentId = this.active.get(player.id);
    if (opponentId == null) return;
    this.active.delete(player.id);
    this.active.delete(opponentId);
    const opponent = this.world.players.get(opponentId);
    if (opponent) this.sendUpdate(opponent, null);
    this.sendUpdate(player, null);
  }

  opponentOf(playerId: number): number | null {
    return this.active.get(playerId) ?? null;
  }

  private sendUpdate(player: Player, opponent: Player | null): void {
    this.world.connections.get(player.connId)?.send({
      t: MsgType.DuelUpdate,
      opponentId: opponent?.id ?? null,
      opponentName: opponent?.name,
    });
  }
}
