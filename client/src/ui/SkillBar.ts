import { JobId, SKILLS_BY_JOB, type SkillDef } from "@rox/shared";

interface Slot {
  def: SkillDef;
  el: HTMLButtonElement;
  cdOverlay: HTMLDivElement;
  cooldownUntil: number; // performance.now() ms
}

// Renders the job's skill bar with hotkeys, SP gating and a cooldown sweep.
// Casting is requested via the onCast callback; the server stays authoritative.
export class SkillBar {
  private root: HTMLElement;
  private slots: Slot[] = [];
  private sp = 0;

  constructor(private onCast: (skillId: string) => void) {
    this.root = document.getElementById("skillbar")!;
    window.addEventListener("keydown", (e) => {
      if (isTyping()) return;
      const n = parseInt(e.key, 10);
      if (!isNaN(n) && n >= 1 && n <= this.slots.length) this.tryCast(this.slots[n - 1]);
    });
  }

  build(job: JobId): void {
    this.root.innerHTML = "";
    this.slots = [];
    for (const def of SKILLS_BY_JOB[job] ?? []) {
      const el = document.createElement("button");
      el.className = "skill-slot";
      el.title = `${def.name} — ${def.desc} (SP ${def.spCost})`;
      el.innerHTML =
        `<span class="key">${def.hotkey}</span>` +
        `<span class="sname">${def.name}</span>` +
        `<span class="sp">SP ${def.spCost}</span>`;
      const cdOverlay = document.createElement("div");
      cdOverlay.className = "cd";
      el.appendChild(cdOverlay);
      const slot: Slot = { def, el, cdOverlay, cooldownUntil: 0 };
      el.addEventListener("click", () => this.tryCast(slot));
      this.root.appendChild(el);
      this.slots.push(slot);
    }
  }

  setSp(sp: number): void {
    this.sp = sp;
  }

  private tryCast(slot: Slot): void {
    if (performance.now() < slot.cooldownUntil) return;
    if (this.sp < slot.def.spCost) {
      slot.el.classList.add("nosp");
      setTimeout(() => slot.el.classList.remove("nosp"), 200);
      return;
    }
    // Optimistic local cooldown; the server enforces the real one.
    slot.cooldownUntil = performance.now() + slot.def.cooldownMs;
    this.onCast(slot.def.id);
  }

  // Called every frame to animate cooldown sweeps and SP-availability dimming.
  update(): void {
    const now = performance.now();
    for (const s of this.slots) {
      const remain = s.cooldownUntil - now;
      if (remain > 0) {
        s.cdOverlay.style.height = `${Math.min(100, (remain / s.def.cooldownMs) * 100)}%`;
        s.el.classList.add("cooling");
      } else {
        s.cdOverlay.style.height = "0%";
        s.el.classList.remove("cooling");
      }
      s.el.classList.toggle("dim", this.sp < s.def.spCost);
    }
  }
}

function isTyping(): boolean {
  const a = document.activeElement;
  return !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA");
}
