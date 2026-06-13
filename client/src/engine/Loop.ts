// requestAnimationFrame driver with delta-time, clamped to avoid huge steps when
// the tab regains focus.
export class Loop {
  private last = 0;
  private running = false;

  constructor(private onFrame: (dt: number) => void) {}

  start(): void {
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.onFrame(dt);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
  }
}
