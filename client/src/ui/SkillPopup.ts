// Big centered skill-name flash on cast, ROX-style ("Blitz Beat!!").
export class SkillPopup {
  private el = document.getElementById("skill-popup")!;
  private timer = 0;

  show(name: string): void {
    this.el.textContent = `${name}!!`;
    this.el.classList.remove("anim");
    // force reflow so the animation restarts
    void this.el.offsetWidth;
    this.el.classList.add("anim");
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.el.classList.remove("anim"), 900);
  }
}
