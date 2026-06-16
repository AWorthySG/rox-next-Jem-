import * as THREE from "three";
import type { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { makeToonGradient } from "./textures.js";
import { applyRimLight } from "./rimLight.js";

// glTF support is loaded on demand: templates that never set a model never pay
// for GLTFLoader/SkeletonUtils in the main bundle.
type Addons = { GLTFLoader: typeof GLTFLoader; clone: (o: THREE.Object3D) => THREE.Object3D };
let addons: Promise<Addons> | null = null;
function getAddons(): Promise<Addons> {
  if (!addons) {
    addons = Promise.all([
      import("three/addons/loaders/GLTFLoader.js"),
      import("three/addons/utils/SkeletonUtils.js"),
    ]).then(([gl, su]) => ({ GLTFLoader: gl.GLTFLoader, clone: su.clone }));
  }
  return addons;
}

// Mid-poly model pipeline. A monster template may opt into a glTF/GLB model
// (see MonsterAppearance.model); until it loads — and if it fails — the view
// keeps its procedural primitive mesh, so this is purely additive.
//
// Drop .glb files into client/public/models/ and reference them by file name
// (e.g. model: "poring.glb"). Vite serves public/ at the site root.

export interface LoadedModel {
  // A wrapper Group sized so the model is ~1.4 units tall with its feet at y=0,
  // matching the procedural meshes — so per-template scale behaves identically.
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

export interface LoadOptions {
  // Convert PBR/standard materials to the game's cel-shaded toon look so
  // dropped-in models match the rest of the bestiary. On by default.
  toon?: boolean;
  // Target world height at scale 1 (procedural meshes are ~1.4 tall).
  height?: number;
}

const MODEL_BASE = "models/";

let loader: GLTFLoader | null = null;
async function getLoader(): Promise<GLTFLoader> {
  if (!loader) {
    const { GLTFLoader } = await getAddons();
    const gl = new GLTFLoader();
    // Real mid-poly exports are usually compressed. meshopt is a self-contained
    // module; Draco fetches its decoder from /draco/ (copied in by the build).
    try {
      const { MeshoptDecoder } = await import("three/addons/libs/meshopt_decoder.module.js");
      gl.setMeshoptDecoder(MeshoptDecoder);
    } catch { /* uncompressed + Draco models still load */ }
    try {
      const { DRACOLoader } = await import("three/addons/loaders/DRACOLoader.js");
      const draco = new DRACOLoader();
      draco.setDecoderPath("draco/");
      gl.setDRACOLoader(draco);
    } catch { /* non-Draco models still load */ }
    loader = gl;
  }
  return loader;
}

// Parse each URL once; repeated spawns of a template share one fetch + parse and
// then clone (clones get their own skeleton + materials, but share geometry).
const cache = new Map<string, Promise<{ scene: THREE.Object3D; animations: THREE.AnimationClip[] }>>();

function loadSource(url: string): Promise<{ scene: THREE.Object3D; animations: THREE.AnimationClip[] }> {
  let p = cache.get(url);
  if (!p) {
    p = getLoader().then(
      (gl) =>
        new Promise((resolve, reject) => {
          gl.load(url, (gltf) => resolve({ scene: gltf.scene, animations: gltf.animations }), undefined, reject);
        }),
    );
    cache.set(url, p);
  }
  return p;
}

// Swap a mesh's material(s) for a toon equivalent, preserving base colour, map,
// and transparency. Skinning/morphs are driven by the mesh, so the toon material
// works on rigged meshes unchanged. The gradient ramp is injected so this stays
// canvas-free and testable headless.
export function toonify(root: THREE.Object3D, gradientMap: THREE.Texture | null): void {
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const convert = (src: THREE.Material): THREE.Material => {
      const s = src as THREE.MeshStandardMaterial;
      const m = new THREE.MeshToonMaterial({
        color: s.color ? s.color.clone() : new THREE.Color(0xffffff),
        map: s.map ?? null,
        gradientMap,
        transparent: s.transparent,
        opacity: s.opacity ?? 1,
        emissive: s.emissive ? s.emissive.clone() : new THREE.Color(0x000000),
      });
      m.side = s.side;
      applyRimLight(m);
      return m;
    };
    o.material = Array.isArray(o.material) ? o.material.map(convert) : convert(o.material as THREE.Material);
  });
}

// Fit the model to a target height and drop it so feet rest on y=0; centre x/z.
// The result is wrapped in a Group whose own transform stays identity, so the
// caller can scale/animate the wrapper exactly like a procedural mesh group.
export function normalize(model: THREE.Object3D, targetHeight: number): THREE.Group {
  const wrapper = new THREE.Group();
  wrapper.add(model);
  let box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const h = size.y || 1;
  model.scale.multiplyScalar(targetHeight / h);
  box = new THREE.Box3().setFromObject(model);
  model.position.x -= (box.min.x + box.max.x) / 2;
  model.position.z -= (box.min.z + box.max.z) / 2;
  model.position.y -= box.min.y;
  return wrapper;
}

// Toon-convert (optional), fit, centre, and shadow-flag a model. Pure + sync +
// canvas-free (gradient is injected), so it's exercised directly by tests.
export function processModel(model: THREE.Object3D, opts: LoadOptions & { gradientMap?: THREE.Texture | null } = {}): THREE.Group {
  if (opts.toon !== false) toonify(model, opts.gradientMap ?? null);
  const wrapper = normalize(model, opts.height ?? 1.4);
  wrapper.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return wrapper;
}

// Load (or reuse) a model and return a ready-to-add, independently animatable
// instance. Throws if the asset is missing/unparseable so callers can fall back.
export async function loadModel(file: string, opts: LoadOptions = {}): Promise<LoadedModel> {
  const [src, { clone: cloneSkeleton }] = await Promise.all([loadSource(MODEL_BASE + file), getAddons()]);
  const model = cloneSkeleton(src.scene);
  const gradientMap = opts.toon !== false ? makeToonGradient() : null;
  const scene = processModel(model, { ...opts, gradientMap });
  return { scene, animations: src.animations };
}
