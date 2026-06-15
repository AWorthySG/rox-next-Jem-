import * as THREE from "three";
import type { EntityFull } from "@rox/shared";
import { buildCharacter, type CharacterMesh } from "../procedural/characterMesh.js";
import { EntityView } from "./EntityView.js";
import { ModelRig } from "./ModelRig.js";

// A static town NPC. Renders a humanoid (or a npc_<role>.glb model if present)
// with a floating marker; clicking it (handled in main) opens the shop. No HP
// bar, no interpolation.
export class NpcView extends EntityView {
  readonly role: string;
  private bob = 0;
  private marker: THREE.Mesh;
  private char: CharacterMesh;
  private rig: ModelRig;

  constructor(entity: EntityFull) {
    super(entity, "nameplate npc", 2.6);
    this.role = entity.npcRole ?? "";
    this.char = buildCharacter(48, false);
    this.char.group.userData.entityId = entity.id;
    this.group.add(this.char.group);
    this.group.rotation.y = entity.facing;

    // hide the HP bar for NPCs
    const bar = this.hpFillEl.parentElement;
    if (bar) bar.style.display = "none";

    // floating golden marker above the head
    this.marker = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.18),
      new THREE.MeshBasicMaterial({ color: 0xffd24a }),
    );
    this.marker.position.set(0, 2.2, 0);
    this.marker.userData.entityId = entity.id;
    this.group.add(this.marker);

    // Optional mid-poly model by role: npc_<role>.glb.
    this.rig = new ModelRig(this.group, entity.id);
    void this.rig.tryLoad(`npc_${this.role}`, undefined, 1, () => {
      this.char.group.visible = false;
    }).then((swapped) => {
      if (swapped) this.modelBacked = true;
    });
  }

  protected override animate(dt: number): void {
    this.bob += dt * 2;
    this.marker.position.y = 2.2 + Math.sin(this.bob) * 0.12;
    this.marker.rotation.y += dt * 1.5;
    if (this.modelBacked) this.rig.update(dt); // NPCs are stationary → idle loop
  }

  override dispose(scene: THREE.Scene): void {
    this.rig.dispose();
    super.dispose(scene);
  }
}
