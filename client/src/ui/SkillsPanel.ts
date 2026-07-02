import { SKILL_MAX_LEVEL, SKILLS_BY_JOB, skillPower, skillSpCost, type SelfState } from "@rox/shared";

export interface SkillsHandlers {
  onLevel(skillId: string): void;
}

// Skills window (key "K"): shows the job's skills with current level and lets the
// player spend skill points to raise them. Re-renders from each SelfSync.
export class SkillsPanel {
  private root = document.getElementById("skills")!;
  private list = document.getElementById("skills-list")!;
  private pointsEl = document.getElementById("skills-points")!;
  private last: SelfState | null = null;

  constructor(private handlers: SkillsHandlers) {
    document.getElementById("skills-close")!.addEventListener("click", () => this.close());
    window.addEventListener("keydown", (e) => {
      if (isTyping()) return;
      if (e.key === "k" || e.key === "K") this.toggle();
      else if (e.key === "Escape" && this.isOpen) this.close();
    });
  }

  get isOpen(): boolean {
    return !this.root.classList.contains("hidden");
  }

  toggle(): void {
    this.root.classList.toggle("hidden");
    if (this.isOpen && this.last) this.render(this.last);
  }

  close(): void {
    this.root.classList.add("hidden");
  }

  sync(self: SelfState): void {
    this.last = self;
    if (this.isOpen) this.render(self);
  }

  private render(self: SelfState): void {
    this.pointsEl.textContent = String(self.skillPoints);
    const levelOf = new Map(self.skillLevels.map((s) => [s.id, s.level]));
    this.list.innerHTML = "";
    for (const def of SKILLS_BY_JOB[self.job] ?? []) {
      const lvl = levelOf.get(def.id) ?? 1;
      const maxed = lvl >= SKILL_MAX_LEVEL;
      const power = Math.round(skillPower(def, lvl) * 100);
      const row = document.createElement("div");
      row.className = "skill-card";
      const canLevel = self.skillPoints > 0 && !maxed;
      row.innerHTML =
        `<div class="sk-main"><div class="sk-name">${def.name} <b class="sk-lv">Lv ${lvl}/${SKILL_MAX_LEVEL}</b></div>` +
        `<div class="sk-desc">${def.desc}</div>` +
        `<div class="sk-meta">Power ${power}% · SP ${skillSpCost(def, lvl)}${def.aoeRadius ? " · AoE" : ""}</div></div>` +
        `<div class="sk-act">${maxed ? '<span class="rr-max">MAX</span>' : `<button class="quest-btn${canLevel ? "" : " dim"}" data-skill="${def.id}" ${canLevel ? "" : "disabled"}>+</button>`}</div>`;
      this.list.appendChild(row);
    }
    this.list.querySelectorAll<HTMLButtonElement>("[data-skill]").forEach((b) =>
      b.addEventListener("click", () => {
        // immediate feedback: the card only reflects the new level once the
        // server confirms the point spend on the next sync
        const card = b.closest(".skill-card") as HTMLElement | null;
        if (card) {
          card.classList.add("inv-cell-flash");
          setTimeout(() => card.classList.remove("inv-cell-flash"), 300);
        }
        this.handlers.onLevel(b.dataset.skill!);
      }),
    );
  }
}

function isTyping(): boolean {
  const a = document.activeElement;
  return !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA");
}
