import * as THREE from "three";
import { getPet } from "@rox/shared";
import { buildPoring } from "../procedural/poringMesh.js";
import { makePoringTexture } from "../procedural/textures.js";

// A small cosmetic pet that trails the local player when one is summoned.
export class PetCompanion {
  private group = new THREE.Group();
  private petId: string | null = null;
  private phase = 0;
  private tex = makePoringTexture();

  constructor(private scene: THREE.Scene) {
    this.group.visible = false;
    this.scene.add(this.group);
  }

  setPet(petId: string | null): void {
    if (petId === this.petId) return;
    this.petId = petId;
    this.group.clear();
    if (!petId) {
      this.group.visible = false;
      return;
    }
    const def = getPet(petId);
    const poring = buildPoring(this.tex);
    poring.group.scale.setScalar(0.5);
    if (def) (poring.body.material as THREE.MeshLambertMaterial).color.setHex(def.tint);
    this.group.add(poring.group);
    this.group.visible = true;
  }

  update(selfPos: THREE.Vector3 | null, dt: number): void {
    if (!this.petId || !selfPos) return;
    this.phase += dt * 4;
    // trail slightly behind-left of the player with a gentle bob
    const target = new THREE.Vector3(selfPos.x - 1.3, 0, selfPos.z - 1.3);
    this.group.position.lerp(target, Math.min(1, dt * 4));
    this.group.position.y = Math.abs(Math.sin(this.phase)) * 0.15;
  }
}
