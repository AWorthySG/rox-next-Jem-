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
