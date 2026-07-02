import { advanceOptions, JOB_NAME, type JobId, type SelfState } from "@rox/shared";
import type { ScreenFx } from "./ScreenFx.js";

// Shows a job-change banner when the player is eligible to advance. Clicking an
// option requests the change; the banner hides itself once applied.
export class JobAdvance {
  private root = document.getElementById("job-advance")!;
  private sig = "";
  private wasVisible = false;

  constructor(private onAdvance: (job: JobId) => void, private screenFx?: ScreenFx) {}

  update(self: SelfState): void {
    const options = advanceOptions(self.job, self.level);
    const signature = `${self.job}:${options.join(",")}`;
    if (signature === this.sig) return; // no change → avoid re-render churn
    this.sig = signature;

    if (options.length === 0) {
      this.root.classList.add("hidden");
      this.root.innerHTML = "";
      this.wasVisible = false;
      return;
    }
    // a golden screen bloom the moment the banner first becomes available,
    // so a fresh job-advance opportunity reads as a milestone, not something
    // the player has to notice on their own in a corner of the HUD
    if (!this.wasVisible) this.screenFx?.levelUp();
    this.wasVisible = true;
    this.root.classList.remove("hidden");
    this.root.innerHTML = `<span class="ja-title">⚜ Job Change available!</span>`;
    for (const job of options) {
      const btn = document.createElement("button");
      btn.className = "ja-btn";
      btn.textContent = `Become ${JOB_NAME[job]}`;
      btn.addEventListener("click", () => this.onAdvance(job));
      this.root.appendChild(btn);
    }
  }
}
