import type { EntityFull } from "@rox/shared";
import { isMagicJob, jobFamilyOf, MOUNT_SPEED_MULT, PLAYER_SPEED } from "@rox/shared";
import * as THREE from "three";
import { applyHeadgear, buildCharacter, type CharacterMesh, type WeaponStyle } from "../procedural/characterMesh.js";
import { EntityView } from "./EntityView.js";
import { ModelRig } from "./ModelRig.js";

// A player avatar. The local player ("self") is client-predicted; remote players
// are interpolated from snapshots like any other entity.
export class PlayerView extends EntityView {
  private char: CharacterMesh;
  private walkPhase = 0;
  private speedMul = 1;
  private mount: THREE.Mesh | null = null;
  private bodyBaseY = 0;
  private headgearId: string | null = null;
  private swingT = 0; // attack-swing animation timer (1→0)
  private flinchT = 0; // hit-reaction timer (1→0)
  private rig: ModelRig;
  private buffAura: THREE.Mesh | null = null;
  private auraPhase = 0;

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
    const magic = entity.job ? isMagicJob(entity.job) : false;
    const fam = entity.job ? jobFamilyOf(entity.job) : null;
    const weapon: WeaponStyle = fam === "mage" ? "staff" : fam === "archer" ? "bow" : fam === "acolyte" ? "mace" : "blade";
    this.char = buildCharacter(entity.colorSeed ?? 0, magic, weapon);
    this.char.group.userData.entityId = entity.id;
    applyHeadgear(this.char, entity.headgear);
    this.headgearId = entity.headgear ?? null;
    this.group.add(this.char.group);

    this.serverX = entity.x;
    this.serverZ = entity.z;
    this.serverFacing = entity.facing;
    this.px = entity.x;
    this.pz = entity.z;
    this.pfacing = entity.facing;

    // Optional mid-poly avatar by job: char_<job>.glb (e.g. char_swordsman.glb).
    this.rig = new ModelRig(this.group, entity.id);
    void this.rig.tryLoad(`char_${entity.job ?? "novice"}`, undefined, 1, () => {
      this.char.group.visible = false; // keep refs (cape/headgear) but hide the primitive
    }).then((swapped) => {
      if (swapped) this.modelBacked = true;
    });
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

  // Toggle the Peco Peco mount: a faster move speed + a simple steed under the rider.
  setMounted(mounted: boolean): void {
    this.speedMul = mounted ? MOUNT_SPEED_MULT : 1;
    if (mounted && !this.mount) {
      this.mount = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.45, 0.9, 6, 10),
        new THREE.MeshLambertMaterial({ color: 0xf4c542 }),
      );
      this.mount.rotation.z = Math.PI / 2;
      this.mount.position.y = 0.5;
      this.char.group.add(this.mount);
      this.bodyBaseY = 0.7; // sit the rider up
    } else if (!mounted && this.mount) {
      this.char.group.remove(this.mount);
      this.mount = null;
      this.bodyBaseY = 0;
    }
  }

  clearMoveTarget(): void {
    this.predTarget = null;
  }

  // Trigger an attack: the model's attack clip, else a procedural weapon swing.
  swing(): void {
    if (!this.rig.playOneShot("attack")) this.swingT = 1;
  }

  // Trigger a hit reaction: the model's hit clip, else a procedural recoil.
  flinch(): void {
    if (!this.rig.playOneShot("hit")) this.flinchT = 1;
  }

  // Show/hide a soft golden ground aura while the player has active buffs.
  setBuffed(active: boolean): void {
    if (active && !this.buffAura) {
      this.buffAura = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.78, 36),
        new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
      );
      this.buffAura.rotation.x = -Math.PI / 2;
      this.buffAura.position.y = 0.05;
      this.group.add(this.buffAura);
    } else if (!active && this.buffAura) {
      this.group.remove(this.buffAura);
      (this.buffAura.material as THREE.Material).dispose();
      this.buffAura.geometry.dispose();
      this.buffAura = null;
    }
  }

  // Swap the worn hat live (e.g. when the local player equips/unequips headgear).
  setHeadgear(id: string | null): void {
    if (id === this.headgearId) return;
    this.headgearId = id;
    applyHeadgear(this.char, id);
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

  override update(renderTime: number, dt: number, camPos?: THREE.Vector3): void {
    if (!this.isSelf) {
      super.update(renderTime, dt, camPos);
      return;
    }
    // ---- local prediction for the controlled player ---- (self is always near
    // the camera, so it stays full-detail — no LOD gating)
    if (this.predTarget) {
      // Advance toward the click target at the authoritative speed. We trust the
      // prediction and let the server simply trail by ~latency — no constant pull
      // toward the late snapshot, which is what caused end-of-move rubber-banding.
      const dx = this.predTarget.x - this.px;
      const dz = this.predTarget.z - this.pz;
      const dist = Math.hypot(dx, dz);
      const step = PLAYER_SPEED * this.speedMul * dt;
      if (dist <= step || dist < 0.05) {
        this.px = this.predTarget.x;
        this.pz = this.predTarget.z;
        this.predTarget = null;
      } else {
        this.pfacing = Math.atan2(dx, dz);
        this.px += (dx / dist) * step;
        this.pz += (dz / dist) * step;
      }
    } else {
      // No local order: ease toward server truth (idle, knockback, attack-chase),
      // framerate-independent so it feels identical at any refresh rate.
      const a = 1 - Math.exp(-12 * dt);
      this.px += (this.serverX - this.px) * a;
      this.pz += (this.serverZ - this.pz) * a;
      this.pfacing = this.serverFacing;
    }

    // Reconcile only on a genuine mis-prediction (a blocked/clamped move, a
    // knockback, or a teleport/respawn). During normal predicted movement the
    // discrepancy is just ~latency, so we leave prediction untouched.
    const ex = this.serverX - this.px;
    const ez = this.serverZ - this.pz;
    const err2 = ex * ex + ez * ez;
    if (err2 > HARD_SNAP * HARD_SNAP) {
      // teleport / respawn / large desync: snap and drop any stale order
      this.px = this.serverX;
      this.pz = this.serverZ;
      this.predTarget = null;
    } else if (err2 > SOFT_RECONCILE * SOFT_RECONCILE) {
      const a = 1 - Math.exp(-10 * dt);
      this.px += ex * a;
      this.pz += ez * a;
    }

    this.detectMovement(this.px, this.pz);
    this.group.position.x = this.px;
    this.group.position.z = this.pz;
    // smooth (shortest-path) turn toward the intended facing, framerate-independent
    this.group.rotation.y = lerpAngle(this.group.rotation.y, this.pfacing, 1 - Math.exp(-12 * dt));
    this.animate(dt);
  }

  protected override animate(dt: number): void {
    if (this.buffAura) {
      this.auraPhase += dt;
      this.buffAura.rotation.z += dt * 1.5;
      const t = Math.sin(this.auraPhase * 2.2) * 0.5 + 0.5;
      (this.buffAura.material as THREE.MeshBasicMaterial).opacity = 0.35 + t * 0.28;
      this.buffAura.scale.setScalar(1 + t * 0.08);
    }
    if (this.modelBacked) {
      // the loaded model drives its own idle/walk + attack/hit clips
      this.rig.setMoving(this.moving);
      this.rig.update(dt);
      return;
    }
    // cape: flow back while moving, gentle drift at rest (framerate-independent)
    if (this.char.cape) {
      const target = this.moving ? 0.6 + Math.sin(this.walkPhase * 2) * 0.08 : 0.08 + Math.sin(this.walkPhase) * 0.05;
      this.char.cape.rotation.x += (target - this.char.cape.rotation.x) * (1 - Math.pow(0.78, dt * 60));
    }
    if (this.moving) {
      this.walkPhase += dt * 10;
      const swing = Math.sin(this.walkPhase) * 0.6;
      this.char.leftArm.rotation.x = swing;
      this.char.rightArm.rotation.x = -swing;
      this.char.leftLeg.rotation.x = -swing;
      this.char.rightLeg.rotation.x = swing;
      this.char.group.position.y = this.bodyBaseY + Math.abs(Math.sin(this.walkPhase)) * 0.06;
    } else {
      // idle: gentle breathing + ease limbs to rest (framerate-independent decay
      // — Math.pow(k, dt*60) reproduces the old per-frame "*= k" feel at any fps)
      this.walkPhase += dt * 2;
      const settle = Math.pow(0.8, dt * 60);
      for (const limb of [this.char.leftArm, this.char.rightArm, this.char.leftLeg, this.char.rightLeg]) {
        limb.rotation.x *= settle;
      }
      const breathe = Math.sin(this.walkPhase) * 0.015;
      this.char.group.position.y += (this.bodyBaseY + breathe - this.char.group.position.y) * (1 - Math.pow(0.8, dt * 60));
    }

    // attack swing: overhead chop of the weapon arm (overrides walk on that arm)
    if (this.swingT > 0) {
      this.swingT = Math.max(0, this.swingT - dt * 5);
      const t = this.swingT;
      this.char.rightArm.rotation.x = -Math.sin(t * Math.PI) * 2.2 - (1 - t) * 0.2;
      this.char.group.rotation.z = Math.sin(t * Math.PI) * 0.06;
    } else {
      this.char.group.rotation.z *= Math.pow(0.7, dt * 60);
    }

    // hit reaction: brief backward lean + jitter
    if (this.flinchT > 0) {
      this.flinchT = Math.max(0, this.flinchT - dt * 4);
      this.char.group.rotation.x = -this.flinchT * 0.25;
    } else if (this.char.group.rotation.x !== 0) {
      this.char.group.rotation.x *= Math.pow(0.7, dt * 60);
    }
  }

  override dispose(scene: THREE.Scene): void {
    this.rig.dispose();
    super.dispose(scene);
  }
}

// Self-reconciliation thresholds (world units): below SOFT we fully trust local
// prediction; above SOFT we ease toward the server; above HARD we snap.
const SOFT_RECONCILE = 2.5;
const HARD_SNAP = 8;

// Interpolate an angle (radians) toward a target along the shortest arc.
function lerpAngle(from: number, to: number, t: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return from + d * t;
}
