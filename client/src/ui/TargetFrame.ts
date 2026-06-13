interface TargetInfo {
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  boss: boolean;
}

// Top-center frame showing the currently-targeted monster's name, level and HP.
export class TargetFrame {
  private root = document.getElementById("target-frame")!;
  private nameEl = document.getElementById("tf-name")!;
  private fill = document.getElementById("tf-fill")!;

  show(info: TargetInfo): void {
    this.root.classList.remove("hidden");
    this.root.classList.toggle("boss", info.boss);
    this.nameEl.textContent = `${info.name}  Lv${info.level}`;
    const pct = info.maxHp ? Math.max(0, Math.min(1, info.hp / info.maxHp)) : 0;
    this.fill.style.width = `${pct * 100}%`;
  }

  hide(): void {
    this.root.classList.add("hidden");
  }
}
