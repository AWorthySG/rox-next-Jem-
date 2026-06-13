import { MsgType, type ClientMessage, type SelfState, type ServerMessage } from "@rox/shared";
import { World, GameLoop, handleClientMessage, type ClientLink } from "@rox/engine";
import type { NetHandlers, Transport } from "./Transport.js";

// Runs the full authoritative engine inside the browser so the game is playable
// with no server (solo / offline mode). Messages are delivered asynchronously to
// mimic a real connection and avoid re-entrancy.
export class LocalServer implements Transport {
  private world = new World();
  private loop = new GameLoop(this.world);
  private link: LocalLink;
  private outbox: ServerMessage[] = [];
  private flushScheduled = false;
  connected = false;

  constructor(
    private handlers: NetHandlers,
    private savedState: SelfState | null = null,
  ) {
    this.link = new LocalLink(1, (msg) => this.enqueue(msg));
  }

  connect(): void {
    this.world.addConnection(this.link);
    this.loop.start();
    this.connected = true;
    this.handlers.onOpen?.();
  }

  send(msg: ClientMessage): void {
    handleClientMessage(this.world, this.link, msg);
    // On join, restore any saved character so solo progress persists.
    if (msg.t === MsgType.Join && this.savedState && this.link.playerId != null) {
      const player = this.world.players.get(this.link.playerId);
      if (player) {
        player.restore(this.savedState);
        this.link.send({ t: MsgType.SelfSync, self: player.toSelfState() });
        this.world.broadcast({ t: MsgType.Spawn, entity: player.toFull() });
      }
      this.savedState = null;
    }
  }

  stop(): void {
    this.loop.stop();
    this.connected = false;
  }

  private enqueue(msg: ServerMessage): void {
    this.outbox.push(msg);
    if (!this.flushScheduled) {
      this.flushScheduled = true;
      queueMicrotask(() => this.flush());
    }
  }

  private flush(): void {
    this.flushScheduled = false;
    const batch = this.outbox;
    this.outbox = [];
    for (const m of batch) this.handlers.onMessage(m);
  }
}

class LocalLink implements ClientLink {
  playerId: number | null = null;
  constructor(
    readonly id: number,
    private deliver: (msg: ServerMessage) => void,
  ) {}
  send(msg: ServerMessage): void {
    this.deliver(msg);
  }
}
