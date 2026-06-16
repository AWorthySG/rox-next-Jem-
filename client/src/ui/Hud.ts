import { STAT_KEYS, type SelfState, type StatKey } from "@rox/shared";

// Manages the on-screen HUD: name/level, HP/SP/EXP bars, Zeny, and the stat
// panel with manual point allocation.
export class Hud {
  private statSig = "";

  constructor(private onAllocate: (stat: StatKey) => void) {}

  private el(id: string): HTMLElement {
    return document.getElementById(id)!;
  }

  show(): void {
    this.el("hud").classList.remove("hidden");
  }

  setIdentity(name: string, job: string): void {
    this.el("hud-name").textContent = name;
    this.el("hud-job").textContent = job;
    this.el("portrait-initial").textContent = (job[0] ?? "N").toUpperCase();
  }

  update(self: SelfState): void {
    this.el("hud-level").textContent = String(self.level);
    this.setBar("hp", self.hp, self.maxHp, `${Math.round(self.hp)}/${self.maxHp}`);
    this.setBar("sp", self.sp, self.maxSp, `${Math.round(self.sp)}/${self.maxSp}`);
    const expMax = self.expToNext || 1;
    const expLabel = self.expToNext ? `EXP ${Math.round((self.exp / expMax) * 100)}%` : "MAX";
    this.setBar("exp", self.exp, expMax, expLabel);
    const zeny = self.zeny.toLocaleString();
    this.el("hud-zeny").textContent = zeny;
    this.el("top-zeny").textContent = zeny;
    this.renderBuffs(self.buffs);
    this.renderStats(self);
  }

  private renderBuffs(buffs: Array<{ type: string; remainingMs: number }>): void {
    const el = this.el("buffs");
    el.innerHTML = buffs
      .map((b) => {
        const label = b.type === "matk" ? "MATK↑" : b.type === "atk" ? "ATK↑" : b.type;
        return `<span class="buff-chip">${label} ${Math.ceil(b.remainingMs / 1000)}s</span>`;
      })
      .join("");
  }

  private ghostPct: Record<string, number> = {};

  private setBar(kind: string, value: number, max: number, label: string): void {
    const pct = Math.max(0, Math.min(1, max ? value / max : 0));
    const fill = this.el(`${kind}-fill`) as HTMLElement;
    fill.style.width = `${pct * 100}%`;
    // damage ghost: drain a beat behind on loss, snap up on gain
    const ghost = document.getElementById(`${kind}-ghost`);
    if (ghost) {
      const prev = this.ghostPct[kind] ?? pct;
      if (pct >= prev) {
        ghost.style.transition = "none";
        ghost.style.width = `${pct * 100}%`;
        void ghost.offsetWidth; // commit before re-enabling the delayed transition
        ghost.style.transition = "";
      } else {
        ghost.style.width = `${pct * 100}%`; // CSS delay+ease drains it down
      }
      this.ghostPct[kind] = pct;
    }
    // flag a low-HP danger state so the bar pulses red (CSS-driven)
    if (kind === "hp") fill.parentElement?.classList.toggle("low", pct > 0 && pct <= 0.3);
    this.el(`${kind}-label`).textContent = label;
  }

  private renderStats(self: SelfState): void {
    const sig = STAT_KEYS.map((k) => self.stats[k]).join(",") + `:${self.statPoints}`;
    if (sig === this.statSig) return; // only rebuild on change
    this.statSig = sig;

    const panel = this.el("stat-panel");
    panel.innerHTML = `<div class="stat-points">Stat Points: <b>${self.statPoints}</b></div>`;
    for (const key of STAT_KEYS) {
      const row = document.createElement("div");
      row.className = "stat-row";
      row.innerHTML = `<span>${key.toUpperCase()}</span><b>${self.stats[key]}</b>`;
      if (self.statPoints > 0) {
        const btn = document.createElement("button");
        btn.className = "stat-plus";
        btn.textContent = "+";
        btn.addEventListener("click", () => this.onAllocate(key));
        row.appendChild(btn);
      }
      panel.appendChild(row);
    }
  }

  setLatency(ms: number): void {
    this.el("latency").textContent = `${ms} ms`;
  }
}
