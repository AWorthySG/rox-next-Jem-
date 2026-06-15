// Full-screen feedback overlays: a red edge-pulse when you take damage and a
// golden bloom when you level up. Cheap CSS animations, retriggered on demand.
export class ScreenFx {
  private dmg = document.getElementById("screen-damage")!;
  private lvl = document.getElementById("screen-levelup")!;
  private low = document.getElementById("screen-lowhp")!;
  private fade = document.getElementById("screen-fade")!;

  damage(): void {
    this.retrigger(this.dmg, "flash");
  }

  levelUp(): void {
    this.retrigger(this.lvl, "flash");
  }

  // Quick black-out → fade-in, masking the entity/theme pop on a map change.
  mapFade(): void {
    this.retrigger(this.fade, "flash");
  }

  // Persistent pulsing red edge while HP is critically low.
  setLowHp(active: boolean): void {
    this.low.classList.toggle("active", active);
  }

  private retrigger(el: HTMLElement, cls: string): void {
    el.classList.remove(cls);
    // force reflow so the animation restarts even on rapid repeats
    void el.offsetWidth;
    el.classList.add(cls);
  }
}
