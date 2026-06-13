import { MAP_HALF } from "@rox/shared";

type Blip = { x: number; z: number; type: "self" | "player" | "monster" | "boss" | "npc" };

const COLORS: Record<Blip["type"], string> = {
  self: "#ffd24a",
  player: "#7fb2ff",
  monster: "#ff8aa8",
  boss: "#ffcf3a",
  npc: "#8fe0b0",
};

// Top-down radar of the map. Pure canvas, redrawn each frame from GameState blips.
export class MiniMap {
  private canvas = document.getElementById("minimap") as HTMLCanvasElement;
  private ctx = this.canvas.getContext("2d")!;
  private size: number;

  constructor() {
    this.size = this.canvas.width;
  }

  update(blips: Blip[]): void {
    const { ctx, size } = this;
    const r = size / 2;
    ctx.clearRect(0, 0, size, size);

    // background disc
    ctx.fillStyle = "rgba(20, 28, 18, 0.7)";
    ctx.beginPath();
    ctx.arc(r, r, r - 1, 0, Math.PI * 2);
    ctx.fill();

    const scale = (size - 8) / (MAP_HALF * 2);
    for (const b of blips) {
      const px = r + b.x * scale;
      const py = r + b.z * scale;
      ctx.fillStyle = COLORS[b.type];
      const dot = b.type === "self" || b.type === "boss" ? 3.4 : 2.2;
      ctx.beginPath();
      ctx.arc(px, py, dot, 0, Math.PI * 2);
      ctx.fill();
      if (b.type === "boss") {
        ctx.strokeStyle = "#fff3c0";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // border ring
    ctx.strokeStyle = "rgba(230, 200, 120, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(r, r, r - 1, 0, Math.PI * 2);
    ctx.stroke();
  }
}
