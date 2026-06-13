import * as THREE from "three";
import type { EntityFull } from "@rox/shared";
import { buildCharacter } from "../procedural/characterMesh.js";
import { EntityView } from "./EntityView.js";

// A static town NPC. Renders a humanoid with a floating marker; clicking it
// (handled in main) opens the shop. No HP bar, no interpolation.
export class NpcView extends EntityView {
  readonly role: string;
  private bob = 0;
  private marker: THREE.Mesh;

  constructor(entity: EntityFull) {
    super(entity, "nameplate npc", 2.6);
    this.role = entity.npcRole ?? "";
    const char = buildCharacter(48, false);
    char.group.userData.entityId = entity.id;
    this.group.add(char.group);
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
  }

  protected override animate(dt: number): void {
    this.bob += dt * 2;
    this.marker.position.y = 2.2 + Math.sin(this.bob) * 0.12;
    this.marker.rotation.y += dt * 1.5;
  }
}
