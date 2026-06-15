import * as THREE from "three";
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
  born: number;
  life: number;
  size: number;
}

interface Ring {
  mesh: THREE.Mesh;
  born: number;
  life: number;
  maxR: number;
}

interface Beam {
  mesh: THREE.Mesh;
  born: number;
  life: number;
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

  // A burst of glowing sparks + an expanding ground ring at a world position.
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
        born: now,
        life: 360 + Math.random() * 220,
        size: s,
      });
    }
    this.ring(pos, color, 2.4 * scale, GEO_IMPACT_RING, 0.1, 420);
    // a fast, bright white-hot shockwave that expands further and fades quickly
    this.ring(pos, 0xffffff, 3.6 * scale, GEO_SHOCK_RING, 0.12, 260);
    // a bright flash core that catches bloom
    const flash = this.acquireSprite(color, 1.6 * scale);
    flash.position.set(pos.x, pos.y + 0.8, pos.z);
    this.particles.push({ sprite: flash, vx: 0, vy: 0, vz: 0, born: now, life: 180, size: 1.6 * scale });
  }

  // A cast telegraph at the caster's feet: a converging ring that reads as a brief wind-up.
  castRing(pos: THREE.Vector3, color: number): void {
    const mesh = this.acquireRing(GEO_CAST_RING, color);
    mesh.position.set(pos.x, pos.y + 0.08, pos.z);
    mesh.scale.setScalar(2.6);
    this.rings.push({ mesh, born: performance.now(), life: 480, maxR: -2.2 });
  }

  // A vertical light pillar that shoots up and fades — punctuates a crit hit.
  crit(pos: THREE.Vector3, color: number): void {
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
    this.beams.push({ mesh, born: performance.now(), life: 320 });
  }

  private ring(pos: THREE.Vector3, color: number, maxR: number, geo: THREE.BufferGeometry, yOff: number, life: number): void {
    const mesh = this.acquireRing(geo, color);
    mesh.position.set(pos.x, pos.y + yOff, pos.z);
    this.rings.push({ mesh, born: performance.now(), life, maxR });
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
      p.sprite.position.x += p.vx * dt;
      p.sprite.position.y += p.vy * dt;
      p.sprite.position.z += p.vz * dt;
      p.vy -= 9 * dt; // gravity
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
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - t);
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
      const h = 3.4 * Math.min(1, t / 0.22); // shoot up fast, then hold
      const taper = 1 - t * 0.4;
      b.mesh.scale.set(taper, h, taper);
      (b.mesh.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - t);
    }
  }
}
