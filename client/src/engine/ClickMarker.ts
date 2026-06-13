import * as THREE from "three";

// A brief expanding ring shown where the player clicks to move (RO-style).
export class ClickMarker {
  private mesh: THREE.Mesh;
  private mat: THREE.MeshBasicMaterial;
  private t = 1; // animation progress (>=1 = idle/hidden)

  constructor(scene: THREE.Scene) {
    this.mat = new THREE.MeshBasicMaterial({ color: 0xffd970, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
    this.mesh = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.7, 24), this.mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 0.06;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  ping(x: number, z: number): void {
    this.mesh.position.set(x, 0.06, z);
    this.t = 0;
    this.mesh.visible = true;
  }

  update(dt: number): void {
    if (this.t >= 1) return;
    this.t = Math.min(1, this.t + dt * 2.5);
    const s = 0.6 + this.t * 1.6;
    this.mesh.scale.set(s, s, s);
    this.mat.opacity = 0.8 * (1 - this.t);
    if (this.t >= 1) this.mesh.visible = false;
  }
}
