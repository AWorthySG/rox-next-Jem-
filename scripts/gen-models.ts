// Generates a small batch of procedural mid-poly .glb models for templates whose
// theme suits abstract geometry (futuristic mechs / gels / wisps), to exercise
// the model pipeline at scale: each is named <templateId>.glb and auto-loads by
// convention. These are procedural placeholders pending sculpted art.
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

const std = (color: number, emissive = 0x000000, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, emissive, roughness: 0.5, metalness: 0.1, ...opts });

// Two-key bob/scale clips on a named "core" node: a calm idle and a livelier walk.
function clips(idleBobY: number, walkBobY: number, squash = 0): THREE.AnimationClip[] {
  const t3 = [0, 1, 2];
  const t2 = [0, 0.5, 1];
  const idlePos = new THREE.VectorKeyframeTrack("core.position", t3, [0, idleBobY, 0, 0, idleBobY + 0.12, 0, 0, idleBobY, 0]);
  const walkPos = new THREE.VectorKeyframeTrack("core.position", t2, [0, walkBobY, 0, 0, walkBobY + 0.22, 0, 0, walkBobY, 0]);
  const idle = [idlePos];
  const walk = [walkPos];
  if (squash > 0) {
    idle.push(new THREE.VectorKeyframeTrack("core.scale", t3, [1, 1, 1, 1 + squash * 0.5, 1 - squash * 0.5, 1 + squash * 0.5, 1, 1, 1]));
    walk.push(new THREE.VectorKeyframeTrack("core.scale", t2, [1, 1, 1, 1 + squash, 1 - squash, 1 + squash, 1, 1, 1]));
  }
  return [new THREE.AnimationClip("idle", 2, idle), new THREE.AnimationClip("walk", 1, walk)];
}

// ---- per-template builders ----
function chromeSentry(): { root: THREE.Group; anims: THREE.AnimationClip[] } {
  const root = new THREE.Group();
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 2), std(0xc6cdd8, 0x10141c, { metalness: 0.8, roughness: 0.25 }));
  core.name = "core";
  core.position.y = 1.0;
  root.add(core);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), std(0x80f0e0, 0x2a8a7a));
  eye.position.set(0, 0.05, 0.55);
  core.add(eye);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 4), std(0x6a7280, 0x101418, { metalness: 0.7 }));
    fin.position.set(Math.cos(a) * 0.7, 0, Math.sin(a) * 0.7);
    fin.rotation.z = Math.PI / 2;
    fin.rotation.y = -a;
    core.add(fin);
  }
  return { root, anims: clips(1.0, 1.0) };
}

function labSlime(): { root: THREE.Group; anims: THREE.AnimationClip[] } {
  const root = new THREE.Group();
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 2), std(0x9af0c0, 0x1a5a3a, { roughness: 0.3, transparent: true, opacity: 0.92 }));
  core.name = "core";
  core.position.y = 0.55;
  core.scale.y = 0.8;
  root.add(core);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), std(0x101018));
    eye.position.set(s * 0.22, 0.1, 0.5);
    core.add(eye);
  }
  return { root, anims: clips(0.55, 0.55, 0.12) };
}

function neonWisp(): { root: THREE.Group; anims: THREE.AnimationClip[] } {
  const root = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.4, 18, 14), std(0x80f0e0, 0x2aa090, { roughness: 0.2 }));
  core.name = "core";
  core.position.y = 1.1;
  root.add(core);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 6), std(0x40c0c0, 0x1a6a6a));
    tail.position.set(Math.cos(a) * 0.35, -0.5, Math.sin(a) * 0.35);
    tail.rotation.x = Math.PI;
    core.add(tail);
  }
  return { root, anims: clips(1.1, 1.1) };
}

const BUILDERS: Record<string, () => { root: THREE.Group; anims: THREE.AnimationClip[] }> = {
  chrome_sentry: chromeSentry,
  lab_slime: labSlime,
  neon_wisp: neonWisp,
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
