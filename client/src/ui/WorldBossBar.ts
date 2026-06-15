import type { BossStatusMsg } from "@rox/shared";

// A prominent server-wide raid bar for an engaged world boss. It auto-hides a
// few seconds after the last update (boss disengaged) or on defeat.
export class WorldBossBar {
  private root = document.getElementById("worldboss-bar")!;
  private title = document.getElementById("wb-title")!;
  private fill = document.getElementById("wb-fill")!;
  private sub = document.getElementById("wb-sub")!;
  private hideTimer: number | null = null;
  private activeId: number | null = null;

  update(msg: BossStatusMsg): void {
    if (msg.defeatedBy) {
      this.title.textContent = `${msg.name} — DEFEATED`;
      this.fill.style.width = "0%";
      this.sub.textContent = `Felled by ${msg.defeatedBy}`;
      this.root.classList.remove("hidden");
      this.scheduleHide(4000);
      this.activeId = null;
      return;
    }
    this.activeId = msg.bossId;
    this.root.classList.remove("hidden");
    this.title.textContent = `${msg.name}`;
    const pct = msg.maxHp ? Math.max(0, Math.min(1, msg.hp / msg.maxHp)) : 0;
    this.fill.style.width = `${pct * 100}%`;
    this.sub.textContent = `${msg.mapName} · ${Math.round(pct * 100)}%`;
    // Bosses broadcast at 10 Hz while engaged; fade if updates stop.
    this.scheduleHide(5000);
  }

  private scheduleHide(ms: number): void {
    if (this.hideTimer != null) window.clearTimeout(this.hideTimer);
    this.hideTimer = window.setTimeout(() => {
      this.root.classList.add("hidden");
      this.activeId = null;
    }, ms);
  }
}
