import {
  decodeServer,
  encode,
  MsgType,
  type ClientMessage,
  type ServerMessage,
} from "@rox/shared";

export interface NetHandlers {
  onOpen?(): void;
  onClose?(): void;
  onMessage(msg: ServerMessage): void;
}

// Thin WebSocket wrapper: connects, (de)serialises JSON messages, and runs a
// periodic ping for latency measurement.
export class NetClient {
  private ws: WebSocket | null = null;
  private pingTimer: number | null = null;

  constructor(private handlers: NetHandlers) {}

  connect(url: string): void {
    this.ws = new WebSocket(url);
    this.ws.onopen = () => {
      this.handlers.onOpen?.();
      this.pingTimer = window.setInterval(() => {
        this.send({ t: MsgType.Ping, clientTime: performance.now() });
      }, 3000);
    };
    this.ws.onclose = () => {
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.handlers.onClose?.();
    };
    this.ws.onerror = () => this.ws?.close();
    this.ws.onmessage = (ev) => {
      const msg = decodeServer(typeof ev.data === "string" ? ev.data : "");
      if (msg) this.handlers.onMessage(msg);
    };
  }

  send(msg: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(encode(msg));
    }
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
