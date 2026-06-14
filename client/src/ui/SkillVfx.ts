import * as THREE from "three";
import { makeSpark } from "../procedural/textures.js";

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

// Pooled, additive particle bursts + shock rings for skill impacts. Cheap and
// transient — colored by the hitting skill's element so combat reads at a glance.
export class SkillVfx {
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private sparkTex = makeSpark();

  constructor(private scene: THREE.Scene) {}

  // A burst of glowing sparks + an expanding ground ring at a world position.
  impact(pos: THREE.Vector3, color: number, scale = 1): void {
    const n = 10;
    for (let i = 0; i < n; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.sparkTex,
        color,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const sprite = new THREE.Sprite(mat);
      const s = (0.35 + Math.random() * 0.4) * scale;
      sprite.scale.setScalar(s);
      sprite.position.set(pos.x, pos.y + 0.8, pos.z);
      this.scene.add(sprite);
      const ang = Math.random() * Math.PI * 2;
      const spd = (2 + Math.random() * 3) * scale;
      this.particles.push({
        sprite,
        vx: Math.cos(ang) * spd,
        vy: 2 + Math.random() * 3,
        vz: Math.sin(ang) * spd,
        born: performance.now(),
        life: 360 + Math.random() * 220,
        size: s,
      });
    }
    this.ring(pos, color, 2.4 * scale);
    // a bright flash core that catches bloom
    const flashMat = new THREE.SpriteMaterial({ map: this.sparkTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const flash = new THREE.Sprite(flashMat);
    flash.scale.setScalar(1.6 * scale);
    flash.position.set(pos.x, pos.y + 0.8, pos.z);
    this.scene.add(flash);
    this.particles.push({ sprite: flash, vx: 0, vy: 0, vz: 0, born: performance.now(), life: 180, size: 1.6 * scale });
  }

  // A cast telegraph at the caster's feet: a converging ring + a rising twin
  // ring, element-coloured, that reads as a brief wind-up.
  castRing(pos: THREE.Vector3, color: number): void {
    const outer = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1.0, 40),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
    );
    outer.rotation.x = -Math.PI / 2;
    outer.position.set(pos.x, pos.y + 0.08, pos.z);
    outer.scale.setScalar(2.6);
    this.scene.add(outer);
    // animate as a converging ring (reuse the rings list with a shrink flag)
    this.rings.push({ mesh: outer, born: performance.now(), life: 480, maxR: -2.2 });
  }

  private ring(pos: THREE.Vector3, color: number, maxR: number): void {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.34, 28),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(pos.x, pos.y + 0.1, pos.z);
    this.scene.add(mesh);
    this.rings.push({ mesh, born: performance.now(), life: 420, maxR });
  }

  update(): void {
    const now = performance.now();
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      const t = (now - p.born) / p.life;
      if (t >= 1) {
        this.scene.remove(p.sprite);
        (p.sprite.material as THREE.SpriteMaterial).dispose();
        this.particles.splice(i, 1);
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
        r.mesh.geometry.dispose();
        (r.mesh.material as THREE.Material).dispose();
        this.rings.splice(i, 1);
        continue;
      }
      // maxR >= 0 expands from a point; maxR < 0 is a converging cast ring.
      const s = r.maxR >= 0 ? 0.3 + t * r.maxR : -r.maxR * (1 - t) + 0.4;
      r.mesh.scale.setScalar(s);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - t);
    }
  }
}
