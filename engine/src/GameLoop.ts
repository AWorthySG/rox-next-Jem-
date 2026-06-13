import { SNAPSHOT_EVERY_N_TICKS, TICK_MS } from "@rox/shared";
import type { World } from "./World.js";
import { MovementSystem } from "./MovementSystem.js";
import { CombatSystem } from "./CombatSystem.js";
import { MonsterAI } from "./MonsterAI.js";
import { SnapshotSystem } from "./SnapshotSystem.js";

// Fixed-timestep authoritative simulation. Uses an accumulator so logic advances
// in discrete TICK_MS steps regardless of timer jitter. Runs identically on the
// Node server and in the browser (local solo mode).
export class GameLoop {
  private movement: MovementSystem;
  private combat: CombatSystem;
  private ai: MonsterAI;
  private snapshots: SnapshotSystem;

  private tick = 0;
  private accumulator = 0;
  private last = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private world: World) {
    this.movement = new MovementSystem(world);
    this.combat = new CombatSystem(world);
    this.ai = new MonsterAI(world, this.combat);
    this.snapshots = new SnapshotSystem(world);
  }

  get combatSystem(): CombatSystem {
    return this.combat;
  }

  start(): void {
    this.last = Date.now();
    // Drive the accumulator slightly faster than the tick rate to stay smooth.
    this.timer = setInterval(() => this.frame(), Math.floor(TICK_MS / 2));
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private frame(): void {
    const now = Date.now();
    this.accumulator += now - this.last;
    this.last = now;
    // Avoid spiral-of-death if the process was paused.
    if (this.accumulator > 250) this.accumulator = 250;

    while (this.accumulator >= TICK_MS) {
      this.step(TICK_MS);
      this.accumulator -= TICK_MS;
    }
  }

  private step(dtMs: number): void {
    const dt = dtMs / 1000;
    this.tick++;

    this.movement.update(dt);
    this.ai.update(dt, dtMs);
    this.combat.update(dtMs);

    if (this.tick % SNAPSHOT_EVERY_N_TICKS === 0) {
      this.snapshots.broadcast(this.tick);
    }
  }
}
