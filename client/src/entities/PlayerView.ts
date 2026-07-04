import type { EntityFull } from "@rox/shared";
import { getCostume, getMount, isMagicJob, jobFamilyOf, jobTierOf, PLAYER_SPEED } from "@rox/shared";
import * as THREE from "three";
import { applyCostume, applyHeadgear, buildCharacter, setEyeBlink, type CharacterMesh, type WeaponStyle } from "../procedural/characterMesh.js";
import { makeSpark } from "../procedural/textures.js";
import { EntityView } from "./EntityView.js";
import { ModelRig } from "./ModelRig.js";

// Shared across every PlayerView so the texture is generated once, not per avatar.
let dustTexture: THREE.Texture | null = null;
function getDustTexture(): THREE.Texture {
  if (!dustTexture) dustTexture = makeSpark();
  return dustTexture;
}

// A player avatar. The local player ("self") is client-predicted; remote players
// are interpolated from snapshots like any other entity.
export class PlayerView extends EntityView {
  private char: CharacterMesh;
  private walkPhase = 0;
  private speedMul = 1;
  private mount: THREE.Object3D | null = null;
  private mountId: string | null = null;
  private costumeId: string | null = null;
  private bodyBaseY = 0;
  private headgearId: string | null = null;
  private swingT = 0; // attack-swing animation timer (1→0)
  private flinchT = 0; // hit-reaction timer (1→0)
  private rig: ModelRig;
  private buffAura: THREE.Mesh | null = null;
  private auraPhase = 0;
  private blinkIn = 1.5 + Math.random() * 3; // seconds until the next blink
  private blinkT = 0; // remaining blink duration
  private glintIn = 3 + Math.random() * 5; // seconds until the next weapon glint
  private glintT = 0; // remaining glint sweep time
  private dustPuffs: { sprite: THREE.Sprite; t: number }[] = []; // pool, recycled while walking
  private dustEmitIn = 0; // seconds until the next puff spawns

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
    super(entity, "nameplate player", 2.15);
    this.nameplateEl.classList.add("player");
    const magic = entity.job ? isMagicJob(entity.job) : false;
    const fam = entity.job ? jobFamilyOf(entity.job) : null;
    const weapon: WeaponStyle =
      fam === "mage" ? "staff" : fam === "archer" ? "bow" : fam === "acolyte" || fam === "merchant" ? "mace" : "blade";
    this.char = buildCharacter(entity.colorSeed ?? 0, magic, weapon, entity.job ? jobTierOf(entity.job) : 0);
    this.char.group.userData.entityId = entity.id;
    applyHeadgear(this.char, entity.headgear);
    this.headgearId = entity.headgear ?? null;
    if (entity.mountId) this.setMount(entity.mountId);
    if (entity.costumeId) this.setCostume(entity.costumeId);
    this.group.add(this.char.group);

    this.serverX = entity.x;
    this.serverZ = entity.z;
    this.serverFacing = entity.facing;
    this.px = entity.x;
    this.pz = entity.z;
    this.pfacing = entity.facing;

    // Guild members wear a small crest on the back, tinted from the guild name
    // so guildmates share a colour (readable in a crowd, like ROX guild capes).
    if (entity.guildName) {
      let h = 0;
      for (let i = 0; i < entity.guildName.length; i++) h = (h * 31 + entity.guildName.charCodeAt(i)) >>> 0;
      const crestColor = new THREE.Color().setHSL((h % 360) / 360, 0.6, 0.5);
      const crest = new THREE.Mesh(
        new THREE.CircleGeometry(0.13, 12),
        new THREE.MeshToonMaterial({ color: crestColor }),
      );
      crest.position.set(0, 0.72, -0.27);
      crest.rotation.y = Math.PI;
      this.char.group.add(crest);
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(0.13, 0.02, 6, 16),
        new THREE.MeshBasicMaterial({ color: 0xf0c25a }),
      );
      rim.position.copy(crest.position);
      this.char.group.add(rim);
    }

    // footstep dust: a small pool of puffs recycled while walking, rising and
    // fading (see animate())
    const dustMat = new THREE.SpriteMaterial({ map: getDustTexture(), color: 0xc8b898, transparent: true, opacity: 0, depthWrite: false });
    for (let i = 0; i < 3; i++) {
      const sprite = new THREE.Sprite(dustMat.clone());
      sprite.scale.setScalar(0.01);
      sprite.position.y = 0.05;
      this.group.add(sprite);
      this.dustPuffs.push({ sprite, t: 1 });
    }

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

  // Summon/dismiss a ridden mount by id (see mounts.ts). Each mount id gets its
  // own distinct silhouette; switching mounts swaps the model directly.
  setMount(mountId: string | null): void {
    if (mountId === this.mountId) return;
    this.mountId = mountId;
    this.speedMul = getMount(mountId)?.speedMult ?? 1;
    if (this.mount) {
      this.char.group.remove(this.mount);
      this.mount = null;
    }
    if (!mountId) {
      this.bodyBaseY = 0;
      return;
    }
    const tint = getMount(mountId)?.tint ?? 0xf4c542;
    const built =
      mountId === "dune_wolf" ? this.buildDuneWolfMount(tint)
      : mountId === "baby_dragon" ? this.buildBabyDragonMount(tint)
      : this.buildPecoMount(tint, mountId === "grand_peco" ? 1.25 : 1);
    built.mesh.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    this.mount = built.mesh;
    this.char.group.add(built.mesh);
    this.bodyBaseY = built.riderY;
  }

  // A Peco Peco (or its bigger "Grand" variant, via `scale`): round body,
  // craning neck, beak, folded wings, tail feathers and stubby legs.
  private buildPecoMount(tint: number, scale: number): { mesh: THREE.Object3D; riderY: number } {
    const bird = new THREE.Group();
    const feather = new THREE.MeshLambertMaterial({ color: tint });
    const featherDark = new THREE.MeshLambertMaterial({ color: new THREE.Color(tint).multiplyScalar(0.82) });
    const orange = new THREE.MeshLambertMaterial({ color: 0xe07a2a });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 12), feather);
    body.position.y = 0.55;
    body.scale.set(0.9, 0.85, 1.15);
    bird.add(body);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.5, 8), feather);
    neck.position.set(0, 0.95, 0.42);
    neck.rotation.x = 0.35;
    bird.add(neck);
    const headM = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), feather);
    headM.position.set(0, 1.2, 0.55);
    bird.add(headM);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 8), orange);
    beak.position.set(0, 1.18, 0.82);
    beak.rotation.x = Math.PI / 2;
    bird.add(beak);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), new THREE.MeshBasicMaterial({ color: 0x241c2c }));
      eye.position.set(s * 0.13, 1.26, 0.68);
      bird.add(eye);
      const wing = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), featherDark);
      wing.position.set(s * 0.42, 0.6, -0.05);
      wing.scale.set(0.35, 0.6, 0.95);
      bird.add(wing);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.5, 6), orange);
      leg.position.set(s * 0.2, 0.2, 0.05);
      bird.add(leg);
    }
    for (let i = -1; i <= 1; i++) {
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.5, 6), featherDark);
      tail.position.set(i * 0.14, 0.72, -0.62);
      tail.rotation.x = -2.2;
      tail.rotation.z = i * 0.2;
      bird.add(tail);
    }
    bird.scale.setScalar(scale);
    return { mesh: bird, riderY: 0.7 * scale };
  }

  // A Dune Wolf: a low, lean quadruped with pricked ears and a bushy tail.
  private buildDuneWolfMount(tint: number): { mesh: THREE.Object3D; riderY: number } {
    const wolf = new THREE.Group();
    const fur = new THREE.MeshLambertMaterial({ color: tint });
    const furDark = new THREE.MeshLambertMaterial({ color: new THREE.Color(tint).multiplyScalar(0.7) });

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.7, 4, 8), fur);
    torso.rotation.z = Math.PI / 2;
    torso.position.y = 0.42;
    wolf.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), fur);
    head.position.set(0, 0.56, 0.55);
    wolf.add(head);
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.32, 8), furDark);
    snout.position.set(0, 0.5, 0.78);
    snout.rotation.x = Math.PI / 2;
    wolf.add(snout);
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 6), furDark);
      ear.position.set(s * 0.11, 0.72, 0.5);
      wolf.add(ear);
      const legF = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.42, 6), fur);
      legF.position.set(s * 0.18, 0.21, 0.3);
      wolf.add(legF);
      const legB = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.42, 6), fur);
      legB.position.set(s * 0.18, 0.21, -0.32);
      wolf.add(legB);
    }
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.55, 8), furDark);
    tail.position.set(0, 0.5, -0.58);
    tail.rotation.x = -2.0;
    wolf.add(tail);
    return { mesh: wolf, riderY: 0.62 };
  }

  // A Baby Dragon: a small winged reptile hatchling, wings spread for lift.
  private buildBabyDragonMount(tint: number): { mesh: THREE.Object3D; riderY: number } {
    const dragon = new THREE.Group();
    const scale = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.5, metalness: 0.2 });
    const scaleDark = new THREE.MeshStandardMaterial({ color: new THREE.Color(tint).multiplyScalar(0.6), roughness: 0.5 });
    const wingMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(tint).multiplyScalar(0.8), roughness: 0.4, side: THREE.DoubleSide });

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.5, 4, 8), scale);
    torso.rotation.z = Math.PI / 2;
    torso.position.y = 0.5;
    dragon.add(torso);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.4, 8), scale);
    head.rotation.z = -Math.PI / 2;
    head.position.set(0, 0.58, 0.55);
    dragon.add(head);
    for (const s of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.14, 5), scaleDark);
      horn.position.set(s * 0.08, 0.74, 0.48);
      dragon.add(horn);
      const wing = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.14, 3), wingMat);
      wing.position.set(s * 0.32, 0.75, -0.05);
      wing.rotation.z = s * 1.1;
      wing.rotation.y = 0.3;
      dragon.add(wing);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.36, 6), scale);
      leg.position.set(s * 0.16, 0.2, 0.1);
      dragon.add(leg);
    }
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.7, 8), scaleDark);
    tail.position.set(0, 0.48, -0.62);
    tail.rotation.x = -1.9;
    dragon.add(tail);
    return { mesh: dragon, riderY: 0.66 };
  }

  // Wear/remove a purely cosmetic outfit by id (see costumes.ts). Recolors the
  // shared outfit/accent/hair materials in place; never touches stats or gear.
  setCostume(costumeId: string | null): void {
    if (costumeId === this.costumeId) return;
    this.costumeId = costumeId;
    applyCostume(this.char, getCostume(costumeId));
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
    this.updateDustPuffs(dt);
    if (this.modelBacked) {
      // the loaded model drives its own idle/walk + attack/hit clips
      this.rig.setMoving(this.moving);
      this.rig.update(dt);
      return;
    }
    // anime blink: eyes squash shut for a beat every few seconds
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) {
      this.blinkIn = 1.5 + Math.random() * 3.5;
      this.blinkT = 0.13;
    }
    if (this.blinkT > 0) {
      this.blinkT -= dt;
      setEyeBlink(this.char, this.blinkT > 0 ? 0.08 : 1);
    }
    // weapon glint: a spark sweeps base→tip every few seconds
    this.glintIn -= dt;
    if (this.glintIn <= 0) {
      this.glintIn = 3 + Math.random() * 5;
      this.glintT = 0.45;
    }
    const wg = this.char.weaponGlint;
    if (this.glintT > 0) {
      this.glintT -= dt;
      const t = 1 - Math.max(0, this.glintT) / 0.45;
      wg.sprite.position.set(wg.x, wg.y0 + (wg.y1 - wg.y0) * t, wg.z);
      (wg.sprite.material as THREE.SpriteMaterial).opacity = Math.sin(t * Math.PI) * 0.9;
    } else {
      (wg.sprite.material as THREE.SpriteMaterial).opacity = 0;
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

  // Footstep dust: spawns a puff at roughly footstep cadence while walking,
  // then lets any already-spawned puffs finish rising and fading regardless
  // of whether the character is still moving. Works for both the procedural
  // chibi and any loaded model, since it only touches the shared group.
  private updateDustPuffs(dt: number): void {
    if (this.moving) {
      this.dustEmitIn -= dt;
      if (this.dustEmitIn <= 0) {
        this.dustEmitIn = 0.22;
        const free = this.dustPuffs.find((p) => p.t >= 1);
        if (free) {
          free.t = 0;
          free.sprite.position.set((Math.random() - 0.5) * 0.2, 0.04, (Math.random() - 0.5) * 0.2);
        }
      }
    }
    for (const p of this.dustPuffs) {
      if (p.t >= 1) continue;
      p.t = Math.min(1, p.t + dt / 0.5);
      p.sprite.position.y = 0.04 + p.t * 0.3;
      p.sprite.scale.setScalar(0.14 + p.t * 0.3);
      (p.sprite.material as THREE.SpriteMaterial).opacity = (1 - p.t) * 0.4;
    }
  }

  override dispose(scene: THREE.Scene): void {
    for (const p of this.dustPuffs) (p.sprite.material as THREE.Material).dispose();
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
