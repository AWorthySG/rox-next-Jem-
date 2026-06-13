import * as THREE from "three";
import { EntityKind, INTERP_DELAY_MS, type EntityFull, type EntitySnapshot } from "@rox/shared";
import { EntityView } from "../entities/EntityView.js";
import { PlayerView } from "../entities/PlayerView.js";
import { MonsterView } from "../entities/MonsterView.js";

// Client-side mirror of the world: maps entity ids to their views and keeps the
// Three.js scene in sync with spawn / despawn / snapshot messages.
export class GameState {
  readonly views = new Map<number, EntityView>();
  selfId = -1;

  constructor(
    private scene: THREE.Scene,
    private poringTexture: THREE.Texture,
  ) {}

  get self(): PlayerView | undefined {
    const v = this.views.get(this.selfId);
    return v instanceof PlayerView ? v : undefined;
  }

  addEntity(entity: EntityFull): void {
    const existing = this.views.get(entity.id);
    if (existing) {
      // Re-spawn (e.g. monster respawn): refresh hp/position.
      existing.maxHp = entity.maxHp;
      existing.setHp(entity.hp);
      existing.group.position.set(entity.x, 0, entity.z);
      return;
    }
    let view: EntityView;
    if (entity.kind === EntityKind.Player) {
      const pv = new PlayerView(entity);
      if (entity.id === this.selfId) {
        pv.isSelf = true;
        pv.markSelf();
      }
      view = pv;
    } else {
      view = new MonsterView(entity, this.poringTexture);
    }
    this.views.set(entity.id, view);
    this.scene.add(view.group);
  }

  removeEntity(id: number): void {
    const view = this.views.get(id);
    if (!view) return;
    view.dispose(this.scene);
    this.views.delete(id);
  }

  applySnapshot(entities: EntitySnapshot[], clientTime: number): void {
    for (const e of entities) {
      const view = this.views.get(e.id);
      if (view) view.pushSnapshot(e.x, e.z, e.facing, e.hp, clientTime);
    }
  }

  worldPosOf(id: number): THREE.Vector3 | null {
    const v = this.views.get(id);
    return v ? v.group.position.clone() : null;
  }

  // Nearest living monster to the local player (for target-less skill casts).
  nearestMonsterId(): number | null {
    const self = this.self;
    if (!self) return null;
    const { x, z } = self.group.position;
    let best: number | null = null;
    let bestD = Infinity;
    for (const v of this.views.values()) {
      if (v instanceof MonsterView) {
        const d = Math.hypot(v.group.position.x - x, v.group.position.z - z);
        if (d < bestD) {
          bestD = d;
          best = v.id;
        }
      }
    }
    return best;
  }

  getPickables(): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const v of this.views.values()) {
      if (v instanceof MonsterView) out.push(v.pickables);
    }
    return out;
  }

  update(dt: number): void {
    const renderTime = performance.now() - INTERP_DELAY_MS;
    for (const v of this.views.values()) v.update(renderTime, dt);
  }
}
