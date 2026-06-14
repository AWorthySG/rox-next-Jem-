import { RUNE_LINES, runesByLine, type SelfState } from "@rox/shared";

export interface AesirHandlers {
  onUnlock(runeId: string): void;
}

// The Aesir Monument (key "R"): spend rune points down five passive paths.
export class AesirPanel {
  private root = document.getElementById("aesir")!;
  private body = document.getElementById("aesir-body")!;
  private pointsEl = document.getElementById("rune-points")!;
  private last: SelfState | null = null;

  constructor(private handlers: AesirHandlers) {
    document.getElementById("aesir-close")!.addEventListener("click", () => this.close());
    window.addEventListener("keydown", (e) => {
      if (isTyping()) return;
      if (e.key === "r" || e.key === "R") this.toggle();
      else if (e.key === "Escape" && this.isOpen) this.close();
    });
  }

  private get isOpen(): boolean {
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
    this.pointsEl.textContent = String(self.runePoints);
    const owned = new Set(self.runes);
    this.body.innerHTML = "";
    for (const lineName of RUNE_LINES) {
      const row = document.createElement("div");
      row.className = "aesir-line";
      let html = `<div class="aesir-line-name">${lineName}</div><div class="aesir-nodes">`;
      for (const rune of runesByLine(lineName)) {
        const unlocked = owned.has(rune.id);
        const prereqMet = !rune.requires || owned.has(rune.requires);
        const available = !unlocked && prereqMet && self.runePoints >= rune.cost;
        const cls = unlocked ? "done" : available ? "avail" : "locked";
        const attr = available ? ` data-rune="${rune.id}"` : "";
        html += `<button class="aesir-node ${cls}"${attr} title="${rune.desc}"><b>${rune.name}</b><i>${rune.desc}</i><span class="rn-cost">${unlocked ? "✓" : rune.cost + "p"}</span></button>`;
      }
      html += "</div>";
      row.innerHTML = html;
      this.body.appendChild(row);
    }
    this.body.querySelectorAll<HTMLButtonElement>("[data-rune]").forEach((b) =>
      b.addEventListener("click", () => this.handlers.onUnlock(b.dataset.rune!)),
    );
  }
}

function isTyping(): boolean {
  const a = document.activeElement;
  return !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA");
}
