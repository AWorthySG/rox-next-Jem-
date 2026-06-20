import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

interface FloatingNumber {
  obj: CSS2DObject;
  span: HTMLElement; // inner element we scale (CSS2DRenderer owns the outer transform)
  born: number;
  baseX: number;
  baseY: number;
  vx: number;
  pop: number; // crit/heal get a bigger punch
}

// Floating combat text. Numbers spawn at the target's world position and rise +
// fade with a quick pop-in and a slight arc, so hits feel punchy. The div pairs
// are pooled and reused so heavy combat (AoE, world bosses) doesn't churn DOM.
export class DamageNumbers {
  private active: FloatingNumber[] = [];
  private pool: FloatingNumber[] = [];
  private recent: { x: number; z: number; t: number }[] = []; // stacking rapid hits
  private readonly life = 900; // ms

  constructor(private scene: THREE.Scene) {}

  spawn(
    pos: THREE.Vector3,
    text: string,
    variant: "" | "crit" | "miss" | "taken" | "heal" | "levelup",
    elementMult = 1,
  ): void {
    const now = performance.now();
    // stagger numbers landing on the same spot in quick succession so they don't overlap
    this.recent = this.recent.filter((r) => now - r.t < 360);
    const stack = this.recent.filter((r) => Math.hypot(r.x - pos.x, r.z - pos.z) < 1.6).length;
    this.recent.push({ x: pos.x, z: pos.z, t: now });

    const f = this.pool.pop() ?? this.create();
    const el = f.obj.element as HTMLElement;
    const elem = elementMult > 1 ? " super" : elementMult < 1 ? " resist" : "";
    el.className = `dmg ${variant}${elem}`.trim();
    f.span.textContent = text;
    el.style.opacity = "1";
    const baseY = pos.y + 2 + Math.min(stack, 5) * 0.5;
    f.baseX = pos.x + (Math.random() - 0.5) * 0.6;
    f.baseY = baseY;
    f.vx = (Math.random() - 0.5) * 1.1; // gentle sideways drift
    f.pop = variant === "levelup" ? 1.8 : variant === "crit" ? 1.7 : variant === "heal" ? 1.3 : 1.0;
    f.obj.position.set(f.baseX, baseY, pos.z);
    f.born = now;
    this.scene.add(f.obj);
    this.active.push(f);
  }

  update(): void {
    const now = performance.now();
    for (let i = this.active.length - 1; i >= 0; i--) {
      const f = this.active[i];
      const t = (now - f.born) / this.life;
      if (t >= 1) {
        this.scene.remove(f.obj);
        this.active.splice(i, 1);
        this.pool.push(f); // recycle the div + CSS2DObject
        continue;
      }
      // ease-out rise + slight horizontal arc
      const rise = 1 - (1 - t) * (1 - t);
      f.obj.position.y = f.baseY + rise * 1.9;
      f.obj.position.x = f.baseX + f.vx * t;
      // pop-in: overshoot the scale at spawn, then settle to 1×
      const sc = f.pop * (1 + 0.7 * Math.exp(-t * 15));
      f.span.style.transform = `scale(${sc.toFixed(3)})`;
      // hold full opacity, then fade over the last 40%
      (f.obj.element as HTMLElement).style.opacity = t < 0.6 ? "1" : `${1 - (t - 0.6) / 0.4}`;
    }
  }

  private create(): FloatingNumber {
    const el = document.createElement("div");
    const span = document.createElement("span");
    span.style.display = "inline-block";
    span.style.willChange = "transform";
    el.appendChild(span);
    const obj = new CSS2DObject(el);
    return { obj, span, born: 0, baseX: 0, baseY: 0, vx: 0, pop: 1 };
  }
}
