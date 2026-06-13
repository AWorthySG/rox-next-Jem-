import type { ClientMessage, ServerMessage } from "@rox/shared";

// Common surface implemented by both the WebSocket client (online) and the
// in-browser local server (solo), so the game code is transport-agnostic.
export interface Transport {
  send(msg: ClientMessage): void;
  readonly connected: boolean;
}

export interface NetHandlers {
  onOpen?(): void;
  onClose?(): void;
  onMessage(msg: ServerMessage): void;
}
