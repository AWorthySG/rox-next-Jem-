import * as THREE from "three";
import { EntityKind, INTERP_DELAY_MS, type EntityFull, type EntitySnapshot } from "@rox/shared";
import { EntityView } from "../entities/EntityView.js";
import { PlayerView } from "../entities/PlayerView.js";
import { MonsterView } from "../entities/MonsterView.js";
import { NpcView } from "../entities/NpcView.js";
import { DEFAULT_TEMPLATE, type MonsterAppearance } from "../procedural/monsters.js";

// Client-side mirror of the world: maps entity ids to their views and keeps the
// Three.js scene in sync with spawn / despawn / snapshot messages.
// Display metadata for a monster species, accumulated as the player meets them.
export interface DexEntry {
  templateId: string;
  name: string;
  level: number;
  element: string;
  boss: boolean;
}

export class GameState {
  readonly views = new Map<number, EntityView>();
  // Monster Codex registry: every species the player has ever seen this session.
  readonly monsterDex = new Map<string, DexEntry>();
  private dying: MonsterView[] = []; // monsters playing their death animation
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
      if (entity.templateId && !this.monsterDex.has(entity.templateId)) {
        this.monsterDex.set(entity.templateId, {
          templateId: entity.templateId,
          name: entity.name,
          level: entity.level,
          element: entity.element ?? "neutral",
          boss: !!appearance.boss,
        });
      }
    }
    this.views.set(entity.id, view);
    this.scene.add(view.group);
  }

  removeEntity(id: number): void {
    const view = this.views.get(id);
    if (!view) return;
    // Monsters play a death animation before disposing; everything else (players
    // leaving, NPCs) is removed immediately.
    if (view instanceof MonsterView) {
      view.beginDeath();
      this.dying.push(view);
    } else {
      view.dispose(this.scene);
    }
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
    for (const v of this.dying) v.dispose(this.scene);
    this.dying = [];
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

  // Position + reticle size for the current target (living monsters only).
  targetReticle(id: number): { pos: THREE.Vector3; scale: number } | null {
    const v = this.views.get(id);
    if (v instanceof MonsterView && !v.dying) return { pos: v.group.position, scale: v.reticleScale };
    return null;
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

  // Tab-targeting: pick the next-nearest living monster after `currentId`,
  // wrapping around (or the nearest if nothing is targeted yet).
  cycleTarget(currentId: number | null): number | null {
    const self = this.self;
    if (!self) return null;
    const { x, z } = self.group.position;
    const monsters = [...this.views.values()]
      .filter((v): v is MonsterView => v instanceof MonsterView && !v.dying)
      .map((v) => ({ id: v.id, d: Math.hypot(v.group.position.x - x, v.group.position.z - z) }))
      .sort((a, b) => a.d - b.d);
    if (monsters.length === 0) return null;
    if (currentId == null) return monsters[0].id;
    const idx = monsters.findIndex((m) => m.id === currentId);
    return monsters[(idx + 1) % monsters.length].id;
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

  // Play an attack animation on the attacker: a weapon swing for players, a
  // forward lunge for monsters (so their hits read clearly).
  onAttack(sourceId: number): void {
    const v = this.views.get(sourceId);
    if (v instanceof PlayerView) v.swing();
    else if (v instanceof MonsterView) v.lunge();
  }

  // Play a hit reaction on whatever got struck.
  onHurt(targetId: number): void {
    const v = this.views.get(targetId);
    if (v instanceof MonsterView) v.hit();
    else if (v instanceof PlayerView) v.flinch();
  }

  // If `id` is a (living) monster, return its position + boss flag — used to
  // burst loot sparkles right before it's removed/death-animated.
  monsterDeathInfo(id: number): { pos: THREE.Vector3; boss: boolean; element: string } | null {
    const v = this.views.get(id);
    if (v instanceof MonsterView && !v.dying) return { pos: v.group.position.clone(), boss: v.boss, element: v.element };
    return null;
  }

  getPickables(): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const v of this.views.values()) {
      if (v instanceof MonsterView || v instanceof NpcView) out.push(v.group);
      else if (v instanceof PlayerView && v.id !== this.selfId) out.push(v.group);
    }
    return out;
  }

  update(dt: number, camPos?: THREE.Vector3): void {
    const renderTime = performance.now() - INTERP_DELAY_MS;
    for (const v of this.views.values()) v.update(renderTime, dt, camPos);
    // Advance dying monsters; dispose when their animation completes.
    for (let i = this.dying.length - 1; i >= 0; i--) {
      if (this.dying[i].updateDeath(dt)) {
        this.dying[i].dispose(this.scene);
        this.dying.splice(i, 1);
      }
    }
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
