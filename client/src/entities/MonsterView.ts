import * as THREE from "three";
import type { EntityFull } from "@rox/shared";
import { buildPoring, type PoringMesh } from "../procedural/poringMesh.js";
import { EntityView } from "./EntityView.js";

// A Poring view: textured jelly body with an idle squash-and-bob animation, and
// a small pop effect on death.
export class MonsterView extends EntityView {
  private poring: PoringMesh;
  private phase = Math.random() * Math.PI * 2;

  constructor(entity: EntityFull, faceTexture: THREE.Texture) {
    super(entity, "nameplate monster", 1.7);
    this.poring = buildPoring(faceTexture);
    // Tag every child so raycast picking resolves to this entity.
    this.poring.group.traverse((o) => (o.userData.entityId = entity.id));
    this.group.add(this.poring.group);
  }

  // Pickable meshes for the raycaster.
  get pickables(): THREE.Object3D {
    return this.poring.group;
  }

  protected override animate(dt: number): void {
    this.phase += dt * (this.moving ? 9 : 3);
    const squash = 0.82 + Math.sin(this.phase) * (this.moving ? 0.14 : 0.06);
    this.poring.body.scale.set(1, squash, 1);
    // little hop when moving
    this.poring.group.position.y = this.moving ? Math.abs(Math.sin(this.phase)) * 0.18 : 0;
  }
}
