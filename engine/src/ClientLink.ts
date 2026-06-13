import type { ServerMessage } from "@rox/shared";

// Transport-agnostic handle for one connected client. Implemented by the WS
// server (`Connection`) and by the in-browser local server (`LocalLink`), so the
// same simulation runs unchanged over the network or entirely client-side.
export interface ClientLink {
  readonly id: number;
  playerId: number | null;
  send(msg: ServerMessage): void;
}
