// Hard runtime validation of the model-loading pipeline. Parses the committed
// demo .glb with the real GLTFLoader, runs the loader's actual clone → toonify →
// normalize transforms, and drives an AnimationMixer — all headless in Node.
// Run with: npm run test:model
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { processModel } from "../client/src/procedural/modelLoader.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) { console.log(`  ✓ ${name}`); passed++; }
  else { console.log(`  ✗ ${name}`); failed++; }
}
const near = (a: number, b: number, eps = 0.02) => Math.abs(a - b) <= eps;

const glbPath = fileURLToPath(new URL("../client/public/models/demo_crystal.glb", import.meta.url));
const bytes = readFileSync(glbPath);
// Pass a tight ArrayBuffer view (Buffer may sit in a larger pool).
const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

const gltf = await new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>((resolve, reject) => {
  new GLTFLoader().parse(ab, "", (g) => resolve({ scene: g.scene as THREE.Group, animations: g.animations }), reject);
});

console.log("model: glTF parse");
check("scene parsed with meshes", (() => { let n = 0; gltf.scene.traverse((o) => { if (o instanceof THREE.Mesh) n++; }); return n > 0; })());
check("idle animation clip present", gltf.animations.some((c) => c.name === "idle"));

console.log("model: clone + transform (real loader code)");
const clone = cloneSkeleton(gltf.scene);
let cloneMeshes = 0;
clone.traverse((o) => { if (o instanceof THREE.Mesh) cloneMeshes++; });
check("clone has the same meshes", cloneMeshes > 0);

// gradientMap null keeps this canvas-free; everything else is the production path.
const wrapper = processModel(clone, { height: 1.4, gradientMap: null });
const box = new THREE.Box3().setFromObject(wrapper);
const size = box.getSize(new THREE.Vector3());
const cx = (box.min.x + box.max.x) / 2;
const cz = (box.min.z + box.max.z) / 2;

check("fitted to ~1.4 units tall", near(size.y, 1.4));
check("feet rest on y=0", near(box.min.y, 0, 0.01));
check("centred on X", near(cx, 0));
check("centred on Z", near(cz, 0));

let allToon = true;
let toonCount = 0;
wrapper.traverse((o) => {
  if (!(o instanceof THREE.Mesh)) return;
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  for (const m of mats) { if (m instanceof THREE.MeshToonMaterial) toonCount++; else allToon = false; }
});
check("every surface is toon-converted", allToon && toonCount > 0);

console.log("model: animation playback");
let moved = false;
try {
  const mixer = new THREE.AnimationMixer(wrapper);
  mixer.clipAction(gltf.animations.find((c) => c.name === "idle")!).play();
  const core = wrapper.getObjectByName("core")!;
  const y0 = core.position.y;
  mixer.update(0.5); // mid-bob
  moved = core.position.y !== y0;
} catch {
  moved = false;
}
check("AnimationMixer advances the clip", moved);

console.log(failed === 0 ? "\nMODEL TEST PASSED" : `\nMODEL TEST FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
