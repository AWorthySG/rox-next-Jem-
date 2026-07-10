import {
  getItem,
  PASS_SEASON_NAME,
  PASS_TIERS,
  type PassTrack,
  type SelfState,
} from "@rox/shared";

export interface BattlePassHandlers {
  onClaim(level: number, track: PassTrack): void;
}

// The Glory Pass panel: shows the season, the pass level + progress bar toward
// the next tier, premium status, and the reward ladder. Each tier shows its
// free and premium rewards with a claim button that lights up once the tier is
// reached (premium requires the Glory Pass). Re-renders from each SelfSync.
export class BattlePassPanel {
  private root = document.getElementById("pass-panel")!;
  private head = document.getElementById("pass-head")!;
  private list = document.getElementById("pass-list")!;
  private last: SelfState | null = null;

  constructor(private handlers: BattlePassHandlers) {
    document.getElementById("pass-close")!.addEventListener("click", () => this.close());
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isOpen) this.close();
    });
  }

  get isOpen(): boolean {
    return !this.root.classList.contains("hidden");
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  open(): void {
    this.root.classList.remove("hidden");
    if (this.last) this.render(this.last);
  }

  close(): void {
    this.root.classList.add("hidden");
  }

  sync(self: SelfState): void {
    this.last = self;
    if (this.isOpen) this.render(self);
  }

  private render(self: SelfState): void {
    const p = self.pass;
    const pct = p.expToNext > 0 ? Math.round((p.exp / p.expToNext) * 100) : 100;
    this.head.innerHTML =
      `<div class="pass-season">Season: ${PASS_SEASON_NAME}${p.premium ? ` · <span class="pass-prem">Premium</span>` : ""}</div>` +
      `<div class="pass-lvl">Pass Lv${p.level}</div>` +
      `<div class="pet-bar"><div class="pet-bar-fill" style="width:${pct}%"></div></div>` +
      (p.expToNext > 0 ? `<div class="pass-exp">${p.exp}/${p.expToNext} to next tier</div>` : `<div class="pass-exp">Max tier reached</div>`) +
      (p.premium ? "" : `<div class="pass-hint">Use a Glory Pass to unlock the premium track.</div>`);

    this.list.innerHTML = "";
    for (const tier of PASS_TIERS) {
      const reached = p.level >= tier.level;
      const row = document.createElement("div");
      row.className = "pass-row" + (reached ? "" : " dim");
      row.appendChild(this.rewardCell(tier.level, "free", tier.free, self, reached));
      row.insertAdjacentHTML("afterbegin", `<div class="pass-tier">${tier.level}</div>`);
      row.appendChild(this.rewardCell(tier.level, "premium", tier.premium, self, reached));
      this.list.appendChild(row);
    }
  }

  private rewardCell(
    level: number,
    track: PassTrack,
    reward: { itemId: string; qty: number } | undefined,
    self: SelfState,
    reached: boolean,
  ): HTMLElement {
    const cell = document.createElement("div");
    cell.className = `pass-cell pass-${track}`;
    if (!reward) {
      cell.innerHTML = `<span class="pass-empty">—</span>`;
      return cell;
    }
    const claimedList = track === "free" ? self.pass.claimedFree : self.pass.claimedPremium;
    const claimed = claimedList.includes(level);
    const locked = track === "premium" && !self.pass.premium;
    const name = getItem(reward.itemId)?.name ?? reward.itemId;
    const canClaim = reached && !claimed && !locked;
    cell.innerHTML =
      `<div class="pass-reward">${name} ×${reward.qty}</div>` +
      `<button class="quest-btn${canClaim ? "" : " dim"}" ${canClaim ? "" : "disabled"}>${claimed ? "Claimed" : locked ? "Locked" : "Claim"}</button>`;
    if (canClaim) {
      cell.querySelector("button")!.addEventListener("click", () => this.handlers.onClaim(level, track));
    }
    return cell;
  }
}
