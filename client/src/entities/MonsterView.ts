import * as THREE from "three";
import { Element, ELEMENT_COLOR, type EntityFull } from "@rox/shared";
import { buildMonsterMesh, type MonsterMesh } from "../procedural/monsterMeshes.js";
import { loadMonsterModel } from "../procedural/modelLoader.js";
import { resolveModelFile } from "../procedural/modelManifest.js";
import type { MonsterAppearance } from "../procedural/monsters.js";
import { EntityView } from "./EntityView.js";

// Collect every toon material under an object so hit/death flashes can drive
// them all (a single primitive body, or all surfaces of a loaded model).
function collectToonMats(root: THREE.Object3D, out: THREE.MeshToonMaterial[]): void {
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) if (m instanceof THREE.MeshToonMaterial) out.push(m);
  });
}

// A monster view: a per-family low-poly mesh with an idle bob (jelly archetypes
// also squash). Bosses are larger and wear a golden crown.
export class MonsterView extends EntityView {
  private poring: MonsterMesh;
  private phase = Math.random() * Math.PI * 2;
  private readonly scale: number;
  readonly boss: boolean;
  readonly element: string;

  constructor(entity: EntityFull, appearance: MonsterAppearance) {
    super(entity, `nameplate monster${appearance.boss ? " boss" : ""}`, 1.7 * appearance.scale + 0.3);
    this.scale = appearance.scale;
    this.boss = !!appearance.boss;
    this.element = entity.element ?? "neutral";
    this.poring = buildMonsterMesh(appearance);
    this.poring.group.scale.setScalar(appearance.scale);
    this.poring.group.traverse((o) => (o.userData.entityId = entity.id));
    this.group.add(this.poring.group);
    const bodyMat = (this.poring.body as THREE.Mesh).material as THREE.MeshToonMaterial | undefined;
    if (bodyMat?.emissive) this.baseEmissive.copy(bodyMat.emissive);
    if (bodyMat) this.flashMats.push(bodyMat);

    // Mid-poly model: an explicit override or the models/<id>.glb convention.
    // Loads async and swaps in over the primitive placeholder; absent = no-op.
    void this.resolveModel(appearance);

    if (appearance.boss) {
      const crown = new THREE.Mesh(
        new THREE.ConeGeometry(0.34, 0.4, 5),
        new THREE.MeshLambertMaterial({ color: 0xffd24a, emissive: 0x4a3500 }),
      );
      crown.position.set(0, 1.15, 0);
      crown.scale.setScalar(appearance.scale);
      this.group.add(crown);

      // menacing ground aura, tinted by element, that gently pulses
      const auraColor = ELEMENT_COLOR[this.element as Element] ?? 0xffd24a;
      this.bossAura = new THREE.Mesh(
        new THREE.RingGeometry(0.7, 1.08, 36),
        new THREE.MeshBasicMaterial({ color: auraColor, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
      );
      this.bossAura.rotation.x = -Math.PI / 2;
      this.bossAura.position.y = 0.04;
      this.bossAura.scale.setScalar(appearance.scale);
      this.group.add(this.bossAura);
    }
  }

  private aura: THREE.Mesh | null = null;
  private bossAura: THREE.Mesh | null = null;
  private hitT = 0;
  private lungeT = 0; // attack-lunge timer (1→0)
  private baseEmissive = new THREE.Color(0, 0, 0);
  private deathT = -1; // -1 = alive; 0..1 = dying
  private deathMats: THREE.Material[] = [];
  private flashMats: THREE.MeshToonMaterial[] = []; // toon mats driven by hit-flash
  private mixer: THREE.AnimationMixer | null = null; // skeletal animation (loaded models)
  private modelBacked = false; // true once a shared-geometry .glb has been swapped in
  private disposed = false;

  // Pick this template's model (explicit field or <id>.glb convention) and load
  // it if one exists; otherwise the procedural mesh stays.
  private async resolveModel(app: MonsterAppearance): Promise<void> {
    const file = await resolveModelFile(app.id, app.model);
    if (file && !this.disposed && !this.dying) await this.loadModel(file);
  }

  // Replace the procedural placeholder with a loaded mid-poly model. Keeps the
  // primitive mesh on any failure, so a missing/bad asset is non-fatal.
  private async loadModel(file: string): Promise<void> {
    let loaded;
    try {
      loaded = await loadMonsterModel(file);
    } catch (e) {
      console.warn(`[model] ${file} failed to load; keeping procedural mesh`, e);
      return;
    }
    if (this.disposed || this.dying) return;

    this.group.remove(this.poring.group);
    this.poring.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose?.();
    });

    loaded.scene.traverse((o) => (o.userData.entityId = this.id));
    loaded.scene.scale.setScalar(this.scale);
    this.poring = { group: loaded.scene, body: loaded.scene, squash: false };
    this.group.add(loaded.scene);
    this.modelBacked = true;

    // Loaded toon materials start with no emissive, so the flash baseline is black.
    this.baseEmissive.setRGB(0, 0, 0);
    this.flashMats = [];
    collectToonMats(loaded.scene, this.flashMats);

    if (loaded.animations.length) {
      this.mixer = new THREE.AnimationMixer(loaded.scene);
      const clip = loaded.animations.find((c) => /idle|walk|run|move/i.test(c.name)) ?? loaded.animations[0];
      this.mixer.clipAction(clip).play();
    }
  }

  // Flash + scale-punch when struck.
  hit(): void {
    this.hitT = 1;
  }

  // Quick forward lunge when the monster lands an attack (reads as a commit).
  lunge(): void {
    this.lungeT = 1;
  }

  get dying(): boolean {
    return this.deathT >= 0;
  }

  // Begin the death animation: flash white, then pop + shrink + fade out.
  beginDeath(): void {
    if (this.dying) return;
    this.deathT = 0;
    this.nameplateEl.style.display = "none";
    this.label.element.style.display = "none";
    // Collect every material on the view (body, feet, crown, aura…) so the whole
    // monster fades together.
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          m.transparent = true;
          this.deathMats.push(m);
        }
      }
    });
  }

  // Advance the death animation; returns true when finished (ready to dispose).
  updateDeath(dt: number): boolean {
    this.deathT = Math.min(1, this.deathT + dt * 2.4);
    const p = this.deathT;
    const pop = Math.sin(Math.min(p / 0.35, 1) * Math.PI * 0.5); // quick pop-up
    const s = this.scale * (1 + 0.35 * pop) * (1 - p * 0.85);
    this.poring.group.scale.setScalar(Math.max(0.001, s));
    this.poring.group.position.y = p * 0.8;
    this.poring.group.rotation.y += dt * 6;
    const op = 1 - p;
    for (const m of this.deathMats) (m as THREE.Material & { opacity: number }).opacity = op;
    const flash = 1 - Math.min(p / 0.3, 1);
    for (const m of this.flashMats) m.emissive.setRGB(this.baseEmissive.r + flash, this.baseEmissive.g + flash, this.baseEmissive.b + flash);
    return p >= 1;
  }

  get pickables(): THREE.Object3D {
    return this.poring.group;
  }

  setEnraged(enraged: boolean): void {
    if (enraged && !this.aura) {
      this.aura = new THREE.Mesh(
        new THREE.TorusGeometry(0.85 * this.scale, 0.06, 8, 28),
        new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.85 }),
      );
      this.aura.rotation.x = Math.PI / 2;
      this.aura.position.y = 0.3 * this.scale;
      this.group.add(this.aura);
    } else if (!enraged && this.aura) {
      this.group.remove(this.aura);
      this.aura = null;
    }
  }

  protected override animate(dt: number): void {
    if (this.mixer) this.mixer.update(dt);
    this.phase += dt * (this.moving ? 9 : 3);
    if (this.poring.squash) {
      const squash = 0.82 + Math.sin(this.phase) * (this.moving ? 0.14 : 0.06);
      this.poring.body.scale.set(1, squash, 1);
    }
    const bobAmp = this.poring.squash ? 0.18 : 0.1;
    // bob while walking; a gentle idle breath when standing so nothing is statue-still
    this.poring.group.position.y = this.moving
      ? Math.abs(Math.sin(this.phase)) * bobAmp * this.scale
      : Math.sin(this.phase) * 0.03 * this.scale;
    if (this.aura) this.aura.rotation.z += dt * 3;
    if (this.bossAura) {
      const t = Math.sin(this.phase * 0.9) * 0.5 + 0.5;
      (this.bossAura.material as THREE.MeshBasicMaterial).opacity = 0.24 + t * 0.18;
      this.bossAura.scale.setScalar(this.scale * (1 + t * 0.06));
    }

    // attack lunge: a brief forward hop along the monster's facing
    if (this.lungeT > 0) {
      this.lungeT = Math.max(0, this.lungeT - dt * 5);
      this.poring.group.position.z = Math.sin((1 - this.lungeT) * Math.PI) * 0.45 * this.scale;
    } else if (this.poring.group.position.z !== 0) {
      this.poring.group.position.z = 0;
    }

    // hit reaction: quick white flash + scale punch
    if (this.hitT > 0) {
      this.hitT = Math.max(0, this.hitT - dt * 6);
      const punch = 1 + this.hitT * 0.18;
      this.poring.group.scale.setScalar(this.scale * punch);
      const f = this.hitT * 0.9;
      for (const m of this.flashMats) m.emissive.setRGB(this.baseEmissive.r + f, this.baseEmissive.g + f, this.baseEmissive.b + f);
    } else if (this.poring.group.scale.x !== this.scale) {
      this.poring.group.scale.setScalar(this.scale);
      for (const m of this.flashMats) m.emissive.copy(this.baseEmissive);
    }
  }

  override dispose(scene: THREE.Scene): void {
    this.disposed = true;
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = null;
    }
    if (this.modelBacked) {
      // Loaded-model geometry is shared across instances via the loader cache —
      // detach only, never dispose, or sibling spawns lose their mesh.
      if (this.label.element.parentElement) this.label.element.parentElement.removeChild(this.label.element);
      scene.remove(this.group);
      return;
    }
    super.dispose(scene);
  }
}
