import * as THREE from "three";
import type { EntityFull } from "@rox/shared";
import { buildMonsterMesh, type MonsterMesh } from "../procedural/monsterMeshes.js";
import type { MonsterAppearance } from "../procedural/monsters.js";
import { EntityView } from "./EntityView.js";

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

    if (appearance.boss) {
      const crown = new THREE.Mesh(
        new THREE.ConeGeometry(0.34, 0.4, 5),
        new THREE.MeshLambertMaterial({ color: 0xffd24a, emissive: 0x4a3500 }),
      );
      crown.position.set(0, 1.15, 0);
      crown.scale.setScalar(appearance.scale);
      this.group.add(crown);
    }
  }

  private aura: THREE.Mesh | null = null;
  private hitT = 0;
  private baseEmissive = new THREE.Color(0, 0, 0);
  private deathT = -1; // -1 = alive; 0..1 = dying
  private deathMats: THREE.Material[] = [];

  // Flash + scale-punch when struck.
  hit(): void {
    this.hitT = 1;
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
    const body = this.poring.body as THREE.Mesh;
    const mat = body.material as THREE.MeshToonMaterial | undefined;
    if (mat?.emissive) {
      const flash = 1 - Math.min(p / 0.3, 1);
      mat.emissive.setRGB(this.baseEmissive.r + flash, this.baseEmissive.g + flash, this.baseEmissive.b + flash);
    }
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
    this.phase += dt * (this.moving ? 9 : 3);
    if (this.poring.squash) {
      const squash = 0.82 + Math.sin(this.phase) * (this.moving ? 0.14 : 0.06);
      this.poring.body.scale.set(1, squash, 1);
    }
    const bobAmp = this.poring.squash ? 0.18 : 0.1;
    this.poring.group.position.y = this.moving ? Math.abs(Math.sin(this.phase)) * bobAmp * this.scale : 0;
    if (this.aura) this.aura.rotation.z += dt * 3;

    // hit reaction: quick white flash + scale punch
    const body = this.poring.body as THREE.Mesh;
    const mat = body.material as THREE.MeshToonMaterial | undefined;
    if (this.hitT > 0) {
      this.hitT = Math.max(0, this.hitT - dt * 6);
      const punch = 1 + this.hitT * 0.18;
      this.poring.group.scale.setScalar(this.scale * punch);
      const f = this.hitT * 0.9;
      if (mat && mat.emissive) mat.emissive.setRGB(this.baseEmissive.r + f, this.baseEmissive.g + f, this.baseEmissive.b + f);
    } else if (this.poring.group.scale.x !== this.scale) {
      this.poring.group.scale.setScalar(this.scale);
      if (mat && mat.emissive) mat.emissive.copy(this.baseEmissive);
    }
  }
}
