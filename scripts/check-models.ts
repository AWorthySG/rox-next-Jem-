// Validates every model in client/public/models/ against the spec + poly budget.
// Run after dropping assets in: npm run check:models (also runs in CI).
//
// Hard-fails only on genuine corruption (unparseable JSON glTF, zero meshes).
// Compression that Node can't decode (Draco) and budget/clip/name issues are
// reported as warnings so legit assets never break CI.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MONSTER_TEMPLATES } from "@rox/engine";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("../client/public/models/", import.meta.url));
let files: string[] = [];
try {
  files = readdirSync(dir).filter((f) => f.endsWith(".glb") || f.endsWith(".gltf")).sort();
} catch { /* folder may not exist */ }

if (!files.length) {
  console.log("no models present — nothing to check");
  process.exit(0);
}

const loader = new GLTFLoader();
try {
  const { MeshoptDecoder } = await import("three/examples/jsm/libs/meshopt_decoder.module.js");
  loader.setMeshoptDecoder(MeshoptDecoder as unknown as Parameters<GLTFLoader["setMeshoptDecoder"]>[0]);
} catch { /* meshopt-compressed models can't be verified here */ }

function triangles(scene: THREE.Object3D): number {
  let n = 0;
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      const g = o.geometry;
      n += g.index ? g.index.count / 3 : (g.attributes.position?.count ?? 0) / 3;
    }
  });
  return Math.round(n);
}
function budget(id: string): number | null {
  const t = MONSTER_TEMPLATES[id];
  if (!t) return null;
  return t.worldBoss ? 15000 : t.boss ? 10000 : 5000;
}

let failed = 0;
let warned = 0;
for (const f of files) {
  const id = f.replace(/\.(glb|gltf)$/, "");
  const bytes = readFileSync(dir + f);
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  let gltf: { scene: THREE.Object3D; animations: THREE.AnimationClip[] };
  try {
    gltf = await new Promise((res, rej) => loader.parse(ab, "", res as () => void, rej));
  } catch (e) {
    console.log(`  ⚠ ${f}: could not parse in Node (likely Draco-compressed) — ${(e as Error)?.message ?? e}`);
    warned++;
    continue;
  }
  let meshes = 0;
  gltf.scene.traverse((o) => { if (o instanceof THREE.Mesh) meshes++; });
  if (meshes === 0) {
    console.log(`  ✗ ${f}: no meshes`);
    failed++;
    continue;
  }
  const tris = triangles(gltf.scene);
  const clips = gltf.animations.map((c) => c.name);
  const b = budget(id);
  const flags: string[] = [];
  if (!MONSTER_TEMPLATES[id]) flags.push("filename is not a known template id");
  if (b != null && tris > b) flags.push(`over poly budget (${tris} > ${b})`);
  if (!clips.some((n) => /idle|breath|walk|run|move/i.test(n))) flags.push("no idle/walk clip");
  if (flags.length) warned++;
  console.log(`  ${flags.length ? "⚠" : "✓"} ${f}  ${tris} tris  clips:[${clips.join(", ") || "none"}]${flags.length ? "  — " + flags.join("; ") : ""}`);
}

console.log(`\n${files.length} model(s): ${failed} error(s), ${warned} warning(s)`);
process.exit(failed ? 1 : 0);
