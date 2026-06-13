// Tiny procedural sound effects via the Web Audio API — no audio assets. The
// AudioContext is resumed on the first user gesture (autoplay policy), and a
// mute toggle button is wired up.
export class Sfx {
  private ctx: AudioContext | null = null;
  private muted = false;
  private btn = document.getElementById("mute-btn");

  constructor() {
    const resume = () => {
      if (!this.ctx) {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (Ctor) this.ctx = new Ctor();
      }
      this.ctx?.resume();
    };
    window.addEventListener("pointerdown", resume);
    window.addEventListener("keydown", resume);
    this.btn?.addEventListener("click", () => this.toggleMute());
    this.render();
  }

  private toggleMute(): void {
    this.muted = !this.muted;
    this.render();
  }

  private render(): void {
    if (this.btn) this.btn.textContent = this.muted ? "🔇" : "🔊";
  }

  private tone(freq: number, durMs: number, type: OscillatorType = "square", gain = 0.06): void {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + durMs / 1000);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + durMs / 1000);
  }

  hit(): void {
    this.tone(220, 70, "square", 0.04);
  }
  crit(): void {
    this.tone(440, 120, "sawtooth", 0.06);
  }
  cast(): void {
    this.tone(660, 110, "triangle", 0.05);
  }
  loot(): void {
    this.tone(880, 60, "sine", 0.05);
    setTimeout(() => this.tone(1180, 80, "sine", 0.05), 60);
  }
  levelUp(): void {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 140, "triangle", 0.07), i * 90));
  }
}
