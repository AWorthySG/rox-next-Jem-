// A small cast-progress bar shown while the local player is channeling a skill
// with a cast time. Driven by the authoritative SkillCast message.
export class CastBar {
  private root = document.getElementById("cast-bar")!;
  private label = document.getElementById("cast-bar-label")!;
  private fill = document.getElementById("cast-bar-fill") as HTMLElement;
  private hideTimer: number | null = null;

  show(name: string, durationMs: number): void {
    this.label.textContent = name;
    this.root.classList.remove("hidden");
    // restart the fill animation: snap to 0, then transition to full over the cast time
    this.fill.style.transition = "none";
    this.fill.style.width = "0%";
    void this.fill.offsetWidth; // force reflow so the next transition takes
    this.fill.style.transition = `width ${durationMs}ms linear`;
    this.fill.style.width = "100%";
    if (this.hideTimer != null) window.clearTimeout(this.hideTimer);
    this.hideTimer = window.setTimeout(() => this.root.classList.add("hidden"), durationMs + 80);
  }

  hide(): void {
    if (this.hideTimer != null) window.clearTimeout(this.hideTimer);
    this.root.classList.add("hidden");
  }
}
