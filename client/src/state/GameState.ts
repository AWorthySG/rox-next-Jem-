import * as THREE from "three";
import { EntityKind, INTERP_DELAY_MS, type EntityFull, type EntitySnapshot } from "@rox/shared";
import { EntityView } from "../entities/EntityView.js";
import { PlayerView } from "../entities/PlayerView.js";
import { MonsterView } from "../entities/MonsterView.js";
import { NpcView } from "../entities/NpcView.js";
import { DEFAULT_TEMPLATE, type MonsterAppearance } from "../procedural/monsters.js";

// Client-side mirror of the world: maps entity ids to their views and keeps the
// Three.js scene in sync with spawn / despawn / snapshot messages.
export class GameState {
  readonly views = new Map<number, EntityView>();
  selfId = -1;

  constructor(
    private scene: THREE.Scene,
    private appearances: Record<string, MonsterAppearance>,
  ) {}

  get self(): PlayerView | undefined {
    const v = this.views.get(this.selfId);
    return v instanceof PlayerView ? v : undefined;
  }

  addEntity(entity: EntityFull): void {
    const existing = this.views.get(entity.id);
    if (existing) {
      // Re-spawn (e.g. monster respawn, guild-tag refresh): refresh state.
      existing.maxHp = entity.maxHp;
      existing.setHp(entity.hp);
      existing.setLabel(entity);
      if (entity.id !== this.selfId) existing.group.position.set(entity.x, 0, entity.z);
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
    } else if (entity.kind === EntityKind.Npc) {
      view = new NpcView(entity);
    } else {
      const appearance =
        this.appearances[entity.templateId ?? DEFAULT_TEMPLATE] ?? this.appearances[DEFAULT_TEMPLATE];
      view = new MonsterView(entity, appearance);
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

  // On map change, drop every entity except the local player (server re-spawns
  // the new map's entities).
  clearExceptSelf(): void {
    for (const [id, view] of this.views) {
      if (id === this.selfId) continue;
      view.dispose(this.scene);
      this.views.delete(id);
    }
  }

  applySnapshot(entities: EntitySnapshot[], clientTime: number): void {
    for (const e of entities) {
      const view = this.views.get(e.id);
      if (!view) continue;
      view.pushSnapshot(e.x, e.z, e.facing, e.hp, clientTime);
      if (view instanceof MonsterView) view.setEnraged(!!e.enraged);
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

  npcRoleOf(id: number): string | null {
    const v = this.views.get(id);
    return v instanceof NpcView ? v.role : null;
  }

  isRemotePlayer(id: number): boolean {
    const v = this.views.get(id);
    return v instanceof PlayerView && id !== this.selfId;
  }

  isMonster(id: number): boolean {
    return this.views.get(id) instanceof MonsterView;
  }

  targetInfo(
    id: number,
  ): { name: string; level: number; hp: number; maxHp: number; boss: boolean; element: string } | null {
    const v = this.views.get(id);
    if (!(v instanceof MonsterView)) return null;
    return { name: v.name, level: v.level, hp: v.hp, maxHp: v.maxHp, boss: v.boss, element: v.element };
  }

  entityHp(id: number): { hp: number; maxHp: number } | null {
    const v = this.views.get(id);
    return v ? { hp: v.hp, maxHp: v.maxHp } : null;
  }

  getPickables(): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const v of this.views.values()) {
      if (v instanceof MonsterView || v instanceof NpcView) out.push(v.group);
      else if (v instanceof PlayerView && v.id !== this.selfId) out.push(v.group);
    }
    return out;
  }

  update(dt: number): void {
    const renderTime = performance.now() - INTERP_DELAY_MS;
    for (const v of this.views.values()) v.update(renderTime, dt);
  }

  // Lightweight position list for the minimap.
  blips(): Array<{ x: number; z: number; type: "self" | "player" | "monster" | "boss" | "npc" }> {
    const out: Array<{ x: number; z: number; type: "self" | "player" | "monster" | "boss" | "npc" }> = [];
    for (const v of this.views.values()) {
      const p = v.group.position;
      if (v instanceof PlayerView) out.push({ x: p.x, z: p.z, type: v.id === this.selfId ? "self" : "player" });
      else if (v instanceof MonsterView) out.push({ x: p.x, z: p.z, type: v.boss ? "boss" : "monster" });
      else if (v instanceof NpcView) out.push({ x: p.x, z: p.z, type: "npc" });
    }
    return out;
  }
}
