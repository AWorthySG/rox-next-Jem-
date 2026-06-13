import * as THREE from "three";
import { makePoringTexture } from "./textures.js";

export interface MonsterAppearance {
  texture: THREE.Texture;
  scale: number;
  boss?: boolean;
}

interface AppearanceDef {
  inner: string;
  outer: string;
  scale: number;
  boss?: boolean;
}

// Per-template look. Same jelly art, recoloured + rescaled per species.
const DEFS: Record<string, AppearanceDef> = {
  poring: { inner: "#ffd1e6", outer: "#ff9ec4", scale: 1 },
  fabre: { inner: "#fff0c0", outer: "#e7c64a", scale: 0.85 },
  drops: { inner: "#d8f6cb", outer: "#82cf63", scale: 1 },
  lunatic: { inner: "#ffffff", outer: "#d7d7de", scale: 0.95 },
  poring_king: { inner: "#ffe7a0", outer: "#e3b400", scale: 2.2, boss: true },
  spore: { inner: "#d8b0e0", outer: "#7a4a86", scale: 0.95 },
  wolf: { inner: "#c9c9d2", outer: "#6b6b76", scale: 1.25 },
  zombie: { inner: "#b6c79a", outer: "#5c7a44", scale: 1.15 },
  skeleton: { inner: "#f0f0f0", outer: "#b8b8c0", scale: 1.2 },
  baphomet: { inner: "#b03030", outer: "#3a0d12", scale: 2.6, boss: true },
  punk: { inner: "#e0b0e8", outer: "#7a3a86", scale: 1.05 },
  clock: { inner: "#d8c088", outer: "#7a5a28", scale: 1.35 },
  clock_tower_manager: { inner: "#e0c060", outer: "#3a2c10", scale: 2.8, boss: true },
  sandman: { inner: "#e8d49a", outer: "#9a7a40", scale: 1.3 },
  anolian: { inner: "#9ad0c0", outer: "#3a7a68", scale: 1.35 },
  dryad: { inner: "#a8d088", outer: "#3a6a2c", scale: 1.4 },
  stem_worm: { inner: "#d0e090", outer: "#6a8a30", scale: 1.3 },
  hardrock_mammoth: { inner: "#9a7050", outer: "#3a281c", scale: 3, boss: true },
  wraith: { inner: "#cfe0f0", outer: "#5a6e90", scale: 1.2 },
  gargoyle: { inner: "#b8b0a0", outer: "#5c5448", scale: 1.4 },
  dark_lord: { inner: "#7a3aa0", outer: "#14081e", scale: 3, boss: true },
  // extra regulars
  chonchon: { inner: "#d8e088", outer: "#7a8a30", scale: 0.8 },
  coco: { inner: "#d8b088", outer: "#7a5430", scale: 0.95 },
  // 2nd bosses + Payon/Comodo bosses
  angeling: { inner: "#fff0b0", outer: "#e0b840", scale: 2, boss: true },
  eddga: { inner: "#e0a040", outer: "#5a2c10", scale: 2.4, boss: true },
  moonlight: { inner: "#f0c0e0", outer: "#7a3a86", scale: 2.2, boss: true },
  mistress: { inner: "#f0d060", outer: "#6a4a10", scale: 2.2, boss: true },
  amon_ra: { inner: "#e0c060", outer: "#3a2c10", scale: 2.6, boss: true },
  owl_duke: { inner: "#d0c0a0", outer: "#4a3c28", scale: 2.6, boss: true },
  kraken: { inner: "#6aa0c0", outer: "#10384a", scale: 2.8, boss: true },
  tao_gunka: { inner: "#9a7050", outer: "#2a180c", scale: 3, boss: true },
  gloom: { inner: "#9a9ad0", outer: "#1a1430", scale: 2.8, boss: true },
  valkyrie_randgris: { inner: "#f0f0d0", outer: "#b0a050", scale: 3, boss: true },
  // Juno
  sleeper: { inner: "#f0d8a0", outer: "#9a7a40", scale: 1.2 },
  hill_wind: { inner: "#c0e0f0", outer: "#4a7a9a", scale: 1.25 },
  kiel: { inner: "#e0e0e0", outer: "#6a6a78", scale: 2.8, boss: true },
  vesper: { inner: "#d0d0e8", outer: "#3a3a5a", scale: 3, boss: true },
  // Einbroch
  metaling: { inner: "#c0c0c8", outer: "#5a5a60", scale: 1.2 },
  venatu: { inner: "#a0c8b0", outer: "#3a6a4a", scale: 1.3 },
  boitata: { inner: "#e08040", outer: "#3a1808", scale: 3, boss: true },
  tendrilion: { inner: "#90d070", outer: "#2a5a1a", scale: 2.9, boss: true },
  // Rachel
  vanberk: { inner: "#e0a0a0", outer: "#7a2c2c", scale: 1.3 },
  hodremlin: { inner: "#c0b0e0", outer: "#4a3a7a", scale: 1.35 },
  ktullanux: { inner: "#c0e0f0", outer: "#2a5a7a", scale: 3, boss: true },
  beelzebub: { inner: "#8a3aa0", outer: "#100818", scale: 3.2, boss: true },
};

export const DEFAULT_TEMPLATE = "poring";

// Build one texture per species up front (cheap canvas draws).
export function buildMonsterAppearances(): Record<string, MonsterAppearance> {
  const out: Record<string, MonsterAppearance> = {};
  for (const [id, d] of Object.entries(DEFS)) {
    out[id] = { texture: makePoringTexture(d.inner, d.outer), scale: d.scale, boss: d.boss };
  }
  return out;
}
