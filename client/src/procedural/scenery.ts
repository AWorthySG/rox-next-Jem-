import * as THREE from "three";
import { MAP_HALF } from "@rox/shared";

export interface Scenery {
  group: THREE.Group;
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

  // ---- rocks (instanced icosahedra) ----
  if (theme.rocks > 0) {
    const [rg, rm] = track(new THREE.IcosahedronGeometry(0.7, 0), new THREE.MeshStandardMaterial({ color: theme.rock, roughness: 1, flatShading: true }));
    const rocks = new THREE.InstancedMesh(rg, rm, theme.rocks);
    rocks.castShadow = true;
    rocks.receiveShadow = true;
    let i = 0;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    scatter(rng, theme.rocks, (x, z, s) => {
      q.setFromEuler(new THREE.Euler(rng(), rng() * Math.PI * 2, rng()));
      m.compose(new THREE.Vector3(x, 0.25 * s, z), q, new THREE.Vector3(s, s * (0.6 + rng() * 0.5), s));
      rocks.setMatrixAt(i++, m);
    });
    rocks.count = i;
    group.add(rocks);
  }

  // ---- grass tufts / flowers (instanced little cones) ----
  if (theme.tufts > 0) {
    const [tg, tm] = track(new THREE.ConeGeometry(0.16, 0.5, 5), new THREE.MeshStandardMaterial({ color: theme.tuft, roughness: 1, flatShading: true }));
    const tufts = new THREE.InstancedMesh(tg, tm, theme.tufts);
    let i = 0;
    const m = new THREE.Matrix4();
    scatter(rng, theme.tufts, (x, z, s) => {
      m.compose(new THREE.Vector3(x, 0.22 * s, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
      tufts.setMatrixAt(i++, m);
    });
    tufts.count = i;
    group.add(tufts);
  }

  return {
    group,
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
    },
  };
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
  const foliageColor = theme.foliage[0];
  const foliageMat = new THREE.MeshStandardMaterial({
    color: foliageColor,
    roughness: 1,
    flatShading: true,
    emissive: theme.tree === "crystal" ? new THREE.Color(foliageColor).multiplyScalar(0.35) : 0x000000,
  });
  track(foliageGeo, foliageMat);
  const foliage = new THREE.InstancedMesh(foliageGeo, foliageMat, n);
  foliage.castShadow = true;

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    const p = placements[i];
    q.setFromAxisAngle(up, p.rot);
    m.compose(new THREE.Vector3(p.x, 1.2 * p.s, p.z), q, new THREE.Vector3(p.s, p.s, p.s));
    trunks.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(p.x, foliageY * p.s, p.z), q, new THREE.Vector3(p.s * foliageScale, p.s * foliageScale, p.s * foliageScale));
    foliage.setMatrixAt(i, m);
  }
  group.add(trunks, foliage);
}
