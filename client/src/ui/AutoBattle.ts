import type { GameState } from "../state/GameState.js";
import type { SkillBar } from "./SkillBar.js";

// ROX-style auto-battle: when enabled, periodically locks onto the current or
// nearest monster, issues an attack order, and auto-casts a ready skill. The
// server still resolves the chase + combat.
export class AutoBattle {
  enabled = false;
  private timer = 0;
  private btn = document.getElementById("auto-btn")!;

  constructor(
    private gameState: GameState,
    private skillBar: SkillBar,
    private currentTarget: () => number | null,
    private attack: (id: number) => void,
  ) {
    this.btn.addEventListener("click", () => this.toggle());
    window.addEventListener("keydown", (e) => {
      if ((e.key === "t" || e.key === "T") && !isTyping()) this.toggle();
    });
    this.render();
  }

  toggle(): void {
    this.enabled = !this.enabled;
    this.timer = 0;
    this.render();
  }

  private render(): void {
    this.btn.textContent = this.enabled ? "Auto ⏸" : "Auto ▶";
    this.btn.classList.toggle("on", this.enabled);
  }

  update(dt: number): void {
    if (!this.enabled || !this.gameState.self) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.5;

    let id = this.currentTarget();
    if (id == null || !this.gameState.isMonster(id)) id = this.gameState.nearestMonsterId();
    if (id == null) return;
    this.attack(id);
    this.skillBar.autoCast();
  }
}

function isTyping(): boolean {
  const a = document.activeElement;
  return !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA");
}
