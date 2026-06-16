import * as THREE from "three";
import { Element, ELEMENT_COLOR, type EntityFull } from "@rox/shared";
import { buildMonsterMesh, type MonsterMesh } from "../procedural/monsterMeshes.js";
import type { MonsterAppearance } from "../procedural/monsters.js";
import { EntityView } from "./EntityView.js";
import { ModelRig } from "./ModelRig.js";

const BLACK = new THREE.Color(0, 0, 0);

// A monster view: a per-family low-poly mesh with an idle bob (jelly archetypes
// also squash), or a mid-poly model if one exists for the template. Bosses are
// larger and wear a golden crown.
export class MonsterView extends EntityView {
  private poring: MonsterMesh;
  private visual: THREE.Object3D; // current visual root (procedural group or model)
  private rig: ModelRig;
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
    this.visual = this.poring.group;
    const bodyMat = (this.poring.body as THREE.Mesh).material as THREE.MeshToonMaterial | undefined;
    if (bodyMat?.emissive) this.baseEmissive.copy(bodyMat.emissive);
    if (bodyMat) this.procMats.push(bodyMat);

    // Mid-poly model: an explicit override or the models/<id>.glb convention.
    // Loads async and swaps in over the primitive placeholder; absent = no-op.
    this.rig = new ModelRig(this.group, entity.id);
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
  private procMats: THREE.MeshToonMaterial[] = []; // procedural toon mats for hit-flash
  private deathClip = false; // model supplied a death clip → skip the procedural pop/spin
  private disposed = false;
  private lowHp = false; // ≤30% HP → a wounded red pulse

  override setHp(hp: number): void {
    super.setHp(hp);
    this.lowHp = this.maxHp > 0 && hp > 0 && hp / this.maxHp <= 0.3;
  }

  // The toon materials currently driven by hit/death flashes (model or primitive).
  private get flashMats(): THREE.MeshToonMaterial[] {
    return this.modelBacked ? this.rig.flashMats : this.procMats;
  }

  // Pick this template's model (explicit field or <id>.glb convention) and swap
  // it in if one exists; otherwise the procedural mesh stays.
  private async resolveModel(app: MonsterAppearance): Promise<void> {
    if (this.disposed || this.dying) return;
    const swapped = await this.rig.tryLoad(app.id, app.model, app.scale, () => {
      this.group.remove(this.poring.group);
      this.poring.group.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose?.();
      });
    });
    if (swapped && this.rig.group) {
      this.visual = this.rig.group;
      this.modelBacked = true;
    }
  }

  // Flash + scale-punch when struck (always), plus a hit clip if the model has one.
  hit(): void {
    this.hitT = 1;
    this.rig.playOneShot("hit");
  }

  // Attack tell: play the model's attack clip, else a procedural forward lunge.
  lunge(): void {
    if (!this.rig.playOneShot("attack")) this.lungeT = 1;
  }

  get dying(): boolean {
    return this.deathT >= 0;
  }

  // Begin the death animation: flash white, then pop + shrink + fade out — or
  // play the model's death clip (if any) while it fades.
  beginDeath(): void {
    if (this.dying) return;
    this.deathT = 0;
    this.deathClip = this.rig.playOneShot("death");
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
    this.rig.step(dt); // keep a death clip playing
    this.deathT = Math.min(1, this.deathT + dt * 2.4);
    const p = this.deathT;
    if (!this.deathClip) {
      // procedural fallback: a quick pop-up + shrink + spin
      const pop = Math.sin(Math.min(p / 0.35, 1) * Math.PI * 0.5);
      const s = this.scale * (1 + 0.35 * pop) * (1 - p * 0.85);
      this.visual.scale.setScalar(Math.max(0.001, s));
      this.visual.position.y = p * 0.8;
      this.visual.rotation.y += dt * 6;
    }
    const op = 1 - p;
    for (const m of this.deathMats) (m as THREE.Material & { opacity: number }).opacity = op;
    const base = this.modelBacked ? BLACK : this.baseEmissive;
    const flash = 1 - Math.min(p / 0.3, 1);
    for (const m of this.flashMats) m.emissive.setRGB(base.r + flash, base.g + flash, base.b + flash);
    return p >= 1;
  }

  get pickables(): THREE.Object3D {
    return this.visual;
  }

  // Ground-reticle radius factor — scales with the monster but stays readable.
  get reticleScale(): number {
    return 0.7 + this.scale * 0.5;
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
    if (this.modelBacked) {
      this.rig.setMoving(this.moving);
      this.rig.update(dt);
    } else {
      this.phase += dt * (this.moving ? 9 : 3);
      if (this.poring.squash) {
        const squash = 0.82 + Math.sin(this.phase) * (this.moving ? 0.14 : 0.06);
        this.poring.body.scale.set(1, squash, 1);
      }
      const bobAmp = this.poring.squash ? 0.18 : 0.1;
      // bob while walking; a gentle idle breath when standing so nothing is statue-still
      this.visual.position.y = this.moving
        ? Math.abs(Math.sin(this.phase)) * bobAmp * this.scale
        : Math.sin(this.phase) * 0.03 * this.scale;
    }

    if (this.aura) this.aura.rotation.z += dt * 3;
    if (this.bossAura) {
      const t = Math.sin(this.phase * 0.9) * 0.5 + 0.5;
      (this.bossAura.material as THREE.MeshBasicMaterial).opacity = 0.24 + t * 0.18;
      this.bossAura.scale.setScalar(this.scale * (1 + t * 0.06));
    }

    // attack lunge: a brief forward hop along the monster's facing (procedural
    // fallback when the model has no attack clip)
    if (this.lungeT > 0) {
      this.lungeT = Math.max(0, this.lungeT - dt * 5);
      this.visual.position.z = Math.sin((1 - this.lungeT) * Math.PI) * 0.45 * this.scale;
    } else if (this.visual.position.z !== 0) {
      this.visual.position.z = 0;
    }

    // hit reaction: quick white flash + scale punch; otherwise rest at base
    // emissive, or a pulsing red glow when the monster is near death.
    const base = this.modelBacked ? BLACK : this.baseEmissive;
    if (this.hitT > 0) {
      this.hitT = Math.max(0, this.hitT - dt * 6);
      const punch = 1 + this.hitT * 0.18;
      this.visual.scale.setScalar(this.scale * punch);
      const f = this.hitT * 0.9;
      for (const m of this.flashMats) m.emissive.setRGB(base.r + f, base.g + f, base.b + f);
    } else {
      if (this.visual.scale.x !== this.scale) this.visual.scale.setScalar(this.scale);
      if (this.lowHp) {
        const r = (Math.sin(this.phase * 3) * 0.5 + 0.5) * 0.45; // wounded pulse
        for (const m of this.flashMats) m.emissive.setRGB(base.r + r, base.g, base.b);
      } else {
        for (const m of this.flashMats) m.emissive.copy(base);
      }
    }
  }

  override dispose(scene: THREE.Scene): void {
    this.disposed = true;
    this.rig.dispose();
    super.dispose(scene);
  }
}
