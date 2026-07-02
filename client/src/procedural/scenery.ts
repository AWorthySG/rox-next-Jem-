import * as THREE from "three";
import { MAP_HALF } from "@rox/shared";
import { MAPS, MONSTER_TEMPLATES } from "@rox/engine";
import { applyWind } from "./wind.js";
import { makeSpark } from "./textures.js";
import { WATER_MAPS } from "./waterMaps.js";

export interface Scenery {
  group: THREE.Group;
  // Multiply all prop albedos by `mul` (day/night + weather dimming, base*mul).
  setShade(mul: number): void;
  // Blend emissive props (lamp heads, house windows) between a dim daytime
  // tone and a bright night glow (0 = day, 1 = night).
  setNight(n: number): void;
  // Advance centerpiece animation (fountain jet pulse, crystal spin).
  tick(dt: number): void;
  dispose(): void;
}

// An emissive prop material that changes with the day/night cycle.
interface NightLight {
  mat: THREE.MeshBasicMaterial;
  day: THREE.Color;
  night: THREE.Color;
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
  snowy?: boolean; // pines carry snow caps (Lutie / Rachel)
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
  rachel: { trunk: 0x6a5a4a, foliage: [0xbfe0e8], rock: 0xc8d2da, tree: "pine", trees: 44, rocks: 50, tufts: 70, tuft: 0xa9c8c0, snowy: true },
  thanatos: { trunk: 0x3a2f3a, foliage: [0x6a4fb0], rock: 0x5a4f6a, tree: "crystal", trees: 30, rocks: 60, tufts: 30, tuft: 0x6a4faa },
  tower: { trunk: 0x3a2f3a, foliage: [0x6a4fb0], rock: 0x5a4f6a, tree: "crystal", trees: 24, rocks: 56, tufts: 24, tuft: 0x6a4faa },
  morocc: { rock: 0xc9a86a, tree: "palm", trunk: 0x9a7b4a, foliage: [0x6cae54], trees: 18, rocks: 64, tufts: 30, tuft: 0xc7b576 },
  bio_lab: { trunk: 0x44404a, foliage: [0x55708a], rock: 0x4a525c, tree: "dead", trees: 18, rocks: 64, tufts: 24, tuft: 0x4a6a7a },
  abyss: { trunk: 0x2a3a44, foliage: [0x3aa0c0], rock: 0x3a5564, tree: "crystal", trees: 28, rocks: 66, tufts: 30, tuft: 0x3a8fb0 },
  geffen: { trunk: 0x3a3458, foliage: [0x6a5fb0], rock: 0x4a4470, tree: "crystal", trees: 26, rocks: 50, tufts: 40, tuft: 0x6a5fb0 },
  niflheim: { trunk: 0x3a3338, foliage: [0x2a3230], rock: 0x4a505a, tree: "dead", trees: 40, rocks: 60, tufts: 24, tuft: 0x3a4a42 },
  amatsu: { trunk: 0x6a4a3a, foliage: [0xf0a0c0, 0x4fae54, 0x6cc35f], rock: 0x7a8270, tree: "leafy", trees: 70, rocks: 30, tufts: 120, tuft: 0x4f9a3f },
  lutie: { trunk: 0x7a6a5a, foliage: [0xe8f0f8], rock: 0xd8e4ee, tree: "pine", trees: 60, rocks: 44, tufts: 50, tuft: 0xeaf2fa, snowy: true },
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
  const nightLights: NightLight[] = [];
  // materials whose opacity fades in with night (lamp light-pools on the ground)
  const nightFades: { mat: THREE.Material & { opacity: number }; max: number }[] = [];
  // materials that do the opposite — visible by day, gone after dark (pollen)
  const dayFades: { mat: THREE.Material & { opacity: number }; max: number }[] = [];
  // meshes that flicker like flame (brazier embers) — scale-pulsed in tick()
  const flickers: THREE.Mesh[] = [];
  // objects that bob on the water (the moored rowboat, the distant ship)
  const bobbers: { obj: THREE.Object3D; baseY: number; phase: number }[] = [];
  // objects that spin in place (windmill hubs)
  const spinners: { obj: THREE.Object3D; speed: number; axis?: "y" }[] = [];
  // small sprites that orbit a point (fireflies around lamps at night)
  const orbiters: { sprite: THREE.Sprite; cx: number; cz: number; y: number; r: number; speed: number; phase: number }[] = [];
  // looping chimney-smoke puffs (rise, swell and thin out above house roofs)
  const smokes: { sprite: THREE.Sprite; baseY: number; offset: number }[] = [];
  // things that fly a circular route around the map (airship, seabirds); they
  // face along the flight path and optionally flap wing pivots as they go
  const cruisers: { obj: THREE.Object3D; r: number; y: number; speed: number; phase: number; wings?: THREE.Object3D[]; cx?: number; cz?: number; flapRate?: number; bob?: number }[] = [];
  // leaves that tumble down around the plaza on living maps, looping forever
  const leaves: { m: THREE.Mesh; x: number; z: number; offset: number; spin: number }[] = [];
  // fish that periodically leap out of the sea in a little arc near the pier
  const jumpers: { obj: THREE.Object3D; x: number; z: number; offset: number }[] = [];
  let animated: CenterpieceAnim = null;
  let animPhase = 0;
  // current darkness level (0 day → 1 night), mirrored from setNight so tick()
  // can gate effects that only belong in the night sky (shooting stars)
  let nightNow = 0;
  // one recycled shooting star: an elongated additive streak that dashes
  // across the sky for the first moments of each ~9 s cycle, then hides
  const starMat = new THREE.SpriteMaterial({ map: makeSpark(), color: 0xeaf4ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  mats.push(starMat);
  const star = new THREE.Sprite(starMat);
  star.scale.set(3.2, 0.18, 1);
  group.add(star);
  // one recycled festival firework: a soft coloured burst blooms over the
  // town every ~13 s after dark, expanding as it fades
  const fireworkMat = new THREE.SpriteMaterial({ map: makeSpark(), color: 0xff80c0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  mats.push(fireworkMat);
  const firework = new THREE.Sprite(fireworkMat);
  group.add(firework);
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

    animated = addCenterpiece(group, theme, track);
    // koi circling the fountain basin on maps whose centerpiece holds water
    if (animated?.water) {
      const [koiGeo, koiMat] = track(
        new THREE.ConeGeometry(0.06, 0.3, 6),
        new THREE.MeshStandardMaterial({ color: 0xe8823a, roughness: 0.5 }),
      );
      for (let k = 0; k < 3; k++) {
        const koi = new THREE.Group();
        const koiBody = new THREE.Mesh(koiGeo, koiMat);
        koiBody.rotation.x = Math.PI / 2; // nose along +z
        koi.add(koiBody);
        group.add(koi);
        cruisers.push({ obj: koi, r: 0.75 + k * 0.25, y: 0.32, speed: (0.5 + k * 0.15) * (k % 2 === 0 ? 1 : -1), phase: (k / 3) * Math.PI * 2, bob: 0.02 });
      }
    }
    addHouses(group, theme, track, nightLights, smokes, spinners);
    addPlazaProps(group, theme, track);

    // flower beds around the plaza rim on living maps (the south path stays clear)
    if (theme.tree === "leafy" || theme.tree === "jungle" || theme.tree === "palm") {
      const [soilGeo, soilMat] = track(
        new THREE.CylinderGeometry(0.75, 0.85, 0.14, 10),
        new THREE.MeshStandardMaterial({ color: 0x4a3624, roughness: 1 }),
      );
      const bloomMats = [0xff6b8a, 0xffd24a, 0xf4f0f0, 0xc080e0].map((c) => {
        const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, flatShading: true });
        applyWind(m, 0.05);
        mats.push(m);
        return m;
      });
      const [bloomGeo] = track(new THREE.IcosahedronGeometry(0.16, 0), bloomMats[0]);
      for (const deg of [150, 195, 240, 285, 330, 15]) {
        const a = (deg / 180) * Math.PI;
        const bx = Math.cos(a) * 5.6;
        const bz = Math.sin(a) * 5.6;
        const soil = new THREE.Mesh(soilGeo, soilMat);
        soil.position.set(bx, 0.07, bz);
        group.add(soil);
        for (let b = 0; b < 4; b++) {
          const bloom = new THREE.Mesh(bloomGeo, bloomMats[(deg + b) % bloomMats.length]);
          bloom.position.set(bx + (rng() - 0.5) * 0.8, 0.28, bz + (rng() - 0.5) * 0.8);
          group.add(bloom);
        }
      }

      // butterflies flit in tight circles above the beds, wings beating fast
      const [flutterGeo, flutterMat] = track(
        new THREE.PlaneGeometry(0.16, 0.12),
        new THREE.MeshBasicMaterial({ color: 0xffb0d0, side: THREE.DoubleSide }),
      );
      const flutterMat2 = new THREE.MeshBasicMaterial({ color: 0x9ad0ff, side: THREE.DoubleSide });
      mats.push(flutterMat2);
      for (let b = 0; b < 3; b++) {
        const deg = [150, 240, 330][b];
        const a = (deg / 180) * Math.PI;
        const butterfly = new THREE.Group();
        const wings: THREE.Object3D[] = [];
        for (const s of [-1, 1]) {
          const pivot = new THREE.Group();
          if (s < 0) pivot.rotation.y = Math.PI;
          const wing = new THREE.Mesh(flutterGeo, b % 2 ? flutterMat2 : flutterMat);
          wing.position.x = 0.09;
          pivot.add(wing);
          butterfly.add(pivot);
          wings.push(pivot);
        }
        group.add(butterfly);
        cruisers.push({
          obj: butterfly,
          cx: Math.cos(a) * 5.6,
          cz: Math.sin(a) * 5.6,
          r: 0.7 + rng() * 0.5,
          y: 0.7 + rng() * 0.5,
          speed: (0.9 + rng() * 0.5) * (b % 2 === 0 ? 1 : -1),
          phase: rng() * Math.PI * 2,
          wings,
          flapRate: 18,
        });
      }
    }

    // falling leaves tumbling down around the town on leafy/jungle maps
    if (theme.tree === "leafy" || theme.tree === "jungle") {
      const [leafGeo, leafMat] = track(
        new THREE.PlaneGeometry(0.16, 0.16),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(theme.foliage[0]).multiplyScalar(0.9), side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
      );
      for (let i = 0; i < 22; i++) {
        const m = new THREE.Mesh(leafGeo, leafMat);
        group.add(m);
        const a = rng() * Math.PI * 2;
        const r = 6 + rng() * 22;
        leaves.push({ m, x: Math.cos(a) * r, z: Math.sin(a) * r, offset: rng(), spin: 1.5 + rng() * 2.5 });
      }
    }

    // gate arch where the south path meets the spawn row: two stone pillars, a
    // wooden crossbeam and lantern caps that warm up after dark. East-Asian
    // towns get a vermilion torii treatment with a second, upswept top lintel.
    {
      const torii = mapId === "amatsu" || mapId === "louyang" || mapId === "gonryun" || mapId === "chinatown";
      const [pillarGeo, pillarMat] = track(
        new THREE.BoxGeometry(0.7, 3.0, 0.7),
        new THREE.MeshStandardMaterial({ color: torii ? 0xc23a28 : new THREE.Color(theme.rock).multiplyScalar(0.85).getHex(), roughness: 0.95 }),
      );
      const [beamGeo, beamMat] = track(
        new THREE.BoxGeometry(5.4, 0.5, 0.8),
        new THREE.MeshStandardMaterial({ color: torii ? 0xc23a28 : new THREE.Color(theme.trunk).multiplyScalar(0.95).getHex(), roughness: 0.9 }),
      );
      const [capGeo, capMat] = track(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
      nightLights.push({ mat: capMat, day: new THREE.Color(0x9a8468), night: new THREE.Color(0xffd9a0) });
      for (const s of [-1, 1]) {
        const pillar = new THREE.Mesh(pillarGeo, pillarMat);
        pillar.position.set(s * 2.1, 1.5, 24);
        pillar.castShadow = true;
        group.add(pillar);
        const cap = new THREE.Mesh(capGeo, capMat);
        cap.position.set(s * 2.1, 3.35, 24);
        group.add(cap);
      }
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(0, 3.15, 24);
      beam.castShadow = true;
      group.add(beam);
      if (torii) {
        // kasagi: the wider top lintel with gently upswept ends
        const [kasagiGeo, kasagiMat] = track(
          new THREE.BoxGeometry(6.4, 0.4, 0.9),
          new THREE.MeshStandardMaterial({ color: 0x2a2430, roughness: 0.9 }),
        );
        const kasagi = new THREE.Mesh(kasagiGeo, kasagiMat);
        kasagi.position.set(0, 3.62, 24);
        kasagi.castShadow = true;
        group.add(kasagi);
        const [tipGeo] = track(new THREE.BoxGeometry(0.7, 0.4, 0.9), kasagiMat);
        for (const s of [-1, 1]) {
          const tip = new THREE.Mesh(tipGeo, kasagiMat);
          tip.position.set(s * 3.5, 3.76, 24);
          tip.rotation.z = s * 0.18;
          group.add(tip);
        }
      }
    }

    // adventurer quest board beside the plaza: a roofed notice board with a
    // scatter of pinned job postings, angled to face the fountain
    {
      const boardWood = new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.trunk).multiplyScalar(1.05), roughness: 0.95 });
      const [bPostGeo] = track(new THREE.BoxGeometry(0.14, 1.9, 0.14), boardWood);
      const [panelGeo, panelMat] = track(
        new THREE.BoxGeometry(2.0, 1.15, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x5a4530, roughness: 1 }),
      );
      const [bRoofGeo] = track(new THREE.BoxGeometry(2.3, 0.08, 0.5), boardWood);
      const [noteGeo, noteMat] = track(
        new THREE.PlaneGeometry(0.26, 0.32),
        new THREE.MeshStandardMaterial({ color: 0xf2ecd8, roughness: 1 }),
      );
      const board = new THREE.Group();
      for (const s of [-1, 1]) {
        const post = new THREE.Mesh(bPostGeo, boardWood);
        post.position.set(s * 0.95, 0.95, 0);
        board.add(post);
      }
      const panel = new THREE.Mesh(panelGeo, panelMat);
      panel.position.y = 1.25;
      panel.castShadow = true;
      board.add(panel);
      const roofSlat = new THREE.Mesh(bRoofGeo, boardWood);
      roofSlat.position.y = 1.95;
      roofSlat.rotation.x = 0.18;
      board.add(roofSlat);
      for (let i = 0; i < 5; i++) {
        const note = new THREE.Mesh(noteGeo, noteMat);
        note.position.set(-0.7 + i * 0.35 + (rng() - 0.5) * 0.08, 1.2 + (rng() - 0.5) * 0.3, 0.05);
        note.rotation.z = (rng() - 0.5) * 0.25;
        board.add(note);
      }
      board.position.set(5.8, 0, 3.4);
      board.rotation.y = Math.atan2(-5.8, -3.4); // face the fountain
      group.add(board);
    }

    // directional signpost where the path leaves the plaza: a weathered post
    // with two finger boards pointing opposite ways (fields vs. town centre)
    {
      const signWood = new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.trunk).multiplyScalar(0.9), roughness: 1 });
      const [sPostGeo] = track(new THREE.CylinderGeometry(0.07, 0.09, 1.9, 6), signWood);
      const [fingerGeo] = track(new THREE.BoxGeometry(0.95, 0.2, 0.05), signWood);
      const signpost = new THREE.Group();
      const sPost = new THREE.Mesh(sPostGeo, signWood);
      sPost.position.y = 0.95;
      sPost.castShadow = true;
      signpost.add(sPost);
      for (const [fy, rot] of [[1.62, 0.5], [1.34, -2.2]] as const) {
        const finger = new THREE.Mesh(fingerGeo, signWood);
        finger.position.set(0, fy, 0);
        finger.rotation.y = rot;
        // shift outward so the board hangs off one side of the post
        finger.translateX(0.42);
        signpost.add(finger);
      }
      signpost.position.set(-2.4, 0, 8.2);
      group.add(signpost);
    }

    // traveller's campfire off the path near spawn: a log ring, a flickering
    // flame and a warm pool of light that carries through the night
    {
      const [logGeo, logMat] = track(
        new THREE.CylinderGeometry(0.09, 0.09, 0.9, 6),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.trunk).multiplyScalar(0.8), roughness: 1 }),
      );
      const [stoneGeo, stoneMat] = track(
        new THREE.DodecahedronGeometry(0.14, 0),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.rock).multiplyScalar(0.8), roughness: 1, flatShading: true }),
      );
      const [flameGeo, flameMat] = track(
        new THREE.ConeGeometry(0.22, 0.55, 7),
        new THREE.MeshBasicMaterial({ color: 0xff9a3a }),
      );
      nightLights.push({ mat: flameMat, day: new THREE.Color(0xff9a3a), night: new THREE.Color(0xffc060) });
      const camp = new THREE.Group();
      for (const [lx, lz, ry] of [[-0.25, 0.1, 0.5], [0.25, -0.05, -0.9], [0, 0.25, 1.9]] as const) {
        const log = new THREE.Mesh(logGeo, logMat);
        log.position.set(lx, 0.1, lz);
        log.rotation.set(Math.PI / 2, 0, ry);
        camp.add(log);
      }
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const stone = new THREE.Mesh(stoneGeo, stoneMat);
        stone.position.set(Math.cos(a) * 0.55, 0.08, Math.sin(a) * 0.55);
        camp.add(stone);
      }
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.y = 0.42;
      camp.add(flame);
      flickers.push(flame);
      // wood smoke drifting off the flame, on the chimney-puff channel
      const campSmokeMat = new THREE.SpriteMaterial({ map: makeSpark(), color: 0x8a8f98, transparent: true, opacity: 0.24, depthWrite: false });
      mats.push(campSmokeMat);
      for (let puff = 0; puff < 2; puff++) {
        const sprite = new THREE.Sprite(campSmokeMat);
        sprite.position.set(0, 0.75, 0);
        sprite.scale.setScalar(0.2);
        camp.add(sprite);
        smokes.push({ sprite, baseY: 0.75, offset: puff / 2 });
      }
      // embers dance in a tight swirl just above the fire after dark
      const emberSparkMat = new THREE.SpriteMaterial({ map: makeSpark(), color: 0xffb060, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
      mats.push(emberSparkMat);
      nightFades.push({ mat: emberSparkMat, max: 0.9 });
      for (let e = 0; e < 3; e++) {
        const spark = new THREE.Sprite(emberSparkMat);
        spark.scale.setScalar(0.09);
        group.add(spark);
        orbiters.push({ sprite: spark, cx: 4.6, cz: 17.5, y: 0.9 + rng() * 0.5, r: 0.16 + rng() * 0.2, speed: 1.6 + rng() * 1.2, phase: rng() * Math.PI * 2 });
      }
      const [glowGeo, glowMat] = track(
        new THREE.PlaneGeometry(3.6, 3.6),
        new THREE.MeshBasicMaterial({ map: makeSpark(), color: 0xff9a4a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
      );
      nightFades.push({ mat: glowMat, max: 0.4 });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.04;
      camp.add(glow);
      camp.position.set(4.6, 0, 17.5);
      group.add(camp);
    }

    // village well between the houses: a stone ring, twin posts holding a
    // little pyramid roof, and a bucket hanging from the crossbar
    {
      const [wellGeo, wellMat] = track(
        new THREE.CylinderGeometry(0.62, 0.68, 0.55, 10, 1, true),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.rock).multiplyScalar(0.9), roughness: 1, side: THREE.DoubleSide }),
      );
      const [wellRimGeo] = track(new THREE.TorusGeometry(0.62, 0.07, 6, 12), wellMat);
      const wellWood = new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.trunk).multiplyScalar(0.95), roughness: 1 });
      mats.push(wellWood);
      const [wPostGeo] = track(new THREE.BoxGeometry(0.1, 1.35, 0.1), wellWood);
      const [wBarGeo] = track(new THREE.CylinderGeometry(0.045, 0.045, 1.5, 6), wellWood);
      const [wRoofGeo] = track(new THREE.ConeGeometry(0.95, 0.5, 4), wellWood);
      const [ropeGeo2] = track(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 4), wellWood);
      const [bucketGeo, bucketMat] = track(
        new THREE.CylinderGeometry(0.13, 0.11, 0.18, 8, 1, true),
        new THREE.MeshStandardMaterial({ color: 0x6a5238, roughness: 1, side: THREE.DoubleSide }),
      );
      const well = new THREE.Group();
      const ring = new THREE.Mesh(wellGeo, wellMat);
      ring.position.y = 0.28;
      ring.castShadow = true;
      well.add(ring);
      const rim = new THREE.Mesh(wellRimGeo, wellMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.56;
      well.add(rim);
      for (const s of [-1, 1]) {
        const post = new THREE.Mesh(wPostGeo, wellWood);
        post.position.set(s * 0.62, 0.95, 0);
        well.add(post);
      }
      const bar = new THREE.Mesh(wBarGeo, wellWood);
      bar.rotation.z = Math.PI / 2;
      bar.position.y = 1.55;
      well.add(bar);
      const wroof = new THREE.Mesh(wRoofGeo, wellWood);
      wroof.position.y = 1.95;
      wroof.rotation.y = Math.PI / 4;
      wroof.castShadow = true;
      well.add(wroof);
      const rope2 = new THREE.Mesh(ropeGeo2, wellWood);
      rope2.position.y = 1.32;
      well.add(rope2);
      const bucket = new THREE.Mesh(bucketGeo, bucketMat);
      bucket.position.y = 1.02;
      well.add(bucket);
      bobbers.push({ obj: bucket, baseY: 1.02, phase: 2.6 });
      // a village cat sits on the rim, tail swaying off the edge
      const catMat = new THREE.MeshStandardMaterial({ color: 0x8a7050, roughness: 0.9 });
      mats.push(catMat);
      const [catBodyGeo] = track(new THREE.SphereGeometry(0.14, 8, 6), catMat);
      const [catEarGeo] = track(new THREE.ConeGeometry(0.04, 0.07, 4), catMat);
      const [catTailGeo] = track(new THREE.CylinderGeometry(0.025, 0.018, 0.4, 5), catMat);
      const cat = new THREE.Group();
      const catBody = new THREE.Mesh(catBodyGeo, catMat);
      catBody.scale.set(0.9, 1.1, 0.9);
      catBody.position.y = 0.13;
      cat.add(catBody);
      const catHead = new THREE.Mesh(catBodyGeo, catMat);
      catHead.scale.setScalar(0.6);
      catHead.position.set(0, 0.32, 0.03);
      cat.add(catHead);
      for (const s of [-1, 1]) {
        const ear = new THREE.Mesh(catEarGeo, catMat);
        ear.position.set(s * 0.05, 0.42, 0.02);
        cat.add(ear);
      }
      // the tail hangs from a pivot so the bobber sway reads as a lazy flick
      const tailPivot = new THREE.Group();
      const catTail = new THREE.Mesh(catTailGeo, catMat);
      catTail.position.y = -0.2;
      tailPivot.add(catTail);
      tailPivot.position.set(0, 0.14, -0.12);
      cat.add(tailPivot);
      bobbers.push({ obj: tailPivot, baseY: 0.14, phase: 1.3 });
      cat.position.set(0.52, 0.56, 0.3);
      cat.rotation.y = -0.6;
      well.add(cat);
      well.position.set(-5.6, 0, -8.8);
      group.add(well);
    }

    // laundry line between the west and north houses: a taut rope with a few
    // pastel cloths that sway on the same breeze as the pennants
    {
      const [x1, z1, x2, z2] = [-8.4, -7.6, -1.2, -11.1];
      const dx = x2 - x1;
      const dz = z2 - z1;
      const [lineGeo, lineMat] = track(
        new THREE.CylinderGeometry(0.012, 0.012, Math.hypot(dx, dz), 4),
        new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 1 }),
      );
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.position.set((x1 + x2) / 2, 1.72, (z1 + z2) / 2);
      line.rotation.z = Math.PI / 2;
      line.rotation.y = -Math.atan2(dz, dx);
      group.add(line);
      const [clothGeo] = track(new THREE.PlaneGeometry(0.55, 0.42), lineMat);
      const clothMats = [0xa8d0e8, 0xf0e0c0, 0xe8b0c0].map((c) => {
        const m = new THREE.MeshStandardMaterial({ color: c, roughness: 1, side: THREE.DoubleSide });
        mats.push(m);
        return m;
      });
      for (let i = 0; i < 3; i++) {
        const t = 0.28 + i * 0.22;
        const cloth = new THREE.Mesh(clothGeo, clothMats[i]);
        const sag = Math.sin(Math.PI * t) * 0.08;
        cloth.position.set(x1 + dx * t, 1.72 - sag - 0.22, z1 + dz * t);
        cloth.rotation.y = -Math.atan2(dz, dx) + Math.PI / 2; // hang across the rope
        group.add(cloth);
        bobbers.push({ obj: cloth, baseY: cloth.position.y, phase: i * 1.9 });
      }
    }
  }

  // ---- Kafra shop stall: a counter with a pink-striped awning behind each
  // shop NPC, so the shop reads as a market stand rather than a lone villager ----
  {
    const shopNpcs = (MAPS[mapId]?.npcs ?? []).filter((n) => n.role === "shop");
    if (shopNpcs.length > 0) {
      const [counterGeo, counterMat] = track(
        new THREE.BoxGeometry(1.7, 0.85, 0.55),
        new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 0.95 }),
      );
      const [postGeo] = track(new THREE.CylinderGeometry(0.05, 0.05, 1.9, 6), counterMat);
      const [awningGeo, awningMat] = track(
        new THREE.BoxGeometry(2.0, 0.06, 1.0),
        new THREE.MeshStandardMaterial({ color: 0xe86a9a, roughness: 0.9 }),
      );
      const [trimGeo, trimMat] = track(
        new THREE.BoxGeometry(2.0, 0.06, 0.22),
        new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.9 }),
      );
      const [bottleGeo] = track(new THREE.CylinderGeometry(0.06, 0.07, 0.18, 8), counterMat);
      const potionMats = [0xe0455a, 0x4a90e0, 0x58c060].map((c) => {
        const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.3 });
        mats.push(m);
        return m;
      });
      const [fruitCrateGeo] = track(new THREE.BoxGeometry(0.55, 0.38, 0.55), counterMat);
      const [fruitGeo] = track(new THREE.SphereGeometry(0.075, 8, 6), counterMat);
      const fruitMats = [0xe06a2a, 0xd8b03a, 0xc04040].map((c) => {
        const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 });
        mats.push(m);
        return m;
      });
      for (const n of shopNpcs) {
        const facing = n.facing ?? 0;
        const stall = new THREE.Group();
        const counter = new THREE.Mesh(counterGeo, counterMat);
        counter.position.y = 0.42;
        counter.castShadow = true;
        stall.add(counter);
        // a row of potion bottles for sale on the countertop
        for (let b = 0; b < 3; b++) {
          const bottle = new THREE.Mesh(bottleGeo, potionMats[b]);
          bottle.position.set((b - 1) * 0.35, 0.94, 0.05);
          stall.add(bottle);
        }
        for (const s of [-1, 1]) {
          const post = new THREE.Mesh(postGeo, counterMat);
          post.position.set(s * 0.9, 0.95, -0.35);
          stall.add(post);
        }
        const awning = new THREE.Mesh(awningGeo, awningMat);
        awning.position.set(0, 1.9, 0.1);
        awning.rotation.x = 0.28;
        awning.castShadow = true;
        stall.add(awning);
        const trim = new THREE.Mesh(trimGeo, trimMat);
        trim.position.set(0, 1.76, 0.56);
        trim.rotation.x = 0.28;
        stall.add(trim);
        // a produce crate beside the counter, piled with fruit
        const crate = new THREE.Group();
        const box = new THREE.Mesh(fruitCrateGeo, counterMat);
        box.position.y = 0.19;
        crate.add(box);
        for (let f = 0; f < 5; f++) {
          const fruit = new THREE.Mesh(fruitGeo, fruitMats[f % fruitMats.length]);
          fruit.position.set(((f % 3) - 1) * 0.14, 0.42, (Math.floor(f / 3) - 0.5) * 0.14);
          crate.add(fruit);
        }
        crate.position.set(1.35, 0, 0.15);
        stall.add(crate);
        // sit just behind the NPC, opening toward wherever they face
        stall.position.set(n.x - Math.sin(facing) * 1.1, 0, n.z - Math.cos(facing) * 1.1);
        stall.rotation.y = facing;
        group.add(stall);
      }
    }
  }

  // ---- boss-arena braziers: a ring of ever-burning fire bowls around each
  // boss spawn, so arenas read as dangerous set-pieces from a distance ----
  {
    const bossZones = (MAPS[mapId]?.zones ?? []).filter((z) => MONSTER_TEMPLATES[z.templateId]?.boss);
    if (bossZones.length > 0) {
      const [pillarGeo, pillarMat] = track(
        new THREE.CylinderGeometry(0.12, 0.16, 1.0, 6),
        new THREE.MeshStandardMaterial({ color: 0x35302c, roughness: 0.95 }),
      );
      const [bowlGeo] = track(new THREE.CylinderGeometry(0.24, 0.16, 0.16, 8), pillarMat);
      const [emberGeo, emberMat] = track(
        new THREE.SphereGeometry(0.15, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xff9a40 }),
      );
      for (const z of bossZones) {
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          const bx = z.cx + Math.cos(a) * (z.radius + 2.5);
          const bz = z.cz + Math.sin(a) * (z.radius + 2.5);
          const pillar = new THREE.Mesh(pillarGeo, pillarMat);
          pillar.position.set(bx, 0.5, bz);
          pillar.castShadow = true;
          const bowl = new THREE.Mesh(bowlGeo, pillarMat);
          bowl.position.set(bx, 1.05, bz);
          const ember = new THREE.Mesh(emberGeo, emberMat);
          ember.position.set(bx, 1.16, bz);
          flickers.push(ember); // flame flicker via tick()
          group.add(pillar, bowl, ember);
        }
      }
    }
  }

  // ---- wooden pier on coastal maps: planks running off the island's east
  // edge over the ocean, with posts sunk into the water ----
  if (WATER_MAPS[mapId]) {
    const [plankGeo, woodMat] = track(
      new THREE.BoxGeometry(1.5, 0.1, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 0.95 }),
    );
    const [postGeo] = track(new THREE.CylinderGeometry(0.08, 0.09, 1.1, 6), woodMat);
    const pierZ = 10;
    for (let i = 0; i < 5; i++) {
      const px = MAP_HALF * 0.94 + i * 1.55;
      const plank = new THREE.Mesh(plankGeo, woodMat);
      plank.position.set(px, 0.3, pierZ);
      plank.castShadow = true;
      group.add(plank);
      for (const s of [-1, 1]) {
        const post = new THREE.Mesh(postGeo, woodMat);
        post.position.set(px + 0.6, -0.2, pierZ + s * 0.95);
        group.add(post);
      }
    }
    // a little rowboat moored beside the pier, bobbing on the swell
    const boat = new THREE.Group();
    const [hullGeo] = track(new THREE.BoxGeometry(0.95, 0.35, 2.0), woodMat);
    const hull = new THREE.Mesh(hullGeo, woodMat);
    boat.add(hull);
    const [bowGeo] = track(new THREE.ConeGeometry(0.48, 0.7, 4), woodMat);
    const bow = new THREE.Mesh(bowGeo, woodMat);
    bow.rotation.x = -Math.PI / 2;
    bow.rotation.y = Math.PI / 4;
    bow.scale.set(1, 1, 0.5);
    bow.position.set(0, 0.02, 1.3);
    boat.add(bow);
    const [benchGeo] = track(new THREE.BoxGeometry(0.85, 0.06, 0.25), woodMat);
    for (const bz of [-0.5, 0.35]) {
      const bench = new THREE.Mesh(benchGeo, woodMat);
      bench.position.set(0, 0.14, bz);
      boat.add(bench);
    }
    boat.position.set(MAP_HALF * 0.94 + 6.6, -0.18, pierZ + 2.2);
    boat.rotation.y = 0.4;
    group.add(boat);
    bobbers.push({ obj: boat, baseY: -0.18, phase: rng() * Math.PI * 2 });

    // shoreline reeds: a wind-swayed fringe of thin cattails near the coast
    const reedMat = new THREE.MeshStandardMaterial({ color: 0x5a7a3a, roughness: 1 });
    applyWind(reedMat, 0.1);
    mats.push(reedMat);
    const [reedGeo] = track(new THREE.ConeGeometry(0.035, 1.0, 5), reedMat);
    const reedCount = 90;
    const reeds = new THREE.InstancedMesh(reedGeo, reedMat, reedCount);
    const rm = new THREE.Matrix4();
    const rq = new THREE.Quaternion();
    const rup = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < reedCount; i++) {
      const a = rng() * Math.PI * 2;
      const r = MAP_HALF * (0.86 + rng() * 0.07);
      const s = 0.8 + rng() * 0.7;
      rq.setFromAxisAngle(rup, rng() * Math.PI);
      rm.compose(new THREE.Vector3(Math.cos(a) * r, 0.5 * s, Math.sin(a) * r), rq, new THREE.Vector3(1, s, 1));
      reeds.setMatrixAt(i, rm);
    }
    group.add(reeds);

    // a couple of fish leap in silvery arcs off the pier every few seconds
    const [fishGeo, fishMat] = track(
      new THREE.ConeGeometry(0.09, 0.42, 6),
      new THREE.MeshStandardMaterial({ color: 0xc8d4dc, roughness: 0.35, metalness: 0.4 }),
    );
    const [tailGeo] = track(new THREE.ConeGeometry(0.09, 0.16, 4), fishMat);
    for (let f = 0; f < 2; f++) {
      const fish = new THREE.Group();
      const bodyF = new THREE.Mesh(fishGeo, fishMat);
      bodyF.rotation.x = Math.PI / 2; // nose along +z
      fish.add(bodyF);
      const tail = new THREE.Mesh(tailGeo, fishMat);
      tail.rotation.x = -Math.PI / 2;
      tail.position.z = -0.27;
      fish.add(tail);
      group.add(fish);
      jumpers.push({ obj: fish, x: MAP_HALF * 0.94 + 4.5 + f * 3.5, z: pierZ - 3 - f * 2, offset: f * 3.7 });
    }

    // a distant sailing ship rides the horizon swell, deep in the haze
    const ship = new THREE.Group();
    const shipMat = new THREE.MeshStandardMaterial({ color: 0x4a3a30, roughness: 0.95 });
    mats.push(shipMat);
    const [shipHullGeo] = track(new THREE.BoxGeometry(3.2, 1.4, 9.0), shipMat);
    const shipHull = new THREE.Mesh(shipHullGeo, shipMat);
    shipHull.position.y = 0.4;
    ship.add(shipHull);
    const [mastGeo] = track(new THREE.CylinderGeometry(0.14, 0.18, 7.0, 6), shipMat);
    const mast = new THREE.Mesh(mastGeo, shipMat);
    mast.position.y = 4.4;
    ship.add(mast);
    const [sailGeo, sailMat] = track(
      new THREE.PlaneGeometry(3.6, 4.2),
      new THREE.MeshStandardMaterial({ color: 0xe9e2d2, roughness: 0.9, side: THREE.DoubleSide }),
    );
    const sail = new THREE.Mesh(sailGeo, sailMat);
    sail.position.set(0, 4.6, 0.4);
    ship.add(sail);
    const shipAngle = rng() * Math.PI * 2;
    ship.position.set(Math.cos(shipAngle) * MAP_HALF * 1.55, -0.3, Math.sin(shipAngle) * MAP_HALF * 1.55);
    ship.rotation.y = shipAngle + Math.PI / 2;
    group.add(ship);
    bobbers.push({ obj: ship, baseY: -0.3, phase: rng() * Math.PI * 2 });
  }

  // ---- windmill on classic leafy field maps: a tall tower with slowly turning
  // sails, the signature RO farmland landmark ----
  if (theme.tree === "leafy" && mapId !== "arena") {
    const mill = new THREE.Group();
    const millStone = new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.rock).lerp(new THREE.Color(0xffffff), 0.25), roughness: 0.95 });
    mats.push(millStone);
    const [towerGeo] = track(new THREE.CylinderGeometry(1.2, 1.8, 5.5, 10), millStone);
    const tower = new THREE.Mesh(towerGeo, millStone);
    tower.position.y = 2.75;
    tower.castShadow = true;
    mill.add(tower);
    const [capGeo] = track(new THREE.ConeGeometry(1.5, 1.4, 10), millStone);
    const cap = new THREE.Mesh(capGeo, millStone);
    cap.position.y = 6.2;
    mill.add(cap);
    const hub = new THREE.Group();
    hub.position.set(0, 5.4, 1.55);
    const [bladeGeo, bladeMat] = track(
      new THREE.BoxGeometry(0.5, 3.4, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xd9cdb4, roughness: 0.9 }),
    );
    for (let b = 0; b < 4; b++) {
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.position.y = 1.75;
      const arm = new THREE.Group();
      arm.rotation.z = (b / 4) * Math.PI * 2;
      arm.add(blade);
      hub.add(arm);
    }
    mill.add(hub);
    spinners.push({ obj: hub, speed: 0.35 });
    mill.position.set(20, 0, -22);
    mill.rotation.y = Math.atan2(-20, 22); // sails face the plaza
    group.add(mill);
  }

  // ---- horizon mountains: a ring of hazy peaks outside the playfield so the
  // world doesn't end at the map border (they sit deep in the fog) ----
  {
    const [peakGeo, peakMat] = track(
      new THREE.ConeGeometry(1, 1, 5),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.rock).lerp(new THREE.Color(theme.foliage[0]), 0.35), roughness: 1, flatShading: true }),
    );
    const peaks = new THREE.InstancedMesh(peakGeo, peakMat, 16);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + rng() * 0.25;
      const r = MAP_HALF * (1.5 + rng() * 0.4); // inside the fog falloff → hazy peaks
      const h = 16 + rng() * 22;
      const w = 14 + rng() * 14;
      q.setFromAxisAngle(up, rng() * Math.PI);
      m.compose(new THREE.Vector3(Math.cos(a) * r, h / 2 - 1, Math.sin(a) * r), q, new THREE.Vector3(w, h, w));
      peaks.setMatrixAt(i, m);
    }
    group.add(peaks);
    if (theme.snowy) {
      // aurora over the snowfields: two translucent curtain bands high in the
      // night sky (fog-exempt, additive) that fade in after dark and drift
      const [auroraGeo, auroraLo] = track(
        new THREE.CylinderGeometry(MAP_HALF * 1.25, MAP_HALF * 1.35, 16, 48, 1, true, 0, Math.PI * 0.9),
        new THREE.MeshBasicMaterial({ color: 0x66ffc0, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
      );
      const [, auroraHi] = track(
        auroraGeo,
        new THREE.MeshBasicMaterial({ color: 0x8a9aff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
      );
      const bands: [THREE.MeshBasicMaterial, number, number, number, number][] = [
        [auroraLo, 34, 0.8, 0.22, 0.012], // [mat, y, rotY, night opacity, drift speed]
        [auroraHi, 40, 2.9, 0.14, -0.008],
      ];
      for (const [mat, y, rotY, max, speed] of bands) {
        const band = new THREE.Mesh(auroraGeo, mat);
        band.position.y = y;
        band.rotation.y = rotY;
        group.add(band);
        nightFades.push({ mat, max });
        spinners.push({ obj: band, speed, axis: "y" });
      }
    }
    const lampPost = track(new THREE.CylinderGeometry(0.07, 0.09, 2.2, 6), new THREE.MeshStandardMaterial({ color: 0x3a3430, roughness: 0.9 }));
    const lampHeadGeo = new THREE.SphereGeometry(0.16, 10, 8);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
    track(lampHeadGeo, lampMat);
    nightLights.push({ mat: lampMat, day: new THREE.Color(0x9a8468), night: new THREE.Color(0xffd9a0) });
    // shared firefly material — fades in with night alongside the light pools
    const fireflyMat = new THREE.SpriteMaterial({ map: makeSpark(), color: 0xffe27a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    mats.push(fireflyMat);
    nightFades.push({ mat: fireflyMat, max: 0.85 });
    // a warm pool of light on the ground under each lamp, fading in at night
    const [poolGeo, poolMat] = track(
      new THREE.PlaneGeometry(4.6, 4.6),
      new THREE.MeshBasicMaterial({ map: makeSpark(), color: 0xffc27a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    nightFades.push({ mat: poolMat, max: 0.3 });
    for (const [lx, lz] of [[-5.5, -5.5], [5.5, -5.5], [-5.5, 5.5], [5.5, 5.5]] as const) {
      const post = new THREE.Mesh(lampPost[0], lampPost[1]);
      post.position.set(lx, 1.1, lz);
      post.castShadow = true;
      group.add(post);
      const head = new THREE.Mesh(lampHeadGeo, lampMat);
      head.position.set(lx, 2.3, lz);
      group.add(head);
      const pool = new THREE.Mesh(poolGeo, poolMat);
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(lx, 0.03, lz);
      group.add(pool);
      // a few fireflies drawn to each lamp after dark
      for (let f = 0; f < 3; f++) {
        const fly = new THREE.Sprite(fireflyMat);
        fly.scale.setScalar(0.14);
        group.add(fly);
        orbiters.push({ sprite: fly, cx: lx, cz: lz, y: 1.9 + rng() * 0.7, r: 0.45 + rng() * 0.4, speed: 0.8 + rng() * 0.8, phase: rng() * Math.PI * 2 });
      }
    }

    // festival pennant garlands strung between the lamp heads: a rope along
    // each side of the lamp square with little flags that sway on the breeze
    const [ropeGeo, ropeMat] = track(
      new THREE.CylinderGeometry(0.015, 0.015, 11, 4),
      new THREE.MeshStandardMaterial({ color: 0x6a5a48, roughness: 1 }),
    );
    const flagMats = [0xe86a9a, 0xffd24a, 0x6ac0e8].map((c) => {
      const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, side: THREE.DoubleSide });
      mats.push(m);
      return m;
    });
    const [flagGeo] = track(new THREE.ConeGeometry(0.11, 0.3, 4), flagMats[0]);
    const sides: [number, number, number, number][] = [
      [-5.5, -5.5, 5.5, -5.5],
      [5.5, -5.5, 5.5, 5.5],
      [5.5, 5.5, -5.5, 5.5],
      [-5.5, 5.5, -5.5, -5.5],
    ];
    for (let si = 0; si < sides.length; si++) {
      const [x1, z1, x2, z2] = sides[si];
      const rope = new THREE.Mesh(ropeGeo, ropeMat);
      rope.position.set((x1 + x2) / 2, 2.28, (z1 + z2) / 2);
      rope.rotation.z = Math.PI / 2;
      rope.rotation.y = Math.atan2(z2 - z1, x2 - x1);
      group.add(rope);
      for (let f = 1; f <= 5; f++) {
        const t = f / 6;
        const flag = new THREE.Mesh(flagGeo, flagMats[(si + f) % flagMats.length]);
        flag.rotation.x = Math.PI; // point down off the rope
        const sag = Math.sin(Math.PI * t) * 0.12; // rope dips toward the middle
        flag.position.set(x1 + (x2 - x1) * t, 2.28 - sag - 0.17, z1 + (z2 - z1) * t);
        group.add(flag);
        bobbers.push({ obj: flag, baseY: flag.position.y, phase: si * 2 + f });
      }
    }
  }

  // ---- horizon airship: a little dirigible on a slow sky lane above the
  // peaks — a nod to Juno's airships. Cabin windows warm up after dark. ----
  if (mapId !== "arena") {
    const ship = new THREE.Group();
    const [hullGeo, hullMat] = track(
      new THREE.CapsuleGeometry(1.5, 4.6, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0xd8cfc0, roughness: 0.8 }),
    );
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.rotation.x = Math.PI / 2; // capsule axis along +z = direction of travel
    ship.add(hull);
    const [cabinGeo, cabinMat] = track(
      new THREE.BoxGeometry(0.9, 0.7, 2.6),
      new THREE.MeshStandardMaterial({ color: 0x6a5238, roughness: 0.9 }),
    );
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.y = -1.75;
    ship.add(cabin);
    const [winGeo, winMat] = track(new THREE.BoxGeometry(0.94, 0.2, 1.8), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
    nightLights.push({ mat: winMat, day: new THREE.Color(0x8a7a62), night: new THREE.Color(0xffd9a0) });
    const win = new THREE.Mesh(winGeo, winMat);
    win.position.y = -1.72;
    ship.add(win);
    const [finGeo] = track(new THREE.BoxGeometry(0.1, 1.3, 1.1), cabinMat);
    for (const tilt of [0, Math.PI / 2]) {
      const fin = new THREE.Mesh(finGeo, cabinMat);
      fin.position.z = -3.1;
      fin.rotation.z = tilt;
      ship.add(fin);
    }
    const [propGeo] = track(new THREE.BoxGeometry(0.16, 1.6, 0.06), cabinMat);
    const prop = new THREE.Mesh(propGeo, cabinMat);
    prop.position.z = -3.8;
    ship.add(prop);
    spinners.push({ obj: prop, speed: 9 });
    ship.scale.setScalar(2.2);
    group.add(ship);
    cruisers.push({ obj: ship, r: MAP_HALF * 1.2, y: 27, speed: 0.02, phase: rng() * Math.PI * 2 });
  }

  // ---- ground mist: on haunted and crystalline maps, broad soft wisps hug
  // the ground after dark and drift in slow local circles ----
  if (theme.tree === "dead" || theme.tree === "crystal") {
    const mistMat = new THREE.SpriteMaterial({
      map: makeSpark(),
      color: new THREE.Color(theme.tuft).lerp(new THREE.Color(0xcccccc), 0.6),
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    mats.push(mistMat);
    nightFades.push({ mat: mistMat, max: 0.14 });
    for (let i = 0; i < 8; i++) {
      const wisp = new THREE.Sprite(mistMat);
      wisp.scale.set(5.5 + rng() * 3, 2.2 + rng() * 1, 1);
      group.add(wisp);
      const a = rng() * Math.PI * 2;
      const r = 8 + rng() * 18;
      orbiters.push({
        sprite: wisp,
        cx: Math.cos(a) * r,
        cz: Math.sin(a) * r,
        y: 0.7 + rng() * 0.5,
        r: 1.6 + rng() * 1.4,
        speed: 0.03 + rng() * 0.04,
        phase: rng() * Math.PI * 2,
      });
    }
  }

  // ---- countryside dressing: a scarecrow watching the grass, and golden
  // pollen motes that sparkle in the daylight and settle at dusk ----
  if (theme.tree === "leafy" && mapId !== "arena") {
    const strawMat = new THREE.MeshStandardMaterial({ color: 0xc8a84a, roughness: 1, flatShading: true });
    mats.push(strawMat);
    const [scPostGeo] = track(new THREE.CylinderGeometry(0.06, 0.08, 2.0, 6), strawMat);
    const [scArmGeo] = track(new THREE.CylinderGeometry(0.045, 0.045, 1.5, 6), strawMat);
    const [scHeadGeo] = track(new THREE.SphereGeometry(0.24, 10, 8), strawMat);
    const [scHatGeo, scHatMat] = track(
      new THREE.ConeGeometry(0.4, 0.28, 8),
      new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 1 }),
    );
    const [scShirtGeo, scShirtMat] = track(
      new THREE.BoxGeometry(0.55, 0.7, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xa85040, roughness: 1 }),
    );
    const scarecrow = new THREE.Group();
    const scPost = new THREE.Mesh(scPostGeo, strawMat);
    scPost.position.y = 1.0;
    scarecrow.add(scPost);
    const scArm = new THREE.Mesh(scArmGeo, strawMat);
    scArm.rotation.z = Math.PI / 2;
    scArm.position.y = 1.45;
    scarecrow.add(scArm);
    const scShirt = new THREE.Mesh(scShirtGeo, scShirtMat);
    scShirt.position.y = 1.25;
    scarecrow.add(scShirt);
    const scHead = new THREE.Mesh(scHeadGeo, strawMat);
    scHead.position.y = 1.85;
    scarecrow.add(scHead);
    const scHat = new THREE.Mesh(scHatGeo, scHatMat);
    scHat.position.y = 2.08;
    scHat.rotation.z = 0.12;
    scarecrow.add(scHat);
    // a crow perched on the crossbar, bobbing as the wind rocks the post
    const crowMat = new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.9 });
    mats.push(crowMat);
    const [crowBodyGeo] = track(new THREE.SphereGeometry(0.11, 8, 6), crowMat);
    const [crowBeakGeo, crowBeakMat] = track(new THREE.ConeGeometry(0.03, 0.09, 5), new THREE.MeshStandardMaterial({ color: 0xd8a850, roughness: 0.8 }));
    const [crowTailGeo] = track(new THREE.BoxGeometry(0.05, 0.02, 0.14), crowMat);
    const crow = new THREE.Group();
    const crowBody = new THREE.Mesh(crowBodyGeo, crowMat);
    crowBody.scale.set(0.9, 1, 1.25);
    crow.add(crowBody);
    const crowHead = new THREE.Mesh(crowBodyGeo, crowMat);
    crowHead.scale.setScalar(0.62);
    crowHead.position.set(0, 0.11, 0.11);
    crow.add(crowHead);
    const beak = new THREE.Mesh(crowBeakGeo, crowBeakMat);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.11, 0.22);
    crow.add(beak);
    const crowTail = new THREE.Mesh(crowTailGeo, crowMat);
    crowTail.position.set(0, 0.03, -0.17);
    crowTail.rotation.x = -0.35;
    crow.add(crowTail);
    crow.position.set(0.58, 1.58, 0);
    scarecrow.add(crow);
    bobbers.push({ obj: crow, baseY: 1.58, phase: 4.1 });
    scarecrow.position.set(-16, 0, 14);
    scarecrow.rotation.y = 0.7;
    group.add(scarecrow);

    const pollenMat = new THREE.SpriteMaterial({ map: makeSpark(), color: 0xffe9a0, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
    mats.push(pollenMat);
    dayFades.push({ mat: pollenMat, max: 0.5 });
    for (let i = 0; i < 10; i++) {
      const mote = new THREE.Sprite(pollenMat);
      mote.scale.setScalar(0.07 + rng() * 0.05);
      group.add(mote);
      const a = rng() * Math.PI * 2;
      const r = 7 + rng() * 20;
      orbiters.push({
        sprite: mote,
        cx: Math.cos(a) * r,
        cz: Math.sin(a) * r,
        y: 0.8 + rng() * 1.4,
        r: 0.9 + rng() * 1.2,
        speed: 0.25 + rng() * 0.3,
        phase: rng() * Math.PI * 2,
      });
    }
  }

  // ---- desert life: dust devils spin across the dunes and tumbleweeds roll
  // an endless lap of the outskirts on arid maps ----
  if (mapId === "morocc" || mapId === "pyramid" || mapId === "veins" || mapId === "scaraba") {
    const [devilGeo, devilMat] = track(
      new THREE.ConeGeometry(0.9, 3.2, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(theme.rock).lerp(new THREE.Color(0xffffff), 0.2), transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
    );
    for (let d = 0; d < 2; d++) {
      const carrier = new THREE.Group();
      const funnel = new THREE.Mesh(devilGeo, devilMat);
      funnel.rotation.x = Math.PI; // wide end up
      funnel.position.y = 1.6;
      carrier.add(funnel);
      group.add(carrier);
      spinners.push({ obj: funnel, speed: 6 + d * 2, axis: "y" });
      cruisers.push({ obj: carrier, r: 16 + d * 9, y: 0, speed: 0.05 * (d % 2 === 0 ? 1 : -1), phase: rng() * Math.PI * 2 });
    }
    const [weedGeo, weedMat] = track(
      new THREE.IcosahedronGeometry(0.42, 0),
      new THREE.MeshStandardMaterial({ color: 0x9a7b4a, roughness: 1, flatShading: true, wireframe: true }),
    );
    for (let w = 0; w < 2; w++) {
      const carrier = new THREE.Group();
      const weed = new THREE.Mesh(weedGeo, weedMat);
      weed.position.y = 0.42;
      carrier.add(weed);
      group.add(carrier);
      spinners.push({ obj: weed, speed: -2.2 - w }); // rolls about local x/z as it travels
      cruisers.push({ obj: carrier, r: 20 + w * 7, y: 0, speed: 0.09 * (w % 2 === 0 ? -1 : 1), phase: rng() * Math.PI * 2 });
    }
  }

  // ---- Ayothaya chedi: a golden bell-shaped stupa rising over the temple
  // town, its spire catching light after dark ----
  if (mapId === "ayothaya") {
    const chediGold = new THREE.MeshStandardMaterial({ color: 0xd8a83a, roughness: 0.4, metalness: 0.5 });
    mats.push(chediGold);
    const [chediBaseGeo, chediBaseMat] = track(
      new THREE.CylinderGeometry(2.0, 2.3, 0.9, 10),
      new THREE.MeshStandardMaterial({ color: 0xc9b490, roughness: 1 }),
    );
    const [bellGeo] = track(new THREE.SphereGeometry(1.35, 12, 10), chediGold);
    const [chediSpireGeo] = track(new THREE.ConeGeometry(0.5, 2.6, 8), chediGold);
    const [spireTipGeo, spireTipMat] = track(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe9a0 }));
    nightLights.push({ mat: spireTipMat, day: new THREE.Color(0xc9a850), night: new THREE.Color(0xffe9a0) });
    const chedi = new THREE.Group();
    const chediBase = new THREE.Mesh(chediBaseGeo, chediBaseMat);
    chediBase.position.y = 0.45;
    chediBase.receiveShadow = true;
    chedi.add(chediBase);
    const bell = new THREE.Mesh(bellGeo, chediGold);
    bell.scale.y = 1.2;
    bell.position.y = 2.1;
    bell.castShadow = true;
    chedi.add(bell);
    const chediSpire = new THREE.Mesh(chediSpireGeo, chediGold);
    chediSpire.position.y = 4.35;
    chedi.add(chediSpire);
    const spireTip = new THREE.Mesh(spireTipGeo, spireTipMat);
    spireTip.position.y = 5.7;
    chedi.add(spireTip);
    chedi.position.set(-13.5, 0, -12);
    group.add(chedi);
  }

  // ---- Dewata candi bentar: the Balinese split gateway — two mirrored
  // stepped towers flanking the south path ----
  if (mapId === "dewata") {
    const candiStone = new THREE.MeshStandardMaterial({ color: 0x8a5a44, roughness: 1, flatShading: true });
    mats.push(candiStone);
    const [candiTierGeo] = track(new THREE.BoxGeometry(1, 1, 1), candiStone);
    for (const s of [-1, 1]) {
      const tower = new THREE.Group();
      const tiers: [number, number, number][] = [
        [1.3, 1.4, 1.1], // [width, height, depth] stacked bottom-up
        [1.0, 1.0, 0.9],
        [0.7, 0.8, 0.7],
        [0.4, 0.7, 0.5],
      ];
      let ty = 0;
      for (const [tw, th, td] of tiers) {
        const tier = new THREE.Mesh(candiTierGeo, candiStone);
        tier.scale.set(tw, th, td);
        // hug the path edge: the flat inner face lines up on both towers
        tier.position.set(s * (0.9 + tw / 2 - 0.65), ty + th / 2, 0);
        tier.castShadow = true;
        tower.add(tier);
        ty += th;
      }
      tower.position.set(s * 1.55, 0, 24);
      group.add(tower);
    }
  }

  // ---- turtle statue: the turtle islands honour their namesake with a stone
  // turtle — shell dome, head and four flippers ----
  if (mapId === "kusu_island" || mapId === "turtle") {
    const turtleStone = new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.rock).multiplyScalar(0.95), roughness: 1, flatShading: true });
    mats.push(turtleStone);
    const [shellGeo] = track(new THREE.SphereGeometry(1.1, 12, 10), turtleStone);
    const [tHeadGeo] = track(new THREE.SphereGeometry(0.38, 10, 8), turtleStone);
    const [flipperGeo] = track(new THREE.BoxGeometry(0.7, 0.16, 0.45), turtleStone);
    const turtle = new THREE.Group();
    const shell = new THREE.Mesh(shellGeo, turtleStone);
    shell.scale.y = 0.55;
    shell.position.y = 0.62;
    shell.castShadow = true;
    turtle.add(shell);
    const tHead = new THREE.Mesh(tHeadGeo, turtleStone);
    tHead.position.set(0, 0.5, 1.25);
    turtle.add(tHead);
    for (const [fx, fz] of [[-0.9, 0.6], [0.9, 0.6], [-0.9, -0.6], [0.9, -0.6]] as const) {
      const flipper = new THREE.Mesh(flipperGeo, turtleStone);
      flipper.position.set(fx, 0.18, fz);
      flipper.rotation.y = Math.sign(fx) * 0.5;
      turtle.add(flipper);
    }
    turtle.position.set(11.5, 0, -12);
    turtle.rotation.y = Math.atan2(-11.5, 12);
    group.add(turtle);
  }

  // ---- mangrove roots: Sungei Buloh's shoreline sprouts arched prop-root
  // cages leaning out of the mudflats ----
  if (mapId === "sungei_buloh") {
    const [mRootGeo, mRootMat] = track(
      new THREE.CylinderGeometry(0.05, 0.07, 1.5, 5),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.trunk).multiplyScalar(0.85), roughness: 1 }),
    );
    for (let c = 0; c < 6; c++) {
      const a = rng() * Math.PI * 2;
      const r = MAP_HALF * (0.8 + rng() * 0.1);
      const cx = Math.cos(a) * r;
      const cz = Math.sin(a) * r;
      for (let s = 0; s < 5; s++) {
        const sa = (s / 5) * Math.PI * 2 + rng() * 0.5;
        const root = new THREE.Mesh(mRootGeo, mRootMat);
        root.position.set(cx + Math.cos(sa) * 0.45, 0.6, cz + Math.sin(sa) * 0.45);
        // lean each root outward so the cluster reads as an arched root cage
        root.rotation.set(Math.sin(sa) * 0.45, 0, -Math.cos(sa) * 0.45);
        group.add(root);
      }
    }
  }

  // ---- Supertrees: Gardens by the Bay grows three lattice supertrees whose
  // canopies pulse violet after dark ----
  if (mapId === "gardens_bay") {
    const latticeMat = new THREE.MeshStandardMaterial({ color: 0x5a4a6a, roughness: 0.8 });
    mats.push(latticeMat);
    const [superTrunkGeo] = track(new THREE.CylinderGeometry(0.55, 1.15, 6.5, 9), latticeMat);
    const [superCupGeo] = track(new THREE.CylinderGeometry(2.3, 0.6, 1.5, 9, 1, true), latticeMat);
    const [superGlowGeo, superGlowMat] = track(
      new THREE.CylinderGeometry(2.1, 0.7, 1.2, 9),
      new THREE.MeshBasicMaterial({ color: 0xb070e0, transparent: true, opacity: 0.55 }),
    );
    nightLights.push({
      mat: superGlowMat,
      day: new THREE.Color(0xb070e0).multiplyScalar(0.45),
      night: new THREE.Color(0xd090ff),
    });
    for (const [sx, sz, sc] of [[-14, -12, 1], [-10, -16, 0.8], [-17.5, -16.5, 0.7]] as const) {
      const superTree = new THREE.Group();
      const trunk = new THREE.Mesh(superTrunkGeo, latticeMat);
      trunk.position.y = 3.25;
      trunk.castShadow = true;
      superTree.add(trunk);
      const cup = new THREE.Mesh(superCupGeo, latticeMat);
      cup.position.y = 7.0;
      superTree.add(cup);
      const glow = new THREE.Mesh(superGlowGeo, superGlowMat);
      glow.position.y = 7.0;
      superTree.add(glow);
      superTree.scale.setScalar(sc);
      superTree.position.set(sx, 0, sz);
      group.add(superTree);
    }
  }

  // ---- bandstand: the Botanic Gardens' white octagonal gazebo on the lawn ----
  if (mapId === "botanic_gardens") {
    const gazeboMat = new THREE.MeshStandardMaterial({ color: 0xf4f2ec, roughness: 0.85 });
    mats.push(gazeboMat);
    const [gStepGeo] = track(new THREE.CylinderGeometry(2.4, 2.6, 0.3, 8), gazeboMat);
    const [gPostGeo] = track(new THREE.CylinderGeometry(0.09, 0.09, 2.2, 6), gazeboMat);
    const [gRoofGeo, gRoofMat] = track(
      new THREE.ConeGeometry(2.6, 1.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x8a4a3a, roughness: 0.9, flatShading: true }),
    );
    const [gFinialGeo] = track(new THREE.SphereGeometry(0.14, 8, 6), gazeboMat);
    const bandstand = new THREE.Group();
    const step = new THREE.Mesh(gStepGeo, gazeboMat);
    step.position.y = 0.15;
    step.receiveShadow = true;
    bandstand.add(step);
    for (let p = 0; p < 8; p++) {
      const a = (p / 8) * Math.PI * 2 + Math.PI / 8;
      const post = new THREE.Mesh(gPostGeo, gazeboMat);
      post.position.set(Math.cos(a) * 2.1, 1.4, Math.sin(a) * 2.1);
      bandstand.add(post);
    }
    const gRoof = new THREE.Mesh(gRoofGeo, gRoofMat);
    gRoof.position.y = 3.05;
    gRoof.castShadow = true;
    bandstand.add(gRoof);
    const finial = new THREE.Mesh(gFinialGeo, gazeboMat);
    finial.position.y = 3.72;
    bandstand.add(finial);
    bandstand.position.set(13, 0, -11);
    group.add(bandstand);
  }

  // ---- Merlion: the bay's icon — a white lion-headed fish on a pedestal,
  // spouting a thin arc of water with a looping splash at its base ----
  if (mapId === "merlion_bay") {
    const merlionMat = new THREE.MeshStandardMaterial({ color: 0xf2f4f0, roughness: 0.8 });
    mats.push(merlionMat);
    const [pedGeo] = track(new THREE.CylinderGeometry(1.0, 1.2, 0.6, 10), merlionMat);
    const [merBodyGeo] = track(new THREE.ConeGeometry(0.65, 2.6, 10), merlionMat);
    const [merHeadGeo] = track(new THREE.SphereGeometry(0.55, 12, 10), merlionMat);
    const [merManeGeo] = track(new THREE.TorusGeometry(0.5, 0.16, 6, 12), merlionMat);
    const [jetGeo, jetMat] = track(
      new THREE.CylinderGeometry(0.05, 0.09, 1.9, 6),
      new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    const merlion = new THREE.Group();
    const ped = new THREE.Mesh(pedGeo, merlionMat);
    ped.position.y = 0.3;
    merlion.add(ped);
    const merBody = new THREE.Mesh(merBodyGeo, merlionMat);
    merBody.position.y = 1.9;
    merBody.rotation.x = -0.12; // fish tail curls back
    merBody.castShadow = true;
    merlion.add(merBody);
    const merHead = new THREE.Mesh(merHeadGeo, merlionMat);
    merHead.position.set(0, 3.25, 0.18);
    merHead.castShadow = true;
    merlion.add(merHead);
    const mane = new THREE.Mesh(merManeGeo, merlionMat);
    mane.position.set(0, 3.25, 0.05);
    mane.rotation.x = 0.15;
    merlion.add(mane);
    const jet = new THREE.Mesh(jetGeo, jetMat);
    jet.position.set(0, 2.9, 1.45);
    jet.rotation.x = 1.15; // arcs out and down from the mouth
    merlion.add(jet);
    flickers.push(jet);
    // splash where the jet lands, looping on the puff channel
    const splashMat = new THREE.SpriteMaterial({ map: makeSpark(), color: 0xd8f0ff, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
    mats.push(splashMat);
    for (let puff = 0; puff < 2; puff++) {
      const splash = new THREE.Sprite(splashMat);
      splash.position.set(0, 0.15, 2.4);
      splash.scale.setScalar(0.25);
      merlion.add(splash);
      smokes.push({ sprite: splash, baseY: 0.15, offset: puff / 2 });
    }
    merlion.position.set(13, 0, -10);
    merlion.rotation.y = Math.atan2(-13, 10);
    group.add(merlion);
  }

  // ---- floodlight pylons: the modern waterfront maps raise angled stadium
  // lights that blaze after dark ----
  if (mapId === "the_float" || mapId === "marina_barrage") {
    const pylonMat = new THREE.MeshStandardMaterial({ color: 0x8a9098, roughness: 0.6, metalness: 0.5 });
    mats.push(pylonMat);
    const [pylonGeo] = track(new THREE.CylinderGeometry(0.12, 0.18, 5.2, 6), pylonMat);
    const [panelGeo, panelMat] = track(new THREE.BoxGeometry(1.3, 0.7, 0.12), new THREE.MeshBasicMaterial({ color: 0xdfe8f0 }));
    nightLights.push({ mat: panelMat, day: new THREE.Color(0x9aa2ac), night: new THREE.Color(0xffffff) });
    for (const deg of [45, 135, 225, 315]) {
      const a = (deg / 180) * Math.PI;
      const px = Math.cos(a) * 13;
      const pz = Math.sin(a) * 13;
      const pylon = new THREE.Mesh(pylonGeo, pylonMat);
      pylon.position.set(px, 2.6, pz);
      pylon.rotation.z = 0.06;
      pylon.castShadow = true;
      group.add(pylon);
      const panel = new THREE.Mesh(panelGeo, panelMat);
      panel.position.set(px, 5.1, pz);
      panel.rotation.y = Math.atan2(-px, -pz); // face the plaza
      panel.rotation.x = 0.35; // tilt down onto the field
      group.add(panel);
    }
  }

  // ---- Bifrost rainbow: three nested translucent arcs span the sky over
  // the rainbow bridge, fog-exempt so they read from anywhere ----
  if (mapId === "bifrost") {
    const rainbowColors = [0xff8a9a, 0xffe08a, 0x8ad0ff];
    for (let band = 0; band < 3; band++) {
      const [arcGeo, arcMat] = track(
        new THREE.TorusGeometry(30 - band * 1.6, 0.55, 6, 40, Math.PI),
        new THREE.MeshBasicMaterial({ color: rainbowColors[band], transparent: true, opacity: 0.35, depthWrite: false, fog: false, side: THREE.DoubleSide }),
      );
      const arc = new THREE.Mesh(arcGeo, arcMat);
      arc.position.set(0, 0, -34);
      arc.rotation.y = 0.35;
      group.add(arc);
    }
  }

  // ---- fairy blooms: the fae forests grow oversized flowers on tall stalks
  // whose heads glow softly after dark ----
  if (mapId === "splendide" || mapId === "eclage") {
    const [stalkGeo, stalkMat] = track(
      new THREE.CylinderGeometry(0.07, 0.1, 2.4, 6),
      new THREE.MeshStandardMaterial({ color: 0x4a8a5a, roughness: 1 }),
    );
    const [headGeo, headMat] = track(new THREE.IcosahedronGeometry(0.42, 0), new THREE.MeshBasicMaterial({ color: 0xf090c8 }));
    nightLights.push({
      mat: headMat,
      day: new THREE.Color(0xf090c8).multiplyScalar(0.75),
      night: new THREE.Color(0xffb8e0),
    });
    const [petalGeo] = track(new THREE.ConeGeometry(0.16, 0.5, 5), stalkMat);
    for (let f = 0; f < 6; f++) {
      const a = rng() * Math.PI * 2;
      const r = 8 + rng() * 18;
      const bloom = new THREE.Group();
      const stalk = new THREE.Mesh(stalkGeo, stalkMat);
      stalk.position.y = 1.2;
      bloom.add(stalk);
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.y = 2.55;
      bloom.add(head);
      for (let p = 0; p < 5; p++) {
        const pa = (p / 5) * Math.PI * 2;
        const petal = new THREE.Mesh(petalGeo, stalkMat);
        petal.position.set(Math.cos(pa) * 0.42, 2.35, Math.sin(pa) * 0.42);
        petal.rotation.z = Math.PI / 2.4;
        petal.rotation.y = -pa;
        bloom.add(petal);
      }
      const sc = 0.7 + rng() * 0.6;
      bloom.scale.setScalar(sc);
      bloom.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      bloom.rotation.z = (rng() - 0.5) * 0.12;
      group.add(bloom);
    }
  }

  // ---- guardian lions: the East-Asian towns sit a pair of stone shishi on
  // plinths just inside the torii gate ----
  if (mapId === "amatsu" || mapId === "louyang" || mapId === "gonryun" || mapId === "chinatown") {
    const lionStone = new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.rock).multiplyScalar(1.1), roughness: 1, flatShading: true });
    mats.push(lionStone);
    const [plinthGeo] = track(new THREE.BoxGeometry(0.7, 0.45, 0.9), lionStone);
    const [lionBodyGeo] = track(new THREE.SphereGeometry(0.3, 10, 8), lionStone);
    const [maneGeo] = track(new THREE.TorusGeometry(0.22, 0.09, 6, 10), lionStone);
    const [lionEarGeo] = track(new THREE.ConeGeometry(0.07, 0.12, 4), lionStone);
    for (const s of [-1, 1]) {
      const lion = new THREE.Group();
      const plinth = new THREE.Mesh(plinthGeo, lionStone);
      plinth.position.y = 0.22;
      lion.add(plinth);
      const lionBody = new THREE.Mesh(lionBodyGeo, lionStone);
      lionBody.scale.set(0.9, 1, 1.3);
      lionBody.position.y = 0.72;
      lion.add(lionBody);
      const lionHead = new THREE.Mesh(lionBodyGeo, lionStone);
      lionHead.scale.setScalar(0.72);
      lionHead.position.set(0, 1.12, 0.22);
      lion.add(lionHead);
      const mane = new THREE.Mesh(maneGeo, lionStone);
      mane.position.set(0, 1.12, 0.1);
      lion.add(mane);
      for (const e of [-1, 1]) {
        const ear = new THREE.Mesh(lionEarGeo, lionStone);
        ear.position.set(e * 0.14, 1.36, 0.16);
        lion.add(ear);
      }
      lion.position.set(s * 3.4, 0, 22.4);
      lion.rotation.y = Math.PI; // face arriving travellers
      lion.castShadow = true;
      group.add(lion);
    }
  }

  // ---- cave stalagmites: the underground maps grow clusters of rock spikes
  // rising from the floor ----
  if (mapId === "cave" || mapId === "orc_dungeon") {
    const [stalagGeo, stalagMat] = track(
      new THREE.ConeGeometry(0.4, 2.2, 7),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.rock).multiplyScalar(0.9), roughness: 1, flatShading: true }),
    );
    for (let c = 0; c < 6; c++) {
      const a = rng() * Math.PI * 2;
      const r = 9 + rng() * 19;
      const cx = Math.cos(a) * r;
      const cz = Math.sin(a) * r;
      for (let s = 0; s < 3; s++) {
        const sc = 0.4 + rng() * 1.2;
        const stalag = new THREE.Mesh(stalagGeo, stalagMat);
        stalag.scale.setScalar(sc);
        stalag.position.set(cx + (rng() - 0.5) * 1.4, 1.1 * sc, cz + (rng() - 0.5) * 1.4);
        stalag.rotation.set((rng() - 0.5) * 0.2, rng() * Math.PI, (rng() - 0.5) * 0.2);
        stalag.castShadow = true;
        group.add(stalag);
      }
    }
  }

  // ---- Pyramid landmark: a weathered sandstone pyramid flanked by twin
  // gold-tipped obelisks ----
  if (mapId === "pyramid") {
    const sandstone = new THREE.MeshStandardMaterial({ color: 0xc9a86a, roughness: 1, flatShading: true });
    mats.push(sandstone);
    const [pyramidGeo] = track(new THREE.ConeGeometry(4.4, 4.2, 4), sandstone);
    const pyramid = new THREE.Mesh(pyramidGeo, sandstone);
    pyramid.position.set(-15, 2.05, -13);
    pyramid.rotation.y = Math.PI / 4 + 0.2;
    pyramid.castShadow = true;
    group.add(pyramid);
    const [obeliskGeo] = track(new THREE.BoxGeometry(0.5, 3.2, 0.5), sandstone);
    const [obeliskTipGeo, obeliskTipMat] = track(
      new THREE.ConeGeometry(0.36, 0.5, 4),
      new THREE.MeshStandardMaterial({ color: 0xd8a83a, roughness: 0.35, metalness: 0.6 }),
    );
    for (const s of [-1, 1]) {
      const obelisk = new THREE.Mesh(obeliskGeo, sandstone);
      obelisk.position.set(-15 + s * 5.4, 1.6, -8.5);
      obelisk.castShadow = true;
      group.add(obelisk);
      const tip = new THREE.Mesh(obeliskTipGeo, obeliskTipMat);
      tip.position.set(-15 + s * 5.4, 3.45, -8.5);
      tip.rotation.y = Math.PI / 4;
      group.add(tip);
    }
  }

  // ---- Ice Cave spires: translucent ice spikes rise from the floor with a
  // pair of glitter motes circling each cluster ----
  if (mapId === "ice_cave") {
    const iceMat = new THREE.MeshStandardMaterial({ color: 0xbfe4f4, roughness: 0.15, transparent: true, opacity: 0.8, flatShading: true });
    mats.push(iceMat);
    const [spireGeo] = track(new THREE.ConeGeometry(0.34, 2.0, 6), iceMat);
    const glitterMat = new THREE.SpriteMaterial({ map: makeSpark(), color: 0xdff4ff, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending });
    mats.push(glitterMat);
    for (let c = 0; c < 5; c++) {
      const a = rng() * Math.PI * 2;
      const r = 9 + rng() * 18;
      const cx = Math.cos(a) * r;
      const cz = Math.sin(a) * r;
      for (let s = 0; s < 3; s++) {
        const sc = 0.5 + rng() * 1.1;
        const spire = new THREE.Mesh(spireGeo, iceMat);
        spire.scale.setScalar(sc);
        spire.position.set(cx + (rng() - 0.5) * 1.2, sc, cz + (rng() - 0.5) * 1.2);
        spire.rotation.set((rng() - 0.5) * 0.25, rng() * Math.PI, (rng() - 0.5) * 0.25);
        group.add(spire);
      }
      for (let g = 0; g < 2; g++) {
        const glitter = new THREE.Sprite(glitterMat);
        glitter.scale.setScalar(0.07);
        group.add(glitter);
        orbiters.push({ sprite: glitter, cx, cz, y: 1.2 + rng() * 1.2, r: 0.7 + rng() * 0.6, speed: 0.5 + rng() * 0.5, phase: rng() * Math.PI * 2 });
      }
    }
  }

  // ---- beach day: sandy resort coasts plant a striped parasol with a towel
  // laid out beside it ----
  if (mapId === "comodo" || mapId === "sentosa" || mapId === "east_coast" || mapId === "pasir_ris") {
    const [parasolPoleGeo, parasolPoleMat] = track(
      new THREE.CylinderGeometry(0.035, 0.035, 1.9, 6),
      new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 0.9 }),
    );
    const [canopyGeo, canopyMat] = track(
      new THREE.ConeGeometry(1.15, 0.5, 10),
      new THREE.MeshStandardMaterial({ color: 0xe86a5a, roughness: 0.85, side: THREE.DoubleSide }),
    );
    const [towelGeo, towelMat] = track(
      new THREE.PlaneGeometry(0.8, 1.7),
      new THREE.MeshStandardMaterial({ color: 0x6ac0e8, roughness: 1 }),
    );
    const beach = new THREE.Group();
    const parasolPole = new THREE.Mesh(parasolPoleGeo, parasolPoleMat);
    parasolPole.position.y = 0.95;
    parasolPole.rotation.z = 0.12;
    beach.add(parasolPole);
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.set(-0.22, 1.85, 0);
    canopy.rotation.z = 0.12;
    canopy.castShadow = true;
    beach.add(canopy);
    const towel = new THREE.Mesh(towelGeo, towelMat);
    towel.rotation.x = -Math.PI / 2;
    towel.rotation.z = 0.4;
    towel.position.set(0.9, 0.02, 0.5);
    beach.add(towel);
    const beachAngle = rng() * Math.PI * 2;
    beach.position.set(Math.cos(beachAngle) * MAP_HALF * 0.78, 0, Math.sin(beachAngle) * MAP_HALF * 0.78);
    group.add(beach);
  }

  // ---- will-o'-wisps: the ghost maps float pale flames that pulse on the
  // flicker channel and only show themselves after dark ----
  if (mapId === "niflheim" || mapId === "pulau_hantu") {
    const wispMat = new THREE.MeshBasicMaterial({ color: 0x9adcc8, transparent: true, opacity: 0 });
    mats.push(wispMat);
    nightFades.push({ mat: wispMat, max: 0.85 });
    const [wispGeo] = track(new THREE.IcosahedronGeometry(0.14, 0), wispMat);
    for (let w = 0; w < 6; w++) {
      const wisp = new THREE.Mesh(wispGeo, wispMat);
      const a = rng() * Math.PI * 2;
      const r = 7 + rng() * 20;
      wisp.position.set(Math.cos(a) * r, 1.1 + rng() * 1.2, Math.sin(a) * r);
      group.add(wisp);
      flickers.push(wisp);
      spinners.push({ obj: wisp, speed: 0.8 + rng(), axis: "y" });
    }
  }

  // ---- Umbala totem: the tree village carves a three-face totem pole whose
  // eyes catch fire-light after dark ----
  if (mapId === "umbala") {
    const totemWood = new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.trunk).multiplyScalar(1.1), roughness: 1, flatShading: true });
    mats.push(totemWood);
    const [totemGeo] = track(new THREE.CylinderGeometry(0.55, 0.65, 1.2, 8), totemWood);
    const [totemNoseGeo] = track(new THREE.ConeGeometry(0.16, 0.4, 4), totemWood);
    const [totemEyeGeo, totemEyeMat] = track(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffb060 }));
    nightLights.push({ mat: totemEyeMat, day: new THREE.Color(0x6a4a30), night: new THREE.Color(0xffb060) });
    const [totemWingGeo] = track(new THREE.BoxGeometry(1.9, 0.18, 0.4), totemWood);
    const totem = new THREE.Group();
    for (let t = 0; t < 3; t++) {
      const segment = new THREE.Mesh(totemGeo, totemWood);
      segment.position.y = 0.6 + t * 1.2;
      segment.rotation.y = t * 0.5;
      segment.castShadow = true;
      totem.add(segment);
      for (const s of [-1, 1]) {
        const eye = new THREE.Mesh(totemEyeGeo, totemEyeMat);
        eye.position.set(s * 0.2, 0.75 + t * 1.2, 0.5);
        totem.add(eye);
      }
      const nose = new THREE.Mesh(totemNoseGeo, totemWood);
      nose.rotation.x = Math.PI / 2;
      nose.position.set(0, 0.55 + t * 1.2, 0.62);
      totem.add(nose);
    }
    const totemWings = new THREE.Mesh(totemWingGeo, totemWood);
    totemWings.position.y = 3.75;
    totemWings.rotation.z = 0.06;
    totem.add(totemWings);
    totem.position.set(10.5, 0, -11);
    totem.rotation.y = Math.atan2(-10.5, 11);
    group.add(totem);
  }

  // ---- Glast Heim ruins: broken column stumps and one leaning survivor
  // scattered around the haunted keep's approach ----
  if (mapId === "glast_heim" || mapId === "gh_church") {
    const [columnGeo, columnMat] = track(
      new THREE.CylinderGeometry(0.42, 0.48, 1, 9),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.rock).multiplyScalar(1.05), roughness: 1, flatShading: true }),
    );
    const stumps: [number, number, number, number][] = [
      [-13, -8, 1.1, 0.3], // [x, z, height, tilt]
      [-10.5, -12, 2.3, -0.1],
      [12, -9, 0.8, 0.5],
      [14.5, -13, 3.4, 0.22],
      [9, 13.5, 1.6, -0.35],
    ];
    for (const [cx, cz, h, tilt] of stumps) {
      const column = new THREE.Mesh(columnGeo, columnMat);
      column.scale.y = h;
      column.position.set(cx, h / 2 - 0.05, cz);
      column.rotation.z = tilt * 0.3;
      column.rotation.y = rng() * Math.PI;
      column.castShadow = true;
      group.add(column);
    }
  }

  // ---- Payon pagoda: a three-tier timber pagoda rises over the pine town,
  // its top window kept lit through the night ----
  if (mapId === "payon") {
    const pagodaWood = new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.trunk).multiplyScalar(1.05), roughness: 0.95 });
    mats.push(pagodaWood);
    const [tierGeo] = track(new THREE.BoxGeometry(2.4, 1.15, 2.4), pagodaWood);
    const [pagodaRoofGeo, pagodaRoofMat] = track(
      new THREE.ConeGeometry(2.15, 0.75, 4),
      new THREE.MeshStandardMaterial({ color: 0x3a5a3a, roughness: 0.9, flatShading: true }),
    );
    const [pagodaWinGeo, pagodaWinMat] = track(new THREE.BoxGeometry(0.38, 0.38, 0.06), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
    nightLights.push({ mat: pagodaWinMat, day: new THREE.Color(0x8a7a62), night: new THREE.Color(0xffd9a0) });
    const pagoda = new THREE.Group();
    for (let t = 0; t < 3; t++) {
      const shrink = 1 - t * 0.22;
      const tier = new THREE.Mesh(tierGeo, pagodaWood);
      tier.scale.setScalar(shrink);
      tier.position.y = 0.6 + t * 1.55;
      tier.castShadow = true;
      pagoda.add(tier);
      const tierRoof = new THREE.Mesh(pagodaRoofGeo, pagodaRoofMat);
      tierRoof.scale.setScalar(shrink);
      tierRoof.position.y = 1.55 + t * 1.55;
      tierRoof.rotation.y = Math.PI / 4;
      tierRoof.castShadow = true;
      pagoda.add(tierRoof);
    }
    const pagodaWin = new THREE.Mesh(pagodaWinGeo, pagodaWinMat);
    pagodaWin.position.set(0, 3.75, 0.75);
    pagoda.add(pagodaWin);
    pagoda.position.set(-12.5, 0, -10.5);
    pagoda.rotation.y = Math.atan2(12.5, 10.5);
    group.add(pagoda);
  }

  // ---- Juno levitation: the sky city's outskirts float slow-bobbing rock
  // shards, as if the ground itself forgot gravity ----
  if (mapId === "juno") {
    const [floatRockGeo, floatRockMat] = track(
      new THREE.DodecahedronGeometry(0.5, 0),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.rock).multiplyScalar(0.95), roughness: 1, flatShading: true }),
    );
    for (let i = 0; i < 7; i++) {
      const rock = new THREE.Mesh(floatRockGeo, floatRockMat);
      const sc = 0.5 + rng() * 0.9;
      rock.scale.setScalar(sc);
      rock.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
      rock.castShadow = true;
      group.add(rock);
      const a = rng() * Math.PI * 2;
      const r = 12 + rng() * 16;
      rock.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      bobbers.push({ obj: rock, baseY: 1.6 + rng() * 2.2, phase: rng() * Math.PI * 2 });
      spinners.push({ obj: rock, speed: (rng() - 0.5) * 0.3, axis: "y" });
    }
  }

  // ---- Moscovia chapel: a little whitewashed chapel with a gilded onion
  // dome and a warm window, tucked off the plaza ----
  if (mapId === "moscovia") {
    const [chapelGeo, chapelMat] = track(
      new THREE.BoxGeometry(2.2, 2.4, 2.2),
      new THREE.MeshStandardMaterial({ color: 0xf0ead8, roughness: 0.95 }),
    );
    const [drumGeo] = track(new THREE.CylinderGeometry(0.55, 0.55, 0.9, 10), chapelMat);
    const [onionGeo, onionMat] = track(
      new THREE.SphereGeometry(0.72, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xd8a83a, roughness: 0.35, metalness: 0.6 }),
    );
    const [spikeGeo] = track(new THREE.ConeGeometry(0.18, 0.55, 8), onionMat);
    const [chapelWinGeo, chapelWinMat] = track(new THREE.BoxGeometry(0.4, 0.6, 0.06), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
    nightLights.push({ mat: chapelWinMat, day: new THREE.Color(0x8a7a62), night: new THREE.Color(0xffd9a0) });
    const chapel = new THREE.Group();
    const hall = new THREE.Mesh(chapelGeo, chapelMat);
    hall.position.y = 1.2;
    hall.castShadow = true;
    chapel.add(hall);
    const drum = new THREE.Mesh(drumGeo, chapelMat);
    drum.position.y = 2.85;
    chapel.add(drum);
    const onion = new THREE.Mesh(onionGeo, onionMat);
    onion.scale.y = 1.15;
    onion.position.y = 3.85;
    onion.castShadow = true;
    chapel.add(onion);
    const spike = new THREE.Mesh(spikeGeo, onionMat);
    spike.position.y = 4.85;
    chapel.add(spike);
    const chapelWin = new THREE.Mesh(chapelWinGeo, chapelWinMat);
    chapelWin.position.set(0, 1.3, 1.12);
    chapel.add(chapelWin);
    chapel.position.set(12.5, 0, -9.5);
    chapel.rotation.y = Math.atan2(-12.5, 9.5);
    group.add(chapel);
  }

  // ---- tiki torches: tropical palm maps ring the plaza with bamboo torches
  // whose flames flicker on the brazier channel ----
  if (theme.tree === "palm") {
    const [tikiPoleGeo, tikiPoleMat] = track(
      new THREE.CylinderGeometry(0.06, 0.08, 1.7, 6),
      new THREE.MeshStandardMaterial({ color: 0x9a7b4a, roughness: 1 }),
    );
    const [tikiBowlGeo] = track(new THREE.CylinderGeometry(0.14, 0.09, 0.2, 6), tikiPoleMat);
    const [tikiFlameGeo, tikiFlameMat] = track(new THREE.ConeGeometry(0.11, 0.3, 6), new THREE.MeshBasicMaterial({ color: 0xff9a3a }));
    nightLights.push({ mat: tikiFlameMat, day: new THREE.Color(0xff9a3a), night: new THREE.Color(0xffc060) });
    for (const deg of [30, 120, 210, 300]) {
      const a = (deg / 180) * Math.PI;
      const tx = Math.cos(a) * 8.2;
      const tz = Math.sin(a) * 8.2;
      const pole = new THREE.Mesh(tikiPoleGeo, tikiPoleMat);
      pole.position.set(tx, 0.85, tz);
      pole.castShadow = true;
      group.add(pole);
      const bowl = new THREE.Mesh(tikiBowlGeo, tikiPoleMat);
      bowl.position.set(tx, 1.78, tz);
      group.add(bowl);
      const tikiFlame = new THREE.Mesh(tikiFlameGeo, tikiFlameMat);
      tikiFlame.position.set(tx, 2.0, tz);
      group.add(tikiFlame);
      flickers.push(tikiFlame);
    }
  }

  // ---- Thor volcano embers: the caldera map is never still — hot motes
  // drift and swirl over the ground day and night ----
  if (mapId === "thor") {
    const thorEmberMat = new THREE.SpriteMaterial({ map: makeSpark(), color: 0xff7a30, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending });
    mats.push(thorEmberMat);
    for (let i = 0; i < 14; i++) {
      const ember = new THREE.Sprite(thorEmberMat);
      ember.scale.setScalar(0.08 + rng() * 0.07);
      group.add(ember);
      const a = rng() * Math.PI * 2;
      const r = 6 + rng() * 24;
      orbiters.push({
        sprite: ember,
        cx: Math.cos(a) * r,
        cz: Math.sin(a) * r,
        y: 0.6 + rng() * 2.4,
        r: 0.8 + rng() * 1.6,
        speed: 0.4 + rng() * 0.6,
        phase: rng() * Math.PI * 2,
      });
    }
  }

  // ---- Einbroch smokestacks: the steam town's skyline — two brick stacks
  // venting heavy plumes on the chimney-puff channel ----
  if (mapId === "einbroch" || mapId === "bio_lab") {
    const [stackGeo, stackMat] = track(
      new THREE.CylinderGeometry(0.6, 0.85, 7.5, 10),
      new THREE.MeshStandardMaterial({ color: 0x5a4038, roughness: 1 }),
    );
    const [bandGeo, bandMat] = track(
      new THREE.CylinderGeometry(0.68, 0.68, 0.35, 10),
      new THREE.MeshStandardMaterial({ color: 0x3a2c26, roughness: 1 }),
    );
    const heavySmokeMat = new THREE.SpriteMaterial({ map: makeSpark(), color: 0x6a6d76, transparent: true, opacity: 0.32, depthWrite: false });
    mats.push(heavySmokeMat);
    for (const [sx, sz] of [[-17, -11], [-13, -16]] as const) {
      const stack = new THREE.Mesh(stackGeo, stackMat);
      stack.position.set(sx, 3.75, sz);
      stack.castShadow = true;
      group.add(stack);
      const band = new THREE.Mesh(bandGeo, bandMat);
      band.position.set(sx, 7.1, sz);
      group.add(band);
      for (let puff = 0; puff < 3; puff++) {
        const sprite = new THREE.Sprite(heavySmokeMat);
        sprite.position.set(sx, 7.6, sz);
        sprite.scale.setScalar(0.6);
        group.add(sprite);
        smokes.push({ sprite, baseY: 7.6, offset: puff / 3 });
      }
    }
  }

  // ---- arcane shards: the sorcery towns levitate glowing fragments that
  // orbit the centerpiece in a slow helix, brightening after dark ----
  if (mapId === "geffen" || mapId === "tower" || mapId === "gh_abyss") {
    const shardOrbitMat = new THREE.MeshBasicMaterial({ color: theme.foliage[0], transparent: true, opacity: 0.9 });
    mats.push(shardOrbitMat);
    nightLights.push({
      mat: shardOrbitMat,
      day: new THREE.Color(theme.foliage[0]).multiplyScalar(0.6),
      night: new THREE.Color(theme.foliage[0]).lerp(new THREE.Color(0xffffff), 0.4),
    });
    const [orbGeo] = track(new THREE.TetrahedronGeometry(0.16, 0), shardOrbitMat);
    for (let s = 0; s < 5; s++) {
      const shard = new THREE.Mesh(orbGeo, shardOrbitMat);
      group.add(shard);
      spinners.push({ obj: shard, speed: 1.2 + s * 0.3 });
      cruisers.push({
        obj: shard,
        r: 2.2 + s * 0.35,
        y: 2.6 + s * 0.5,
        speed: 0.35 * (s % 2 === 0 ? 1 : -1),
        phase: (s / 5) * Math.PI * 2,
        bob: 0.2,
      });
    }
  }

  // ---- Aldebaran clock tower: the town's landmark — a tall stone tower with
  // a white clock face whose hands really turn ----
  if (mapId === "aldebaran") {
    const towerMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.rock).lerp(new THREE.Color(0xffffff), 0.15), roughness: 0.95 });
    mats.push(towerMat);
    const [towerGeo] = track(new THREE.BoxGeometry(2.6, 9, 2.6), towerMat);
    const [towerRoofGeo, towerRoofMat] = track(
      new THREE.ConeGeometry(2.2, 1.8, 4),
      new THREE.MeshStandardMaterial({ color: 0x3a5a4a, roughness: 0.9, flatShading: true }),
    );
    const [faceGeo, faceMat] = track(new THREE.CircleGeometry(0.85, 20), new THREE.MeshBasicMaterial({ color: 0xf4efe0 }));
    nightLights.push({ mat: faceMat, day: new THREE.Color(0xf4efe0), night: new THREE.Color(0xffe9b0) });
    const [handGeo, handMat] = track(new THREE.BoxGeometry(0.06, 0.62, 0.02), new THREE.MeshBasicMaterial({ color: 0x2a2430 }));
    const clockTower = new THREE.Group();
    const shaft = new THREE.Mesh(towerGeo, towerMat);
    shaft.position.y = 4.5;
    shaft.castShadow = true;
    clockTower.add(shaft);
    const towerRoof = new THREE.Mesh(towerRoofGeo, towerRoofMat);
    towerRoof.position.y = 9.9;
    towerRoof.rotation.y = Math.PI / 4;
    towerRoof.castShadow = true;
    clockTower.add(towerRoof);
    const face = new THREE.Mesh(faceGeo, faceMat);
    face.position.set(0, 7.6, 1.32);
    clockTower.add(face);
    // minute and hour hands pivot from their base ends and turn at scaled rates
    for (const [len, speed] of [[0.62, 0.2], [0.42, 0.0167]] as const) {
      const hand = new THREE.Mesh(handGeo, handMat);
      hand.scale.y = len / 0.62;
      const pivot = new THREE.Group();
      hand.position.y = len / 2 - 0.03;
      pivot.add(hand);
      pivot.position.set(0, 7.6, 1.33);
      clockTower.add(pivot);
      spinners.push({ obj: pivot, speed: -speed });
    }
    clockTower.position.set(-14, 0, -14);
    clockTower.rotation.y = Math.PI / 4; // face turned toward the plaza
    group.add(clockTower);
  }

  // ---- snowman: snowy towns get a lopsided snowman by the plaza with a
  // carrot nose, coal eyes and twig arms ----
  if (theme.snowy) {
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xf4f8fc, roughness: 0.9 });
    mats.push(snowMat);
    const [snowBallGeo] = track(new THREE.SphereGeometry(0.55, 12, 10), snowMat);
    const [coalGeo, coalMat] = track(new THREE.SphereGeometry(0.045, 6, 5), new THREE.MeshStandardMaterial({ color: 0x18141a, roughness: 1 }));
    const [carrotGeo, carrotMat] = track(new THREE.ConeGeometry(0.06, 0.3, 6), new THREE.MeshStandardMaterial({ color: 0xe07a2a, roughness: 1 }));
    const [twigGeo, twigMat] = track(new THREE.CylinderGeometry(0.02, 0.03, 0.8, 4), new THREE.MeshStandardMaterial({ color: 0x4a3220, roughness: 1 }));
    const snowman = new THREE.Group();
    const base = new THREE.Mesh(snowBallGeo, snowMat);
    base.position.y = 0.5;
    base.castShadow = true;
    snowman.add(base);
    const torso = new THREE.Mesh(snowBallGeo, snowMat);
    torso.scale.setScalar(0.72);
    torso.position.y = 1.18;
    snowman.add(torso);
    const noggin = new THREE.Mesh(snowBallGeo, snowMat);
    noggin.scale.setScalar(0.5);
    noggin.position.y = 1.78;
    snowman.add(noggin);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(coalGeo, coalMat);
      eye.position.set(s * 0.11, 1.86, 0.24);
      snowman.add(eye);
      const twig = new THREE.Mesh(twigGeo, twigMat);
      twig.position.set(s * 0.62, 1.3, 0);
      twig.rotation.z = s * (Math.PI / 2 - 0.35);
      snowman.add(twig);
    }
    for (let b = 0; b < 3; b++) {
      const button = new THREE.Mesh(coalGeo, coalMat);
      button.position.set(0, 1.0 + b * 0.19, 0.36 - b * 0.02);
      snowman.add(button);
    }
    const carrot = new THREE.Mesh(carrotGeo, carrotMat);
    carrot.rotation.x = Math.PI / 2;
    carrot.position.set(0, 1.78, 0.38);
    snowman.add(carrot);
    snowman.position.set(7.2, 0, 2.6);
    snowman.rotation.y = Math.atan2(-7.2, -2.6);
    group.add(snowman);
  }

  // ---- stone lanterns: East-Asian-themed towns line the south path with
  // squat toro lanterns whose windows warm up after dark ----
  if (mapId === "amatsu" || mapId === "louyang" || mapId === "gonryun" || mapId === "chinatown") {
    const [toroGeo, toroMat] = track(
      new THREE.CylinderGeometry(0.22, 0.3, 0.5, 6),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.rock).multiplyScalar(0.9), roughness: 1, flatShading: true }),
    );
    const [toroCapGeo] = track(new THREE.ConeGeometry(0.42, 0.3, 6), toroMat);
    const [toroLightGeo, toroLightMat] = track(new THREE.BoxGeometry(0.2, 0.16, 0.2), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
    nightLights.push({ mat: toroLightMat, day: new THREE.Color(0x9a8468), night: new THREE.Color(0xffd9a0) });
    for (const [sx, tz] of [[-1, 12], [1, 15], [-1, 18], [1, 21]] as const) {
      const toro = new THREE.Group();
      const base = new THREE.Mesh(toroGeo, toroMat);
      base.position.y = 0.25;
      toro.add(base);
      const light = new THREE.Mesh(toroLightGeo, toroLightMat);
      light.position.y = 0.6;
      toro.add(light);
      const cap = new THREE.Mesh(toroCapGeo, toroMat);
      cap.position.y = 0.84;
      toro.add(cap);
      toro.position.set(sx * 2.2, 0, tz);
      group.add(toro);
    }

    // red paper lanterns swing beneath the gate-arch beam, glowing after dark
    const [redLanternGeo, redLanternMat] = track(
      new THREE.SphereGeometry(0.19, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xc03028 }),
    );
    nightLights.push({ mat: redLanternMat, day: new THREE.Color(0xc03028), night: new THREE.Color(0xff6a4a) });
    const [tasselGeo, tasselMat] = track(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 4), new THREE.MeshStandardMaterial({ color: 0xd8a850, roughness: 0.8 }));
    for (const lxp of [-1.4, 0, 1.4]) {
      const lantern = new THREE.Group();
      const bulb = new THREE.Mesh(redLanternGeo, redLanternMat);
      bulb.scale.y = 0.85;
      lantern.add(bulb);
      const tassel = new THREE.Mesh(tasselGeo, tasselMat);
      tassel.position.y = -0.24;
      lantern.add(tassel);
      lantern.position.set(lxp, 2.72, 24);
      group.add(lantern);
      bobbers.push({ obj: lantern, baseY: 2.72, phase: lxp * 1.7 });
    }
  }

  // ---- glowing mushrooms: jungle maps sprout tiny fungus clusters on the
  // forest floor that shine teal once the sun goes down ----
  if (theme.tree === "jungle") {
    const [stemGeo, stemMat] = track(
      new THREE.CylinderGeometry(0.04, 0.06, 0.22, 6),
      new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 1 }),
    );
    const [capGeo, capMat] = track(new THREE.ConeGeometry(0.16, 0.14, 8), new THREE.MeshBasicMaterial({ color: 0x58c0a8 }));
    nightLights.push({
      mat: capMat,
      day: new THREE.Color(0x58c0a8).multiplyScalar(0.5),
      night: new THREE.Color(0x7af0cc),
    });
    for (let c = 0; c < 7; c++) {
      const a = rng() * Math.PI * 2;
      const r = 9 + rng() * 20;
      const cx = Math.cos(a) * r;
      const cz = Math.sin(a) * r;
      for (let s = 0; s < 3; s++) {
        const sc = 0.7 + rng() * 0.8;
        const mx = cx + (rng() - 0.5) * 0.7;
        const mz = cz + (rng() - 0.5) * 0.7;
        const stem = new THREE.Mesh(stemGeo, stemMat);
        stem.scale.setScalar(sc);
        stem.position.set(mx, 0.11 * sc, mz);
        group.add(stem);
        const cap = new THREE.Mesh(capGeo, capMat);
        cap.scale.setScalar(sc);
        cap.position.set(mx, 0.25 * sc, mz);
        group.add(cap);
      }
    }
  }

  // ---- sea-floor bubbles: the sunken maps vent columns of bubbles that ride
  // the chimney-puff channel (rise, swell, thin out, loop) ----
  if (mapId === "byalan" || mapId === "abyss") {
    const bubbleMat = new THREE.SpriteMaterial({ map: makeSpark(), color: 0x9adcf0, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending });
    mats.push(bubbleMat);
    for (let v = 0; v < 4; v++) {
      const a = rng() * Math.PI * 2;
      const r = 8 + rng() * 18;
      const vx = Math.cos(a) * r;
      const vz = Math.sin(a) * r;
      for (let b = 0; b < 3; b++) {
        const bubble = new THREE.Sprite(bubbleMat);
        bubble.position.set(vx + (rng() - 0.5) * 0.4, 0.2, vz + (rng() - 0.5) * 0.4);
        bubble.scale.setScalar(0.12);
        group.add(bubble);
        smokes.push({ sprite: bubble, baseY: 0.2, offset: b / 3 + v * 0.17 });
      }
    }
  }

  // ---- night bats: on haunted maps a few bats wheel overhead after dark,
  // fading in with the night level like the ground mist ----
  if (theme.tree === "dead") {
    const batMat = new THREE.MeshBasicMaterial({ color: 0x201824, side: THREE.DoubleSide, transparent: true, opacity: 0 });
    mats.push(batMat);
    nightFades.push({ mat: batMat, max: 0.95 });
    const [batBodyGeo] = track(new THREE.SphereGeometry(0.09, 8, 6), batMat);
    const [batWingGeo] = track(new THREE.PlaneGeometry(0.5, 0.2), batMat);
    for (let b = 0; b < 3; b++) {
      const bat = new THREE.Group();
      bat.add(new THREE.Mesh(batBodyGeo, batMat));
      const wings: THREE.Object3D[] = [];
      for (const s of [-1, 1]) {
        const pivot = new THREE.Group();
        if (s < 0) pivot.rotation.y = Math.PI;
        const wing = new THREE.Mesh(batWingGeo, batMat);
        wing.position.x = 0.28;
        pivot.add(wing);
        bat.add(pivot);
        wings.push(pivot);
      }
      group.add(bat);
      cruisers.push({
        obj: bat,
        r: 6 + rng() * 8,
        y: 5 + rng() * 3,
        speed: (0.5 + rng() * 0.4) * (b % 2 === 0 ? 1 : -1),
        phase: rng() * Math.PI * 2,
        wings,
        flapRate: 13,
      });
    }
  }

  // ---- crystal outcrops: on crystal maps, clusters of tilted shards catch
  // the theme's hue by day and glow from within after dark ----
  if (theme.tree === "crystal") {
    const [shardGeo, shardMat] = track(
      new THREE.ConeGeometry(0.22, 1.1, 5),
      new THREE.MeshBasicMaterial({ color: theme.foliage[0] }),
    );
    nightLights.push({
      mat: shardMat,
      day: new THREE.Color(theme.foliage[0]).multiplyScalar(0.55),
      night: new THREE.Color(theme.foliage[0]).lerp(new THREE.Color(0xffffff), 0.35),
    });
    for (let c = 0; c < 6; c++) {
      const a = rng() * Math.PI * 2;
      const r = 10 + rng() * 20;
      const cx = Math.cos(a) * r;
      const cz = Math.sin(a) * r;
      for (let s = 0; s < 3; s++) {
        const shard = new THREE.Mesh(shardGeo, shardMat);
        const sc = 0.6 + rng() * 0.9;
        shard.scale.setScalar(sc);
        shard.position.set(cx + (rng() - 0.5) * 0.9, 0.4 * sc, cz + (rng() - 0.5) * 0.9);
        shard.rotation.set((rng() - 0.5) * 0.6, rng() * Math.PI, (rng() - 0.5) * 0.6);
        group.add(shard);
      }
    }
  }

  // ---- seabirds: a small wheeling flock over the water on coastal maps ----
  if (WATER_MAPS[mapId]) {
    const [birdBodyGeo, birdMat] = track(
      new THREE.ConeGeometry(0.11, 0.55, 6),
      new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.8 }),
    );
    const [wingGeo] = track(new THREE.BoxGeometry(0.85, 0.03, 0.26), birdMat);
    for (let b = 0; b < 4; b++) {
      const bird = new THREE.Group();
      const body = new THREE.Mesh(birdBodyGeo, birdMat);
      body.rotation.x = Math.PI / 2; // cone nose points +z = direction of travel
      bird.add(body);
      const wings: THREE.Object3D[] = [];
      for (const s of [-1, 1]) {
        // pivot at the shoulder; the left pivot is mirrored so one shared
        // rotation.z flaps both wings up and down together
        const pivot = new THREE.Group();
        pivot.position.x = s * 0.08;
        if (s < 0) pivot.rotation.y = Math.PI;
        const wing = new THREE.Mesh(wingGeo, birdMat);
        wing.position.x = 0.42;
        pivot.add(wing);
        bird.add(pivot);
        wings.push(pivot);
      }
      group.add(bird);
      cruisers.push({
        obj: bird,
        r: MAP_HALF * (1.02 + rng() * 0.08),
        y: 11 + rng() * 5,
        speed: (0.16 + rng() * 0.08) * (b % 2 === 0 ? 1 : -1),
        phase: rng() * Math.PI * 2,
        wings,
      });
    }
  }

  return {
    group,
    setShade(mul: number) {
      for (const s of shadeList) s.mat.color.copy(s.base).multiplyScalar(mul);
    },
    setNight(n: number) {
      nightNow = n;
      for (const l of nightLights) l.mat.color.copy(l.day).lerp(l.night, n);
      for (const f of nightFades) f.mat.opacity = f.max * n;
      for (const f of dayFades) f.mat.opacity = f.max * (1 - n);
    },
    tick(dt: number) {
      animPhase += dt;
      // brazier embers flicker like flame (per-mesh offset so they desync)
      for (let i = 0; i < flickers.length; i++) {
        const s = 1 + Math.sin(animPhase * 7 + i * 1.7) * 0.12 + Math.sin(animPhase * 13 + i) * 0.06;
        flickers[i].scale.setScalar(s);
      }
      // fireflies orbit their lamp with a gentle vertical wander
      for (const o of orbiters) {
        const a = o.phase + animPhase * o.speed;
        o.sprite.position.set(o.cx + Math.cos(a) * o.r, o.y + Math.sin(a * 1.7) * 0.2, o.cz + Math.sin(a) * o.r);
      }
      // the moored boat + distant ship bob and roll on the swell
      for (const b of bobbers) {
        b.obj.position.y = b.baseY + Math.sin(animPhase * 1.3 + b.phase) * 0.06;
        b.obj.rotation.z = Math.sin(animPhase * 1.1 + b.phase) * 0.05;
      }
      // windmill sails turn slowly; the aurora band drifts around the sky
      for (const s of spinners) s.obj.rotation[s.axis ?? "z"] += dt * s.speed;
      // chimney puffs rise, swell mid-climb, then shrink away and loop
      for (const s of smokes) {
        const t = (animPhase * 0.22 + s.offset) % 1;
        s.sprite.position.y = s.baseY + t * 1.5;
        s.sprite.scale.setScalar(0.2 + Math.sin(Math.PI * t) * 0.55);
      }
      // a shooting star dashes across the first beat of each cycle at night
      {
        const CYCLE = 9;
        const idx = Math.floor(animPhase / CYCLE);
        const t = (animPhase % CYCLE) / 0.9; // 0→1 over the first 0.9 s
        // cheap deterministic per-cycle randoms (fractional-sine hash)
        const h1 = Math.abs(Math.sin(idx * 127.1) * 43758.5) % 1;
        const h2 = Math.abs(Math.sin(idx * 311.7) * 26951.3) % 1;
        if (t < 1) {
          const a0 = h1 * Math.PI * 2;
          const dir = a0 + 2.3 + h2 * 1.6; // streak heading, roughly crosswise
          const r0 = 60 + h2 * 30;
          star.position.set(
            Math.cos(a0) * r0 + Math.cos(dir) * t * 34,
            36 + h2 * 10 - t * 7,
            Math.sin(a0) * r0 + Math.sin(dir) * t * 34,
          );
          starMat.rotation = -dir;
          starMat.opacity = nightNow * Math.sin(Math.PI * t) * 0.9;
        } else {
          starMat.opacity = 0;
        }
      }
      // a firework blooms over town: grows through the burst while it fades
      {
        const CYCLE = 13;
        const idx = Math.floor(animPhase / CYCLE);
        const t = (animPhase % CYCLE) / 1.4; // 0→1 over the first 1.4 s
        const h1 = Math.abs(Math.sin(idx * 91.7) * 47453.3) % 1;
        const h2 = Math.abs(Math.sin(idx * 217.3) * 33871.1) % 1;
        if (t < 1) {
          const a = h1 * Math.PI * 2;
          firework.position.set(Math.cos(a) * 24, 20 + h2 * 8, Math.sin(a) * 24);
          firework.scale.setScalar(1 + t * 9);
          fireworkMat.color.setHSL(h2, 0.85, 0.65);
          fireworkMat.opacity = nightNow * (1 - t) * 0.85;
        } else {
          fireworkMat.opacity = 0;
        }
      }
      // leaves tumble down from canopy height, swaying sideways as they fall
      for (const l of leaves) {
        const t = (animPhase * 0.06 + l.offset) % 1;
        l.m.position.set(
          l.x + Math.sin(animPhase * 0.9 + l.offset * 20) * 1.1,
          6.5 * (1 - t),
          l.z + Math.cos(animPhase * 0.7 + l.offset * 14) * 0.8,
        );
        l.m.rotation.set(animPhase * l.spin, l.offset * 6, animPhase * l.spin * 0.7);
      }
      // fish leap: a quick parabolic arc out of the sea, nose tracing the path
      for (const j of jumpers) {
        const t = ((animPhase + j.offset) % 7) / 1.1; // first 1.1 s of a 7 s cycle
        if (t < 1) {
          j.obj.visible = true;
          j.obj.position.set(j.x + t * 1.4, -0.35 + Math.sin(Math.PI * t) * 1.5, j.z);
          j.obj.rotation.x = (t - 0.5) * 2.1; // nose up on the rise, down on the dive
        } else {
          j.obj.visible = false;
        }
      }
      // cruisers fly their ring route, nose along the tangent, wings flapping
      for (const c of cruisers) {
        const a = c.phase + animPhase * c.speed;
        c.obj.position.set((c.cx ?? 0) + Math.cos(a) * c.r, c.y + Math.sin(a * 3 + c.phase) * (c.bob ?? 0.4), (c.cz ?? 0) + Math.sin(a) * c.r);
        c.obj.rotation.y = -a + (c.speed < 0 ? Math.PI : 0);
        if (c.wings) {
          const flap = Math.sin(animPhase * (c.flapRate ?? 9) + c.phase * 7) * 0.55;
          for (const w of c.wings) w.rotation.z = flap;
        }
      }
      if (!animated) return;
      if (animated.jet) {
        // fountain jet pulses; the pool shimmers faintly
        animated.jet.scale.y = 1 + Math.sin(animPhase * 3) * 0.16;
        animated.jet.scale.x = animated.jet.scale.z = 1 - Math.sin(animPhase * 3) * 0.06;
      }
      if (animated.water) {
        (animated.water.material as THREE.MeshBasicMaterial).opacity = 0.8 + Math.sin(animPhase * 2.2) * 0.06;
      }
      if (animated.shard) {
        // crystal monolith slowly spins and bobs
        animated.shard.rotation.y += dt * 0.4;
        animated.shard.position.y = 2.0 + Math.sin(animPhase * 0.8) * 0.12;
      }
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
  nightLights: NightLight[],
  smokes: { sprite: THREE.Sprite; baseY: number; offset: number }[],
  spinners: { obj: THREE.Object3D; speed: number; axis?: "y" }[],
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
  nightLights.push({ mat: winMat, day: new THREE.Color(0x8a7a62), night: new THREE.Color(0xffd9a0) });
  const [chimneyGeo, chimneyMat] = track(
    new THREE.BoxGeometry(0.34, 0.7, 0.34),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.rock).multiplyScalar(0.7), roughness: 1 }),
  );
  // shared puff material; riding track() with the chimney geo keeps it in the
  // dispose list (a re-disposed geometry is a safe no-op in three.js)
  const [, smokeMat] = track(
    chimneyGeo,
    new THREE.SpriteMaterial({ map: makeSpark(), color: 0xb9bcc4, transparent: true, opacity: 0.28, depthWrite: false }),
  );

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
    // a squat chimney off the roof's back corner, with looping smoke puffs
    const chimney = new THREE.Mesh(chimneyGeo, chimneyMat);
    chimney.position.set(0.7, 2.55, -0.4);
    house.add(chimney);
    // the north house carries a weather vane that swings slowly with the wind
    if (p.x === 0) {
      const vaneMat = new THREE.MeshStandardMaterial({ color: 0x3a3430, roughness: 0.7, metalness: 0.4 });
      const [rodGeo] = track(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 5), vaneMat);
      const rod = new THREE.Mesh(rodGeo, vaneMat);
      rod.position.y = 3.15;
      house.add(rod);
      const [vaneShaftGeo] = track(new THREE.BoxGeometry(0.03, 0.03, 0.6), vaneMat);
      const [vaneHeadGeo] = track(new THREE.ConeGeometry(0.05, 0.14, 4), vaneMat);
      const [vaneFinGeo] = track(new THREE.BoxGeometry(0.02, 0.14, 0.16), vaneMat);
      const vane = new THREE.Group();
      vane.add(new THREE.Mesh(vaneShaftGeo, vaneMat));
      const vaneHead = new THREE.Mesh(vaneHeadGeo, vaneMat);
      vaneHead.rotation.x = Math.PI / 2;
      vaneHead.position.z = 0.34;
      vane.add(vaneHead);
      const vaneFin = new THREE.Mesh(vaneFinGeo, vaneMat);
      vaneFin.position.z = -0.28;
      vane.add(vaneFin);
      vane.position.y = 3.32;
      house.add(vane);
      spinners.push({ obj: vane, speed: 0.3, axis: "y" });
    }
    for (let puff = 0; puff < 3; puff++) {
      const sprite = new THREE.Sprite(smokeMat);
      sprite.position.set(0.7, 2.95, -0.4);
      sprite.scale.setScalar(0.25);
      house.add(sprite);
      smokes.push({ sprite, baseY: 2.95, offset: puff / 3 });
    }
    house.position.set(p.x, 0, p.z);
    house.rotation.y = Math.atan2(-p.x, -p.z); // door side (+z) faces the fountain
    group.add(house);
  }
}

// Plaza furniture: two benches facing the fountain, plus a crate stack and a
// barrel by the houses — small props that make the square feel inhabited.
function addPlazaProps(
  group: THREE.Group,
  theme: Theme,
  track: <T extends THREE.BufferGeometry, M extends THREE.Material>(g: T, m: M) => [T, M],
): void {
  const wood = new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.trunk).multiplyScalar(1.1), roughness: 0.95 });
  const [seatGeo] = track(new THREE.BoxGeometry(1.4, 0.08, 0.4), wood);
  const [backGeo] = track(new THREE.BoxGeometry(1.4, 0.34, 0.06), wood);
  const [legGeo] = track(new THREE.BoxGeometry(0.08, 0.42, 0.4), wood);
  for (const s of [-1, 1]) {
    const bench = new THREE.Group();
    const seat = new THREE.Mesh(seatGeo, wood);
    seat.position.y = 0.42;
    seat.castShadow = true;
    const back = new THREE.Mesh(backGeo, wood);
    back.position.set(0, 0.62, -0.2);
    const legL = new THREE.Mesh(legGeo, wood);
    legL.position.set(-0.6, 0.21, 0);
    const legR = new THREE.Mesh(legGeo, wood);
    legR.position.set(0.6, 0.21, 0);
    bench.add(seat, back, legL, legR);
    bench.position.set(s * 6.2, 0, 0.6);
    bench.rotation.y = s * Math.PI / 2; // face the fountain
    group.add(bench);
  }
  // crate stack beside the east house
  const [crateGeo] = track(new THREE.BoxGeometry(0.62, 0.62, 0.62), wood);
  const crates = [
    { x: 7.6, y: 0.31, z: -5.2, rot: 0.2 },
    { x: 8.3, y: 0.31, z: -5.5, rot: -0.35 },
    { x: 7.9, y: 0.93, z: -5.3, rot: 0.55 },
  ];
  for (const cfg of crates) {
    const crate = new THREE.Mesh(crateGeo, wood);
    crate.position.set(cfg.x, cfg.y, cfg.z);
    crate.rotation.y = cfg.rot;
    crate.castShadow = true;
    group.add(crate);
  }
  // barrel by the west house
  const [barrelGeo, barrelMat] = track(
    new THREE.CylinderGeometry(0.3, 0.34, 0.72, 10),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.trunk).multiplyScalar(0.85), roughness: 0.95 }),
  );
  const barrel = new THREE.Mesh(barrelGeo, barrelMat);
  barrel.position.set(-7.8, 0.36, -5.3);
  barrel.castShadow = true;
  group.add(barrel);
}

// Animatable parts of the centerpiece (fountain jet/pool or crystal shard).
type CenterpieceAnim = { jet?: THREE.Mesh; water?: THREE.Mesh; shard?: THREE.Mesh } | null;

// A themed monument at the map centre: a tiered fountain on living maps, a
// glowing crystal monolith on crystal maps, a weathered obelisk on dead ones.
// Returns the parts that Scenery.tick animates.
function addCenterpiece(
  group: THREE.Group,
  theme: Theme,
  track: <T extends THREE.BufferGeometry, M extends THREE.Material>(g: T, m: M) => [T, M],
): CenterpieceAnim {
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
    return { shard };
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
    return null; // the obelisk stands still
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
    return { jet, water };
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

  // snow caps on snowy pines: a small white cone perched on each canopy
  let snowCaps: THREE.InstancedMesh | null = null;
  if (theme.snowy) {
    const [snowGeo, snowMat] = track(
      new THREE.ConeGeometry(0.72, 0.9, 7),
      new THREE.MeshStandardMaterial({ color: 0xf4f8fc, roughness: 0.9, flatShading: true }),
    );
    snowCaps = new THREE.InstancedMesh(snowGeo, snowMat, n);
  }

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
    if (snowCaps) {
      m.compose(new THREE.Vector3(p.x, (foliageY + 1.15) * p.s, p.z), q, new THREE.Vector3(fs, fs, fs));
      snowCaps.setMatrixAt(i, m);
    }
  }
  if (foliage.instanceColor) foliage.instanceColor.needsUpdate = true;
  if (foliage2.instanceColor) foliage2.instanceColor.needsUpdate = true;
  group.add(trunks, foliage, foliage2);
  if (snowCaps) group.add(snowCaps);
}
