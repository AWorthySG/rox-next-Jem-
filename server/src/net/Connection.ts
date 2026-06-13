import type { WebSocket } from "ws";
import { encode, type ServerMessage } from "@rox/shared";

let nextConnId = 1;

// Per-socket wrapper: identity, send helper, and liveness tracking.
export class Connection {
  readonly id: number;
  readonly socket: WebSocket;
  alive = true;
  lastSeen = Date.now();
  playerId: number | null = null; // entity id once the player has joined

  constructor(socket: WebSocket) {
    this.id = nextConnId++;
    this.socket = socket;
  }

  send(msg: ServerMessage): void {
    if (this.socket.readyState === this.socket.OPEN) {
      this.socket.send(encode(msg));
    }
  }

  close(): void {
    try {
      this.socket.close();
    } catch {
      /* already closing */
    }
  }
}
