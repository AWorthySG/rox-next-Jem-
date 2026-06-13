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
