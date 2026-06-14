import * as THREE from "three";
import type { EntityFull } from "@rox/shared";
import { buildPoring, type PoringMesh } from "../procedural/poringMesh.js";
import type { MonsterAppearance } from "../procedural/monsters.js";
import { EntityView } from "./EntityView.js";

// A Poring-family view: textured jelly body with an idle squash-and-bob
// animation. Bosses are larger and wear a golden crown.
export class MonsterView extends EntityView {
  private poring: PoringMesh;
  private phase = Math.random() * Math.PI * 2;
  private readonly scale: number;
  readonly boss: boolean;
  readonly element: string;

  constructor(entity: EntityFull, appearance: MonsterAppearance) {
    super(entity, `nameplate monster${appearance.boss ? " boss" : ""}`, 1.7 * appearance.scale + 0.3);
    this.scale = appearance.scale;
    this.boss = !!appearance.boss;
    this.element = entity.element ?? "neutral";
    this.poring = buildPoring(appearance.texture);
    this.poring.group.scale.setScalar(appearance.scale);
    this.poring.group.traverse((o) => (o.userData.entityId = entity.id));
    this.group.add(this.poring.group);

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
    const squash = 0.82 + Math.sin(this.phase) * (this.moving ? 0.14 : 0.06);
    this.poring.body.scale.set(1, squash, 1);
    this.poring.group.position.y = this.moving ? Math.abs(Math.sin(this.phase)) * 0.18 * this.scale : 0;
    if (this.aura) this.aura.rotation.z += dt * 3;
  }
}
