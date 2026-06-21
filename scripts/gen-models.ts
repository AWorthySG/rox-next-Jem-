// Generates a batch of procedural mid-poly .glb models for templates whose theme
// suits abstract geometry (mechs, elementals, gels, swarms, constructs). Each is
// named <templateId>.glb and auto-loads by the naming convention. These are
// procedural placeholders pending sculpted art — overwrite the same filenames.
//   npm run gen:models
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

// GLTFExporter reads its GLB Blob back via FileReader (absent in Node).
class NodeFileReader {
  result: ArrayBuffer | string | null = null;
  private cbs: Record<string, () => void> = {};
  addEventListener(t: string, cb: () => void) { this.cbs[t] = cb; }
  set onloadend(cb: () => void) { this.cbs["loadend"] = cb; }
  readAsArrayBuffer(b: Blob) { b.arrayBuffer().then((x) => { this.result = x; this.cbs["loadend"]?.(); }); }
  readAsDataURL(b: Blob) { b.arrayBuffer().then((x) => { this.result = "data:application/octet-stream;base64," + Buffer.from(x).toString("base64"); this.cbs["loadend"]?.(); }); }
}
(globalThis as unknown as { FileReader: unknown }).FileReader = NodeFileReader;

type Built = { root: THREE.Group; anims: THREE.AnimationClip[] };

const std = (color: number, emissive = 0x000000, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, emissive, roughness: 0.5, metalness: 0.1, ...opts });

// Idle + walk clips on a "core" node: a calm bob and a livelier bounce, with an
// optional squash (for gels).
function clips(baseY: number, squash = 0): THREE.AnimationClip[] {
  const t3 = [0, 1, 2];
  const t2 = [0, 0.5, 1];
  const idle: THREE.KeyframeTrack[] = [new THREE.VectorKeyframeTrack("core.position", t3, [0, baseY, 0, 0, baseY + 0.12, 0, 0, baseY, 0])];
  const walk: THREE.KeyframeTrack[] = [new THREE.VectorKeyframeTrack("core.position", t2, [0, baseY, 0, 0, baseY + 0.24, 0, 0, baseY, 0])];
  if (squash > 0) {
    idle.push(new THREE.VectorKeyframeTrack("core.scale", t3, [1, 1, 1, 1 + squash * 0.5, 1 - squash * 0.5, 1 + squash * 0.5, 1, 1, 1]));
    walk.push(new THREE.VectorKeyframeTrack("core.scale", t2, [1, 1, 1, 1 + squash, 1 - squash, 1 + squash, 1, 1, 1]));
  }
  return [new THREE.AnimationClip("idle", 2, idle), new THREE.AnimationClip("walk", 1, walk)];
}

const eyes = (core: THREE.Object3D, z: number, r = 0.1) => {
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), std(0x101018));
    e.position.set(s * 0.22, 0.1, z);
    core.add(e);
  }
};

// ---- reusable parametric builders ----
function jelly(body: number, emis: number): Built {
  const root = new THREE.Group();
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 2), std(body, emis, { roughness: 0.3, transparent: true, opacity: 0.92 }));
  core.name = "core";
  core.position.y = 0.55;
  core.scale.y = 0.8;
  root.add(core);
  eyes(core, 0.5);
  return { root, anims: clips(0.55, 0.12) };
}

function orbMech(body: number, eye: number): Built {
  const root = new THREE.Group();
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 2), std(body, 0x10141c, { metalness: 0.8, roughness: 0.25 }));
  core.name = "core";
  core.position.y = 1.0;
  root.add(core);
  const e = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), std(eye, eye));
  e.position.set(0, 0.05, 0.55);
  core.add(e);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 4), std(0x6a7280, 0x101418, { metalness: 0.7 }));
    fin.position.set(Math.cos(a) * 0.7, 0, Math.sin(a) * 0.7);
    fin.rotation.z = Math.PI / 2;
    fin.rotation.y = -a;
    core.add(fin);
  }
  return { root, anims: clips(1.0) };
}

function elemental(body: number, emis: number): Built {
  const root = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.4, 18, 14), std(body, emis, { roughness: 0.2 }));
  core.name = "core";
  core.position.y = 1.1;
  root.add(core);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 6), std(body, emis));
    t.position.set(Math.cos(a) * 0.35, -0.5, Math.sin(a) * 0.35);
    t.rotation.x = Math.PI;
    core.add(t);
  }
  return { root, anims: clips(1.1) };
}

function swarm(body: number, emis: number): Built {
  const root = new THREE.Group();
  const core = new THREE.Object3D();
  core.name = "core";
  core.position.y = 1.1;
  root.add(core);
  core.add(new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), std(body, emis)));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = 0.5 + (i % 2) * 0.2;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), std(body, emis));
    m.position.set(Math.cos(a) * r, Math.sin(a * 2) * 0.25, Math.sin(a) * r);
    core.add(m);
  }
  return { root, anims: clips(1.1) };
}

function serpent(body: number, emis: number): Built {
  const root = new THREE.Group();
  const core = new THREE.Object3D();
  core.name = "core";
  core.position.y = 1.2;
  root.add(core);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), std(body, emis));
  head.position.set(0, 0, 0.4);
  core.add(head);
  eyes(core, 0.64, 0.07);
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.Mesh(new THREE.SphereGeometry(0.3 - i * 0.03, 14, 10), std(body, emis));
    seg.position.set(Math.sin(i * 0.6) * 0.3, -i * 0.16, -i * 0.3);
    core.add(seg);
  }
  return { root, anims: clips(1.2) };
}

function mech(body: number, eye: number): Built {
  const root = new THREE.Group();
  const core = new THREE.Object3D();
  core.name = "core";
  core.position.y = 0.9;
  root.add(core);
  const m = std(body, 0x10141c, { metalness: 0.6, roughness: 0.4 });
  core.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.5), m));
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.34), m);
  head.position.y = 0.62;
  core.add(head);
  const e = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.02), std(eye, eye));
  e.position.set(0, 0.62, 0.18);
  core.add(e);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.18), m);
    arm.position.set(s * 0.5, 0.05, 0);
    core.add(arm);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.6, 0.24), m);
    leg.position.set(s * 0.2, -0.7, 0);
    core.add(leg);
  }
  return { root, anims: clips(0.9) };
}

// templateId -> builder. Themed to each monster's palette.
const BUILDERS: Record<string, () => Built> = {
  chrome_sentry: () => orbMech(0xc6cdd8, 0x80f0e0),
  scout_bot: () => orbMech(0xb0c0d0, 0x80d0ff),
  metaling: () => orbMech(0xc0c0c8, 0xff8a3a),
  lab_slime: () => jelly(0x9af0c0, 0x1a5a3a),
  magmaring: () => jelly(0xff9a50, 0x7a2008),
  snowier: () => jelly(0xdfeefa, 0x6a8aa0),
  butoijo: () => jelly(0x9ad0c8, 0x2a5a54),
  neon_wisp: () => elemental(0x80f0e0, 0x2aa090),
  surge_elemental: () => elemental(0x60b0e0, 0x1a5a8a),
  drone_swarm: () => swarm(0xb0c0d0, 0x3a4a5a),
  firefly_swarm: () => swarm(0xffe06a, 0xb3860f),
  holo_serpent: () => serpent(0x40d0e0, 0x0a4a6a),
  mecha_dino: () => mech(0xc0c8d0, 0xff6030),
  war_machine: () => mech(0xc08060, 0xff4020),
};

const outDir = fileURLToPath(new URL("../client/public/models/", import.meta.url));
mkdirSync(outDir, { recursive: true });

let pending = Object.keys(BUILDERS).length;
for (const [id, build] of Object.entries(BUILDERS)) {
  const { root, anims } = build();
  new GLTFExporter().parse(
    root,
    (glb) => {
      const buf = Buffer.from(glb as ArrayBuffer);
      writeFileSync(outDir + `${id}.glb`, buf);
      console.log(`wrote ${id}.glb (${buf.byteLength} bytes)`);
      if (--pending === 0) console.log("done");
    },
    (err) => { console.error(`export failed for ${id}`, err); process.exit(1); },
    { binary: true, animations: anims },
  );
}
