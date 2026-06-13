import { MAP_HALF, MOUNT_SPEED_MULT, PLAYER_SPEED } from "@rox/shared";
import type { World } from "./World.js";

// Advances player positions toward their click-to-move targets. Monster movement
// is handled inside MonsterAI (it depends on AI state).
export class MovementSystem {
  constructor(private world: World) {}

  update(dt: number): void {
    for (const p of this.world.players.values()) {
      if (!p.moveTarget) continue;
      // If chasing an attack target, MovementSystem still moves toward the point
      // CombatSystem set as moveTarget.
      const speed = PLAYER_SPEED * (p.mounted ? MOUNT_SPEED_MULT : 1);
      const reached = stepToward(p, p.moveTarget.x, p.moveTarget.z, speed, dt);
      if (reached) p.moveTarget = null;
      p.x = clamp(p.x, -MAP_HALF, MAP_HALF);
      p.z = clamp(p.z, -MAP_HALF, MAP_HALF);
    }
  }
}

// Move an entity toward (tx,tz). Returns true when within snapping distance.
export function stepToward(
  e: { x: number; z: number; facing: number },
  tx: number,
  tz: number,
  speed: number,
  dt: number,
): boolean {
  const dx = tx - e.x;
  const dz = tz - e.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.05) return true;
  e.facing = Math.atan2(dx, dz);
  const step = speed * dt;
  if (step >= dist) {
    e.x = tx;
    e.z = tz;
    return true;
  }
  e.x += (dx / dist) * step;
  e.z += (dz / dist) * step;
  return false;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function dist2d(ax: number, az: number, bx: number, bz: number): number {
  return Math.hypot(ax - bx, az - bz);
}
