import * as THREE from "three";
import { getHomun } from "@rox/shared";
import { buildPoring } from "../procedural/poringMesh.js";
import { makePoringTexture } from "../procedural/textures.js";

// The Alchemist line's homunculus familiar, rendered as a small companion that
// trails the local player on the right (the pet trails on the left). Purely
// visual — the server drives its combat actions.
export class HomunculusCompanion {
  private group = new THREE.Group();
  private homunId: string | null = null;
  private phase = Math.PI; // offset from the pet's bob
  private tex = makePoringTexture();
  private scratch = new THREE.Vector3();
  private body: THREE.Object3D | null = null;

  constructor(private scene: THREE.Scene) {
    this.group.visible = false;
    this.scene.add(this.group);
  }

  setHomunculus(id: string | null): void {
    if (id === this.homunId) return;
    this.homunId = id;
    this.group.clear();
    this.body = null;
    if (!id) {
      this.group.visible = false;
      return;
    }
    const def = getHomun(id);
    const poring = buildPoring(this.tex);
    poring.group.scale.setScalar(0.55);
    if (def) (poring.body.material as THREE.MeshLambertMaterial).color.setHex(def.tint);
    this.body = poring.body;
    this.group.add(poring.group);
    this.group.visible = true;
  }

  update(selfPos: THREE.Vector3 | null, dt: number): void {
    if (!this.homunId || !selfPos) return;
    this.phase += dt * 3.4;
    // hover to the right and slightly behind the player, with a gentle bob
    this.scratch.set(selfPos.x + 1.4, 0, selfPos.z - 1.2);
    this.group.position.lerp(this.scratch, 1 - Math.exp(-4 * dt));
    this.group.position.y = 0.35 + Math.sin(this.phase) * 0.18; // floats, doesn't hop
    if (this.body) this.body.scale.y = 0.9 + Math.sin(this.phase * 1.3) * 0.06;
  }
}
