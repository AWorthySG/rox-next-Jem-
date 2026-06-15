import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

interface FloatingNumber {
  obj: CSS2DObject;
  born: number;
  baseY: number;
}

// Floating combat text. Numbers spawn at the target's world position and rise +
// fade over a short lifetime. The div + CSS2DObject pairs are pooled and reused
// so heavy combat (AoE, world bosses) doesn't churn DOM nodes or trigger GC.
export class DamageNumbers {
  private active: FloatingNumber[] = [];
  private pool: FloatingNumber[] = [];
  private readonly life = 850; // ms

  constructor(private scene: THREE.Scene) {}

  spawn(
    pos: THREE.Vector3,
    text: string,
    variant: "" | "crit" | "miss" | "taken" | "heal",
    elementMult = 1,
  ): void {
    const f = this.pool.pop() ?? this.create();
    const el = f.obj.element as HTMLElement;
    const elem = elementMult > 1 ? " super" : elementMult < 1 ? " resist" : "";
    el.className = `dmg ${variant}${elem}`.trim();
    el.textContent = text;
    el.style.opacity = "1";
    const baseY = pos.y + 2;
    f.obj.position.set(pos.x + (Math.random() - 0.5) * 0.6, baseY, pos.z);
    f.baseY = baseY;
    f.born = performance.now();
    this.scene.add(f.obj);
    this.active.push(f);
  }

  update(): void {
    const now = performance.now();
    for (let i = this.active.length - 1; i >= 0; i--) {
      const f = this.active[i];
      const age = now - f.born;
      const t = age / this.life;
      if (t >= 1) {
        this.scene.remove(f.obj);
        this.active.splice(i, 1);
        this.pool.push(f); // recycle the div + CSS2DObject
        continue;
      }
      f.obj.position.y = f.baseY + t * 1.6;
      (f.obj.element as HTMLElement).style.opacity = `${1 - t}`;
    }
  }

  private create(): FloatingNumber {
    const el = document.createElement("div");
    const obj = new CSS2DObject(el);
    return { obj, born: 0, baseY: 0 };
  }
}
