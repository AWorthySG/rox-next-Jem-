// Anime-style radial speed lines at the screen edges, shown while the player is
// mounted and moving — pure CSS, toggled on/off.
export class SpeedLines {
  private el: HTMLDivElement;
  private active = false;

  constructor(root: HTMLElement) {
    this.el = document.createElement("div");
    this.el.id = "speed-lines";
    root.appendChild(this.el);
  }

  setActive(on: boolean): void {
    if (on === this.active) return;
    this.active = on;
    this.el.classList.toggle("active", on);
  }
}
