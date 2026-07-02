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
  // a migratory V of birds that crosses the whole sky once per long cycle
  let flock: THREE.Group | null = null;
  const flockWings: THREE.Object3D[] = [];
  // fish that periodically leap out of the sea in a little arc near the pier
  const jumpers: { obj: THREE.Object3D; x: number; z: number; offset: number }[] = [];
  // soft cloud shadows drifting in a straight line across the ground, wrapping
  // around once they clear the map
  const drifters: { obj: THREE.Object3D; vx: number; vz: number }[] = [];
  // materials whose opacity shimmers gently around a base value (puddles)
  const shimmers: { mat: THREE.Material & { opacity: number }; base: number; amp: number; phase: number }[] = [];
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
      // lily pads drift lazily on the surface between the koi
      const [padGeo, padMat] = track(
        new THREE.CircleGeometry(0.24, 8),
        new THREE.MeshStandardMaterial({ color: 0x3a8a4a, roughness: 0.7, side: THREE.DoubleSide }),
      );
      for (let p = 0; p < 4; p++) {
        const pad = new THREE.Mesh(padGeo, padMat);
        pad.rotation.x = -Math.PI / 2;
        group.add(pad);
        cruisers.push({ obj: pad, r: 0.4 + p * 0.18, y: 0.31, speed: 0.08 * (p % 2 === 0 ? 1 : -1), phase: (p / 4) * Math.PI * 2, bob: 0.005 });
      }
      // dragonflies zip erratically low over the fountain, wings a blur
      const dragonMat = new THREE.MeshBasicMaterial({ color: 0x3ac0a0 });
      mats.push(dragonMat);
      const [dragonBodyGeo] = track(new THREE.CylinderGeometry(0.015, 0.02, 0.28, 5), dragonMat);
      const [dragonWingGeo, dragonWingMat] = track(
        new THREE.PlaneGeometry(0.3, 0.06),
        new THREE.MeshBasicMaterial({ color: 0xd0f0e8, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
      );
      for (let d = 0; d < 2; d++) {
        const dragonfly = new THREE.Group();
        const body = new THREE.Mesh(dragonBodyGeo, dragonMat);
        body.rotation.x = Math.PI / 2;
        dragonfly.add(body);
        const wings: THREE.Object3D[] = [];
        for (const s of [-1, 1]) {
          const pivot = new THREE.Group();
          if (s < 0) pivot.rotation.y = Math.PI;
          const wing = new THREE.Mesh(dragonWingGeo, dragonWingMat);
          wing.position.x = 0.15;
          pivot.add(wing);
          dragonfly.add(pivot);
          wings.push(pivot);
        }
        group.add(dragonfly);
        cruisers.push({ obj: dragonfly, r: 1.2 + d * 0.5, y: 0.55 + d * 0.1, speed: 3.2 + d * 0.6, phase: rng() * Math.PI * 2, wings, flapRate: 30 });
      }

      // a frog perches on one lily pad, throat pulsing on the flicker channel
      const frogMat = new THREE.MeshStandardMaterial({ color: 0x5a9a4a, roughness: 0.85 });
      mats.push(frogMat);
      const [frogBodyGeo] = track(new THREE.SphereGeometry(0.09, 8, 6), frogMat);
      const [frogEyeGeo, frogEyeMat] = track(new THREE.SphereGeometry(0.025, 6, 5), new THREE.MeshStandardMaterial({ color: 0xf0e050, roughness: 0.5 }));
      const frog = new THREE.Group();
      const frogBody = new THREE.Mesh(frogBodyGeo, frogMat);
      frogBody.scale.set(1.1, 0.7, 1.2);
      frog.add(frogBody);
      const throat = new THREE.Mesh(frogBodyGeo, frogMat);
      throat.scale.setScalar(0.4);
      throat.position.set(0, -0.03, 0.09);
      frog.add(throat);
      flickers.push(throat);
      for (const s of [-1, 1]) {
        const eye = new THREE.Mesh(frogEyeGeo, frogEyeMat);
        eye.position.set(s * 0.05, 0.06, 0.05);
        frog.add(eye);
      }
      frog.position.set(0.55, 0.335, 0);
      group.add(frog);
      cruisers.push({ obj: frog, r: 0.4, y: 0.335, speed: -0.08, phase: 0, bob: 0.005 });
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
      const torii = mapId === "amatsu" || mapId === "louyang" || mapId === "gonryun";
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
      // Chinatown gets a circular moon gate instead of a torii — a proper
      // Chinese garden threshold, distinct from its East-Asian sister towns
      if (mapId === "chinatown") {
        const moonStone = new THREE.MeshStandardMaterial({ color: 0xd8302a, roughness: 0.85 });
        mats.push(moonStone);
        const [ringGeo] = track(new THREE.TorusGeometry(2.4, 0.32, 10, 28), moonStone);
        const ring = new THREE.Mesh(ringGeo, moonStone);
        ring.position.set(0, 2.5, 24);
        ring.castShadow = true;
        group.add(ring);
        // a small glowing plaque above the gate, warming after dark
        const [plaqueGeo, plaqueMat] = track(new THREE.CircleGeometry(0.35, 12), new THREE.MeshBasicMaterial({ color: 0xffd24a }));
        nightLights.push({ mat: plaqueMat, day: new THREE.Color(0xc9a850), night: new THREE.Color(0xffe27a) });
        const plaque = new THREE.Mesh(plaqueGeo, plaqueMat);
        plaque.position.set(0, 5.1, 24.35);
        group.add(plaque);
      }
    }

    // training dummy: a straw-stuffed practice post standing near the smithy,
    // a nod to where new adventurers learn to swing a weapon
    {
      const dummyWood = new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.trunk).multiplyScalar(0.85), roughness: 1 });
      mats.push(dummyWood);
      const [dPostGeo] = track(new THREE.CylinderGeometry(0.09, 0.11, 1.5, 6), dummyWood);
      const [dBodyGeo, dBodyMat] = track(new THREE.CylinderGeometry(0.26, 0.3, 1.0, 8), new THREE.MeshStandardMaterial({ color: 0xc8a86a, roughness: 1 }));
      const [dArmGeo] = track(new THREE.CylinderGeometry(0.05, 0.06, 0.7, 5), dummyWood);
      const [dHeadGeo, dHeadMat] = track(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshStandardMaterial({ color: 0xe0c088, roughness: 1 }));
      const dummy = new THREE.Group();
      const dPost = new THREE.Mesh(dPostGeo, dummyWood);
      dPost.position.y = 0.75;
      dummy.add(dPost);
      const dBody = new THREE.Mesh(dBodyGeo, dBodyMat);
      dBody.position.y = 1.55;
      dBody.castShadow = true;
      dummy.add(dBody);
      const dArm = new THREE.Mesh(dArmGeo, dummyWood);
      dArm.rotation.z = Math.PI / 2;
      dArm.position.y = 1.9;
      dummy.add(dArm);
      const dHead = new THREE.Mesh(dHeadGeo, dHeadMat);
      dHead.position.y = 2.2;
      dummy.add(dHead);
      dummy.position.set(-9.0, 0, 6.4);
      dummy.rotation.y = Math.atan2(9.0, -6.4);
      group.add(dummy);
    }

    // archery target: a straw butt with painted rings, standing near the
    // training dummy for ranged classes to practice against
    {
      const [targetBackGeo, targetBackMat] = track(
        new THREE.CylinderGeometry(0.55, 0.55, 0.22, 16),
        new THREE.MeshStandardMaterial({ color: 0xd8c088, roughness: 1 }),
      );
      const ringMats = [0xf0f0e8, 0x2a2430, 0x4a90d0, 0xd83030, 0xf0d040].map((c) => {
        const m = new THREE.MeshBasicMaterial({ color: c });
        mats.push(m);
        return m;
      });
      const [ringGeo] = track(new THREE.CircleGeometry(1, 16), ringMats[0]);
      const [legGeo, legMat] = track(new THREE.CylinderGeometry(0.04, 0.05, 1.0, 5), new THREE.MeshStandardMaterial({ color: 0x6a5238, roughness: 1 }));
      const target = new THREE.Group();
      const targetBack = new THREE.Mesh(targetBackGeo, targetBackMat);
      targetBack.rotation.x = Math.PI / 2;
      targetBack.position.y = 1.15;
      targetBack.castShadow = true;
      target.add(targetBack);
      for (let r = 0; r < 5; r++) {
        const ring = new THREE.Mesh(ringGeo, ringMats[r]);
        ring.scale.setScalar(0.52 - r * 0.09);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(0, 1.15, 0.12);
        target.add(ring);
      }
      for (const s of [-1, 1]) {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(s * 0.3, 0.5, -0.35);
        leg.rotation.x = s * 0.25;
        target.add(leg);
      }
      target.position.set(-9.8, 0, 7.6);
      target.rotation.y = Math.atan2(9.8, -7.6);
      group.add(target);
    }

    // beehive: a woven hive box on a stump, a small ring of bees looping
    // around it endlessly
    {
      const [hiveGeo, hiveMat] = track(
        new THREE.CylinderGeometry(0.28, 0.34, 0.55, 8),
        new THREE.MeshStandardMaterial({ color: 0xd8b060, roughness: 1 }),
      );
      const [stumpGeo, stumpMat] = track(
        new THREE.CylinderGeometry(0.22, 0.26, 0.4, 8),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.trunk).multiplyScalar(0.8), roughness: 1 }),
      );
      const hive = new THREE.Group();
      const stump = new THREE.Mesh(stumpGeo, stumpMat);
      stump.position.y = 0.2;
      hive.add(stump);
      const hiveBox = new THREE.Mesh(hiveGeo, hiveMat);
      hiveBox.position.y = 0.68;
      hiveBox.castShadow = true;
      hive.add(hiveBox);
      hive.position.set(6.6, 0, 10.5);
      group.add(hive);
      const beeMat = new THREE.MeshStandardMaterial({ color: 0x3a3020, roughness: 0.7 });
      mats.push(beeMat);
      const [beeGeo] = track(new THREE.SphereGeometry(0.045, 6, 5), beeMat);
      for (let b = 0; b < 4; b++) {
        const bee = new THREE.Mesh(beeGeo, beeMat);
        group.add(bee);
        orbiters.push({ sprite: bee as unknown as THREE.Sprite, cx: 6.6, cz: 10.5, y: 0.95 + rng() * 0.3, r: 0.4 + rng() * 0.25, speed: 2.2 + rng() * 1.4, phase: rng() * Math.PI * 2 });
      }
    }

    // village smithy: an anvil under a lean-to roof beside a glowing forge,
    // embers drifting up from the coals ----
    {
      const smithyWood = new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.trunk).multiplyScalar(0.9), roughness: 1 });
      mats.push(smithyWood);
      const [smPostGeo] = track(new THREE.CylinderGeometry(0.09, 0.09, 2.0, 6), smithyWood);
      const [smRoofGeo] = track(new THREE.BoxGeometry(2.4, 0.1, 1.6), smithyWood);
      const [forgeGeo, forgeMat] = track(
        new THREE.CylinderGeometry(0.55, 0.65, 0.6, 8),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.rock).multiplyScalar(0.75), roughness: 1 }),
      );
      const [coalGlowGeo, coalGlowMat] = track(new THREE.CircleGeometry(0.4, 8), new THREE.MeshBasicMaterial({ color: 0xff6a20 }));
      nightLights.push({ mat: coalGlowMat, day: new THREE.Color(0xff6a20), night: new THREE.Color(0xffb050) });
      const [anvilGeo, anvilMat] = track(new THREE.BoxGeometry(0.55, 0.32, 0.22), new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.5, metalness: 0.6 }));
      const [anvilBaseGeo] = track(new THREE.CylinderGeometry(0.12, 0.16, 0.42, 6), anvilMat);
      const smithy = new THREE.Group();
      for (const [px, pz] of [[-1.1, -0.7], [1.1, -0.7], [-1.1, 0.7], [1.1, 0.7]] as const) {
        const post = new THREE.Mesh(smPostGeo, smithyWood);
        post.position.set(px, 1.0, pz);
        smithy.add(post);
      }
      const smRoof = new THREE.Mesh(smRoofGeo, smithyWood);
      smRoof.position.y = 2.05;
      smRoof.castShadow = true;
      smithy.add(smRoof);
      const forge = new THREE.Mesh(forgeGeo, forgeMat);
      forge.position.set(-0.6, 0.3, 0);
      smithy.add(forge);
      const coalGlow = new THREE.Mesh(coalGlowGeo, coalGlowMat);
      coalGlow.rotation.x = -Math.PI / 2;
      coalGlow.position.set(-0.6, 0.61, 0);
      smithy.add(coalGlow);
      flickers.push(coalGlow);
      const anvilBase = new THREE.Mesh(anvilBaseGeo, anvilMat);
      anvilBase.position.set(0.7, 0.21, 0.2);
      smithy.add(anvilBase);
      const anvil = new THREE.Mesh(anvilGeo, anvilMat);
      anvil.position.set(0.7, 0.58, 0.2);
      smithy.add(anvil);
      // sparks drift up from the coals on the chimney-puff channel
      const sparkMat = new THREE.SpriteMaterial({ map: makeSpark(), color: 0xffb050, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
      mats.push(sparkMat);
      for (let s = 0; s < 2; s++) {
        const sprite = new THREE.Sprite(sparkMat);
        sprite.position.set(-0.6, 0.7, 0);
        sprite.scale.setScalar(0.12);
        smithy.add(sprite);
        smokes.push({ sprite, baseY: 0.7, offset: s / 2 });
      }
      smithy.position.set(-7.0, 0, 4.2);
      smithy.rotation.y = Math.atan2(7.0, -4.2);
      group.add(smithy);

      // a foot-pedal grindstone stands beside the smithy for sharpening
      const [wheelStoneGeo, wheelStoneMat] = track(
        new THREE.CylinderGeometry(0.32, 0.32, 0.09, 14),
        new THREE.MeshStandardMaterial({ color: 0x9a9a92, roughness: 1 }),
      );
      const [frameLegGeo] = track(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 5), smithyWood);
      const grindstone = new THREE.Group();
      const wheelStone = new THREE.Mesh(wheelStoneGeo, wheelStoneMat);
      wheelStone.rotation.z = Math.PI / 2;
      wheelStone.position.y = 0.55;
      wheelStone.castShadow = true;
      grindstone.add(wheelStone);
      spinners.push({ obj: wheelStone, speed: 1.4 });
      for (const [lx, lz] of [[-0.18, -0.12], [0.18, -0.12], [0, 0.16]] as const) {
        const leg = new THREE.Mesh(frameLegGeo, smithyWood);
        leg.rotation.x = 0.15;
        leg.position.set(lx, 0.28, lz);
        grindstone.add(leg);
      }
      grindstone.position.set(-8.6, 0, 5.0);
      group.add(grindstone);
    }

    // watchtower: a timber lookout post beside the town gate, torch burning
    // at the top rail through the night
    {
      const towerWood = new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.trunk).multiplyScalar(0.9), roughness: 1 });
      mats.push(towerWood);
      const [wtPostGeo] = track(new THREE.CylinderGeometry(0.1, 0.14, 4.2, 6), towerWood);
      const [wtPlatformGeo] = track(new THREE.BoxGeometry(1.6, 0.12, 1.6), towerWood);
      const [wtRailGeo] = track(new THREE.BoxGeometry(1.6, 0.5, 0.06), towerWood);
      const [wtTorchGeo, wtTorchMat] = track(new THREE.ConeGeometry(0.09, 0.24, 6), new THREE.MeshBasicMaterial({ color: 0xff9a3a }));
      nightLights.push({ mat: wtTorchMat, day: new THREE.Color(0xff9a3a), night: new THREE.Color(0xffc060) });
      const watchtower = new THREE.Group();
      const wtPost = new THREE.Mesh(wtPostGeo, towerWood);
      wtPost.position.y = 2.1;
      wtPost.castShadow = true;
      watchtower.add(wtPost);
      const wtPlatform = new THREE.Mesh(wtPlatformGeo, towerWood);
      wtPlatform.position.y = 4.26;
      wtPlatform.castShadow = true;
      watchtower.add(wtPlatform);
      for (const [rz, ry] of [[-0.77, 0], [0.77, 0], [0, Math.PI / 2]] as const) {
        const rail = new THREE.Mesh(wtRailGeo, towerWood);
        rail.position.set(0, 4.57, rz);
        rail.rotation.y = ry;
        watchtower.add(rail);
      }
      const wtTorch = new THREE.Mesh(wtTorchGeo, wtTorchMat);
      wtTorch.position.set(0.7, 4.6, 0.7);
      watchtower.add(wtTorch);
      flickers.push(wtTorch);

      // a windsock flutters from the rail, showing which way the breeze blows
      const [sockGeo, sockMat] = track(
        new THREE.ConeGeometry(0.12, 0.55, 8, 1, true),
        new THREE.MeshStandardMaterial({ color: 0xe86a3a, roughness: 0.85, side: THREE.DoubleSide }),
      );
      const [sockPoleGeo] = track(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 5), towerWood);
      const windsock = new THREE.Group();
      const sockPole = new THREE.Mesh(sockPoleGeo, towerWood);
      sockPole.rotation.x = Math.PI / 2;
      windsock.add(sockPole);
      const sock = new THREE.Mesh(sockGeo, sockMat);
      sock.rotation.z = Math.PI / 2;
      sock.position.x = 0.4;
      windsock.add(sock);
      windsock.position.set(-0.9, 4.6, 0);
      watchtower.add(windsock);
      bobbers.push({ obj: sock, baseY: 0, phase: 1.9 });

      watchtower.position.set(3.6, 0, 22.5); // beside the south gate arch
      group.add(watchtower);
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
      // wishing coins glint faintly at the bottom of the well
      const coinMat = new THREE.MeshStandardMaterial({ color: 0xd8b040, roughness: 0.25, metalness: 0.7 });
      mats.push(coinMat);
      const [coinGeo] = track(new THREE.CylinderGeometry(0.045, 0.045, 0.01, 8), coinMat);
      for (let c = 0; c < 4; c++) {
        const coin = new THREE.Mesh(coinGeo, coinMat);
        coin.rotation.x = Math.PI / 2 + (rng() - 0.5) * 0.5;
        coin.position.set((rng() - 0.5) * 0.5, 0.05, (rng() - 0.5) * 0.5);
        well.add(coin);
        flickers.push(coin);
      }
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

      // a couple of shallow puddles near the well and path, catching the sky
      const [puddleGeo, puddleMat] = track(
        new THREE.CircleGeometry(0.6, 12),
        new THREE.MeshStandardMaterial({ color: 0x4a6a7a, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.5 }),
      );
      for (const [px, pz, sc] of [[-4.6, -7.2, 1], [-6.4, -6.5, 0.65], [0.6, 18.5, 0.8]] as const) {
        const puddle = new THREE.Mesh(puddleGeo, puddleMat);
        puddle.rotation.x = -Math.PI / 2;
        puddle.scale.setScalar(sc);
        puddle.position.set(px, 0.018, pz);
        group.add(puddle);
      }
      shimmers.push({ mat: puddleMat, base: 0.5, amp: 0.12, phase: rng() * Math.PI * 2 });
    }

    // chalk hopscotch grid: a child's game scratched onto the flagstones,
    // white line segments forming the classic single/double/single layout
    {
      const chalkMat = new THREE.MeshBasicMaterial({ color: 0xf0ece0 });
      mats.push(chalkMat);
      const [lineGeo] = track(new THREE.PlaneGeometry(0.9, 0.05), chalkMat);
      const [lineGeoV] = track(new THREE.PlaneGeometry(0.05, 0.9), chalkMat);
      const hopscotch = new THREE.Group();
      // five rungs stacked along z, each 0.9 wide; middle two rungs split in half
      for (let row = 0; row < 5; row++) {
        const rz = row * 0.95;
        const rung = new THREE.Mesh(lineGeo, chalkMat);
        rung.position.set(0, 0.02, rz);
        hopscotch.add(rung);
        if (row === 1 || row === 3) {
          const split = new THREE.Mesh(lineGeoV, chalkMat);
          split.position.set(0, 0.02, rz + 0.475);
          hopscotch.add(split);
        }
      }
      const sideL = new THREE.Mesh(lineGeoV, chalkMat);
      sideL.scale.y = 4.8 / 0.9;
      sideL.position.set(-0.45, 0.02, 1.9);
      hopscotch.add(sideL);
      const sideR = new THREE.Mesh(lineGeoV, chalkMat);
      sideR.scale.y = 4.8 / 0.9;
      sideR.position.set(0.45, 0.02, 1.9);
      hopscotch.add(sideR);
      for (const m of hopscotch.children) (m as THREE.Mesh).rotation.x = -Math.PI / 2;
      hopscotch.position.set(2.5, 0, -3.2);
      hopscotch.rotation.y = 0.3;
      group.add(hopscotch);
    }

    // haberdashery stall: a counter of hats on display stands, a nod to
    // the headgear shop every ROX town seems to have
    {
      const hatStallWood = new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 0.95 });
      mats.push(hatStallWood);
      const [hatCounterGeo] = track(new THREE.BoxGeometry(1.7, 0.85, 0.55), hatStallWood);
      const [hatAwningGeo, hatAwningMat] = track(new THREE.BoxGeometry(2.0, 0.06, 1.0), new THREE.MeshStandardMaterial({ color: 0x4a90d0, roughness: 0.9 }));
      const [hatStandGeo] = track(new THREE.CylinderGeometry(0.015, 0.02, 0.4, 5), hatStallWood);
      const hatMats = [0x8a4a3a, 0x3a5a8a, 0x5a8a3a].map((c) => {
        const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });
        mats.push(m);
        return m;
      });
      const [hatBrimGeo] = track(new THREE.CylinderGeometry(0.14, 0.16, 0.02, 10), hatMats[0]);
      const [hatCrownGeo] = track(new THREE.CylinderGeometry(0.09, 0.1, 0.13, 10), hatMats[0]);
      const hatStall = new THREE.Group();
      const hatCounter = new THREE.Mesh(hatCounterGeo, hatStallWood);
      hatCounter.position.y = 0.42;
      hatCounter.castShadow = true;
      hatStall.add(hatCounter);
      const hatAwning = new THREE.Mesh(hatAwningGeo, hatAwningMat);
      hatAwning.position.set(0, 1.55, 0.1);
      hatAwning.rotation.x = 0.28;
      hatStall.add(hatAwning);
      for (let h = 0; h < 3; h++) {
        const stand = new THREE.Mesh(hatStandGeo, hatStallWood);
        stand.position.set((h - 1) * 0.5, 1.05, 0);
        hatStall.add(stand);
        const brim = new THREE.Mesh(hatBrimGeo, hatMats[h]);
        brim.position.set((h - 1) * 0.5, 1.26, 0);
        hatStall.add(brim);
        const crown = new THREE.Mesh(hatCrownGeo, hatMats[h]);
        crown.position.set((h - 1) * 0.5, 1.34, 0);
        hatStall.add(crown);
      }
      hatStall.position.set(-4.6, 0, 3.0);
      hatStall.rotation.y = Math.atan2(4.6, -3.0);
      group.add(hatStall);
    }

    // street-food cart: a skewer grill on wheels beside the plaza, coals
    // glowing under a few roasting skewers, a thin curl of smoke rising
    {
      const cartWood = new THREE.MeshStandardMaterial({ color: 0x6a4a30, roughness: 1 });
      mats.push(cartWood);
      const [cartBedGeo] = track(new THREE.BoxGeometry(1.2, 0.5, 0.6), cartWood);
      const [cartWheelGeo, cartWheelMat] = track(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 10), new THREE.MeshStandardMaterial({ color: 0x3a2c1e, roughness: 1 }));
      const [grillGeo, grillMat] = track(new THREE.BoxGeometry(0.9, 0.12, 0.4), new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.7, metalness: 0.4 }));
      const [coalStripGeo, coalStripMat] = track(new THREE.PlaneGeometry(0.8, 0.3), new THREE.MeshBasicMaterial({ color: 0xff6a20 }));
      nightLights.push({ mat: coalStripMat, day: new THREE.Color(0xff6a20), night: new THREE.Color(0xffb050) });
      const [skewerGeo, skewerMat] = track(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 4), new THREE.MeshStandardMaterial({ color: 0xc8a060, roughness: 1 }));
      const [meatGeo, meatMat] = track(new THREE.SphereGeometry(0.05, 6, 5), new THREE.MeshStandardMaterial({ color: 0xa85a3a, roughness: 0.8 }));
      const cart = new THREE.Group();
      const cartBed = new THREE.Mesh(cartBedGeo, cartWood);
      cartBed.position.y = 0.55;
      cartBed.castShadow = true;
      cart.add(cartBed);
      for (const s of [-1, 1]) {
        const wheel = new THREE.Mesh(cartWheelGeo, cartWheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(s * 0.55, 0.24, 0);
        cart.add(wheel);
      }
      const grill = new THREE.Mesh(grillGeo, grillMat);
      grill.position.y = 0.87;
      cart.add(grill);
      const coalStrip = new THREE.Mesh(coalStripGeo, coalStripMat);
      coalStrip.rotation.x = -Math.PI / 2;
      coalStrip.position.y = 0.94;
      cart.add(coalStrip);
      flickers.push(coalStrip);
      for (let sk = 0; sk < 3; sk++) {
        const skewer = new THREE.Mesh(skewerGeo, skewerMat);
        skewer.rotation.z = Math.PI / 2;
        skewer.position.set(0, 1.0, -0.12 + sk * 0.12);
        cart.add(skewer);
        for (let m = 0; m < 3; m++) {
          const meat = new THREE.Mesh(meatGeo, meatMat);
          meat.position.set(-0.2 + m * 0.2, 1.0, -0.12 + sk * 0.12);
          cart.add(meat);
        }
      }
      const cartSmokeMat = new THREE.SpriteMaterial({ map: makeSpark(), color: 0xb9bcc4, transparent: true, opacity: 0.2, depthWrite: false });
      mats.push(cartSmokeMat);
      const cartSmoke = new THREE.Sprite(cartSmokeMat);
      cartSmoke.position.set(0, 1.1, 0);
      cartSmoke.scale.setScalar(0.2);
      cart.add(cartSmoke);
      smokes.push({ sprite: cartSmoke, baseY: 1.1, offset: rng() });
      cart.position.set(4.9, 0, 2.7);
      cart.rotation.y = Math.atan2(-4.9, -2.7);
      group.add(cart);
    }

    // parked wagon: a farmer's cart with two spoked wheels, resting near the
    // houses as if just arrived with goods
    {
      const wagonWood = new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.trunk).multiplyScalar(1.0), roughness: 1 });
      mats.push(wagonWood);
      const [bedGeo] = track(new THREE.BoxGeometry(1.6, 0.35, 0.9), wagonWood);
      const [wheelGeo, wheelMat] = track(new THREE.TorusGeometry(0.35, 0.06, 6, 12), new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 1 }));
      const [spokeGeo] = track(new THREE.CylinderGeometry(0.02, 0.02, 0.66, 4), wheelMat);
      const [shaftGeo] = track(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 5), wagonWood);
      const wagon = new THREE.Group();
      const bed = new THREE.Mesh(bedGeo, wagonWood);
      bed.position.y = 0.55;
      bed.castShadow = true;
      wagon.add(bed);
      const shaft = new THREE.Mesh(shaftGeo, wagonWood);
      shaft.rotation.x = Math.PI / 2;
      shaft.position.set(0, 0.5, 1.1);
      wagon.add(shaft);
      for (const s of [-1, 1]) {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.rotation.y = Math.PI / 2;
        wheel.position.set(s * 0.85, 0.36, 0);
        wagon.add(wheel);
        for (let sp = 0; sp < 2; sp++) {
          const spoke = new THREE.Mesh(spokeGeo, wheelMat);
          spoke.rotation.z = sp * Math.PI / 2;
          spoke.rotation.y = Math.PI / 2;
          spoke.position.set(s * 0.85, 0.36, 0);
          wagon.add(spoke);
        }
      }
      wagon.position.set(3.4, 0, 6.9);
      wagon.rotation.y = 0.9;
      group.add(wagon);
    }

    // rope swing: hangs from the north house's roofline, seat swaying gently
    {
      const swingRopeMat = new THREE.MeshStandardMaterial({ color: 0xc8b088, roughness: 1 });
      mats.push(swingRopeMat);
      const [swingRopeGeo] = track(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 4), swingRopeMat);
      const [swingSeatGeo, swingSeatMat] = track(new THREE.BoxGeometry(0.5, 0.05, 0.22), new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 0.95 }));
      const swing = new THREE.Group();
      for (const s of [-1, 1]) {
        const rope = new THREE.Mesh(swingRopeGeo, swingRopeMat);
        rope.position.set(s * 0.2, -0.8, 0);
        swing.add(rope);
      }
      const seat = new THREE.Mesh(swingSeatGeo, swingSeatMat);
      seat.position.y = -1.6;
      swing.add(seat);
      swing.position.set(0.9, 3.35, -12.9); // hangs beside the north house
      group.add(swing);
      bobbers.push({ obj: swing, baseY: swing.position.y, phase: 0.8 });
    }

    // chickens: a few peck around near the wagon, bobbing their heads down
    // and up on a fast, jittery cycle
    {
      const chickenBodyMat = new THREE.MeshStandardMaterial({ color: 0xf0ece0, roughness: 0.9 });
      mats.push(chickenBodyMat);
      const [chickenBodyGeo] = track(new THREE.SphereGeometry(0.12, 8, 6), chickenBodyMat);
      const [combGeo, combMat] = track(new THREE.ConeGeometry(0.03, 0.06, 4), new THREE.MeshStandardMaterial({ color: 0xd83030, roughness: 0.8 }));
      const [beakGeo] = track(new THREE.ConeGeometry(0.02, 0.06, 4), combMat);
      for (let c = 0; c < 3; c++) {
        const chicken = new THREE.Group();
        const body = new THREE.Mesh(chickenBodyGeo, chickenBodyMat);
        body.scale.set(1, 1.1, 1.3);
        chicken.add(body);
        // head + beak ride a pivot so the peck cycle can nod it down and up
        const headPivot = new THREE.Group();
        headPivot.position.set(0, 0.1, 0.13);
        const head = new THREE.Mesh(chickenBodyGeo, chickenBodyMat);
        head.scale.setScalar(0.55);
        headPivot.add(head);
        const comb = new THREE.Mesh(combGeo, combMat);
        comb.position.y = 0.07;
        headPivot.add(comb);
        const beak = new THREE.Mesh(beakGeo, combMat);
        beak.rotation.x = Math.PI / 2;
        beak.position.set(0, 0, 0.08);
        headPivot.add(beak);
        chicken.add(headPivot);
        const a = rng() * Math.PI * 2;
        const r = 2.5 + rng() * 1.5;
        chicken.position.set(3.4 + Math.cos(a) * r, 0.13, 6.9 + Math.sin(a) * r);
        chicken.rotation.y = rng() * Math.PI * 2;
        group.add(chicken);
        flickers.push(headPivot); // scale-pulse reads as a quick peck bob
      }
    }

    // a stray dog trots a slow loop around the plaza, tail wagging
    {
      const dogMat = new THREE.MeshStandardMaterial({ color: 0xa87850, roughness: 0.9 });
      mats.push(dogMat);
      const [dogBodyGeo] = track(new THREE.CapsuleGeometry(0.13, 0.32, 4, 8), dogMat);
      const [dogHeadGeo] = track(new THREE.SphereGeometry(0.11, 8, 6), dogMat);
      const [dogEarGeo, dogEarMat] = track(new THREE.ConeGeometry(0.045, 0.12, 4), new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.9 }));
      const [dogLegGeo] = track(new THREE.CylinderGeometry(0.028, 0.028, 0.3, 5), dogMat);
      const [dogTailGeo] = track(new THREE.CylinderGeometry(0.02, 0.035, 0.28, 5), dogMat);
      const dog = new THREE.Group();
      const dogBody = new THREE.Mesh(dogBodyGeo, dogMat);
      dogBody.rotation.z = Math.PI / 2;
      dogBody.position.y = 0.3;
      dogBody.castShadow = true;
      dog.add(dogBody);
      const dogHead = new THREE.Mesh(dogHeadGeo, dogMat);
      dogHead.position.set(0, 0.34, 0.22);
      dog.add(dogHead);
      for (const s of [-1, 1]) {
        const ear = new THREE.Mesh(dogEarGeo, dogEarMat);
        ear.position.set(s * 0.06, 0.42, 0.22);
        ear.rotation.x = 0.3;
        dog.add(ear);
      }
      for (const [lx, lz] of [[-0.08, 0.15], [0.08, 0.15], [-0.08, -0.15], [0.08, -0.15]] as const) {
        const leg = new THREE.Mesh(dogLegGeo, dogMat);
        leg.position.set(lx, 0.15, lz);
        dog.add(leg);
      }
      const tailPivot = new THREE.Group();
      const dogTail = new THREE.Mesh(dogTailGeo, dogMat);
      dogTail.rotation.x = -0.6;
      dogTail.position.y = 0.14;
      tailPivot.add(dogTail);
      tailPivot.position.set(0, 0.32, -0.2);
      dog.add(tailPivot);
      bobbers.push({ obj: tailPivot, baseY: 0.32, phase: 0 });
      group.add(dog);
      cruisers.push({ obj: dog, r: 6.5, y: 0, speed: 0.22, phase: rng() * Math.PI * 2, bob: 0 });
    }

    // hitching post: a Peco Peco rests here, head tucked and one leg cocked,
    // tethered near the houses like a traveller's parked mount
    {
      const postWood = new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.trunk).multiplyScalar(0.85), roughness: 1 });
      mats.push(postWood);
      const [hPostGeo] = track(new THREE.CylinderGeometry(0.06, 0.08, 1.1, 6), postWood);
      const hitchPost = new THREE.Mesh(hPostGeo, postWood);
      hitchPost.position.set(4.2, 0.55, -5.4);
      group.add(hitchPost);
      const pecoBodyMat = new THREE.MeshStandardMaterial({ color: 0xe0c85a, roughness: 0.9 });
      mats.push(pecoBodyMat);
      const [pecoBodyGeo] = track(new THREE.SphereGeometry(0.34, 10, 8), pecoBodyMat);
      const [pecoHeadGeo] = track(new THREE.SphereGeometry(0.16, 8, 6), pecoBodyMat);
      const [pecoBeakGeo, pecoBeakMat] = track(new THREE.ConeGeometry(0.05, 0.16, 5), new THREE.MeshStandardMaterial({ color: 0xd8892a, roughness: 0.8 }));
      const [pecoLegGeo] = track(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 5), new THREE.MeshStandardMaterial({ color: 0xd8892a, roughness: 0.8 }));
      const restingPeco = new THREE.Group();
      const pecoBody = new THREE.Mesh(pecoBodyGeo, pecoBodyMat);
      pecoBody.scale.set(1.1, 0.9, 1.3);
      pecoBody.position.y = 0.42;
      pecoBody.castShadow = true;
      restingPeco.add(pecoBody);
      const pecoHead = new THREE.Mesh(pecoHeadGeo, pecoBodyMat);
      pecoHead.position.set(0, 0.5, 0.42); // tucked low, resting
      restingPeco.add(pecoHead);
      const pecoBeak = new THREE.Mesh(pecoBeakGeo, pecoBeakMat);
      pecoBeak.rotation.x = Math.PI / 2;
      pecoBeak.position.set(0, 0.5, 0.58);
      restingPeco.add(pecoBeak);
      for (const s of [-1, 1]) {
        const leg = new THREE.Mesh(pecoLegGeo, pecoBeakMat);
        leg.position.set(s * 0.16, 0.2, s > 0 ? 0.05 : -0.02); // one leg cocked
        leg.rotation.x = s > 0 ? 0.1 : -0.15;
        restingPeco.add(leg);
      }
      restingPeco.position.set(4.2, 0, -6.1);
      restingPeco.rotation.y = 2.6;
      group.add(restingPeco);
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
    // a seagull perches on the end piling, preening now and then
    const gullMat = new THREE.MeshStandardMaterial({ color: 0xf0f2f4, roughness: 0.85 });
    mats.push(gullMat);
    const [gullBodyGeo] = track(new THREE.ConeGeometry(0.1, 0.32, 6), gullMat);
    const [gullBeakGeo, gullBeakMat] = track(new THREE.ConeGeometry(0.025, 0.09, 4), new THREE.MeshStandardMaterial({ color: 0xe89a2a, roughness: 0.7 }));
    const gull = new THREE.Group();
    const gullBody = new THREE.Mesh(gullBodyGeo, gullMat);
    gullBody.rotation.x = Math.PI / 2;
    gull.add(gullBody);
    const gullHead = new THREE.Mesh(gullBodyGeo, gullMat);
    gullHead.scale.setScalar(0.5);
    gullHead.position.set(0, 0.14, 0.1);
    gull.add(gullHead);
    const gullBeak = new THREE.Mesh(gullBeakGeo, gullBeakMat);
    gullBeak.rotation.x = Math.PI / 2;
    gullBeak.position.set(0, 0.14, 0.2);
    gull.add(gullBeak);
    flickers.push(gullHead); // a subtle scale-pulse reads as head-preening
    gull.position.set(MAP_HALF * 0.94 + (5 - 1) * 1.55 + 0.6, 0.9, pierZ + 0.95);
    gull.rotation.y = Math.PI;
    group.add(gull);

    // a coiled rope and rusty anchor resting at the foot of the pier
    const [ropeCoilGeo, ropeCoilMat] = track(new THREE.TorusGeometry(0.28, 0.05, 6, 14), new THREE.MeshStandardMaterial({ color: 0xc8a860, roughness: 1 }));
    const ropeCoil = new THREE.Mesh(ropeCoilGeo, ropeCoilMat);
    ropeCoil.rotation.x = -Math.PI / 2;
    ropeCoil.position.set(MAP_HALF * 0.94 - 0.8, 0.06, pierZ - 1.6);
    group.add(ropeCoil);
    const anchorMat = new THREE.MeshStandardMaterial({ color: 0x5a4a42, roughness: 0.6, metalness: 0.5 });
    mats.push(anchorMat);
    const [anchorShaftGeo] = track(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6), anchorMat);
    const [anchorArmGeo] = track(new THREE.TorusGeometry(0.22, 0.045, 6, 10, Math.PI), anchorMat);
    const anchor = new THREE.Group();
    const anchorShaft = new THREE.Mesh(anchorShaftGeo, anchorMat);
    anchorShaft.rotation.z = 0.15;
    anchorShaft.position.y = 0.3;
    anchor.add(anchorShaft);
    const anchorArm = new THREE.Mesh(anchorArmGeo, anchorMat);
    anchorArm.position.y = 0.02;
    anchor.add(anchorArm);
    anchor.position.set(MAP_HALF * 0.94 - 0.3, 0, pierZ - 1.0);
    anchor.rotation.y = 0.6;
    group.add(anchor);
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

  // ---- rabbits: small critters resting low in the meadow grass, ears
  // twitching now and then on the flicker channel ----
  if (theme.tree === "leafy" && mapId !== "arena") {
    const rabbitMat = new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 1 });
    mats.push(rabbitMat);
    const [rabbitBodyGeo] = track(new THREE.SphereGeometry(0.13, 8, 6), rabbitMat);
    const [rabbitEarGeo, rabbitEarMat] = track(new THREE.CapsuleGeometry(0.025, 0.14, 3, 6), new THREE.MeshStandardMaterial({ color: 0xf0d8c8, roughness: 1 }));
    for (let r = 0; r < 4; r++) {
      const rabbit = new THREE.Group();
      const body = new THREE.Mesh(rabbitBodyGeo, rabbitMat);
      body.scale.set(1.2, 0.9, 1.5);
      rabbit.add(body);
      const head = new THREE.Mesh(rabbitBodyGeo, rabbitMat);
      head.scale.setScalar(0.6);
      head.position.set(0, 0.08, 0.16);
      rabbit.add(head);
      for (const s of [-1, 1]) {
        const ear = new THREE.Mesh(rabbitEarGeo, rabbitEarMat);
        ear.position.set(s * 0.04, 0.24, 0.14);
        ear.rotation.x = -0.2;
        rabbit.add(ear);
        flickers.push(ear);
      }
      const a = rng() * Math.PI * 2;
      const rr = 8 + rng() * 20;
      rabbit.position.set(Math.cos(a) * rr, 0.13, Math.sin(a) * rr);
      rabbit.rotation.y = rng() * Math.PI * 2;
      group.add(rabbit);
    }
  }

  // ---- grazing deer: a small herd stands still in the leafy meadows, heads
  // down as if grazing, ears occasionally flicking (tick-driven twitch) ----
  if (theme.tree === "leafy" && mapId !== "arena") {
    const deerMat = new THREE.MeshStandardMaterial({ color: 0x9a6a42, roughness: 0.9 });
    mats.push(deerMat);
    const [deerBodyGeo] = track(new THREE.CapsuleGeometry(0.22, 0.5, 4, 8), deerMat);
    const [deerNeckGeo] = track(new THREE.CylinderGeometry(0.09, 0.12, 0.4, 6), deerMat);
    const [deerHeadGeo] = track(new THREE.ConeGeometry(0.12, 0.32, 6), deerMat);
    const [deerLegGeo] = track(new THREE.CylinderGeometry(0.035, 0.045, 0.5, 5), deerMat);
    const [deerEarGeo, deerEarMat] = track(new THREE.ConeGeometry(0.05, 0.12, 4), deerMat);
    for (let d = 0; d < 3; d++) {
      const a = rng() * Math.PI * 2;
      const r = 10 + rng() * 18;
      const deer = new THREE.Group();
      const body = new THREE.Mesh(deerBodyGeo, deerMat);
      body.rotation.z = Math.PI / 2;
      body.position.y = 0.55;
      body.castShadow = true;
      deer.add(body);
      const neck = new THREE.Mesh(deerNeckGeo, deerMat);
      neck.rotation.x = 1.1; // lowered, grazing posture
      neck.position.set(0, 0.42, 0.35);
      deer.add(neck);
      const head = new THREE.Mesh(deerHeadGeo, deerMat);
      head.rotation.x = Math.PI / 2 + 0.3;
      head.position.set(0, 0.22, 0.55);
      deer.add(head);
      for (const s of [-1, 1]) {
        const ear = new THREE.Mesh(deerEarGeo, deerEarMat);
        ear.position.set(s * 0.06, 0.3, 0.5);
        ear.rotation.z = s * 0.6;
        deer.add(ear);
        flickers.push(ear); // subtle scale-pulse reads as an ear twitch
      }
      for (const [lx, lz] of [[-0.15, 0.2], [0.15, 0.2], [-0.15, -0.2], [0.15, -0.2]] as const) {
        const leg = new THREE.Mesh(deerLegGeo, deerMat);
        leg.position.set(lx, 0.25, lz);
        deer.add(leg);
      }
      deer.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      deer.rotation.y = rng() * Math.PI * 2;
      group.add(deer);
    }
  }

  // ---- hay bales: a few round bales rest out in the leafy fields, some
  // stacked in twos ----
  if (theme.tree === "leafy" && mapId !== "arena") {
    const [bareGeo, bareMat] = track(
      new THREE.CylinderGeometry(0.55, 0.55, 0.9, 12),
      new THREE.MeshStandardMaterial({ color: 0xd8b850, roughness: 1, flatShading: true }),
    );
    for (let b = 0; b < 4; b++) {
      const a = rng() * Math.PI * 2;
      const r = 9 + rng() * 20;
      const bx = Math.cos(a) * r;
      const bz = Math.sin(a) * r;
      const bale = new THREE.Mesh(bareGeo, bareMat);
      bale.rotation.z = Math.PI / 2;
      bale.position.set(bx, 0.55, bz);
      bale.castShadow = true;
      group.add(bale);
      if (b % 2 === 0) {
        const stacked = new THREE.Mesh(bareGeo, bareMat);
        stacked.rotation.z = Math.PI / 2;
        stacked.position.set(bx, 1.5, bz);
        stacked.castShadow = true;
        group.add(stacked);
      }
    }
  }

  // ---- kite: a diamond paper kite tugs and dips on an invisible string
  // high over the leafy fields ----
  if (theme.tree === "leafy" && mapId !== "arena") {
    const kiteMat = new THREE.MeshStandardMaterial({ color: 0xe85a5a, roughness: 0.85, side: THREE.DoubleSide });
    mats.push(kiteMat);
    const [kiteGeo] = track(new THREE.ConeGeometry(0.9, 1.4, 4), kiteMat);
    const [tailGeo, tailMat] = track(new THREE.PlaneGeometry(0.12, 0.12), new THREE.MeshStandardMaterial({ color: 0xf0d040, side: THREE.DoubleSide }));
    const kite = new THREE.Group();
    const diamond = new THREE.Mesh(kiteGeo, kiteMat);
    diamond.rotation.z = Math.PI / 2;
    diamond.scale.z = 0.06;
    kite.add(diamond);
    for (let t = 0; t < 4; t++) {
      const tailBow = new THREE.Mesh(tailGeo, tailMat);
      tailBow.position.set(-0.7 - t * 0.32, -t * 0.1, 0);
      tailBow.rotation.z = t * 0.6;
      kite.add(tailBow);
    }
    kite.position.set(-14, 18, 8);
    group.add(kite);
    cruisers.push({ obj: kite, cx: -14, cz: 8, r: 3, y: 18, speed: 0.14, phase: 0, bob: 1.4 });
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

  // ---- Scaraba monument: a giant stone scarab on a plinth, rolling its
  // boulder — the desert cult's idol ----
  if (mapId === "scaraba") {
    const scarabStone = new THREE.MeshStandardMaterial({ color: 0x6a5a3a, roughness: 1, flatShading: true });
    mats.push(scarabStone);
    const [scPlinthGeo] = track(new THREE.BoxGeometry(3.2, 0.6, 2.2), scarabStone);
    const [scBodyGeo] = track(new THREE.SphereGeometry(0.9, 10, 8), scarabStone);
    const [scLegGeo] = track(new THREE.CylinderGeometry(0.08, 0.11, 0.9, 5), scarabStone);
    const [scBallGeo] = track(new THREE.SphereGeometry(0.75, 10, 8), scarabStone);
    const scarab = new THREE.Group();
    const scPlinth = new THREE.Mesh(scPlinthGeo, scarabStone);
    scPlinth.position.y = 0.3;
    scPlinth.receiveShadow = true;
    scarab.add(scPlinth);
    const scBody = new THREE.Mesh(scBodyGeo, scarabStone);
    scBody.scale.set(1, 0.7, 1.25);
    scBody.position.set(-0.55, 1.05, 0);
    scBody.castShadow = true;
    scarab.add(scBody);
    const scHead = new THREE.Mesh(scBodyGeo, scarabStone);
    scHead.scale.setScalar(0.45);
    scHead.position.set(0.35, 1.0, 0);
    scarab.add(scHead);
    for (const [lx, lz, rot] of [[-0.8, 0.7, 0.5], [-0.3, 0.8, 0.2], [-0.8, -0.7, -0.5], [-0.3, -0.8, -0.2]] as const) {
      const leg = new THREE.Mesh(scLegGeo, scarabStone);
      leg.position.set(lx, 0.85, lz);
      leg.rotation.x = rot;
      scarab.add(leg);
    }
    const scBall = new THREE.Mesh(scBallGeo, scarabStone);
    scBall.position.set(1.15, 1.35, 0);
    scBall.castShadow = true;
    scarab.add(scBall);
    scarab.position.set(12.5, 0, -11.5);
    scarab.rotation.y = Math.atan2(-12.5, 11.5);
    group.add(scarab);
  }

  // ---- Brasilis waterfall: a rock wall at the jungle's edge sheds a
  // translucent water sheet with mist churning at its base ----
  if (mapId === "brasilis") {
    const falls = new THREE.Group();
    const [cliffGeo, cliffMat] = track(
      new THREE.BoxGeometry(5.0, 6.5, 1.4),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.rock).multiplyScalar(0.85), roughness: 1, flatShading: true }),
    );
    const cliff = new THREE.Mesh(cliffGeo, cliffMat);
    cliff.position.y = 3.25;
    cliff.castShadow = true;
    falls.add(cliff);
    const [sheetGeo, sheetMat] = track(
      new THREE.PlaneGeometry(2.6, 6.2),
      new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    );
    const sheet = new THREE.Mesh(sheetGeo, sheetMat);
    sheet.position.set(0, 3.15, 0.78);
    falls.add(sheet);
    // plunge-pool mist churns on the looping puff channel
    const fallsMistMat = new THREE.SpriteMaterial({ map: makeSpark(), color: 0xd8f0ff, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending });
    mats.push(fallsMistMat);
    for (let puff = 0; puff < 3; puff++) {
      const mist = new THREE.Sprite(fallsMistMat);
      mist.position.set((puff - 1) * 0.8, 0.25, 1.1);
      mist.scale.setScalar(0.4);
      falls.add(mist);
      smokes.push({ sprite: mist, baseY: 0.25, offset: puff / 3 });
    }
    falls.position.set(-14, 0, -14);
    falls.rotation.y = Math.PI / 4;
    group.add(falls);
  }

  // ---- Veins hoodoos: wind-carved rock spires stacked in wobbly columns
  // around the canyon floor ----
  if (mapId === "veins") {
    const [hoodooGeo, hoodooMat] = track(
      new THREE.CylinderGeometry(0.5, 0.7, 1, 8),
      new THREE.MeshStandardMaterial({ color: 0xa87850, roughness: 1, flatShading: true }),
    );
    for (let h = 0; h < 4; h++) {
      const a = rng() * Math.PI * 2;
      const r = 12 + rng() * 16;
      const cx = Math.cos(a) * r;
      const cz = Math.sin(a) * r;
      let hy = 0;
      const tiers = 3 + Math.floor(rng() * 2);
      for (let t = 0; t < tiers; t++) {
        const th = 0.9 + rng() * 0.7;
        const tw = 1.1 - t * 0.22 + rng() * 0.15;
        const tier = new THREE.Mesh(hoodooGeo, hoodooMat);
        tier.scale.set(tw, th, tw);
        tier.position.set(cx + (rng() - 0.5) * 0.2, hy + th / 2, cz + (rng() - 0.5) * 0.2);
        tier.rotation.y = rng() * Math.PI;
        tier.castShadow = true;
        group.add(tier);
        hy += th;
      }
    }
  }

  // ---- Manuk relic: a half-buried giant's stone head and reaching hand,
  // remnants of something that fell here long ago ----
  if (mapId === "manuk") {
    const relicStone = new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.rock).multiplyScalar(1.1), roughness: 1, flatShading: true });
    mats.push(relicStone);
    const [relicHeadGeo] = track(new THREE.SphereGeometry(1.6, 10, 8), relicStone);
    const relicHead = new THREE.Mesh(relicHeadGeo, relicStone);
    relicHead.position.set(-13, 0.35, -12); // mostly swallowed by the ground
    relicHead.rotation.set(0.4, 0.6, 0.25);
    relicHead.castShadow = true;
    group.add(relicHead);
    const [fingerGeo] = track(new THREE.CylinderGeometry(0.22, 0.3, 1.8, 6), relicStone);
    for (const [fx, fz, tilt] of [[-9.5, -9, 0.2], [-8.9, -9.6, 0.35], [-8.4, -8.9, 0.5]] as const) {
      const finger = new THREE.Mesh(fingerGeo, relicStone);
      finger.position.set(fx, 0.7, fz);
      finger.rotation.z = tilt;
      finger.rotation.x = (rng() - 0.5) * 0.3;
      finger.castShadow = true;
      group.add(finger);
    }
  }

  // ---- cherry blossom trees: East-Asian towns flank the plaza with two
  // pink-canopied trees, petals drifting down in a lazy spiral ----
  if (mapId === "amatsu" || mapId === "louyang" || mapId === "gonryun") {
    const [blossomTrunkGeo, blossomTrunkMat] = track(
      new THREE.CylinderGeometry(0.16, 0.24, 2.6, 7),
      new THREE.MeshStandardMaterial({ color: 0x4a3628, roughness: 1 }),
    );
    const [blossomCanopyGeo, blossomCanopyMat] = track(
      new THREE.SphereGeometry(1.4, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xf4a0c0, roughness: 0.9, flatShading: true }),
    );
    applyWind(blossomCanopyMat, 0.05);
    const [petalGeo, petalMat] = track(
      new THREE.PlaneGeometry(0.1, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xffc0d8, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
    );
    for (const [tx, tz] of [[-7.5, 8.5], [7.5, 8.5]] as const) {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(blossomTrunkGeo, blossomTrunkMat);
      trunk.position.y = 1.3;
      trunk.castShadow = true;
      tree.add(trunk);
      const canopy = new THREE.Mesh(blossomCanopyGeo, blossomCanopyMat);
      canopy.scale.y = 0.8;
      canopy.position.y = 3.0;
      canopy.castShadow = true;
      tree.add(canopy);
      tree.position.set(tx, 0, tz);
      group.add(tree);
      for (let p = 0; p < 5; p++) {
        const petal = new THREE.Mesh(petalGeo, petalMat);
        group.add(petal);
        leaves.push({ m: petal, x: tx, z: tz, offset: rng(), spin: 1.0 + rng() * 1.5 });
      }
    }
  }

  // ---- lighthouse: coastal maps raise a striped tower whose lamp sweeps a
  // slow rotating beam after dark ----
  if (WATER_MAPS[mapId] && mapId !== "byalan" && mapId !== "abyss") {
    const [lhBaseGeo, lhBaseMat] = track(
      new THREE.CylinderGeometry(0.9, 1.3, 6.5, 10),
      new THREE.MeshStandardMaterial({ color: 0xf0ece0, roughness: 0.9 }),
    );
    const [stripeGeo, stripeMat] = track(
      new THREE.CylinderGeometry(0.95, 1.0, 1.1, 10),
      new THREE.MeshStandardMaterial({ color: 0xc0392a, roughness: 0.9 }),
    );
    const [lampRoomGeo, lampRoomMat] = track(new THREE.CylinderGeometry(0.7, 0.8, 1.0, 10), new THREE.MeshStandardMaterial({ color: 0x3a3430, roughness: 0.7 }));
    const [beamGeo, lhBeamMat] = track(
      new THREE.ConeGeometry(0.5, 14, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }),
    );
    nightFades.push({ mat: lhBeamMat, max: 0.28 });
    const lighthouse = new THREE.Group();
    const lhBase = new THREE.Mesh(lhBaseGeo, lhBaseMat);
    lhBase.position.y = 3.25;
    lhBase.castShadow = true;
    lighthouse.add(lhBase);
    for (const sy of [2.0, 4.6]) {
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.scale.setScalar(1 - (sy - 2.0) * 0.03);
      stripe.position.y = sy;
      lighthouse.add(stripe);
    }
    const lampRoom = new THREE.Mesh(lampRoomGeo, lampRoomMat);
    lampRoom.position.y = 7.0;
    lighthouse.add(lampRoom);
    // the beam is a rotating child so its cone always points radially outward
    const beamPivot = new THREE.Group();
    beamPivot.position.y = 7.0;
    const beam = new THREE.Mesh(beamGeo, lhBeamMat);
    beam.rotation.z = Math.PI / 2;
    beam.position.z = 7;
    beamPivot.add(beam);
    lighthouse.add(beamPivot);
    spinners.push({ obj: beamPivot, speed: 0.6, axis: "y" });
    lighthouse.position.set(MAP_HALF * 0.92, 0, MAP_HALF * 0.6);
    group.add(lighthouse);
  }

  // ---- god rays: soft sunbeam shafts angle down through the jungle canopy,
  // visible by day and fading out at night ----
  if (theme.tree === "jungle") {
    const rayMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide });
    mats.push(rayMat);
    dayFades.push({ mat: rayMat, max: 0.12 });
    const [rayGeo] = track(new THREE.ConeGeometry(0.8, 10, 6, 1, true), rayMat);
    for (let r = 0; r < 5; r++) {
      const a = rng() * Math.PI * 2;
      const rr = 8 + rng() * 18;
      const ray = new THREE.Mesh(rayGeo, rayMat);
      ray.position.set(Math.cos(a) * rr, 5, Math.sin(a) * rr);
      ray.rotation.set(Math.PI + 0.25, rng() * Math.PI * 2, 0);
      group.add(ray);
    }
  }

  // ---- hanging vines: jungle canopies drop wind-swayed vine curtains from
  // above, reaching almost to the ground ----
  if (theme.tree === "jungle") {
    const vineMat = new THREE.MeshStandardMaterial({ color: 0x3a6a3a, roughness: 1 });
    applyWind(vineMat, 0.07);
    mats.push(vineMat);
    const [vineGeo] = track(new THREE.CylinderGeometry(0.025, 0.035, 3.2, 5), vineMat);
    for (let v = 0; v < 8; v++) {
      const a = rng() * Math.PI * 2;
      const r = 7 + rng() * 20;
      const vine = new THREE.Mesh(vineGeo, vineMat);
      vine.scale.y = 0.7 + rng() * 0.7;
      vine.position.set(Math.cos(a) * r, 3.2, Math.sin(a) * r);
      group.add(vine);
    }
  }

  // ---- MacRitchie treetop walk: two lattice towers with a gently sagging
  // suspension walkway strung between them at canopy height ----
  if (mapId === "macritchie") {
    const walkSteel = new THREE.MeshStandardMaterial({ color: 0x6a7268, roughness: 0.7, metalness: 0.4 });
    mats.push(walkSteel);
    const [wTowerGeo] = track(new THREE.BoxGeometry(0.9, 6.0, 0.9), walkSteel);
    const [wDeckGeo, wDeckMat] = track(
      new THREE.BoxGeometry(1.4, 0.12, 1.0),
      new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 0.95 }),
    );
    const [wCableGeo] = track(new THREE.CylinderGeometry(0.03, 0.03, 1, 4), walkSteel);
    const walk = new THREE.Group();
    const x1 = -5.5;
    const x2 = 5.5;
    for (const tx of [x1, x2]) {
      const tower = new THREE.Mesh(wTowerGeo, walkSteel);
      tower.position.set(tx, 3.0, 0);
      tower.castShadow = true;
      walk.add(tower);
    }
    // deck segments trace a shallow catenary between the towers
    const segs = 7;
    for (let i = 0; i < segs; i++) {
      const t = (i + 0.5) / segs;
      const dx = x1 + (x2 - x1) * t;
      const sag = Math.sin(Math.PI * t) * 0.9;
      const deckSeg = new THREE.Mesh(wDeckGeo, wDeckMat);
      deckSeg.position.set(dx, 5.4 - sag, 0);
      deckSeg.rotation.z = Math.cos(Math.PI * t) * 0.22; // follow the curve
      walk.add(deckSeg);
      for (const s of [-1, 1]) {
        const rail = new THREE.Mesh(wCableGeo, walkSteel);
        rail.scale.y = 0.9;
        rail.position.set(dx, 5.85 - sag, s * 0.45);
        walk.add(rail);
      }
    }
    walk.position.set(-11, 0, -13);
    walk.rotation.y = 0.6;
    group.add(walk);
  }

  // ---- Coney Island driftwood: sun-bleached logs and a bare casuarina snag
  // scattered along the wild shore ----
  if (mapId === "coney_island") {
    const [driftGeo, driftMat] = track(
      new THREE.CylinderGeometry(0.16, 0.22, 2.6, 6),
      new THREE.MeshStandardMaterial({ color: 0xb8a888, roughness: 1, flatShading: true }),
    );
    for (let d = 0; d < 4; d++) {
      const a = rng() * Math.PI * 2;
      const r = MAP_HALF * (0.72 + rng() * 0.12);
      const log = new THREE.Mesh(driftGeo, driftMat);
      log.scale.setScalar(0.7 + rng() * 0.6);
      log.position.set(Math.cos(a) * r, 0.16, Math.sin(a) * r);
      log.rotation.set(Math.PI / 2, 0, rng() * Math.PI); // lying on its side
      log.castShadow = true;
      group.add(log);
    }
    const [snagGeo] = track(new THREE.CylinderGeometry(0.14, 0.3, 3.4, 7), driftMat);
    const [snagBranchGeo] = track(new THREE.CylinderGeometry(0.05, 0.09, 1.3, 5), driftMat);
    const snag = new THREE.Group();
    const snagTrunk = new THREE.Mesh(snagGeo, driftMat);
    snagTrunk.position.y = 1.7;
    snagTrunk.rotation.z = 0.1;
    snagTrunk.castShadow = true;
    snag.add(snagTrunk);
    for (const [by, rot] of [[2.2, 0.9], [2.8, -1.1]] as const) {
      const branch = new THREE.Mesh(snagBranchGeo, driftMat);
      branch.position.set(Math.sin(rot) * 0.5, by, 0);
      branch.rotation.z = rot;
      snag.add(branch);
    }
    snag.position.set(12, 0, 11);
    group.add(snag);
  }

  // ---- Punggol arc bridge: the waterway's red jewel — an arched span with
  // a plank deck crossing toward the water's edge ----
  if (mapId === "punggol_waterway") {
    const bridgeRed = new THREE.MeshStandardMaterial({ color: 0xc0392a, roughness: 0.7 });
    mats.push(bridgeRed);
    const [archGeo] = track(new THREE.TorusGeometry(4.2, 0.16, 6, 24, Math.PI), bridgeRed);
    const [deckGeo, deckMat] = track(
      new THREE.BoxGeometry(8.4, 0.18, 1.6),
      new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 0.95 }),
    );
    const [hangerGeo] = track(new THREE.CylinderGeometry(0.035, 0.035, 1, 4), bridgeRed);
    const bridge = new THREE.Group();
    for (const s of [-1, 1]) {
      const arch = new THREE.Mesh(archGeo, bridgeRed);
      arch.position.set(0, 0.4, s * 0.85);
      bridge.add(arch);
    }
    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.position.y = 0.5;
    deck.receiveShadow = true;
    bridge.add(deck);
    for (const hx of [-2.8, -1.4, 1.4, 2.8]) {
      const drop = Math.sqrt(Math.max(0, 4.2 * 4.2 - hx * hx)); // arch height above the deck
      for (const s of [-1, 1]) {
        const hanger = new THREE.Mesh(hangerGeo, bridgeRed);
        hanger.scale.y = Math.max(0.2, drop - 0.1);
        hanger.position.set(hx, 0.5 + (drop - 0.1) / 2, s * 0.85);
        bridge.add(hanger);
      }
    }
    bridge.position.set(MAP_HALF * 0.55, 0, -6);
    bridge.rotation.y = 0.5;
    group.add(bridge);
  }

  // ---- Bukit Timah summit: the famous marker stone beside a small timber
  // rest shelter at the hill's crown ----
  if (mapId === "bukit_timah") {
    const [markerGeo, markerMat] = track(
      new THREE.CylinderGeometry(0.55, 0.7, 1.1, 8),
      new THREE.MeshStandardMaterial({ color: 0x9a4a3a, roughness: 1, flatShading: true }),
    );
    const [plaqueGeo, plaqueMat] = track(new THREE.BoxGeometry(0.6, 0.35, 0.04), new THREE.MeshStandardMaterial({ color: 0xf0ead8, roughness: 0.9 }));
    const marker = new THREE.Group();
    const stone = new THREE.Mesh(markerGeo, markerMat);
    stone.position.y = 0.55;
    stone.castShadow = true;
    marker.add(stone);
    const plaque = new THREE.Mesh(plaqueGeo, plaqueMat);
    plaque.position.set(0, 0.75, 0.62);
    plaque.rotation.x = -0.15;
    marker.add(plaque);
    marker.position.set(-11, 0, -12.5);
    marker.rotation.y = Math.atan2(11, 12.5);
    group.add(marker);
    const shelterWood = new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.trunk).multiplyScalar(1.05), roughness: 1 });
    mats.push(shelterWood);
    const [shPostGeo] = track(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 6), shelterWood);
    const [shRoofGeo] = track(new THREE.ConeGeometry(2.0, 0.9, 4), shelterWood);
    const shelter = new THREE.Group();
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const post = new THREE.Mesh(shPostGeo, shelterWood);
      post.position.set(px, 1.1, pz);
      shelter.add(post);
    }
    const shRoof = new THREE.Mesh(shRoofGeo, shelterWood);
    shRoof.position.y = 2.6;
    shRoof.rotation.y = Math.PI / 4;
    shRoof.castShadow = true;
    shelter.add(shRoof);
    shelter.position.set(-13.5, 0, -9.5);
    group.add(shelter);
  }

  // ---- Labrador cannon: the park's preserved coastal gun on a stone mount,
  // barrel raised toward the sea ----
  if (mapId === "labrador_park") {
    const gunMetal = new THREE.MeshStandardMaterial({ color: 0x3a4038, roughness: 0.6, metalness: 0.5 });
    mats.push(gunMetal);
    const [mountGeo, mountMat] = track(
      new THREE.CylinderGeometry(1.1, 1.3, 0.5, 10),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.rock).multiplyScalar(0.9), roughness: 1 }),
    );
    const [breechGeo] = track(new THREE.BoxGeometry(0.9, 0.7, 1.3), gunMetal);
    const [barrelGeo] = track(new THREE.CylinderGeometry(0.14, 0.2, 2.6, 8), gunMetal);
    const cannon = new THREE.Group();
    const mount = new THREE.Mesh(mountGeo, mountMat);
    mount.position.y = 0.25;
    mount.receiveShadow = true;
    cannon.add(mount);
    const breech = new THREE.Mesh(breechGeo, gunMetal);
    breech.position.y = 0.85;
    breech.castShadow = true;
    cannon.add(breech);
    const barrel = new THREE.Mesh(barrelGeo, gunMetal);
    barrel.position.set(0, 1.35, 1.3);
    barrel.rotation.x = Math.PI / 2 - 0.35; // raised toward the horizon
    barrel.castShadow = true;
    cannon.add(barrel);
    cannon.position.set(12, 0, -11.5);
    cannon.rotation.y = Math.atan2(12, -11.5); // aim out to sea, away from town
    group.add(cannon);
  }

  // ---- Changi control tower: a slim tower with a wide glass cab and a red
  // beacon that pulses on the flicker channel ----
  if (mapId === "changi") {
    const towerConc = new THREE.MeshStandardMaterial({ color: 0xd8dce0, roughness: 0.8 });
    mats.push(towerConc);
    const [shaftGeo] = track(new THREE.CylinderGeometry(0.5, 0.7, 7.0, 10), towerConc);
    const [cabGeo, cabMat] = track(
      new THREE.CylinderGeometry(1.3, 0.9, 1.1, 10),
      new THREE.MeshBasicMaterial({ color: 0x9ad0e8 }),
    );
    nightLights.push({ mat: cabMat, day: new THREE.Color(0x7aa8c0), night: new THREE.Color(0xd0ecff) });
    const [beaconGeo, beaconMat] = track(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3a30 }));
    const controlTower = new THREE.Group();
    const shaft = new THREE.Mesh(shaftGeo, towerConc);
    shaft.position.y = 3.5;
    shaft.castShadow = true;
    controlTower.add(shaft);
    const cab = new THREE.Mesh(cabGeo, cabMat);
    cab.position.y = 7.55;
    controlTower.add(cab);
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.y = 8.25;
    controlTower.add(beacon);
    flickers.push(beacon);
    controlTower.position.set(-13, 0, -13);
    group.add(controlTower);
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

  // ---- fishmonger stall: coastal towns set up a counter of fish laid on
  // ice near the pier, a nod to the day's catch ----
  if (WATER_MAPS[mapId] && mapId !== "byalan" && mapId !== "abyss") {
    const fishStallWood = new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 0.95 });
    mats.push(fishStallWood);
    const [fCounterGeo] = track(new THREE.BoxGeometry(1.9, 0.7, 0.7), fishStallWood);
    const [iceGeo, iceMat] = track(new THREE.BoxGeometry(1.7, 0.12, 0.5), new THREE.MeshStandardMaterial({ color: 0xd8f0f8, roughness: 0.2, transparent: true, opacity: 0.85 }));
    const [fFishGeo, fFishMat] = track(new THREE.ConeGeometry(0.09, 0.4, 6), new THREE.MeshStandardMaterial({ color: 0x9ab0c0, roughness: 0.4, metalness: 0.3 }));
    const fishStall = new THREE.Group();
    const fCounter = new THREE.Mesh(fCounterGeo, fishStallWood);
    fCounter.position.y = 0.35;
    fCounter.castShadow = true;
    fishStall.add(fCounter);
    const ice = new THREE.Mesh(iceGeo, iceMat);
    ice.position.y = 0.76;
    fishStall.add(ice);
    for (let f = 0; f < 4; f++) {
      const fish = new THREE.Mesh(fFishGeo, fFishMat);
      fish.rotation.z = Math.PI / 2;
      fish.rotation.y = rng() * 0.6 - 0.3;
      fish.position.set(-0.6 + f * 0.4, 0.85, (rng() - 0.5) * 0.15);
      fishStall.add(fish);
    }
    fishStall.position.set(-MAP_HALF * 0.7, 0, MAP_HALF * 0.55);
    fishStall.rotation.y = rng() * Math.PI * 2;
    group.add(fishStall);
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

  // ---- Thanatos arcane doorway: a broken stone archway framing a slowly
  // swirling void, the tower's ominous landmark ----
  if (mapId === "thanatos" || mapId === "tower") {
    const archStone = new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.rock).multiplyScalar(0.9), roughness: 1, flatShading: true });
    mats.push(archStone);
    const [doorPillarGeo] = track(new THREE.BoxGeometry(0.6, 3.2, 0.6), archStone);
    const [doorTopGeo] = track(new THREE.BoxGeometry(2.6, 0.6, 0.6), archStone);
    const [voidGeo, voidMat] = track(
      new THREE.CircleGeometry(1.0, 20),
      new THREE.MeshBasicMaterial({ color: theme.foliage[0], transparent: true, opacity: 0.7 }),
    );
    const [swirlGeo, swirlMat] = track(
      new THREE.RingGeometry(0.3, 0.95, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, side: THREE.DoubleSide }),
    );
    const doorway = new THREE.Group();
    for (const s of [-1, 1]) {
      const pillar = new THREE.Mesh(doorPillarGeo, archStone);
      pillar.position.set(s * 1.0, 1.6, 0);
      pillar.castShadow = true;
      doorway.add(pillar);
    }
    const top = new THREE.Mesh(doorTopGeo, archStone);
    top.position.y = 3.5;
    top.castShadow = true;
    doorway.add(top);
    const voidPane = new THREE.Mesh(voidGeo, voidMat);
    voidPane.position.set(0, 1.7, 0.05);
    doorway.add(voidPane);
    const swirl = new THREE.Mesh(swirlGeo, swirlMat);
    swirl.position.set(0, 1.7, 0.1);
    doorway.add(swirl);
    spinners.push({ obj: swirl, speed: 0.7 });
    doorway.position.set(-13, 0, -13);
    doorway.rotation.y = Math.PI / 4;
    group.add(doorway);
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

  // ---- shipwreck: a broken hull half-buried in the sand on wilder coastal
  // maps, ribs exposed, listing to one side ----
  if (mapId === "pulau_hantu" || mapId === "coney_island") {
    const wreckWood = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 1, flatShading: true });
    mats.push(wreckWood);
    const [hullSideGeo] = track(new THREE.BoxGeometry(3.6, 1.1, 0.15), wreckWood);
    const [ribGeo] = track(new THREE.CylinderGeometry(0.05, 0.06, 1.3, 5), wreckWood);
    const wreck = new THREE.Group();
    const hullSide = new THREE.Mesh(hullSideGeo, wreckWood);
    hullSide.position.y = 0.4;
    hullSide.castShadow = true;
    wreck.add(hullSide);
    for (let r = 0; r < 5; r++) {
      const rib = new THREE.Mesh(ribGeo, wreckWood);
      rib.position.set(-1.4 + r * 0.7, 0.5, 0.12);
      rib.rotation.x = 0.15;
      wreck.add(rib);
    }
    wreck.position.set(MAP_HALF * 0.75, -0.15, MAP_HALF * 0.5);
    wreck.rotation.y = rng() * Math.PI * 2;
    wreck.rotation.z = 0.3; // listing to one side, half-swallowed by sand
    group.add(wreck);
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

  // ---- Gonryun dojo: a modest training hall with a wooden practice post
  // and a hanging banner, honoring the town's martial-arts reputation ----
  if (mapId === "gonryun") {
    const dojoWood = new THREE.MeshStandardMaterial({ color: 0x6a4a30, roughness: 1 });
    mats.push(dojoWood);
    const [dojoWallGeo, dojoWallMat] = track(new THREE.BoxGeometry(3.2, 1.9, 2.4), new THREE.MeshStandardMaterial({ color: 0xe8ddc8, roughness: 0.95 }));
    const [dojoRoofGeo, dojoRoofMat] = track(new THREE.ConeGeometry(2.6, 1.0, 4), new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.9, flatShading: true }));
    const [postGeo3] = track(new THREE.CylinderGeometry(0.1, 0.13, 1.6, 8), dojoWood);
    const [padGeo, padMat] = track(new THREE.CylinderGeometry(0.24, 0.24, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0xc8a860, roughness: 1 }));
    const [bannerGeo, bannerMat] = track(new THREE.PlaneGeometry(0.6, 1.6), new THREE.MeshStandardMaterial({ color: 0x2a3a6a, roughness: 0.9, side: THREE.DoubleSide }));
    const dojo = new THREE.Group();
    const dojoWall = new THREE.Mesh(dojoWallGeo, dojoWallMat);
    dojoWall.position.y = 0.95;
    dojoWall.castShadow = true;
    dojo.add(dojoWall);
    const dojoRoof = new THREE.Mesh(dojoRoofGeo, dojoRoofMat);
    dojoRoof.position.y = 2.4;
    dojoRoof.rotation.y = Math.PI / 4;
    dojoRoof.castShadow = true;
    dojo.add(dojoRoof);
    // a wooden practice post out front, padded at striking height
    const post3 = new THREE.Mesh(postGeo3, dojoWood);
    post3.position.set(2.6, 0.8, 1.6);
    dojo.add(post3);
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(2.6, 1.1, 1.6);
    dojo.add(pad);
    const bannerPole = new THREE.Mesh(postGeo3, dojoWood);
    bannerPole.scale.y = 1.3;
    bannerPole.position.set(-2.3, 1.0, 1.5);
    dojo.add(bannerPole);
    const banner = new THREE.Mesh(bannerGeo, bannerMat);
    banner.position.set(-2.3, 1.6, 1.8);
    dojo.add(banner);
    bobbers.push({ obj: banner, baseY: 1.6, phase: rng() * Math.PI * 2 });
    dojo.position.set(11.5, 0, -10.5);
    dojo.rotation.y = Math.atan2(-11.5, 10.5);
    group.add(dojo);
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

  // ---- hammock: a relaxed rope hammock strung between two posts on
  // tropical palm maps, sagging gently ----
  if (theme.tree === "palm") {
    const hammockPostMat = new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 1 });
    mats.push(hammockPostMat);
    const [hPostGeo2] = track(new THREE.CylinderGeometry(0.07, 0.09, 1.6, 6), hammockPostMat);
    const [hammockClothGeo, hammockClothMat] = track(
      new THREE.PlaneGeometry(2.6, 0.9),
      new THREE.MeshStandardMaterial({ color: 0xe8d090, roughness: 1, side: THREE.DoubleSide }),
    );
    const hammock = new THREE.Group();
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(hPostGeo2, hammockPostMat);
      post.position.set(s * 1.4, 0.8, 0);
      post.rotation.z = -s * 0.1;
      hammock.add(post);
    }
    const cloth = new THREE.Mesh(hammockClothGeo, hammockClothMat);
    cloth.rotation.x = Math.PI / 2.6; // sags into a shallow curve
    cloth.position.y = 0.85;
    hammock.add(cloth);
    hammock.position.set(9.5, 0, -4.5);
    hammock.rotation.y = 1.1;
    group.add(hammock);
    bobbers.push({ obj: cloth, baseY: 0.85, phase: rng() * Math.PI * 2 });
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

  // ---- orc war banner: a crude tribal totem of stacked bones and a hide
  // banner marks the dungeon entrance ----
  if (mapId === "orc_dungeon") {
    const orcWood = new THREE.MeshStandardMaterial({ color: 0x4a3a26, roughness: 1, flatShading: true });
    mats.push(orcWood);
    const [poleGeo] = track(new THREE.CylinderGeometry(0.09, 0.12, 3.4, 6), orcWood);
    const [skullGeo, skullMat] = track(new THREE.SphereGeometry(0.24, 8, 6), new THREE.MeshStandardMaterial({ color: 0xe0d8c0, roughness: 1 }));
    const [hornGeo] = track(new THREE.ConeGeometry(0.05, 0.3, 4), skullMat);
    const [hideGeo, hideMat] = track(new THREE.PlaneGeometry(1.1, 1.5), new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 1, side: THREE.DoubleSide }));
    const totem = new THREE.Group();
    const pole = new THREE.Mesh(poleGeo, orcWood);
    pole.position.y = 1.7;
    pole.castShadow = true;
    totem.add(pole);
    for (let s = 0; s < 3; s++) {
      const skull = new THREE.Mesh(skullGeo, skullMat);
      skull.position.y = 0.6 + s * 0.85;
      totem.add(skull);
      for (const side of [-1, 1]) {
        const horn = new THREE.Mesh(hornGeo, skullMat);
        horn.position.set(side * 0.18, 0.6 + s * 0.85 + 0.12, 0.05);
        horn.rotation.z = side * 0.5;
        totem.add(horn);
      }
    }
    const hide = new THREE.Mesh(hideGeo, hideMat);
    hide.position.set(0.65, 2.8, 0);
    totem.add(hide);
    totem.position.set(-11, 0, -11);
    totem.rotation.y = Math.PI / 4;
    group.add(totem);
  }

  // ---- bio lab hazard tanks: two glass cylinders of glowing green liquid
  // with rising bubbles, the lab's grim ambience ----
  if (mapId === "bio_lab") {
    const [tankGeo, tankMat] = track(
      new THREE.CylinderGeometry(0.55, 0.55, 2.2, 12, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x8a9aa0, roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
    );
    const [liquidGeo, liquidMat] = track(
      new THREE.CylinderGeometry(0.5, 0.5, 1.9, 12),
      new THREE.MeshBasicMaterial({ color: 0x5aff8a, transparent: true, opacity: 0.55 }),
    );
    nightLights.push({ mat: liquidMat, day: new THREE.Color(0x5aff8a), night: new THREE.Color(0x8affb0) });
    const [capGeo, capMat] = track(new THREE.CylinderGeometry(0.6, 0.6, 0.15, 12), new THREE.MeshStandardMaterial({ color: 0x5a626c, roughness: 0.5, metalness: 0.6 }));
    const bubbleMat = new THREE.SpriteMaterial({ map: makeSpark(), color: 0x8affb0, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
    mats.push(bubbleMat);
    for (const [tx, tz] of [[-13.5, -9], [-11.5, -10.5]] as const) {
      const tank = new THREE.Group();
      const shell = new THREE.Mesh(tankGeo, tankMat);
      shell.position.y = 1.2;
      tank.add(shell);
      const liquid = new THREE.Mesh(liquidGeo, liquidMat);
      liquid.position.y = 1.15;
      tank.add(liquid);
      const capTop = new THREE.Mesh(capGeo, capMat);
      capTop.position.y = 2.35;
      tank.add(capTop);
      const capBottom = new THREE.Mesh(capGeo, capMat);
      capBottom.position.y = 0.05;
      tank.add(capBottom);
      for (let b = 0; b < 2; b++) {
        const bubble = new THREE.Sprite(bubbleMat);
        bubble.scale.setScalar(0.1);
        tank.add(bubble);
        smokes.push({ sprite: bubble, baseY: 0.3, offset: b / 2 });
      }
      tank.position.set(tx, 0, tz);
      group.add(tank);
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

  // ---- drifting jellyfish: the abyssal maps have a few translucent jellies
  // pulsing slowly as they wander at mid-depth ----
  if (mapId === "byalan" || mapId === "abyss") {
    const jellyMat = new THREE.MeshBasicMaterial({ color: 0x8ad0e0, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
    mats.push(jellyMat);
    const [jellyCapGeo] = track(new THREE.SphereGeometry(0.3, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), jellyMat);
    const [tentacleGeo] = track(new THREE.CylinderGeometry(0.02, 0.01, 0.7, 4), jellyMat);
    for (let j = 0; j < 4; j++) {
      const jelly = new THREE.Group();
      const cap = new THREE.Mesh(jellyCapGeo, jellyMat);
      jelly.add(cap);
      for (let t = 0; t < 5; t++) {
        const ta = (t / 5) * Math.PI * 2;
        const tentacle = new THREE.Mesh(tentacleGeo, jellyMat);
        tentacle.position.set(Math.cos(ta) * 0.18, -0.35, Math.sin(ta) * 0.18);
        jelly.add(tentacle);
      }
      group.add(jelly);
      flickers.push(cap); // pulse the bell like a slow heartbeat
      const a = rng() * Math.PI * 2;
      const r = 6 + rng() * 20;
      cruisers.push({ obj: jelly, cx: Math.cos(a) * r, cz: Math.sin(a) * r, r: 1.5 + rng() * 2, y: 1.5 + rng() * 1.5, speed: 0.06 + rng() * 0.06, phase: rng() * Math.PI * 2, bob: 0.3 });
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

  // ---- woodland stream + footbridge: a thin winding brook cuts across
  // leafy/jungle maps with a small plank bridge over it ----
  if ((theme.tree === "leafy" || theme.tree === "jungle") && mapId !== "arena") {
    const [streamGeo, streamMat] = track(
      new THREE.PlaneGeometry(2.4, 34),
      new THREE.MeshStandardMaterial({ color: 0x3a7a90, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.75 }),
    );
    const stream = new THREE.Mesh(streamGeo, streamMat);
    stream.rotation.x = -Math.PI / 2;
    stream.position.set(-16, 0.02, 0);
    stream.rotation.z = 0.15; // gentle diagonal course
    group.add(stream);
    const bridgeWood = new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.trunk).multiplyScalar(0.95), roughness: 1 });
    mats.push(bridgeWood);
    const [plankGeo] = track(new THREE.BoxGeometry(3.2, 0.1, 0.3), bridgeWood);
    const [railGeo] = track(new THREE.CylinderGeometry(0.03, 0.03, 3.2, 5), bridgeWood);
    const bridge = new THREE.Group();
    for (let p = 0; p < 6; p++) {
      const plank = new THREE.Mesh(plankGeo, bridgeWood);
      plank.position.z = -0.75 + p * 0.3;
      bridge.add(plank);
    }
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(railGeo, bridgeWood);
      rail.rotation.z = Math.PI / 2;
      rail.position.set(0, 0.35, s * 0.75);
      bridge.add(rail);
    }
    bridge.position.set(-16 - 2.4 * Math.sin(0.15), 0.15, -2.4 * (1 - Math.cos(0.15)));
    bridge.rotation.y = Math.PI / 2 - 0.15;
    group.add(bridge);

    // fireflies drift low over the stream, only showing themselves at night
    const streamFireflyMat = new THREE.SpriteMaterial({ map: makeSpark(), color: 0x9af0c0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    mats.push(streamFireflyMat);
    nightFades.push({ mat: streamFireflyMat, max: 0.8 });
    for (let f = 0; f < 6; f++) {
      const fly = new THREE.Sprite(streamFireflyMat);
      fly.scale.setScalar(0.12);
      group.add(fly);
      orbiters.push({ sprite: fly, cx: -16, cz: -14 + rng() * 28, y: 0.4 + rng() * 0.5, r: 0.6 + rng() * 0.8, speed: 0.5 + rng() * 0.6, phase: rng() * Math.PI * 2 });
    }
  }

  // ---- gravestones: a small forgotten cluster of weathered markers on
  // haunted maps, leaning at odd angles ----
  if (mapId === "niflheim" || mapId === "gh_church" || mapId === "glast_heim" || mapId === "pulau_hantu") {
    const graveStone = new THREE.MeshStandardMaterial({ color: 0x6a6e72, roughness: 1, flatShading: true });
    mats.push(graveStone);
    const [slabGeo] = track(new THREE.BoxGeometry(0.5, 0.7, 0.12), graveStone);
    const [archTopGeo] = track(new THREE.CylinderGeometry(0.25, 0.25, 0.12, 10, 1, false, 0, Math.PI), graveStone);
    for (let g = 0; g < 5; g++) {
      const a = rng() * Math.PI * 2;
      const r = 10 + rng() * 16;
      const grave = new THREE.Group();
      const slab = new THREE.Mesh(slabGeo, graveStone);
      slab.position.y = 0.35;
      slab.castShadow = true;
      grave.add(slab);
      const archTop = new THREE.Mesh(archTopGeo, graveStone);
      archTop.rotation.z = Math.PI / 2;
      archTop.rotation.y = Math.PI / 2;
      archTop.position.y = 0.7;
      grave.add(archTop);
      grave.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      grave.rotation.y = rng() * Math.PI * 2;
      grave.rotation.z = (rng() - 0.5) * 0.35; // leaning, weathered
      group.add(grave);
    }
  }

  // ---- spiderwebs: dead and cave maps string a few webs between rocks, dew
  // drops catching a faint glint via the flicker channel ----
  if (theme.tree === "dead" || mapId === "cave" || mapId === "orc_dungeon") {
    const webMat = new THREE.MeshBasicMaterial({ color: 0xd8dce0, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
    mats.push(webMat);
    const [webGeo] = track(new THREE.RingGeometry(0.05, 0.55, 8, 4), webMat);
    const dewMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
    mats.push(dewMat);
    const [dewGeo] = track(new THREE.SphereGeometry(0.02, 6, 5), dewMat);
    for (let w = 0; w < 5; w++) {
      const a = rng() * Math.PI * 2;
      const r = 8 + rng() * 18;
      const web = new THREE.Mesh(webGeo, webMat);
      web.position.set(Math.cos(a) * r, 0.7 + rng() * 0.8, Math.sin(a) * r);
      web.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
      group.add(web);
      const dew = new THREE.Mesh(dewGeo, dewMat);
      dew.position.copy(web.position);
      group.add(dew);
      flickers.push(dew);
    }
  }

  // ---- night owl: a single owl perches at canopy height on leafy/pine maps,
  // its eyes glowing faintly once the sun goes down ----
  if ((theme.tree === "leafy" || theme.tree === "pine") && mapId !== "arena") {
    const owlMat = new THREE.MeshStandardMaterial({ color: 0x6a5a48, roughness: 0.9 });
    mats.push(owlMat);
    const [owlBodyGeo] = track(new THREE.SphereGeometry(0.16, 10, 8), owlMat);
    const [owlEyeGeo, owlEyeMat] = track(new THREE.SphereGeometry(0.035, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffe27a }));
    nightLights.push({ mat: owlEyeMat, day: new THREE.Color(0x8a7a5a), night: new THREE.Color(0xffe27a) });
    const owl = new THREE.Group();
    const owlBody = new THREE.Mesh(owlBodyGeo, owlMat);
    owlBody.scale.set(0.9, 1.2, 0.9);
    owl.add(owlBody);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(owlEyeGeo, owlEyeMat);
      eye.position.set(s * 0.07, 0.1, 0.13);
      owl.add(eye);
    }
    const a = rng() * Math.PI * 2;
    const r = 9 + rng() * 16;
    owl.position.set(Math.cos(a) * r, 3.4 + rng() * 1.4, Math.sin(a) * r);
    owl.rotation.y = rng() * Math.PI * 2;
    group.add(owl);
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

  // ---- cloud shadows: soft dark ellipses drift across the ground in
  // straight lines, wrapping around once they clear the map ----
  if (mapId !== "arena") {
    const cloudShadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.1, depthWrite: false });
    mats.push(cloudShadowMat);
    const [cloudShadowGeo] = track(new THREE.CircleGeometry(1, 16), cloudShadowMat);
    for (let c = 0; c < 3; c++) {
      const patch = new THREE.Mesh(cloudShadowGeo, cloudShadowMat);
      patch.rotation.x = -Math.PI / 2;
      const sc = 5 + rng() * 4;
      patch.scale.set(sc * 1.6, sc, 1);
      const a = rng() * Math.PI * 2;
      const r = rng() * MAP_HALF * 1.1;
      patch.position.set(Math.cos(a) * r, 0.05, Math.sin(a) * r);
      const heading = rng() * Math.PI * 2;
      const speed = 0.6 + rng() * 0.4;
      patch.rotation.z = heading;
      group.add(patch);
      drifters.push({ obj: patch, vx: Math.cos(heading) * speed, vz: Math.sin(heading) * speed });
    }
  }

  // ---- migratory flock: on every open map, a V of seven birds crosses the
  // whole sky once per ~26 s cycle on a hashed heading ----
  if (mapId !== "arena") {
    const [migBodyGeo, migMat] = track(
      new THREE.ConeGeometry(0.13, 0.6, 6),
      new THREE.MeshStandardMaterial({ color: 0xe8ecf0, roughness: 0.8 }),
    );
    const [migWingGeo] = track(new THREE.BoxGeometry(0.95, 0.04, 0.3), migMat);
    flock = new THREE.Group();
    for (let b = 0; b < 7; b++) {
      const rank = Math.ceil(b / 2); // 0, 1, 1, 2, 2, 3, 3
      const side = b === 0 ? 0 : b % 2 === 1 ? -1 : 1;
      const bird = new THREE.Group();
      const body = new THREE.Mesh(migBodyGeo, migMat);
      body.rotation.x = Math.PI / 2; // nose along +z
      bird.add(body);
      for (const s of [-1, 1]) {
        const pivot = new THREE.Group();
        pivot.position.x = s * 0.09;
        if (s < 0) pivot.rotation.y = Math.PI;
        const wing = new THREE.Mesh(migWingGeo, migMat);
        wing.position.x = 0.45;
        pivot.add(wing);
        bird.add(pivot);
        flockWings.push(pivot);
      }
      bird.position.set(side * rank * 1.1, (b % 2) * 0.15, -rank * 1.3);
      flock.add(bird);
    }
    flock.visible = false;
    group.add(flock);
  }

  // ---- spectator banners: the PvP arena rings its perimeter with tall
  // duelist banners that ripple gently on the breeze ----
  if (mapId === "arena") {
    const bannerPoleMat = new THREE.MeshStandardMaterial({ color: 0x3a3430, roughness: 0.7, metalness: 0.3 });
    mats.push(bannerPoleMat);
    const [bannerPoleGeo] = track(new THREE.CylinderGeometry(0.05, 0.06, 3.4, 6), bannerPoleMat);
    const bannerColors = [0xc0392a, 0x2a6ac0, 0xd0a02a, 0x4a9a5a];
    const [bannerClothGeo] = track(
      new THREE.PlaneGeometry(0.7, 1.6),
      new THREE.MeshStandardMaterial({ color: bannerColors[0], roughness: 0.9, side: THREE.DoubleSide }),
    );
    for (let b = 0; b < 8; b++) {
      const a = (b / 8) * Math.PI * 2;
      const r = 13.5;
      const pole = new THREE.Mesh(bannerPoleGeo, bannerPoleMat);
      pole.position.set(Math.cos(a) * r, 1.7, Math.sin(a) * r);
      group.add(pole);
      const clothMat = new THREE.MeshStandardMaterial({ color: bannerColors[b % bannerColors.length], roughness: 0.9, side: THREE.DoubleSide });
      mats.push(clothMat);
      const cloth = new THREE.Mesh(bannerClothGeo, clothMat);
      cloth.position.set(Math.cos(a) * r + Math.cos(a) * 0.4, 2.6, Math.sin(a) * r + Math.sin(a) * 0.4);
      cloth.rotation.y = -a;
      group.add(cloth);
      bobbers.push({ obj: cloth, baseY: 2.6, phase: (b / 8) * Math.PI * 2 });
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
      // puddles shimmer gently around their base opacity, like light on water
      for (const s of shimmers) s.mat.opacity = s.base + Math.sin(animPhase * 1.6 + s.phase) * s.amp;
      // cloud shadows drift in a straight line, wrapping around the map edge
      for (const d of drifters) {
        d.obj.position.x += d.vx * dt;
        d.obj.position.z += d.vz * dt;
        const lim = MAP_HALF * 1.3;
        if (d.obj.position.x > lim) d.obj.position.x = -lim;
        if (d.obj.position.x < -lim) d.obj.position.x = lim;
        if (d.obj.position.z > lim) d.obj.position.z = -lim;
        if (d.obj.position.z < -lim) d.obj.position.z = lim;
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
      // the migratory V crosses the sky in the first 11 s of each 26 s cycle
      if (flock) {
        const CYCLE = 26;
        const idx = Math.floor(animPhase / CYCLE);
        const t = (animPhase % CYCLE) / 11;
        if (t < 1) {
          const h = Math.abs(Math.sin(idx * 73.3) * 39217.7) % 1;
          const a = h * Math.PI * 2;
          const span = MAP_HALF * 1.4;
          flock.visible = true;
          flock.position.set(
            Math.cos(a) * span * (1 - 2 * t),
            21 + Math.sin(Math.PI * t) * 2,
            Math.sin(a) * span * (1 - 2 * t),
          );
          flock.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a)); // nose along travel
          const flap = Math.sin(animPhase * 8) * 0.5;
          for (const w of flockWings) w.rotation.z = flap;
        } else {
          flock.visible = false;
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
    // a wooden ladder leans against the wall, left out from roof repairs
    if (p.x !== 0) {
      const [ladderRailGeo, ladderMat] = track(
        new THREE.CylinderGeometry(0.03, 0.03, 2.2, 5),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.trunk).multiplyScalar(0.95), roughness: 1 }),
      );
      const [rungGeo] = track(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 4), ladderMat);
      const ladder = new THREE.Group();
      for (const s of [-1, 1]) {
        const rail = new THREE.Mesh(ladderRailGeo, ladderMat);
        rail.position.x = s * 0.2;
        ladder.add(rail);
      }
      for (let r = 0; r < 6; r++) {
        const rung = new THREE.Mesh(rungGeo, ladderMat);
        rung.rotation.z = Math.PI / 2;
        rung.position.y = -0.95 + r * 0.36;
        ladder.add(rung);
      }
      ladder.position.set(Math.sign(p.x) * -1.25, 1.15, 1.05);
      ladder.rotation.x = 0.22; // leans up against the wall
      house.add(ladder);
    }

    // windchimes hang beside the door: a small hanger with a few metal tubes
    // that sway and glint gently in the breeze
    {
      const chimeMat = new THREE.MeshStandardMaterial({ color: 0xd8b060, roughness: 0.4, metalness: 0.6 });
      mats.push(chimeMat);
      const [hangerGeo] = track(new THREE.CylinderGeometry(0.015, 0.015, 0.36, 4), chimeMat);
      const [tubeGeo] = track(new THREE.CylinderGeometry(0.018, 0.018, 0.28, 6), chimeMat);
      const chimes = new THREE.Group();
      const hanger = new THREE.Mesh(hangerGeo, chimeMat);
      hanger.rotation.z = Math.PI / 2;
      chimes.add(hanger);
      for (let t = 0; t < 4; t++) {
        const tube = new THREE.Mesh(tubeGeo, chimeMat);
        tube.position.set(-0.15 + t * 0.1, -0.2, 0);
        chimes.add(tube);
      }
      chimes.position.set(p.x === 0 ? 0.9 : Math.sign(p.x) * -0.9, 1.6, 1.15);
      house.add(chimes);
      bobbers.push({ obj: chimes, baseY: 1.6, phase: rng() * Math.PI * 2 });
    }

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
