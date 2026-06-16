import * as THREE from "three";

// A persistent reticle that sits under the currently-targeted monster: a
// rotating double-ring with a soft pulse, tinted red for hostiles. Driven each
// frame with the target's world position (or null to hide).
export class TargetReticle {
  private group = new THREE.Group();
  private outer: THREE.Mesh;
  private inner: THREE.Mesh;
  private phase = 0;

  constructor(scene: THREE.Scene) {
    const mk = (r0: number, r1: number, seg: number) =>
      new THREE.Mesh(
        new THREE.RingGeometry(r0, r1, seg),
        new THREE.MeshBasicMaterial({ color: 0xff5a5a, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
      );
    this.outer = mk(0.62, 0.78, 40);
    this.inner = mk(0.42, 0.5, 4); // a diamond/cardinal-tick inner ring
    this.outer.rotation.x = -Math.PI / 2;
    this.inner.rotation.x = -Math.PI / 2;
    this.group.add(this.outer, this.inner);
    this.group.position.y = 0.05;
    this.group.visible = false;
    scene.add(this.group);
  }

  update(pos: THREE.Vector3 | null, scale: number, dt: number): void {
    if (!pos) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    this.group.position.set(pos.x, 0.05, pos.z);
    this.phase += dt;
    const pulse = Math.sin(this.phase * 4) * 0.5 + 0.5;
    const s = scale * (1 + pulse * 0.06);
    this.group.scale.setScalar(s);
    this.outer.rotation.z += dt * 1.4;
    this.inner.rotation.z -= dt * 2.2;
    (this.outer.material as THREE.MeshBasicMaterial).opacity = 0.55 + pulse * 0.35;
    (this.inner.material as THREE.MeshBasicMaterial).opacity = 0.45 + pulse * 0.3;
  }
}
