import { WebSocketServer, type WebSocket } from "ws";
import {
  CLIENT_TIMEOUT_MS,
  decodeClient,
  HEARTBEAT_INTERVAL_MS,
} from "@rox/shared";
import { handleClientMessage, type World } from "@rox/engine";
import { Connection } from "./Connection.js";

// Accepts WebSocket connections, validates/parses messages, and forwards them to
// the engine's shared message handler. The gateway is a thin transport adapter;
// all game logic lives in @rox/engine.
export class WsGateway {
  private wss: WebSocketServer;
  private heartbeat: ReturnType<typeof setInterval>;

  constructor(
    private world: World,
    port: number,
  ) {
    this.wss = new WebSocketServer({ port });
    this.wss.on("connection", (socket) => this.onConnection(socket));
    this.wss.on("listening", () => console.log(`[ws] listening on :${port}`));
    this.heartbeat = setInterval(() => this.checkHeartbeats(), HEARTBEAT_INTERVAL_MS);
  }

  private onConnection(socket: WebSocket): void {
    const conn = new Connection(socket);
    this.world.addConnection(conn);
    console.log(`[ws] connection ${conn.id} opened`);

    socket.on("message", (data) => {
      conn.lastSeen = Date.now();
      const msg = decodeClient(data.toString());
      if (msg) handleClientMessage(this.world, conn, msg);
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

  private checkHeartbeats(): void {
    const now = Date.now();
    for (const link of this.world.connections.values()) {
      const conn = link as Connection;
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
