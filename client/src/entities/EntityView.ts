import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import type { EntityFull } from "@rox/shared";
import { Interpolator } from "./Interpolator.js";

// Base view for any networked entity: owns the 3D group, a nameplate + HP bar
// label, and the interpolation buffer. Subclasses build the actual mesh.
export abstract class EntityView {
  readonly id: number;
  readonly group = new THREE.Group();
  protected interp = new Interpolator();

  hp: number;
  maxHp: number;
  protected nameplateEl: HTMLDivElement;
  protected hpFillEl: HTMLElement;
  protected label: CSS2DObject;

  protected prevX = 0;
  protected prevZ = 0;
  protected moving = false;

  constructor(entity: EntityFull, labelClass: string, labelHeight: number) {
    this.id = entity.id;
    this.hp = entity.hp;
    this.maxHp = entity.maxHp;
    this.group.position.set(entity.x, 0, entity.z);
    this.group.rotation.y = entity.facing;
    this.prevX = entity.x;
    this.prevZ = entity.z;

    // nameplate + HP bar as a CSS2D label floating above the entity
    const wrap = document.createElement("div");
    const name = document.createElement("div");
    name.className = `nameplate ${labelClass}`;
    this.nameplateEl = name;
    this.setLabel(entity);
    const bar = document.createElement("div");
    bar.className = `hpbar ${labelClass === "monster" ? "monster" : ""}`;
    const fill = document.createElement("i");
    fill.style.width = "100%";
    bar.appendChild(fill);
    wrap.appendChild(name);
    wrap.appendChild(bar);

    this.hpFillEl = fill;
    this.label = new CSS2DObject(wrap);
    this.label.position.set(0, labelHeight, 0);
    this.group.add(this.label);
  }

  // (Re)render the name line: optional [guild] tag, name, and level.
  setLabel(entity: EntityFull): void {
    const guild = entity.guildName ? `<span class="guild-tag">[${entity.guildName}]</span> ` : "";
    const lvl = entity.level > 0 ? ` <span class="lvl">Lv${entity.level}</span>` : "";
    this.nameplateEl.innerHTML = `${guild}${entity.name}${lvl}`;
  }

  markSelf(): void {
    this.nameplateEl.classList.remove("player");
    this.nameplateEl.classList.add("self");
  }

  pushSnapshot(x: number, z: number, facing: number, hp: number, clientTime: number): void {
    this.interp.push(x, z, facing, clientTime);
    this.setHp(hp);
  }

  setHp(hp: number): void {
    this.hp = hp;
    const pct = Math.max(0, Math.min(1, this.maxHp ? hp / this.maxHp : 0));
    this.hpFillEl.style.width = `${pct * 100}%`;
  }

  // Default update: drive position from the interpolation buffer.
  update(renderTime: number, dt: number): void {
    const s = this.interp.sample(renderTime);
    if (s) {
      this.detectMovement(s.x, s.z);
      this.group.position.x = s.x;
      this.group.position.z = s.z;
      this.group.rotation.y = s.facing;
    }
    this.animate(dt);
  }

  protected detectMovement(x: number, z: number): void {
    this.moving = Math.hypot(x - this.prevX, z - this.prevZ) > 0.01;
    this.prevX = x;
    this.prevZ = z;
  }

  // Subclass animation hook (walk cycle, idle bob, …).
  protected animate(_dt: number): void {}

  dispose(scene: THREE.Scene): void {
    if (this.label.element.parentElement) this.label.element.parentElement.removeChild(this.label.element);
    scene.remove(this.group);
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose?.();
    });
  }
}
