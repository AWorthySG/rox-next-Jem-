import * as THREE from "three";
import { getPet } from "@rox/shared";
import { buildPoring } from "../procedural/poringMesh.js";
import { makePoringTexture, makeSpark } from "../procedural/textures.js";

// A small cosmetic pet that trails the local player when one is summoned. It
// hops with a jelly squash, turns to face where it's going, and occasionally
// lets off a little affection sparkle above its head.
export class PetCompanion {
  private group = new THREE.Group();
  private petId: string | null = null;
  private phase = 0;
  private tex = makePoringTexture();
  private scratch = new THREE.Vector3();
  private body: THREE.Object3D | null = null;
  private sparkle: THREE.Sprite;
  private sparkleIn = 3 + Math.random() * 4; // seconds until the next sparkle
  private sparkleT = 0; // remaining sparkle time
  private prevX = 0;
  private prevZ = 0;

  constructor(private scene: THREE.Scene) {
    this.group.visible = false;
    this.scene.add(this.group);
    this.sparkle = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: makeSpark(), color: 0xffc0d8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.sparkle.position.y = 0.9;
    this.group.add(this.sparkle);
  }

  setPet(petId: string | null): void {
    if (petId === this.petId) return;
    this.petId = petId;
    this.group.clear();
    this.group.add(this.sparkle);
    this.body = null;
    if (!petId) {
      this.group.visible = false;
      return;
    }
    const def = getPet(petId);
    const poring = buildPoring(this.tex);
    poring.group.scale.setScalar(0.5);
    if (def) (poring.body.material as THREE.MeshLambertMaterial).color.setHex(def.tint);
    this.body = poring.body;
    this.group.add(poring.group);
    this.group.visible = true;
  }

  update(selfPos: THREE.Vector3 | null, dt: number): void {
    if (!this.petId || !selfPos) return;
    this.phase += dt * 4;
    // trail slightly behind-left of the player with a gentle bob (framerate-
    // independent easing, reused scratch vector)
    this.scratch.set(selfPos.x - 1.3, 0, selfPos.z - 1.3);
    this.group.position.lerp(this.scratch, 1 - Math.exp(-4 * dt));
    this.group.position.y = Math.abs(Math.sin(this.phase)) * 0.15;

    // jelly hop squash + face the direction of travel
    if (this.body) {
      const squash = 0.82 + Math.sin(this.phase) * 0.1;
      this.body.scale.y = squash;
    }
    const dx = this.group.position.x - this.prevX;
    const dz = this.group.position.z - this.prevZ;
    if (Math.hypot(dx, dz) > 0.005) this.group.rotation.y = Math.atan2(dx, dz);
    this.prevX = this.group.position.x;
    this.prevZ = this.group.position.z;

    // affection sparkle: a soft pink twinkle pops above its head every few seconds
    this.sparkleIn -= dt;
    if (this.sparkleIn <= 0) {
      this.sparkleIn = 3 + Math.random() * 4;
      this.sparkleT = 0.6;
    }
    const mat = this.sparkle.material as THREE.SpriteMaterial;
    if (this.sparkleT > 0) {
      this.sparkleT -= dt;
      const t = 1 - this.sparkleT / 0.6;
      mat.opacity = Math.sin(t * Math.PI) * 0.9;
      this.sparkle.scale.setScalar(0.25 + t * 0.25);
      this.sparkle.position.y = 0.85 + t * 0.3;
    } else {
      mat.opacity = 0;
    }
  }
}
