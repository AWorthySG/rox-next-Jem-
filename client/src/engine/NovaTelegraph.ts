import * as THREE from "three";

interface Tele {
  group: THREE.Group;
  fill: THREE.Mesh;
  fillMat: THREE.MeshBasicMaterial;
  born: number;
  delayMs: number;
}

// Renders growing red warning circles for telegraphed boss AoEs, then a flash.
export class NovaTelegraph {
  private active: Tele[] = [];

  constructor(private scene: THREE.Scene) {}

  spawn(x: number, z: number, radius: number, delayMs: number): void {
    const group = new THREE.Group();
    group.position.set(x, 0.07, z);
    // static outline ring at the full radius
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff3a3a, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius - 0.25, radius, 40), ringMat);
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);
    // expanding inner fill that reaches the radius at impact
    const fillMat = new THREE.MeshBasicMaterial({ color: 0xff5a3a, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false });
    const fill = new THREE.Mesh(new THREE.CircleGeometry(radius, 40), fillMat);
    fill.rotation.x = -Math.PI / 2;
    fill.scale.setScalar(0.02);
    group.add(fill);
    this.scene.add(group);
    this.active.push({ group, fill, fillMat, born: performance.now(), delayMs });
  }

  update(): void {
    const now = performance.now();
    for (let i = this.active.length - 1; i >= 0; i--) {
      const t = this.active[i];
      const p = (now - t.born) / t.delayMs;
      if (p < 1) {
        t.fill.scale.setScalar(Math.max(0.02, p));
        t.fillMat.opacity = 0.2 + 0.2 * Math.abs(Math.sin(p * Math.PI * 4));
      } else if (p < 1.25) {
        // impact flash
        t.fill.scale.setScalar(1);
        t.fillMat.color.setHex(0xffffff);
        t.fillMat.opacity = 0.7 * (1 - (p - 1) / 0.25);
      } else {
        this.scene.remove(t.group);
        this.active.splice(i, 1);
      }
    }
  }
}
