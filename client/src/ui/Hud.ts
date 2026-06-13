import type { SelfState, Stats } from "@rox/shared";

// Manages the on-screen HUD: name/level, HP/SP/EXP bars and the stat panel.
export class Hud {
  private el(id: string): HTMLElement {
    return document.getElementById(id)!;
  }

  show(): void {
    this.el("hud").classList.remove("hidden");
  }

  setIdentity(name: string, job: string): void {
    this.el("hud-name").textContent = name;
    this.el("hud-job").textContent = job;
  }

  update(self: SelfState): void {
    this.el("hud-level").textContent = String(self.level);
    this.setBar("hp", self.hp, self.maxHp, `${Math.round(self.hp)}/${self.maxHp}`);
    this.setBar("sp", self.sp, self.maxSp, `${Math.round(self.sp)}/${self.maxSp}`);
    const expMax = self.expToNext || 1;
    const expLabel = self.expToNext ? `EXP ${Math.round((self.exp / expMax) * 100)}%` : "MAX";
    this.setBar("exp", self.exp, expMax, expLabel);
    this.setStats(self.stats);
  }

  private setBar(kind: string, value: number, max: number, label: string): void {
    const pct = Math.max(0, Math.min(1, max ? value / max : 0));
    (this.el(`${kind}-fill`) as HTMLElement).style.width = `${pct * 100}%`;
    this.el(`${kind}-label`).textContent = label;
  }

  private setStats(s: Stats): void {
    this.el("st-str").textContent = String(s.str);
    this.el("st-agi").textContent = String(s.agi);
    this.el("st-vit").textContent = String(s.vit);
    this.el("st-int").textContent = String(s.int);
    this.el("st-dex").textContent = String(s.dex);
    this.el("st-luk").textContent = String(s.luk);
  }

  setLatency(ms: number): void {
    this.el("latency").textContent = `${ms} ms`;
  }
}
