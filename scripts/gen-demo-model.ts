// Generates a real mid-poly .glb so the model-loading path has a committed asset
// to validate against (and a live in-game demo). Run with: npm run gen:model
//
// Builds a faceted "crystal construct" — a cel-shade-friendly floating gem with
// orbiting shards and a base ring — plus an "idle" bob/spin animation clip, and
// writes it to client/public/models/demo_crystal.glb.
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

// GLTFExporter turns the GLB into a Blob and reads it back via FileReader; Node
// has Blob but not FileReader, so provide the minimal slice the exporter uses.
class NodeFileReader {
  result: ArrayBuffer | string | null = null;
  private cbs: Record<string, () => void> = {};
  addEventListener(t: string, cb: () => void) { this.cbs[t] = cb; }
  set onloadend(cb: () => void) { this.cbs["loadend"] = cb; }
  readAsArrayBuffer(blob: Blob) { blob.arrayBuffer().then((b) => { this.result = b; this.cbs["loadend"]?.(); }); }
  readAsDataURL(blob: Blob) { blob.arrayBuffer().then((b) => { this.result = "data:application/octet-stream;base64," + Buffer.from(b).toString("base64"); this.cbs["loadend"]?.(); }); }
}
(globalThis as unknown as { FileReader: unknown }).FileReader = NodeFileReader;

const root = new THREE.Group();

// Faceted core (kept low — detail 2 icosahedron ≈ 320 tris).
const core = new THREE.Mesh(
  new THREE.IcosahedronGeometry(0.55, 2),
  new THREE.MeshStandardMaterial({ color: 0x7ad0ff, emissive: 0x1a4a6a, metalness: 0.1, roughness: 0.4 }),
);
core.name = "core";
core.position.y = 1.0;
root.add(core);

// Orbiting shards.
const shardGeo = new THREE.OctahedronGeometry(0.18, 0);
const shardMat = new THREE.MeshStandardMaterial({ color: 0xcdeeff, emissive: 0x2a6a8a });
for (let i = 0; i < 6; i++) {
  const a = (i / 6) * Math.PI * 2;
  const shard = new THREE.Mesh(shardGeo, shardMat);
  shard.position.set(Math.cos(a) * 0.85, 1.0 + Math.sin(a * 2) * 0.15, Math.sin(a) * 0.85);
  shard.scale.setScalar(0.6 + (i % 3) * 0.25);
  core.add(shard);
}

// Base ring so it reads as a hovering construct.
const ring = new THREE.Mesh(
  new THREE.TorusGeometry(0.6, 0.07, 10, 28),
  new THREE.MeshStandardMaterial({ color: 0x3a5a8a, emissive: 0x0a2a4a }),
);
ring.rotation.x = Math.PI / 2;
ring.position.y = 0.18;
root.add(ring);

// "idle": gentle bob + a quarter spin loop on the core.
const times = [0, 1, 2];
const bob = new THREE.VectorKeyframeTrack("core.position", times, [0, 1.0, 0, 0, 1.15, 0, 0, 1.0, 0]);
const q0 = new THREE.Quaternion();
const q1 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
const q2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI * 2);
const spin = new THREE.QuaternionKeyframeTrack(
  "core.quaternion",
  times,
  [q0.x, q0.y, q0.z, q0.w, q1.x, q1.y, q1.z, q1.w, q2.x, q2.y, q2.z, q2.w],
);
const clip = new THREE.AnimationClip("idle", 2, [bob, spin]);

const outDir = fileURLToPath(new URL("../client/public/models/", import.meta.url));
const outFile = outDir + "demo_crystal.glb";
mkdirSync(outDir, { recursive: true });

new GLTFExporter().parse(
  root,
  (glb) => {
    const buf = Buffer.from(glb as ArrayBuffer);
    writeFileSync(outFile, buf);
    console.log(`wrote ${outFile} (${buf.byteLength} bytes)`);
  },
  (err) => {
    console.error("export failed", err);
    process.exit(1);
  },
  { binary: true, animations: [clip] },
);
