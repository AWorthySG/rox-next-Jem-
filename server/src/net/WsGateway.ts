import { WebSocketServer, type WebSocket } from "ws";
import {
  CLIENT_TIMEOUT_MS,
  decodeClient,
  HEARTBEAT_INTERVAL_MS,
  JobId,
  MAP_SIZE,
  MsgType,
  SNAPSHOT_RATE,
  TICK_RATE,
  type ClientMessage,
} from "@rox/shared";
import { Connection } from "./Connection.js";
import type { World } from "../game/World.js";
import { Player } from "../game/Player.js";

const VALID_JOBS = new Set<string>([JobId.Novice, JobId.Swordsman, JobId.Mage]);

// Accepts WebSocket connections, validates/parses messages, and applies them to
// the authoritative world as player intents.
export class WsGateway {
  private wss: WebSocketServer;
  private heartbeat: NodeJS.Timeout;

  constructor(
    private world: World,
    port: number,
  ) {
    this.wss = new WebSocketServer({ port });
    this.wss.on("connection", (socket) => this.onConnection(socket));
    this.wss.on("listening", () => {
      console.log(`[ws] listening on :${port}`);
    });
    this.heartbeat = setInterval(() => this.checkHeartbeats(), HEARTBEAT_INTERVAL_MS);
  }

  private onConnection(socket: WebSocket): void {
    const conn = new Connection(socket);
    this.world.addConnection(conn);
    console.log(`[ws] connection ${conn.id} opened`);

    socket.on("message", (data) => {
      conn.lastSeen = Date.now();
      const msg = decodeClient(data.toString());
      if (msg) this.route(conn, msg);
    });
    socket.on("pong", () => {
      conn.lastSeen = Date.now();
    });
    socket.on("close", () => this.onClose(conn));
    socket.on("error", () => this.onClose(conn));
  }

  private onClose(conn: Connection): void {
    if (!this.world.connections.has(conn.id)) return;
    console.log(`[ws] connection ${conn.id} closed`);
    this.world.removeConnection(conn);
  }

  private route(conn: Connection, msg: ClientMessage): void {
    switch (msg.t) {
      case MsgType.Join:
        this.handleJoin(conn, msg.name, msg.job);
        break;
      case MsgType.MoveIntent: {
        const p = this.playerOf(conn);
        if (p && isFinite(msg.x) && isFinite(msg.z)) {
          p.moveTarget = { x: clampMap(msg.x), z: clampMap(msg.z) };
          p.attackTargetId = null; // manual move cancels auto-attack
        }
        break;
      }
      case MsgType.AttackIntent: {
        const p = this.playerOf(conn);
        if (p && this.world.monsters.has(msg.targetId)) {
          p.attackTargetId = msg.targetId;
        }
        break;
      }
      case MsgType.Chat: {
        const p = this.playerOf(conn);
        const text = (msg.text ?? "").toString().slice(0, 140).trim();
        if (p && text) {
          this.world.broadcast({
            t: MsgType.ChatBroadcast,
            fromId: p.id,
            name: p.name,
            text,
          });
        }
        break;
      }
      case MsgType.Ping:
        conn.send({ t: MsgType.Pong, clientTime: msg.clientTime, serverTime: Date.now() });
        break;
    }
  }

  private handleJoin(conn: Connection, rawName: string, rawJob?: JobId): void {
    if (conn.playerId != null) return; // already joined
    const name = sanitizeName(rawName);
    const job = rawJob && VALID_JOBS.has(rawJob) ? rawJob : JobId.Novice;

    // Spawn at a small random offset around town center so players don't stack.
    const x = (Math.random() - 0.5) * 6;
    const z = (Math.random() - 0.5) * 6;
    const player = new Player(this.world.allocId(), conn.id, name, job, x, z);
    conn.playerId = player.id;

    conn.send({
      t: MsgType.JoinAck,
      selfId: player.id,
      tickRate: TICK_RATE,
      snapshotRate: SNAPSHOT_RATE,
      mapSize: MAP_SIZE,
      self: player.toSelfState(),
    });
    // Existing world to the joiner first, then announce the joiner to everyone.
    this.world.spawnAllFor(conn);
    this.world.addPlayer(player);
    console.log(`[ws] player "${name}" (${job}) joined as entity ${player.id}`);
  }

  private playerOf(conn: Connection): Player | null {
    if (conn.playerId == null) return null;
    return this.world.players.get(conn.playerId) ?? null;
  }

  private checkHeartbeats(): void {
    const now = Date.now();
    for (const conn of this.world.connections.values()) {
      if (now - conn.lastSeen > CLIENT_TIMEOUT_MS) {
        conn.close();
        this.onClose(conn);
        continue;
      }
      if (conn.socket.readyState === conn.socket.OPEN) {
        conn.socket.ping();
      }
    }
  }

  close(): void {
    clearInterval(this.heartbeat);
    this.wss.close();
  }
}

function sanitizeName(raw: string): string {
  const cleaned = (raw ?? "").toString().replace(/[^\w \-]/g, "").trim().slice(0, 16);
  return cleaned || `Adventurer${Math.floor(Math.random() * 1000)}`;
}

function clampMap(v: number): number {
  const half = MAP_SIZE / 2;
  return Math.min(half, Math.max(-half, v));
}
