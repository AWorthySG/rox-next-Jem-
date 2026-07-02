import { Element, ELEMENT_ICON, ELEMENT_LABEL } from "@rox/shared";

interface TargetInfo {
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  boss: boolean;
  element: string;
}

// Top-center frame showing the currently-targeted monster's name, level, element and HP.
export class TargetFrame {
  private root = document.getElementById("target-frame")!;
  private nameEl = document.getElementById("tf-name")!;
  private fill = document.getElementById("tf-fill")!;
  private chip = document.getElementById("tf-chip")!;
  private lastTargetName: string | null = null;

  show(info: TargetInfo): void {
    this.root.classList.remove("hidden");
    this.root.classList.toggle("boss", info.boss);
    const el = info.element as Element;
    const elemTag =
      el && el !== Element.Neutral ? `  ${ELEMENT_ICON[el] ?? ""}${ELEMENT_LABEL[el] ?? ""}` : "";
    this.nameEl.textContent = `${info.name}  Lv${info.level}${elemTag}`;
    const pct = info.maxHp ? Math.max(0, Math.min(1, info.hp / info.maxHp)) : 0;
    const widthPct = `${pct * 100}%`;
    // a fresh target snaps both bars instantly instead of "chipping" from
    // whatever the previous target's health happened to be
    if (info.name !== this.lastTargetName) {
      this.lastTargetName = info.name;
      this.chip.style.transition = "none";
      this.chip.style.width = widthPct;
      void this.chip.offsetWidth; // force reflow before re-enabling the transition
      this.chip.style.transition = "";
    }
    this.fill.style.width = widthPct;
    this.chip.style.width = widthPct;
  }

  hide(): void {
    this.root.classList.add("hidden");
    this.lastTargetName = null;
  }
}
