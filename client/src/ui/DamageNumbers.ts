import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

interface FloatingNumber {
  obj: CSS2DObject;
  born: number;
  baseY: number;
}

// Floating combat text. Numbers spawn at the target's world position and rise +
// fade over a short lifetime.
export class DamageNumbers {
  private active: FloatingNumber[] = [];
  private readonly life = 850; // ms

  constructor(private scene: THREE.Scene) {}

  spawn(pos: THREE.Vector3, text: string, variant: "" | "crit" | "miss" | "taken" | "heal"): void {
    const el = document.createElement("div");
    el.className = `dmg ${variant}`.trim();
    el.textContent = text;
    const obj = new CSS2DObject(el);
    const baseY = pos.y + 2;
    obj.position.set(pos.x + (Math.random() - 0.5) * 0.6, baseY, pos.z);
    this.scene.add(obj);
    this.active.push({ obj, born: performance.now(), baseY });
  }

  update(): void {
    const now = performance.now();
    for (let i = this.active.length - 1; i >= 0; i--) {
      const f = this.active[i];
      const age = now - f.born;
      const t = age / this.life;
      if (t >= 1) {
        this.remove(f);
        this.active.splice(i, 1);
        continue;
      }
      f.obj.position.y = f.baseY + t * 1.6;
      (f.obj.element as HTMLElement).style.opacity = `${1 - t}`;
    }
  }

  private remove(f: FloatingNumber): void {
    const el = f.obj.element as HTMLElement;
    el.parentElement?.removeChild(el);
    this.scene.remove(f.obj);
  }
}
