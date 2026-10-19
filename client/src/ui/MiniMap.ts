import { MAP_HALF } from "@rox/shared";

type Blip = { x: number; z: number; type: "self" | "player" | "monster" | "boss" | "npc"; facing?: number };

// A-Worthy palette: you are the rust action colour, everyone else a marker pop,
// every blip outlined in navy ink so it reads on the cream paper disc.
const INK = "#22304a";
const COLORS: Record<Blip["type"], string> = {
  self: "#c0392b",
  player: "#5faee3",
  monster: "#ef476f",
  boss: "#f5b82e",
  npc: "#3daa5c",
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
    ctx.fillStyle = "#faf6ee";
    ctx.beginPath();
    ctx.arc(r, r, r - 1, 0, Math.PI * 2);
    ctx.fill();

    const scale = (size - 8) / (MAP_HALF * 2);
    for (const b of blips) {
      const px = r + b.x * scale;
      const py = r + b.z * scale;
      ctx.fillStyle = COLORS[b.type];
      const dot = b.type === "self" || b.type === "boss" ? 3.4 : 2.2;
      if (b.type === "self") {
        // a soft halo so the self-blip stays easy to find at a glance
        ctx.beginPath();
        ctx.arc(px, py, dot + 3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(192, 57, 43, 0.22)";
        ctx.fill();
        ctx.fillStyle = COLORS[b.type];
      }
      ctx.beginPath();
      ctx.arc(px, py, dot, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.stroke();
      if (b.type === "boss") {
        // expanding radar "ping" so bosses draw the eye on the minimap
        const t = (performance.now() % 1200) / 1200;
        ctx.beginPath();
        ctx.arc(px, py, dot + 2 + t * 5, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(245, 184, 46, ${0.8 * (1 - t)})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      if (b.type === "self" && b.facing !== undefined) {
        // facing cone: a small wedge pointing the way the player is looking
        // (world +z is screen-down here, matching the world→canvas mapping above)
        const len = dot + 7;
        const spread = 0.42;
        const tipX = px + Math.sin(b.facing) * len;
        const tipY = py + Math.cos(b.facing) * len;
        ctx.beginPath();
        ctx.moveTo(px + Math.sin(b.facing - spread) * dot, py + Math.cos(b.facing - spread) * dot);
        ctx.lineTo(tipX, tipY);
        ctx.lineTo(px + Math.sin(b.facing + spread) * dot, py + Math.cos(b.facing + spread) * dot);
        ctx.closePath();
        ctx.fillStyle = "rgba(192, 57, 43, 0.55)";
        ctx.fill();
      }
    }

    // border ring
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(r, r, r - 1, 0, Math.PI * 2);
    ctx.stroke();

    // compass tick + "N" label at the top, so the radar reads as oriented
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(r, 2);
    ctx.lineTo(r, 9);
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.font = "800 10px Nunito, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("N", r, 19);
  }
}
