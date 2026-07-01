import * as THREE from "three";
import { MAP_HALF } from "@rox/shared";
import { applyWind } from "./wind.js";

export interface Scenery {
  group: THREE.Group;
  // Multiply all prop albedos by `mul` (day/night + weather dimming, base*mul).
  setShade(mul: number): void;
  dispose(): void;
}

// Deterministic small PRNG so each map's scenery layout is stable across visits.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

type TreeStyle = "leafy" | "pine" | "dead" | "palm" | "jungle" | "crystal" | "none";

interface Theme {
  trunk: number;
  foliage: number[];
  rock: number;
  tree: TreeStyle;
  trees: number;
  rocks: number;
  tufts: number;
  tuft: number;
}

const DEFAULT: Theme = { trunk: 0x6b4a2b, foliage: [0x3f8f3a, 0x4fa044, 0x357a30], rock: 0x8a8d92, tree: "leafy", trees: 64, rocks: 34, tufts: 140, tuft: 0x4f9a3f };

const THEMES: Record<string, Partial<Theme>> = {
  field: {},
  payon: { foliage: [0x357a30, 0x2f6b2c, 0x46913f], tree: "pine", trees: 80 },
  cave: { trunk: 0x4a3a2b, foliage: [0x2c3a22], rock: 0x5b5e66, tree: "dead", trees: 26, rocks: 70, tufts: 40, tuft: 0x3a5a30 },
  glast_heim: { trunk: 0x3a3030, foliage: [0x2a3326], rock: 0x6a6d76, tree: "dead", trees: 34, rocks: 64, tufts: 30, tuft: 0x40503a },
  aldebaran: { rock: 0x9aa0ab, tree: "pine", trees: 30, rocks: 50, tufts: 60 },
  comodo: { trunk: 0x9a7b4a, foliage: [0x4fb04a, 0x6cc35f], rock: 0xcaba8a, tree: "palm", trees: 40, rocks: 30, tufts: 70, tuft: 0xc7b576 },
  umbala: { trunk: 0x5a3f28, foliage: [0x2f7a3a, 0x3f9a4a, 0x256b30], rock: 0x6b6f5a, tree: "jungle", trees: 90, rocks: 26, tufts: 160, tuft: 0x3f8f3f },
  juno: { rock: 0x9a8d9a, tree: "leafy", trees: 40, rocks: 44 },
  einbroch: { trunk: 0x4a4438, foliage: [0x55613a], rock: 0x7a756a, tree: "dead", trees: 28, rocks: 60, tufts: 50, tuft: 0x6a6a44 },
  rachel: { trunk: 0x6a5a4a, foliage: [0xbfe0e8], rock: 0xc8d2da, tree: "pine", trees: 44, rocks: 50, tufts: 70, tuft: 0xa9c8c0 },
  thanatos: { trunk: 0x3a2f3a, foliage: [0x6a4fb0], rock: 0x5a4f6a, tree: "crystal", trees: 30, rocks: 60, tufts: 30, tuft: 0x6a4faa },
  tower: { trunk: 0x3a2f3a, foliage: [0x6a4fb0], rock: 0x5a4f6a, tree: "crystal", trees: 24, rocks: 56, tufts: 24, tuft: 0x6a4faa },
  morocc: { rock: 0xc9a86a, tree: "palm", trunk: 0x9a7b4a, foliage: [0x6cae54], trees: 18, rocks: 64, tufts: 30, tuft: 0xc7b576 },
  bio_lab: { trunk: 0x44404a, foliage: [0x55708a], rock: 0x4a525c, tree: "dead", trees: 18, rocks: 64, tufts: 24, tuft: 0x4a6a7a },
  abyss: { trunk: 0x2a3a44, foliage: [0x3aa0c0], rock: 0x3a5564, tree: "crystal", trees: 28, rocks: 66, tufts: 30, tuft: 0x3a8fb0 },
  geffen: { trunk: 0x3a3458, foliage: [0x6a5fb0], rock: 0x4a4470, tree: "crystal", trees: 26, rocks: 50, tufts: 40, tuft: 0x6a5fb0 },
  niflheim: { trunk: 0x3a3338, foliage: [0x2a3230], rock: 0x4a505a, tree: "dead", trees: 40, rocks: 60, tufts: 24, tuft: 0x3a4a42 },
  amatsu: { trunk: 0x6a4a3a, foliage: [0xf0a0c0, 0x4fae54, 0x6cc35f], rock: 0x7a8270, tree: "leafy", trees: 70, rocks: 30, tufts: 120, tuft: 0x4f9a3f },
  lutie: { trunk: 0x7a6a5a, foliage: [0xe8f0f8], rock: 0xd8e4ee, tree: "pine", trees: 60, rocks: 44, tufts: 50, tuft: 0xeaf2fa },
  ayothaya: { trunk: 0x5a3f28, foliage: [0x2f7a3a, 0x3f9a4a], rock: 0x8a8260, tree: "jungle", trees: 80, rocks: 40, tufts: 130, tuft: 0x3f8f3f },
  moscovia: { trunk: 0x4a3a2a, foliage: [0x2f6b2c, 0x3a7a38], rock: 0x5a6a4a, tree: "pine", trees: 90, rocks: 36, tufts: 90, tuft: 0x3a6a30 },
  thor: { trunk: 0x3a1810, foliage: [0xc0401a], rock: 0x4a241a, tree: "dead", trees: 20, rocks: 70, tufts: 40, tuft: 0xc0501a },
  byalan: { rock: 0x3a6a7a, tree: "none", trees: 0, rocks: 80, tufts: 60, tuft: 0x3a8a9a },
  orc_dungeon: { trunk: 0x4a3a26, foliage: [0x4a5a28, 0x3a4a1c], rock: 0x6a5a3a, tree: "dead", trees: 44, rocks: 56, tufts: 60, tuft: 0x5a6a30 },
  gh_church: { trunk: 0x3a3838, foliage: [0x2a3326], rock: 0x5a5e68, tree: "dead", trees: 40, rocks: 62, tufts: 28, tuft: 0x40503a },
  pyramid: { rock: 0xbfa060, tree: "palm", trunk: 0x9a7b4a, foliage: [0x6cae54], trees: 14, rocks: 66, tufts: 30, tuft: 0xc7b576 },
  turtle: { trunk: 0x6a5238, foliage: [0x4fb04a, 0x6cc35f], rock: 0x5a8a6a, tree: "palm", trees: 36, rocks: 40, tufts: 80, tuft: 0x4f9a5f },
  louyang: { trunk: 0x6a4a30, foliage: [0x4a8a3a, 0xc04040], rock: 0x7a7050, tree: "leafy", trees: 64, rocks: 34, tufts: 110, tuft: 0x4a9a3a },
  gh_abyss: { trunk: 0x2a2832, foliage: [0x6a4fb0], rock: 0x3a3a48, tree: "crystal", trees: 30, rocks: 66, tufts: 24, tuft: 0x5a4f8a },
  gonryun: { trunk: 0x6a4a36, foliage: [0x3a8a3a, 0xd05050], rock: 0x7a7458, tree: "leafy", trees: 58, rocks: 38, tufts: 100, tuft: 0x4a9a3a },
  bifrost: { trunk: 0x5a4a6a, foliage: [0x6fb0c0, 0xc090d0], rock: 0x6a6a8a, tree: "jungle", trees: 74, rocks: 30, tufts: 120, tuft: 0x7fb0c0 },
  brasilis: { trunk: 0x5a3f28, foliage: [0x2f7a3a, 0x3f9a4a, 0xf0c040], rock: 0x6a7a4a, tree: "jungle", trees: 88, rocks: 28, tufts: 150, tuft: 0x3f9a3f },
  veins: { rock: 0xb89060, tree: "palm", trunk: 0x9a7b4a, foliage: [0x7cae54], trees: 16, rocks: 72, tufts: 36, tuft: 0xc7a866 },
  scaraba: { rock: 0x5a4632, tree: "dead", trunk: 0x3a2c1a, foliage: [0x4a3a1a], trees: 18, rocks: 74, tufts: 30, tuft: 0x5a4a24 },
  ice_cave: { rock: 0xc8e0ec, tree: "pine", trunk: 0x8a9aa6, foliage: [0xdcecf6], trees: 36, rocks: 64, tufts: 40, tuft: 0xdcecf6 },
  dewata: { trunk: 0x6a4a30, foliage: [0x4fae54, 0xe0a040], rock: 0x6a5a44, tree: "palm", trees: 50, rocks: 40, tufts: 90, tuft: 0x4f9a4f },
  splendide: { trunk: 0x5a6a4a, foliage: [0x6fc0a0, 0xa0e0c0], rock: 0x6a8a7a, tree: "jungle", trees: 78, rocks: 28, tufts: 130, tuft: 0x6fc0a0 },
  eclage: { trunk: 0x4a6a3a, foliage: [0x6fd08a, 0x4faa54], rock: 0x5a7a5a, tree: "jungle", trees: 90, rocks: 24, tufts: 150, tuft: 0x5fc06a },
  manuk: { rock: 0x5a626c, tree: "dead", trunk: 0x3a3e44, foliage: [0x4a5560], trees: 16, rocks: 72, tufts: 30, tuft: 0x5a6a74 },
  merlion_bay: { trunk: 0x8a6b3a, foliage: [0x4fb04a, 0x6cc35f], rock: 0xb0a070, tree: "palm", trees: 40, rocks: 30, tufts: 80, tuft: 0x4f9a5f },
  bukit_timah: { trunk: 0x4a3a24, foliage: [0x2f7a3a, 0x3f9a4a, 0x256b30], rock: 0x5a6a44, tree: "jungle", trees: 96, rocks: 26, tufts: 160, tuft: 0x3f8f3f },
  chinatown: { rock: 0x8a4a3a, tree: "none", trees: 0, rocks: 30, tufts: 120, tuft: 0xd05030 },
  gardens_bay: { trunk: 0x5a4a3a, foliage: [0x4faa54, 0xf070b0, 0x6fd08a], rock: 0x5a7a5a, tree: "crystal", trees: 60, rocks: 30, tufts: 140, tuft: 0x5fc06a },
  pulau_hantu: { trunk: 0x2a3328, foliage: [0x2a3a2a], rock: 0x3a4a3a, tree: "dead", trees: 50, rocks: 50, tufts: 40, tuft: 0x2a4a34 },
  sentosa: { trunk: 0x8a6b3a, foliage: [0x4fb04a, 0x6cc35f], rock: 0xbfae80, tree: "palm", trees: 46, rocks: 26, tufts: 90, tuft: 0x4fae5f },
  kampong_glam: { rock: 0x9a7a50, tree: "palm", trunk: 0x7a5a38, foliage: [0x5fae54, 0xe0b040], trees: 24, rocks: 40, tufts: 80, tuft: 0xc09040 },
  marina_bay: { rock: 0x5a6a8a, tree: "crystal", trunk: 0x3a4a6a, foliage: [0x6fb0e0], trees: 40, rocks: 40, tufts: 60, tuft: 0x6fb0e0 },
  jurong: { trunk: 0x5a4a30, foliage: [0x4a8a3a, 0x6fae54], rock: 0x6a7a5a, tree: "leafy", trees: 60, rocks: 34, tufts: 110, tuft: 0x4a9a3a },
  pulau_ubin: { trunk: 0x5a4228, foliage: [0x2f7a3a, 0x4faa4a], rock: 0x5a6a44, tree: "jungle", trees: 84, rocks: 30, tufts: 140, tuft: 0x3f8f3f },
  haw_par: { trunk: 0x4a2a2a, foliage: [0x6a2a2a], rock: 0x5a3a3a, tree: "dead", trees: 40, rocks: 50, tufts: 60, tuft: 0xa03030 },
  east_coast: { trunk: 0x9a7b4a, foliage: [0x4fb04a, 0x6cc35f], rock: 0xcaba8a, tree: "palm", trees: 44, rocks: 24, tufts: 70, tuft: 0x4f9a5f },
  fort_canning: { trunk: 0x5a4a30, foliage: [0x4a8a3a, 0x6fae54], rock: 0x6a7a5a, tree: "leafy", trees: 76, rocks: 34, tufts: 120, tuft: 0x4a9a3a },
  mount_faber: { trunk: 0x5a4a38, foliage: [0x357a30, 0x46913f], rock: 0x6a7464, tree: "pine", trees: 80, rocks: 40, tufts: 70, tuft: 0x3a7a34 },
  changi: { trunk: 0x8a6b3a, foliage: [0x4fb04a, 0x6cc35f], rock: 0xbfae80, tree: "palm", trees: 50, rocks: 28, tufts: 80, tuft: 0x4fae5f },
  macritchie: { trunk: 0x4a3420, foliage: [0x2f7a3a, 0x4faa4a], rock: 0x5a6a44, tree: "jungle", trees: 90, rocks: 28, tufts: 150, tuft: 0x3f8f3f },
  little_india: { trunk: 0x6a4a30, foliage: [0xe05a40, 0xf0a040], rock: 0xb07050, tree: "leafy", trees: 40, rocks: 36, tufts: 90, tuft: 0xe08040 },
  orchard_road: { trunk: 0x3a3a4a, foliage: [0xc040e0, 0x40c0e0], rock: 0x4a4a5a, tree: "crystal", trees: 44, rocks: 40, tufts: 60, tuft: 0x40c0e0 },
  sungei_buloh: { trunk: 0x5a4a30, foliage: [0x4a9a4a, 0x6cba5f], rock: 0x6a7a5a, tree: "jungle", trees: 70, rocks: 24, tufts: 130, tuft: 0x5a9a4f },
  night_safari: { trunk: 0x241a10, foliage: [0x143a1a, 0x1d4a24], rock: 0x2a2a24, tree: "jungle", trees: 96, rocks: 30, tufts: 150, tuft: 0x1a3a1f },
  kusu_island: { trunk: 0x8a6b3a, foliage: [0x4fb04a, 0x6cc35f], rock: 0xbfae80, tree: "palm", trees: 44, rocks: 26, tufts: 80, tuft: 0x4fae5f },
  botanic_gardens: { trunk: 0x6a5a38, foliage: [0x4fc04a, 0x8ad060], rock: 0xb0c090, tree: "leafy", trees: 72, rocks: 22, tufts: 140, tuft: 0x6fc05f },
  labrador_park: { trunk: 0x5a4a38, foliage: [0x3a7a44, 0x5a9a54], rock: 0x7a7464, tree: "palm", trees: 48, rocks: 40, tufts: 70, tuft: 0x4a8a44 },
  coney_island: { trunk: 0x7a6a40, foliage: [0x5aa04a, 0x7ab85f], rock: 0xb0a878, tree: "palm", trees: 56, rocks: 26, tufts: 110, tuft: 0x5fa84f },
  tiong_bahru: { trunk: 0x6a5a48, foliage: [0x5a8a4a, 0x7aaa5a], rock: 0xa09480, tree: "leafy", trees: 30, rocks: 30, tufts: 60, tuft: 0x6a9a4f },
  punggol_waterway: { trunk: 0x5a5a38, foliage: [0x6aba5a, 0x9ad070], rock: 0x8a9a78, tree: "leafy", trees: 50, rocks: 22, tufts: 130, tuft: 0x7aba5f },
  pasir_ris: { trunk: 0x8a6b3a, foliage: [0x5fc04a, 0x8ad060], rock: 0xc0b088, tree: "palm", trees: 52, rocks: 22, tufts: 110, tuft: 0x6fc05f },
  marina_barrage: { trunk: 0x3a3a4a, foliage: [0x4a7a9a, 0x6aa0c0], rock: 0x4a5a6a, tree: "crystal", trees: 30, rocks: 44, tufts: 50, tuft: 0x5a90b0 },
  the_float: { trunk: 0x2a3a4a, foliage: [0x3a6a9a, 0x5a90c0], rock: 0x3a4a5a, tree: "crystal", trees: 18, rocks: 36, tufts: 30, tuft: 0x4a80b0 },
  southern_ridges: { trunk: 0x5a4a30, foliage: [0x3a8a3a, 0x5faa4f], rock: 0x6a7a5a, tree: "leafy", trees: 84, rocks: 30, tufts: 130, tuft: 0x4a9a3f },
  arena: { trees: 0, rocks: 10, tufts: 30 },
};

// Place `count` props avoiding the central spawn area; denser toward the edges.
function scatter(rng: () => number, count: number, place: (x: number, z: number, s: number) => void): void {
  let placed = 0;
  let guard = 0;
  while (placed < count && guard < count * 8) {
    guard++;
    const x = (rng() * 2 - 1) * MAP_HALF * 0.95;
    const z = (rng() * 2 - 1) * MAP_HALF * 0.95;
    const r = Math.hypot(x, z);
    if (r < 14) continue; // keep the spawn/town clear
    // bias: more likely to keep props that are farther out
    if (rng() > 0.35 + (r / MAP_HALF) * 0.65) continue;
    place(x, z, 0.7 + rng() * 0.7);
    placed++;
  }
}

export function buildScenery(mapId: string): Scenery {
  const theme: Theme = { ...DEFAULT, ...(THEMES[mapId] ?? {}) };
  const rng = mulberry32(hash(mapId));
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const track = <T extends THREE.BufferGeometry, M extends THREE.Material>(g: T, m: M): [T, M] => {
    geos.push(g);
    mats.push(m);
    return [g, m];
  };

  // ---- trees (instanced) ----
  if (theme.tree !== "none" && theme.trees > 0) {
    const placements: Array<{ x: number; z: number; s: number; rot: number }> = [];
    scatter(rng, theme.trees, (x, z, s) => placements.push({ x, z, s, rot: rng() * Math.PI * 2 }));
    addTrees(group, theme, placements, track);
  }

  // ---- rocks (instanced icosahedra), with mossy caps on lush maps ----
  if (theme.rocks > 0) {
    const rockPlace: Array<{ x: number; z: number; s: number; sy: number; q: THREE.Quaternion }> = [];
    scatter(rng, theme.rocks, (x, z, s) => {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rng(), rng() * Math.PI * 2, rng()));
      rockPlace.push({ x, z, s, sy: s * (0.6 + rng() * 0.5), q });
    });
    const [rg, rm] = track(new THREE.IcosahedronGeometry(0.7, 0), new THREE.MeshStandardMaterial({ color: theme.rock, roughness: 1, flatShading: true }));
    const rocks = new THREE.InstancedMesh(rg, rm, rockPlace.length);
    rocks.castShadow = true;
    rocks.receiveShadow = true;
    const m = new THREE.Matrix4();
    rockPlace.forEach((p, i) => {
      m.compose(new THREE.Vector3(p.x, 0.25 * p.s, p.z), p.q, new THREE.Vector3(p.s, p.sy, p.s));
      rocks.setMatrixAt(i, m);
    });
    group.add(rocks);

    // moss caps: a flattened, foliage-tinted shell atop each rock on lush maps
    const mossy = theme.tree === "leafy" || theme.tree === "jungle" || theme.tree === "pine" || theme.tree === "palm";
    if (mossy) {
      const mossColor = new THREE.Color(theme.foliage[0]).multiplyScalar(0.72);
      const [mg, mm] = track(new THREE.IcosahedronGeometry(0.7, 0), new THREE.MeshStandardMaterial({ color: mossColor, roughness: 1, flatShading: true }));
      const moss = new THREE.InstancedMesh(mg, mm, rockPlace.length);
      moss.receiveShadow = true;
      rockPlace.forEach((p, i) => {
        m.compose(new THREE.Vector3(p.x, 0.25 * p.s + p.sy * 0.34, p.z), p.q, new THREE.Vector3(p.s * 0.86, p.sy * 0.5, p.s * 0.86));
        moss.setMatrixAt(i, m);
      });
      group.add(moss);
    }
  }

  // ---- grass tufts / flowers (instanced little cones) ----
  if (theme.tufts > 0) {
    const [tg, tm] = track(new THREE.ConeGeometry(0.16, 0.5, 5), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }));
    applyWind(tm, 0.08); // grass sways a touch more than canopies
    const tufts = new THREE.InstancedMesh(tg, tm, theme.tufts);
    const base = new THREE.Color(theme.tuft);
    const col = new THREE.Color();
    let i = 0;
    const m = new THREE.Matrix4();
    scatter(rng, theme.tufts, (x, z, s) => {
      m.compose(new THREE.Vector3(x, 0.22 * s, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
      tufts.setMatrixAt(i, m);
      // per-tuft brightness/hue jitter so the grass field isn't a flat colour
      col.copy(base).offsetHSL((rng() - 0.5) * 0.05, (rng() - 0.5) * 0.12, (rng() - 0.5) * 0.18);
      tufts.setColorAt(i, col);
      i++;
    });
    tufts.count = i;
    if (tufts.instanceColor) tufts.instanceColor.needsUpdate = true;
    group.add(tufts);
  }

  // ---- wildflowers: bright instanced blooms scattered through grassy maps ----
  const grassy = theme.tree === "leafy" || theme.tree === "jungle" || theme.tree === "palm";
  if (grassy && theme.tufts > 40) {
    const fcount = Math.round(theme.tufts * 0.5);
    const [fg, fm] = track(
      new THREE.IcosahedronGeometry(0.13, 0),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true }),
    );
    applyWind(fm, 0.06);
    const flowers = new THREE.InstancedMesh(fg, fm, fcount);
    const palette = [0xff6b8a, 0xffd24a, 0xf4f0f0, 0xff9a3a, 0xc080e0, 0xff5060];
    const col = new THREE.Color();
    const fm4 = new THREE.Matrix4();
    let fi = 0;
    scatter(rng, fcount, (x, z, s) => {
      fm4.compose(new THREE.Vector3(x, 0.3 * s, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
      flowers.setMatrixAt(fi, fm4);
      col.setHex(palette[(rng() * palette.length) | 0]).offsetHSL((rng() - 0.5) * 0.04, 0, (rng() - 0.5) * 0.1);
      flowers.setColorAt(fi, col);
      fi++;
    });
    flowers.count = fi;
    if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true;
    group.add(flowers);
  }

  // Capture each prop material's base colour so day/night dimming can scale it
  // (base × mul) without losing the material's hue.
  const shadeList = mats
    .filter((m): m is THREE.MeshStandardMaterial => m instanceof THREE.MeshStandardMaterial)
    .map((m) => ({ mat: m, base: m.color.clone() }));

  // ---- landmark centerpiece + plaza lamps (ROX-style town dressing) ----
  // The map centre is kept clear of scatter props, so a themed monument there
  // gives every map a readable landmark; lamps ring it and glow at night
  // (MeshBasicMaterial heads are exempt from setShade, so they stay lit).
  if (mapId !== "arena") {
    // stone plaza under the fountain + a paved path south toward the spawn row,
    // so the town centre reads as constructed ground rather than bare grass
    const paveMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.rock).lerp(new THREE.Color(0xffffff), 0.18), roughness: 0.9 });
    const [plazaGeo] = track(new THREE.CircleGeometry(4.4, 24), paveMat);
    const plaza = new THREE.Mesh(plazaGeo, paveMat);
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.015;
    plaza.receiveShadow = true;
    group.add(plaza);
    const [rimGeo, rimMat] = track(
      new THREE.RingGeometry(4.4, 4.75, 24),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.rock).multiplyScalar(0.75), roughness: 0.95 }),
    );
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.014;
    group.add(rim);
    const [pathGeo] = track(new THREE.PlaneGeometry(2.4, 22), rimMat);
    const path = new THREE.Mesh(pathGeo, rimMat);
    path.rotation.x = -Math.PI / 2;
    path.position.set(0, 0.012, 15);
    path.receiveShadow = true;
    group.add(path);

    addCenterpiece(group, theme, track);
    addHouses(group, theme, track);
    const lampPost = track(new THREE.CylinderGeometry(0.07, 0.09, 2.2, 6), new THREE.MeshStandardMaterial({ color: 0x3a3430, roughness: 0.9 }));
    const lampHeadGeo = new THREE.SphereGeometry(0.16, 10, 8);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
    track(lampHeadGeo, lampMat);
    for (const [lx, lz] of [[-5.5, -5.5], [5.5, -5.5], [-5.5, 5.5], [5.5, 5.5]] as const) {
      const post = new THREE.Mesh(lampPost[0], lampPost[1]);
      post.position.set(lx, 1.1, lz);
      post.castShadow = true;
      group.add(post);
      const head = new THREE.Mesh(lampHeadGeo, lampMat);
      head.position.set(lx, 2.3, lz);
      group.add(head);
    }
  }

  return {
    group,
    setShade(mul: number) {
      for (const s of shadeList) s.mat.color.copy(s.base).multiplyScalar(mul);
    },
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
    },
  };
}

// A trio of small village houses ringing the plaza on its north side (the south
// approach from spawn stays open). Plastered walls tinted by the map's rock
// tone, a pyramid roof from the trunk tone, a door and warm windows that stay
// lit at night (MeshBasicMaterial is exempt from day/night shading).
function addHouses(
  group: THREE.Group,
  theme: Theme,
  track: <T extends THREE.BufferGeometry, M extends THREE.Material>(g: T, m: M) => [T, M],
): void {
  const [wallGeo, wallMat] = track(
    new THREE.BoxGeometry(2.6, 1.8, 2.2),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.rock).lerp(new THREE.Color(0xffffff), 0.35), roughness: 0.95 }),
  );
  const [roofGeo, roofMat] = track(
    new THREE.ConeGeometry(2.2, 1.2, 4),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.trunk).multiplyScalar(0.9), roughness: 0.9, flatShading: true }),
  );
  const [doorGeo, doorMat] = track(new THREE.BoxGeometry(0.6, 1.0, 0.08), new THREE.MeshStandardMaterial({ color: 0x4a3220, roughness: 1 }));
  const [winGeo, winMat] = track(new THREE.BoxGeometry(0.42, 0.42, 0.06), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));

  const placements = [
    { x: -9.5, z: -7 },
    { x: 0, z: -11.5 },
    { x: 9.5, z: -7 },
  ];
  for (const p of placements) {
    const house = new THREE.Group();
    const walls = new THREE.Mesh(wallGeo, wallMat);
    walls.position.y = 0.9;
    walls.castShadow = true;
    house.add(walls);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 2.35;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    house.add(roof);
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(0, 0.5, 1.12);
    house.add(door);
    for (const s of [-1, 1]) {
      const win = new THREE.Mesh(winGeo, winMat);
      win.position.set(s * 0.85, 1.1, 1.12);
      house.add(win);
    }
    house.position.set(p.x, 0, p.z);
    house.rotation.y = Math.atan2(-p.x, -p.z); // door side (+z) faces the fountain
    group.add(house);
  }
}

// A themed monument at the map centre: a tiered fountain on living maps, a
// glowing crystal monolith on crystal maps, a weathered obelisk on dead ones.
function addCenterpiece(
  group: THREE.Group,
  theme: Theme,
  track: <T extends THREE.BufferGeometry, M extends THREE.Material>(g: T, m: M) => [T, M],
): void {
  const stoneMat = new THREE.MeshStandardMaterial({ color: theme.rock, roughness: 0.95 });
  if (theme.tree === "crystal") {
    // crystal monolith with a soft inner glow
    const [geo, mat] = track(
      new THREE.OctahedronGeometry(1.5, 0),
      new THREE.MeshStandardMaterial({ color: theme.foliage[0], roughness: 0.3, emissive: new THREE.Color(theme.foliage[0]).multiplyScalar(0.4) }),
    );
    const shard = new THREE.Mesh(geo, mat);
    shard.position.y = 2.0;
    shard.scale.y = 1.6;
    shard.castShadow = true;
    const [baseGeo] = track(new THREE.CylinderGeometry(1.4, 1.7, 0.5, 8), stoneMat);
    const base = new THREE.Mesh(baseGeo, stoneMat);
    base.position.y = 0.25;
    group.add(base, shard);
  } else if (theme.tree === "dead") {
    // weathered obelisk
    const [geo] = track(new THREE.CylinderGeometry(0.35, 0.6, 3.4, 4), stoneMat);
    const obelisk = new THREE.Mesh(geo, stoneMat);
    obelisk.position.y = 1.7;
    obelisk.rotation.y = Math.PI / 4;
    obelisk.castShadow = true;
    const [tipGeo] = track(new THREE.ConeGeometry(0.42, 0.5, 4), stoneMat);
    const tip = new THREE.Mesh(tipGeo, stoneMat);
    tip.position.y = 3.6;
    tip.rotation.y = Math.PI / 4;
    const [baseGeo2] = track(new THREE.BoxGeometry(1.6, 0.5, 1.6), stoneMat);
    const base = new THREE.Mesh(baseGeo2, stoneMat);
    base.position.y = 0.25;
    group.add(base, obelisk, tip);
  } else {
    // tiered plaza fountain with a glowing water disc + centre jet
    const [basinGeo] = track(new THREE.CylinderGeometry(2.2, 2.4, 0.7, 14, 1, false), stoneMat);
    const basin = new THREE.Mesh(basinGeo, stoneMat);
    basin.position.y = 0.35;
    basin.castShadow = true;
    const [waterGeo, waterMat] = track(
      new THREE.CylinderGeometry(2.0, 2.0, 0.08, 14),
      new THREE.MeshBasicMaterial({ color: 0x8fd8e8, transparent: true, opacity: 0.85 }),
    );
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.position.y = 0.68;
    const [colGeo] = track(new THREE.CylinderGeometry(0.28, 0.4, 1.3, 10), stoneMat);
    const column = new THREE.Mesh(colGeo, stoneMat);
    column.position.y = 1.3;
    column.castShadow = true;
    const [topGeo] = track(new THREE.CylinderGeometry(0.85, 1.0, 0.3, 12), stoneMat);
    const top = new THREE.Mesh(topGeo, stoneMat);
    top.position.y = 1.95;
    const [jetGeo, jetMat] = track(new THREE.ConeGeometry(0.18, 0.7, 8), new THREE.MeshBasicMaterial({ color: 0xbfeaf4, transparent: true, opacity: 0.8 }));
    const jet = new THREE.Mesh(jetGeo, jetMat);
    jet.position.y = 2.4;
    group.add(basin, water, column, top, jet);
  }
}

function addTrees(
  group: THREE.Group,
  theme: Theme,
  placements: Array<{ x: number; z: number; s: number; rot: number }>,
  track: <T extends THREE.BufferGeometry, M extends THREE.Material>(g: T, m: M) => [T, M],
): void {
  const n = placements.length;
  const trunkMatColor = theme.trunk;
  const [trunkGeo, trunkMat] = track(new THREE.CylinderGeometry(0.18, 0.28, 2.4, 6), new THREE.MeshStandardMaterial({ color: trunkMatColor, roughness: 1 }));
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, n);
  trunks.castShadow = true;

  // Foliage geometry varies by style.
  let foliageGeo: THREE.BufferGeometry;
  let foliageY = 2.6;
  let foliageScale = 1;
  switch (theme.tree) {
    case "pine":
      foliageGeo = new THREE.ConeGeometry(1.1, 2.8, 7);
      foliageY = 2.7;
      break;
    case "palm":
      foliageGeo = new THREE.SphereGeometry(0.9, 8, 6);
      foliageY = 2.9;
      foliageScale = 1.2;
      break;
    case "jungle":
      foliageGeo = new THREE.IcosahedronGeometry(1.5, 0);
      foliageY = 3.0;
      break;
    case "crystal":
      foliageGeo = new THREE.OctahedronGeometry(1.1, 0);
      foliageY = 2.8;
      break;
    case "dead":
      foliageGeo = new THREE.IcosahedronGeometry(0.5, 0);
      foliageY = 2.2;
      break;
    default:
      foliageGeo = new THREE.IcosahedronGeometry(1.25, 0);
      foliageY = 2.7;
  }
  // Foliage colour is driven per-tree via instanceColor (material left white), so
  // a forest reads as many shades of green rather than one flat tone.
  const foliageColor = theme.foliage[0];
  const foliageMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    flatShading: true,
    emissive: theme.tree === "crystal" ? new THREE.Color(foliageColor).multiplyScalar(0.35) : 0x000000,
  });
  track(foliageGeo, foliageMat);
  applyWind(foliageMat);
  const foliage = new THREE.InstancedMesh(foliageGeo, foliageMat, n);
  foliage.castShadow = true;

  // Second, smaller canopy layer in the theme's lighter foliage tone, sitting
  // atop the first — fuller, two-tone trees.
  const foliageColor2 = theme.foliage[1] ?? theme.foliage[0];
  const [, foliageMat2] = track(
    foliageGeo,
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 1,
      flatShading: true,
      emissive: theme.tree === "crystal" ? new THREE.Color(foliageColor2).multiplyScalar(0.35) : 0x000000,
    }),
  );
  applyWind(foliageMat2);
  const foliage2 = new THREE.InstancedMesh(foliageGeo, foliageMat2, n);
  foliage2.castShadow = true;

  const fCol = new THREE.Color(foliageColor);
  const fCol2 = new THREE.Color(foliageColor2);
  const c = new THREE.Color();
  const frac = (x: number) => x - Math.floor(x);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    const p = placements[i];
    q.setFromAxisAngle(up, p.rot);
    m.compose(new THREE.Vector3(p.x, 1.2 * p.s, p.z), q, new THREE.Vector3(p.s, p.s, p.s));
    trunks.setMatrixAt(i, m);
    // deterministic per-tree colour jitter from position
    const jit = frac(Math.sin(p.x * 12.9898 + p.z * 4.1414) * 43758.5453);
    const dl = (jit - 0.5) * 0.22;
    c.copy(fCol).offsetHSL((jit - 0.5) * 0.04, 0, dl);
    foliage.setColorAt(i, c);
    c.copy(fCol2).offsetHSL((jit - 0.5) * 0.04, 0, dl * 0.8);
    foliage2.setColorAt(i, c);
    const fs = p.s * foliageScale;
    m.compose(new THREE.Vector3(p.x, foliageY * p.s, p.z), q, new THREE.Vector3(fs, fs, fs));
    foliage.setMatrixAt(i, m);
    const fs2 = fs * 0.62;
    m.compose(new THREE.Vector3(p.x, (foliageY + 0.7) * p.s, p.z), q, new THREE.Vector3(fs2, fs2, fs2));
    foliage2.setMatrixAt(i, m);
  }
  if (foliage.instanceColor) foliage.instanceColor.needsUpdate = true;
  if (foliage2.instanceColor) foliage2.instanceColor.needsUpdate = true;
  group.add(trunks, foliage, foliage2);
}
