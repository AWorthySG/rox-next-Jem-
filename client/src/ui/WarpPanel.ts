import { MAPS } from "@rox/engine";

// Warp Girl: pick a destination map for quick travel. Opened by clicking the
// warp NPC; the chosen map is sent to the server (which performs the travel).
export class WarpPanel {
  private root = document.getElementById("warp")!;
  private list = document.getElementById("warp-list")!;
  private npcId = -1;

  constructor(private onWarp: (npcId: number, mapId: string) => void) {
    document.getElementById("warp-close")!.addEventListener("click", () => this.close());
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !this.root.classList.contains("hidden")) this.close();
    });
    this.render();
  }

  private render(): void {
    this.list.innerHTML = "";
    for (const map of Object.values(MAPS)) {
      const btn = document.createElement("button");
      btn.className = "warp-btn";
      btn.textContent = map.name;
      btn.addEventListener("click", () => {
        this.onWarp(this.npcId, map.id);
        this.close();
      });
      this.list.appendChild(btn);
    }
  }

  open(npcId: number): void {
    this.npcId = npcId;
    this.root.classList.remove("hidden");
  }

  close(): void {
    this.root.classList.add("hidden");
  }
}
