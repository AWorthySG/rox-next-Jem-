import * as THREE from "three";
import { Element, ELEMENT_COLOR } from "@rox/shared";
import { makeSpark } from "../procedural/textures.js";

// Shared ring geometries — created once and reused for every ring (their meshes
// are scaled per-effect), so impacts never allocate/dispose geometry.
const GEO_IMPACT_RING = new THREE.RingGeometry(0.2, 0.34, 28);
const GEO_CAST_RING = new THREE.RingGeometry(0.85, 1.0, 40);
const GEO_SHOCK_RING = new THREE.RingGeometry(0.46, 0.52, 48); // thin, fast shockwave
// Tapered beam for crit pillars; translated so its base sits at y=0 (grows up).
const GEO_BEAM = new THREE.CylinderGeometry(0.16, 0.05, 1, 12).translate(0, 0.5, 0);

interface Particle {
  sprite: THREE.Sprite;
  vx: number;
  vy: number;
  vz: number;
  grav: number; // downward accel (negative = rises, e.g. dust/embers)
  drag: number; // per-second velocity damping (swirl/float feel)
  born: number;
  life: number;
  size: number;
}

// Per-element burst tuning. Spawn mode shapes the silhouette: "out" sprays
// outward, "tangential" swirls (wind), "inward" collapses from a ring (shadow).
interface BurstOpts {
  color: number;
  count: number;
  speedMin: number;
  speedMax: number;
  upMin: number;
  upMax: number;
  grav: number;
  drag: number;
  lifeMin: number;
  lifeMax: number;
  sizeMin: number;
  sizeMax: number;
  yStart: number;
  mode: "out" | "tangential" | "inward";
  radius?: number; // inward spawn radius
  scale: number;
}

interface Ring {
  mesh: THREE.Mesh;
  born: number;
  life: number;
  maxR: number;
  op: number; // starting opacity (faint for dust, bright for impacts)
}

interface Beam {
  mesh: THREE.Mesh;
  born: number;
  life: number;
  maxH: number;
}

// Pooled additive particle bursts + shock rings for skill impacts. Sprites and
// ring meshes (with their materials) are recycled rather than created/disposed
// per hit, so heavy combat doesn't churn GPU resources or trigger GC.
export class SkillVfx {
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private beams: Beam[] = [];
  private sparkTex = makeSpark();
  private spritePool: THREE.Sprite[] = [];
  private ringPool: THREE.Mesh[] = [];
  private beamPool: THREE.Mesh[] = [];

  constructor(private scene: THREE.Scene) {}

  // A generic burst of glowing sparks + an expanding ground ring at a world
  // position (used for non-elemental events like monster deaths).
  impact(pos: THREE.Vector3, color: number, scale = 1): void {
    const now = performance.now();
    const n = 10;
    for (let i = 0; i < n; i++) {
      const s = (0.35 + Math.random() * 0.4) * scale;
      const sprite = this.acquireSprite(color, s);
      sprite.position.set(pos.x, pos.y + 0.8, pos.z);
      const ang = Math.random() * Math.PI * 2;
      const spd = (2 + Math.random() * 3) * scale;
      this.particles.push({
        sprite,
        vx: Math.cos(ang) * spd,
        vy: 2 + Math.random() * 3,
        vz: Math.sin(ang) * spd,
        grav: 9,
        drag: 0,
        born: now,
        life: 360 + Math.random() * 220,
        size: s,
      });
    }
    this.ring(pos, color, 2.4 * scale, GEO_IMPACT_RING, 0.1, 420);
    this.shockAndFlash(pos, color, scale);
  }

  // Element-styled skill impact: each element gets a distinct particle silhouette
  // (fire licks up, water splashes + falls, wind swirls, earth throws debris +
  // dust, holy radiates + a light shaft, shadow collapses inward) over the shared
  // shockwave + flash.
  impactElement(pos: THREE.Vector3, element: Element, scale = 1): void {
    const color = ELEMENT_COLOR[element] ?? 0xffffff;
    this.shockAndFlash(pos, color, scale);
    switch (element) {
      case Element.Fire:
        this.burst(pos, { color, count: 12, speedMin: 0.3, speedMax: 1.4, upMin: 3.5, upMax: 7, grav: 2, drag: 1.2, lifeMin: 380, lifeMax: 640, sizeMin: 0.3, sizeMax: 0.6, yStart: 0.6, mode: "out", scale });
        this.ring(pos, color, 1.8 * scale, GEO_IMPACT_RING, 0.1, 380);
        break;
      case Element.Water:
        this.burst(pos, { color, count: 16, speedMin: 2.5, speedMax: 5, upMin: 1.5, upMax: 3.5, grav: 16, drag: 0.2, lifeMin: 340, lifeMax: 560, sizeMin: 0.22, sizeMax: 0.45, yStart: 0.6, mode: "out", scale });
        this.ring(pos, color, 3.2 * scale, GEO_IMPACT_RING, 0.08, 480);
        break;
      case Element.Wind:
        this.burst(pos, { color, count: 16, speedMin: 3, speedMax: 5.5, upMin: 0.5, upMax: 2, grav: 1, drag: 1.4, lifeMin: 300, lifeMax: 480, sizeMin: 0.25, sizeMax: 0.5, yStart: 0.8, mode: "tangential", scale });
        this.ring(pos, color, 4.0 * scale, GEO_SHOCK_RING, 0.12, 300);
        break;
      case Element.Earth:
        this.burst(pos, { color, count: 12, speedMin: 2, speedMax: 4, upMin: 1.5, upMax: 3, grav: 18, drag: 0.1, lifeMin: 380, lifeMax: 600, sizeMin: 0.3, sizeMax: 0.6, yStart: 0.4, mode: "out", scale });
        this.burst(pos, { color: 0xb89a72, count: 5, speedMin: 0.4, speedMax: 1.2, upMin: 0.4, upMax: 1.2, grav: -0.6, drag: 1.6, lifeMin: 520, lifeMax: 760, sizeMin: 0.7, sizeMax: 1.1, yStart: 0.3, mode: "out", scale });
        this.ring(pos, color, 2.6 * scale, GEO_IMPACT_RING, 0.06, 460);
        break;
      case Element.Holy:
        this.burst(pos, { color, count: 12, speedMin: 0.4, speedMax: 1.4, upMin: 3, upMax: 6, grav: 1, drag: 1.0, lifeMin: 480, lifeMax: 760, sizeMin: 0.3, sizeMax: 0.55, yStart: 0.4, mode: "out", scale });
        this.beam(pos, color, 2.8, 380);
        this.ring(pos, color, 2.6 * scale, GEO_IMPACT_RING, 0.08, 520);
        break;
      case Element.Shadow:
        this.burst(pos, { color, count: 14, speedMin: 3, speedMax: 5, upMin: 0.5, upMax: 2.5, grav: 2, drag: 0.8, lifeMin: 360, lifeMax: 560, sizeMin: 0.28, sizeMax: 0.55, yStart: 0.7, mode: "inward", radius: 2.6 * scale, scale });
        this.ring(pos, color, 2.2 * scale, GEO_IMPACT_RING, 0.1, 460);
        break;
      default: // Neutral
        this.burst(pos, { color, count: 10, speedMin: 2, speedMax: 5, upMin: 2, upMax: 5, grav: 9, drag: 0, lifeMin: 360, lifeMax: 580, sizeMin: 0.35, sizeMax: 0.75, yStart: 0.8, mode: "out", scale });
        this.ring(pos, color, 2.4 * scale, GEO_IMPACT_RING, 0.1, 420);
    }
  }

  // The shared white-hot shockwave ring + a bright flash core (catches bloom).
  private shockAndFlash(pos: THREE.Vector3, color: number, scale: number): void {
    this.ring(pos, 0xffffff, 3.6 * scale, GEO_SHOCK_RING, 0.12, 260);
    const flash = this.acquireSprite(color, 1.6 * scale);
    flash.position.set(pos.x, pos.y + 0.8, pos.z);
    this.particles.push({ sprite: flash, vx: 0, vy: 0, vz: 0, grav: 0, drag: 0, born: performance.now(), life: 180, size: 1.6 * scale });
  }

  // Spawn a shaped spark burst (see BurstOpts).
  private burst(pos: THREE.Vector3, o: BurstOpts): void {
    const now = performance.now();
    for (let i = 0; i < o.count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dx = Math.cos(ang);
      const dz = Math.sin(ang);
      const spd = (o.speedMin + Math.random() * (o.speedMax - o.speedMin)) * o.scale;
      const s = (o.sizeMin + Math.random() * (o.sizeMax - o.sizeMin)) * o.scale;
      const sprite = this.acquireSprite(o.color, s);
      let px = pos.x;
      let pz = pos.z;
      let vx: number;
      let vz: number;
      if (o.mode === "tangential") {
        const sign = Math.random() < 0.5 ? -1 : 1;
        vx = -dz * spd * sign;
        vz = dx * spd * sign;
      } else if (o.mode === "inward") {
        const r = o.radius ?? 2.5;
        px = pos.x + dx * r;
        pz = pos.z + dz * r;
        vx = -dx * spd;
        vz = -dz * spd;
      } else {
        vx = dx * spd;
        vz = dz * spd;
      }
      sprite.position.set(px, pos.y + o.yStart, pz);
      this.particles.push({
        sprite,
        vx,
        vy: (o.upMin + Math.random() * (o.upMax - o.upMin)) * o.scale,
        vz,
        grav: o.grav,
        drag: o.drag,
        born: now,
        life: o.lifeMin + Math.random() * (o.lifeMax - o.lifeMin),
        size: s,
      });
    }
  }

  // A cast telegraph: a converging ground ring plus a few motes that gather
  // inward toward the caster, reading as a brief energy wind-up (element-tinted).
  castRing(pos: THREE.Vector3, color: number): void {
    const mesh = this.acquireRing(GEO_CAST_RING, color);
    mesh.position.set(pos.x, pos.y + 0.08, pos.z);
    mesh.scale.setScalar(2.6);
    this.rings.push({ mesh, born: performance.now(), life: 480, maxR: -2.2, op: 0.9 });
    this.burst(pos, { color, count: 7, speedMin: 3, speedMax: 4.5, upMin: 0.4, upMax: 1.4, grav: 0, drag: 0.6, lifeMin: 420, lifeMax: 520, sizeMin: 0.22, sizeMax: 0.4, yStart: 0.85, mode: "inward", radius: 2.0, scale: 1 });
  }

  // A faint dust scuff kicked up under a moving entity's feet.
  footPuff(pos: THREE.Vector3): void {
    const mesh = this.acquireRing(GEO_IMPACT_RING, 0x9a8a6a);
    mesh.position.set(pos.x, pos.y + 0.04, pos.z);
    this.rings.push({ mesh, born: performance.now(), life: 340, maxR: 1.0, op: 0.32 });
  }

  // A vertical light pillar that shoots up and fades — punctuates a crit hit.
  crit(pos: THREE.Vector3, color: number): void {
    this.beam(pos, color, 3.4, 320);
  }

  // A dramatic entrance flourish when a boss spawns nearby: a dark ember burst,
  // a wide violet ground ring, a white shock, and a tall dark pillar.
  bossEntrance(pos: THREE.Vector3): void {
    this.burst(pos, { color: 0x9a4faa, count: 22, speedMin: 2, speedMax: 5.5, upMin: 3, upMax: 7, grav: 6, drag: 0.3, lifeMin: 520, lifeMax: 820, sizeMin: 0.35, sizeMax: 0.75, yStart: 0.4, mode: "out", scale: 1.4 });
    this.ring(pos, 0xb060ff, 6.5, GEO_IMPACT_RING, 0.06, 720);
    this.ring(pos, 0xffffff, 7.5, GEO_SHOCK_RING, 0.1, 380);
    this.beam(pos, 0x9a4faa, 5.5, 760);
  }

  // A warp-arrival flourish: motes collapse inward, two rings ripple out, and a
  // brief portal pillar — played at the player's new position on a map change.
  warp(pos: THREE.Vector3): void {
    this.burst(pos, { color: 0x8ad0ff, count: 16, speedMin: 3.5, speedMax: 6, upMin: 1, upMax: 3.5, grav: 0.5, drag: 1.0, lifeMin: 420, lifeMax: 640, sizeMin: 0.25, sizeMax: 0.5, yStart: 0.6, mode: "inward", radius: 3.0, scale: 1 });
    this.ring(pos, 0x8ad0ff, 3.4, GEO_IMPACT_RING, 0.06, 560);
    this.ring(pos, 0xc080ff, 2.4, GEO_SHOCK_RING, 0.1, 420);
    this.beam(pos, 0x8ad0ff, 3.2, 520);
  }

  // A few gold motes that drift up from a slain monster — a loot/XP cue.
  reward(pos: THREE.Vector3): void {
    this.burst(pos, { color: 0xffe08a, count: 6, speedMin: 0.3, speedMax: 1.0, upMin: 2, upMax: 3.5, grav: -0.4, drag: 1.2, lifeMin: 600, lifeMax: 900, sizeMin: 0.25, sizeMax: 0.45, yStart: 0.5, mode: "out", scale: 1 });
  }

  // A small lick of flame on a burn damage-over-time tick (no ring/shockwave).
  burnTick(pos: THREE.Vector3): void {
    this.burst(pos, { color: 0xff7a3a, count: 5, speedMin: 0.2, speedMax: 0.9, upMin: 2, upMax: 4, grav: 1.5, drag: 1.5, lifeMin: 300, lifeMax: 480, sizeMin: 0.2, sizeMax: 0.4, yStart: 0.7, mode: "out", scale: 0.85 });
  }

  // A celebratory burst at the player on level-up: a golden upward fountain, a
  // wide expanding ground ring, and a tall slow light pillar.
  levelUp(pos: THREE.Vector3): void {
    const now = performance.now();
    const gold = 0xffe08a;
    for (let i = 0; i < 18; i++) {
      const s = 0.3 + Math.random() * 0.4;
      const sprite = this.acquireSprite(gold, s);
      sprite.position.set(pos.x, pos.y + 0.2, pos.z);
      const ang = Math.random() * Math.PI * 2;
      const spd = 1 + Math.random() * 2;
      this.particles.push({ sprite, vx: Math.cos(ang) * spd, vy: 5 + Math.random() * 4, vz: Math.sin(ang) * spd, grav: 9, drag: 0, born: now, life: 720 + Math.random() * 320, size: s });
    }
    this.ring(pos, gold, 5.0, GEO_IMPACT_RING, 0.06, 760);
    this.beam(pos, gold, 5.5, 900);
  }

  private beam(pos: THREE.Vector3, color: number, maxH: number, life: number): void {
    let mesh = this.beamPool.pop();
    if (!mesh) {
      mesh = new THREE.Mesh(
        GEO_BEAM,
        new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
      );
    }
    const mat = mesh.material as THREE.MeshBasicMaterial;
    mat.color.setHex(color);
    mat.opacity = 0.85;
    mesh.position.set(pos.x, pos.y + 0.1, pos.z);
    mesh.scale.set(1, 0.2, 1);
    this.scene.add(mesh);
    this.beams.push({ mesh, born: performance.now(), life, maxH });
  }

  private ring(pos: THREE.Vector3, color: number, maxR: number, geo: THREE.BufferGeometry, yOff: number, life: number): void {
    const mesh = this.acquireRing(geo, color);
    mesh.position.set(pos.x, pos.y + yOff, pos.z);
    this.rings.push({ mesh, born: performance.now(), life, maxR, op: 0.9 });
  }

  private acquireSprite(color: number, scale: number): THREE.Sprite {
    let sprite = this.spritePool.pop();
    if (!sprite) {
      sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: this.sparkTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
      );
    }
    const mat = sprite.material as THREE.SpriteMaterial;
    mat.color.setHex(color);
    mat.opacity = 1;
    sprite.scale.setScalar(scale);
    this.scene.add(sprite);
    return sprite;
  }

  private acquireRing(geo: THREE.BufferGeometry, color: number): THREE.Mesh {
    let mesh = this.ringPool.pop();
    if (!mesh) {
      mesh = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
      );
      mesh.rotation.x = -Math.PI / 2;
    } else {
      mesh.geometry = geo;
    }
    const mat = mesh.material as THREE.MeshBasicMaterial;
    mat.color.setHex(color);
    mat.opacity = 0.9;
    this.scene.add(mesh);
    return mesh;
  }

  update(): void {
    const now = performance.now();
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      const t = (now - p.born) / p.life;
      if (t >= 1) {
        this.scene.remove(p.sprite);
        this.particles.splice(i, 1);
        this.spritePool.push(p.sprite); // recycle (keep the material)
        continue;
      }
      const dt = 0.016;
      if (p.drag) {
        const f = Math.max(0, 1 - p.drag * dt);
        p.vx *= f;
        p.vy *= f;
        p.vz *= f;
      }
      p.vy -= p.grav * dt; // gravity (negative grav rises)
      p.sprite.position.x += p.vx * dt;
      p.sprite.position.y += p.vy * dt;
      p.sprite.position.z += p.vz * dt;
      (p.sprite.material as THREE.SpriteMaterial).opacity = 1 - t;
      p.sprite.scale.setScalar(p.size * (1 - t * 0.5));
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      const t = (now - r.born) / r.life;
      if (t >= 1) {
        this.scene.remove(r.mesh);
        this.rings.splice(i, 1);
        this.ringPool.push(r.mesh); // recycle (shared geometry + kept material)
        continue;
      }
      // maxR >= 0 expands from a point; maxR < 0 is a converging cast ring.
      const s = r.maxR >= 0 ? 0.3 + t * r.maxR : -r.maxR * (1 - t) + 0.4;
      r.mesh.scale.setScalar(s);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = r.op * (1 - t);
    }
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      const t = (now - b.born) / b.life;
      if (t >= 1) {
        this.scene.remove(b.mesh);
        this.beams.splice(i, 1);
        this.beamPool.push(b.mesh);
        continue;
      }
      const h = b.maxH * Math.min(1, t / 0.22); // shoot up fast, then hold
      const taper = 1 - t * 0.4;
      b.mesh.scale.set(taper, h, taper);
      (b.mesh.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - t);
    }
  }
}
