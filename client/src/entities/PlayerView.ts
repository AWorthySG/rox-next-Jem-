import type { EntityFull } from "@rox/shared";
import { JobId, PLAYER_SPEED } from "@rox/shared";
import { buildCharacter, type CharacterMesh } from "../procedural/characterMesh.js";
import { EntityView } from "./EntityView.js";

// A player avatar. The local player ("self") is client-predicted; remote players
// are interpolated from snapshots like any other entity.
export class PlayerView extends EntityView {
  private char: CharacterMesh;
  private walkPhase = 0;

  isSelf = false;
  // server-authoritative position (used for self correction / remote idle)
  private serverX: number;
  private serverZ: number;
  private serverFacing: number;
  // local predicted position for self
  private px: number;
  private pz: number;
  private pfacing: number;
  private predTarget: { x: number; z: number } | null = null;

  constructor(entity: EntityFull) {
    super(entity, "nameplate player", 2.5);
    this.nameplateEl.classList.add("player");
    const magic = entity.job === JobId.Mage;
    this.char = buildCharacter(entity.colorSeed ?? 0, magic);
    this.char.group.userData.entityId = entity.id;
    this.group.add(this.char.group);

    this.serverX = entity.x;
    this.serverZ = entity.z;
    this.serverFacing = entity.facing;
    this.px = entity.x;
    this.pz = entity.z;
    this.pfacing = entity.facing;
  }

  override pushSnapshot(x: number, z: number, facing: number, hp: number, clientTime: number): void {
    this.serverX = x;
    this.serverZ = z;
    this.serverFacing = facing;
    super.pushSnapshot(x, z, facing, hp, clientTime);
  }

  setMoveTarget(x: number, z: number): void {
    this.predTarget = { x, z };
  }

  clearMoveTarget(): void {
    this.predTarget = null;
  }

  // Hard-reset position (used on map change so the avatar doesn't lerp across maps).
  teleport(x: number, z: number): void {
    this.px = x;
    this.pz = z;
    this.serverX = x;
    this.serverZ = z;
    this.predTarget = null;
    this.group.position.set(x, 0, z);
  }

  override update(renderTime: number, dt: number): void {
    if (!this.isSelf) {
      super.update(renderTime, dt);
      return;
    }
    // ---- local prediction for the controlled player ----
    if (this.predTarget) {
      const dx = this.predTarget.x - this.px;
      const dz = this.predTarget.z - this.pz;
      const dist = Math.hypot(dx, dz);
      const step = PLAYER_SPEED * dt;
      if (dist <= step || dist < 0.05) {
        this.px = this.predTarget.x;
        this.pz = this.predTarget.z;
        this.predTarget = null;
      } else {
        this.pfacing = Math.atan2(dx, dz);
        this.px += (dx / dist) * step;
        this.pz += (dz / dist) * step;
      }
      // gentle correction toward server truth
      this.px += (this.serverX - this.px) * 0.03;
      this.pz += (this.serverZ - this.pz) * 0.03;
    } else {
      // No local order: follow the server (idle, knockback, attack-chase).
      const k = Math.min(1, dt * 10);
      this.px += (this.serverX - this.px) * k;
      this.pz += (this.serverZ - this.pz) * k;
      this.pfacing = this.serverFacing;
    }

    this.detectMovement(this.px, this.pz);
    this.group.position.x = this.px;
    this.group.position.z = this.pz;
    this.group.rotation.y = this.pfacing;
    this.animate(dt);
  }

  protected override animate(dt: number): void {
    if (this.moving) {
      this.walkPhase += dt * 10;
      const swing = Math.sin(this.walkPhase) * 0.6;
      this.char.leftArm.rotation.x = swing;
      this.char.rightArm.rotation.x = -swing;
      this.char.leftLeg.rotation.x = -swing;
      this.char.rightLeg.rotation.x = swing;
      this.char.group.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.06;
    } else {
      // ease limbs back to rest
      for (const limb of [this.char.leftArm, this.char.rightArm, this.char.leftLeg, this.char.rightLeg]) {
        limb.rotation.x *= 0.8;
      }
      this.char.group.position.y *= 0.8;
    }
  }
}
