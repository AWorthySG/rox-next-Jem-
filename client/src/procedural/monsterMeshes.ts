import * as THREE from "three";
import { buildPoring } from "./poringMesh.js";
import { makeBlobShadow, makeToonGradient } from "./textures.js";
import type { MonsterAppearance } from "./monsters.js";

export interface MonsterMesh {
  group: THREE.Group;
  body: THREE.Object3D; // primary part (jelly squashes it; others just bob)
  squash: boolean;
}

function toon(color: number, opts: { transparent?: boolean; opacity?: number; emissive?: number } = {}): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({
    color,
    gradientMap: makeToonGradient(),
    transparent: opts.transparent,
    opacity: opts.opacity ?? 1,
    emissive: opts.emissive ?? 0x000000,
  });
}

function glow(color: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color });
}

function blob(size = 1): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: makeBlobShadow(), transparent: true, depthWrite: false, opacity: 0.6 }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.02;
  return m;
}

function shade(group: THREE.Group): void {
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
}

// Dispatch a per-family mesh so the bestiary actually looks varied.
export function buildMonsterMesh(app: MonsterAppearance): MonsterMesh {
  switch (app.arch) {
    case "bug":
      return bug(app);
    case "beast":
      return beast(app);
    case "undead":
      return undead(app);
    case "plant":
      return plant(app);
    case "rock":
      return rock(app);
    case "demon":
      return demon(app);
    case "bird":
      return bird(app);
    case "ghost":
      return ghost(app);
    case "dragon":
      return dragon(app);
    default: {
      const p = buildPoring(app.texture);
      return { group: p.group, body: p.body, squash: true };
    }
  }
}

function eyes(group: THREE.Object3D, y: number, z: number, spread: number, r = 0.07, color = 0x101018): void {
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 8), new THREE.MeshBasicMaterial({ color }));
    e.position.set(s * spread, y, z);
    group.add(e);
  }
}

function bug(app: MonsterAppearance): MonsterMesh {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 12), toon(app.main));
  body.scale.set(1, 0.8, 1.25);
  body.position.y = 0.5;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), toon(app.accent));
  head.position.set(0, 0.55, 0.5);
  g.add(head);
  eyes(g, 0.62, 0.74, 0.12, 0.06, 0xffffff);
  // wings
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(
      new THREE.CircleGeometry(0.4, 10),
      new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: makeToonGradient(), transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
    );
    wing.position.set(s * 0.34, 0.72, -0.05);
    wing.rotation.set(Math.PI / 2.4, 0, s * 0.5);
    wing.scale.set(0.7, 1.1, 1);
    g.add(wing);
  }
  // antennae
  for (const s of [-1, 1]) {
    const a = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.35, 5), toon(app.accent));
    a.position.set(s * 0.1, 0.85, 0.62);
    a.rotation.set(0.5, 0, s * 0.3);
    g.add(a);
  }
  g.add(blob(1.1));
  shade(g);
  return { group: g, body, squash: false };
}

function beast(app: MonsterAppearance): MonsterMesh {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.7, 6, 12), toon(app.main));
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.62;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 12), toon(app.main));
  head.position.set(0, 0.78, 0.62);
  g.add(head);
  // snout + ears
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 8), toon(app.accent));
  snout.position.set(0, 0.72, 0.92);
  snout.rotation.x = Math.PI / 2;
  g.add(snout);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 6), toon(app.accent));
    ear.position.set(s * 0.16, 1.02, 0.55);
    g.add(ear);
  }
  eyes(g, 0.86, 0.88, 0.13, 0.05, 0xffe080);
  // legs + tail
  for (const sx of [-0.26, 0.26]) for (const sz of [-0.34, 0.34]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.5, 6), toon(app.accent));
    leg.position.set(sx, 0.25, sz);
    g.add(leg);
  }
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.02, 0.5, 6), toon(app.main));
  tail.position.set(0, 0.7, -0.6);
  tail.rotation.x = -0.8;
  g.add(tail);
  g.add(blob(1.4));
  shade(g);
  return { group: g, body, squash: false };
}

function undead(app: MonsterAppearance): MonsterMesh {
  const g = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.85, 0.32), toon(app.main));
  torso.position.y = 1.0;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 14), toon(app.accent));
  head.position.y = 1.62;
  g.add(head);
  eyes(g, 1.66, 0.24, 0.1, 0.05, 0xff3030);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.6, 0.13), toon(app.main));
    arm.position.set(s * 0.36, 1.0, 0.1);
    arm.rotation.x = -0.6; // reaching forward
    g.add(arm);
  }
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 0.16), toon(app.accent));
    leg.position.set(s * 0.14, 0.3, 0);
    g.add(leg);
  }
  g.add(blob(1.2));
  shade(g);
  return { group: g, body: torso, squash: false };
}

function plant(app: MonsterAppearance): MonsterMesh {
  const g = new THREE.Group();
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.7, 10), toon(app.accent));
  stalk.position.y = 0.4;
  g.add(stalk);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.7), toon(app.main));
  cap.position.y = 0.78;
  cap.scale.y = 0.7;
  g.add(cap);
  // spots
  for (let i = 0; i < 4; i++) {
    const spot = new THREE.Mesh(new THREE.CircleGeometry(0.08, 8), glow(app.accent));
    const a = (i / 4) * Math.PI * 2;
    spot.position.set(Math.sin(a) * 0.32, 0.92, Math.cos(a) * 0.32);
    spot.lookAt(spot.position.x * 2, 2, spot.position.z * 2);
    g.add(spot);
  }
  eyes(g, 0.5, 0.3, 0.12, 0.05, 0x101018);
  g.add(blob(1.3));
  shade(g);
  return { group: g, body: cap, squash: false };
}

function rock(app: MonsterAppearance): MonsterMesh {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 0), new THREE.MeshToonMaterial({ color: app.main, gradientMap: makeToonGradient(), flatShading: true }));
  body.position.y = 0.6;
  g.add(body);
  for (let i = 0; i < 4; i++) {
    const r = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18 + Math.random() * 0.12, 0), new THREE.MeshToonMaterial({ color: app.accent, gradientMap: makeToonGradient(), flatShading: true }));
    const a = (i / 4) * Math.PI * 2;
    r.position.set(Math.sin(a) * 0.5, 0.18, Math.cos(a) * 0.5);
    g.add(r);
  }
  eyes(g, 0.66, 0.5, 0.16, 0.07, 0xffd24a);
  g.add(blob(1.5));
  shade(g);
  return { group: g, body, squash: false };
}

function demon(app: MonsterAppearance): MonsterMesh {
  const g = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.1, 12), toon(app.main, { emissive: new THREE.Color(app.main).multiplyScalar(0.12).getHex() }));
  torso.position.y = 1.1;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 14), toon(app.accent));
  head.position.y = 1.85;
  g.add(head);
  for (const s of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.4, 6), toon(0xece0d0));
    horn.position.set(s * 0.2, 2.12, 0);
    horn.rotation.z = s * 0.5;
    g.add(horn);
  }
  eyes(g, 1.9, 0.3, 0.13, 0.06, 0xff3020);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.9, 8), toon(app.main));
    arm.position.set(s * 0.55, 1.15, 0);
    arm.rotation.z = s * 0.35;
    g.add(arm);
    // bat wing
    const wing = new THREE.Mesh(
      new THREE.CircleGeometry(0.7, 3),
      new THREE.MeshToonMaterial({ color: app.accent, gradientMap: makeToonGradient(), side: THREE.DoubleSide }),
    );
    wing.position.set(s * 0.5, 1.4, -0.25);
    wing.rotation.set(0, s * -0.6, s * 0.3);
    g.add(wing);
  }
  g.add(blob(1.7));
  shade(g);
  return { group: g, body: torso, squash: false };
}

function bird(app: MonsterAppearance): MonsterMesh {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 14), toon(app.main));
  body.scale.set(1, 1.1, 1.2);
  body.position.y = 0.75;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 12), toon(app.main));
  head.position.set(0, 1.2, 0.18);
  g.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.28, 6), toon(0xf0a030));
  beak.position.set(0, 1.18, 0.42);
  beak.rotation.x = Math.PI / 2;
  g.add(beak);
  eyes(g, 1.26, 0.36, 0.12, 0.05, 0x101018);
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(
      new THREE.CircleGeometry(0.6, 8, 0, Math.PI),
      new THREE.MeshToonMaterial({ color: app.accent, gradientMap: makeToonGradient(), side: THREE.DoubleSide }),
    );
    wing.position.set(s * 0.42, 0.8, -0.05);
    wing.rotation.set(Math.PI / 2, 0, s * 0.4);
    g.add(wing);
  }
  // tail feathers
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 5), toon(app.accent));
  tail.position.set(0, 0.7, -0.5);
  tail.rotation.x = Math.PI / 2.2;
  g.add(tail);
  g.add(blob(1.3));
  shade(g);
  return { group: g, body, squash: false };
}

function dragon(app: MonsterAppearance): MonsterMesh {
  const g = new THREE.Group();
  // low, long serpentine body
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.1, 8, 14), toon(app.main));
  body.rotation.z = Math.PI / 2;
  body.position.set(0, 0.7, -0.1);
  g.add(body);
  // raised neck + head
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.34, 0.8, 10), toon(app.main));
  neck.position.set(0, 1.1, 0.55);
  neck.rotation.x = 0.7;
  g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 12), toon(app.main));
  head.position.set(0, 1.45, 0.85);
  head.scale.set(1, 0.9, 1.25);
  g.add(head);
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.36, 8), toon(app.accent));
  snout.position.set(0, 1.4, 1.2);
  snout.rotation.x = Math.PI / 2;
  g.add(snout);
  for (const s of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.32, 6), toon(0xece0d0));
    horn.position.set(s * 0.16, 1.68, 0.74);
    horn.rotation.z = s * 0.4;
    horn.rotation.x = -0.3;
    g.add(horn);
  }
  eyes(g, 1.5, 1.04, 0.14, 0.055, 0xffd24a);
  // large bat wings
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(
      new THREE.CircleGeometry(0.95, 3),
      new THREE.MeshToonMaterial({ color: app.accent, gradientMap: makeToonGradient(), side: THREE.DoubleSide }),
    );
    wing.position.set(s * 0.55, 1.05, -0.15);
    wing.rotation.set(0.2, s * -0.7, s * 0.5);
    g.add(wing);
  }
  // four stubby legs + a tail
  for (const sx of [-0.32, 0.32]) for (const sz of [-0.3, 0.45]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.45, 6), toon(app.accent));
    leg.position.set(sx, 0.22, sz);
    g.add(leg);
  }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.26, 1.2, 8), toon(app.main));
  tail.position.set(0, 0.6, -1.0);
  tail.rotation.x = -Math.PI / 2.3;
  g.add(tail);
  g.add(blob(1.7));
  shade(g);
  return { group: g, body, squash: false };
}

function ghost(app: MonsterAppearance): MonsterMesh {
  const g = new THREE.Group();
  const mat = toon(app.main, { transparent: true, opacity: 0.72, emissive: new THREE.Color(app.main).multiplyScalar(0.25).getHex() });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 14), mat);
  body.position.y = 0.95;
  g.add(body);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.9, 14), mat);
  tail.position.y = 0.45;
  tail.rotation.x = Math.PI;
  g.add(tail);
  eyes(g, 1.02, 0.42, 0.16, 0.07, 0x101018);
  // a faint floor glow instead of a hard shadow
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(0.6, 20),
    new THREE.MeshBasicMaterial({ color: app.main, transparent: true, opacity: 0.18, depthWrite: false }),
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.03;
  g.add(halo);
  return { group: g, body, squash: false };
}
