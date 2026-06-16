// On-screen indicator that points toward whatever just hit the player, so an
// off-screen attacker is readable. A red chevron is parked at the screen edge in
// the bearing of the source (0 = top of screen) and fades out. Pooled DOM.
export class DamageDirection {
  private pool: HTMLElement[] = [];
  private active: { el: HTMLElement; born: number }[] = [];
  private readonly life = 1000;

  constructor(private root: HTMLElement) {}

  // angle: bearing in radians, 0 = top of screen, +clockwise (camera-relative).
  hit(angle: number): void {
    const el = this.pool.pop() ?? this.create();
    el.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
    el.style.opacity = "1";
    this.root.appendChild(el);
    this.active.push({ el, born: performance.now() });
  }

  update(): void {
    const now = performance.now();
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i];
      const t = (now - a.born) / this.life;
      if (t >= 1) {
        a.el.remove();
        this.active.splice(i, 1);
        this.pool.push(a.el);
        continue;
      }
      // hold briefly, then fade
      a.el.style.opacity = t < 0.4 ? "1" : `${1 - (t - 0.4) / 0.6}`;
    }
  }

  private create(): HTMLElement {
    const el = document.createElement("div");
    el.className = "dmg-dir";
    el.innerHTML = '<i></i>';
    return el;
  }
}
