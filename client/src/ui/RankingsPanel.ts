import type { RankingUpdateMsg } from "@rox/shared";

// The Hall of Glory panel: two seasonal leaderboards — MVP hunters (players by
// boss-kill score) and guild sieges (guilds by castle captures). Populated by a
// RankingUpdate pushed when the player consults the Hall of Glory NPC.
export class RankingsPanel {
  private root = document.getElementById("rankings")!;
  private seasonEl = document.getElementById("rankings-season")!;
  private mvpEl = document.getElementById("rankings-mvp")!;
  private siegeEl = document.getElementById("rankings-siege")!;

  constructor() {
    document.getElementById("rankings-close")!.addEventListener("click", () => this.close());
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isOpen) this.close();
    });
  }

  get isOpen(): boolean {
    return !this.root.classList.contains("hidden");
  }

  close(): void {
    this.root.classList.add("hidden");
  }

  // Show the panel with the latest board data from the server.
  show(msg: RankingUpdateMsg): void {
    this.seasonEl.textContent = msg.season;
    this.mvpEl.innerHTML = this.board(msg.mvp, "No MVP has fallen yet.");
    this.siegeEl.innerHTML = this.board(msg.siege, "No castle has been claimed yet.");
    this.root.classList.remove("hidden");
  }

  private board(entries: { name: string; score: number }[], empty: string): string {
    if (entries.length === 0) return `<div class="rank-empty">${empty}</div>`;
    return entries
      .map((e, i) => {
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
        return `<div class="rank-row"><span class="rank-pos">${medal}</span><span class="rank-name">${e.name}</span><span class="rank-score">${e.score}</span></div>`;
      })
      .join("");
  }
}
