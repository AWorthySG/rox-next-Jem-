import { advanceOptions, JOB_NAME, type JobId, type SelfState } from "@rox/shared";

// Shows a job-change banner when the player is eligible to advance. Clicking an
// option requests the change; the banner hides itself once applied.
export class JobAdvance {
  private root = document.getElementById("job-advance")!;
  private sig = "";

  constructor(private onAdvance: (job: JobId) => void) {}

  update(self: SelfState): void {
    const options = advanceOptions(self.job, self.level);
    const signature = `${self.job}:${options.join(",")}`;
    if (signature === this.sig) return; // no change → avoid re-render churn
    this.sig = signature;

    if (options.length === 0) {
      this.root.classList.add("hidden");
      this.root.innerHTML = "";
      return;
    }
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
