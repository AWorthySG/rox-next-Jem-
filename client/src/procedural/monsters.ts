import * as THREE from "three";
import { makePoringTexture } from "./textures.js";

export type MonsterArch = "jelly" | "bug" | "beast" | "undead" | "plant" | "rock" | "demon" | "bird" | "ghost" | "dragon" | "golem" | "aquatic";

export interface MonsterAppearance {
  arch: MonsterArch;
  texture: THREE.Texture; // jelly face (also a fallback)
  main: number; // primary toon colour
  accent: number; // secondary toon colour
  scale: number;
  boss?: boolean;
}

interface AppearanceDef {
  inner: string;
  outer: string;
  scale: number;
  boss?: boolean;
}

// Visual family per template — drives which low-poly mesh archetype is built.
const ARCH: Record<string, MonsterArch> = {
  poring: "jelly", drops: "jelly", lunatic: "jelly", angeling: "jelly",
  fabre: "bug", chonchon: "bug", stem_worm: "bug", metaling: "bug", venatu: "bug", sleeper: "bug",
  wolf: "beast", coco: "beast", eddga: "beast", kraken: "aquatic", boitata: "beast", tao_gunka: "beast",
  zombie: "undead", skeleton: "undead", wraith: "undead", gargoyle: "undead", vanberk: "undead", hodremlin: "undead", amon_ra: "undead",
  spore: "plant", dryad: "plant", tendrilion: "plant",
  hardrock_mammoth: "golem", clock: "rock", clock_tower_manager: "golem", sandman: "rock", anolian: "aquatic",
  tao_gunka: "golem", ktullanux: "golem",
  baphomet: "demon", dark_lord: "demon", beelzebub: "demon", gloom: "demon", thanatos_phantom: "demon", memory_of_thanatos: "demon",
  hill_wind: "bird", owl_duke: "bird", vesper: "bird", valkyrie_randgris: "bird", kiel: "bird",
  moonlight: "ghost", mistress: "ghost", punk: "ghost", aliot: "ghost", aliza: "ghost",
  anubis: "undead", pasana: "undead", drake: "undead", egnigem: "undead",
  satan_morroc: "demon", nidhoggr: "demon", kathryne: "ghost",
  cecil: "bird", wickebine: "bug", ferus: "dragon", acidus: "dragon", detale: "dragon", boitata: "dragon",
  marionette: "ghost", nightmare: "beast", marduk: "bug", doppelganger: "demon", dark_priest: "ghost",
  loli_ruri: "ghost", quve: "ghost", gibbet: "undead", bacsojin: "ghost", fallen_bishop: "demon",
  poison_spore: "plant", karakasa: "ghost", tengu: "demon", samurai_specter: "undead", kapha: "aquatic",
  cookie: "jelly", myst_case: "rock", antonio: "beast", stormy_knight: "undead", garm: "beast",
  kobold: "beast", elder_willow: "plant", brilight: "bug", lady_tanee: "plant", leak: "dragon",
  les: "beast", mavka: "plant", uzhas: "undead", gopinich: "demon", baba_yaga: "ghost",
};

function hex(s: string): number {
  return parseInt(s.replace("#", ""), 16);
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
  // Thanatos Tower
  aliot: { inner: "#c0a0d0", outer: "#5a3a6a", scale: 1.3 },
  aliza: { inner: "#d0a0c0", outer: "#6a3a5a", scale: 1.3 },
  thanatos_phantom: { inner: "#d04060", outer: "#2a0810", scale: 3, boss: true },
  memory_of_thanatos: { inner: "#ff4060", outer: "#1a0008", scale: 3.4, boss: true },
  // Morocc
  anubis: { inner: "#e0c060", outer: "#3a2c10", scale: 1.4 },
  pasana: { inner: "#e8d8a0", outer: "#8a6a30", scale: 1.35 },
  drake: { inner: "#9ab0c0", outer: "#1a3040", scale: 2.9, boss: true },
  satan_morroc: { inner: "#d04030", outer: "#2a0808", scale: 3.4, boss: true },
  // Bio Lab
  cecil: { inner: "#d0c0a0", outer: "#5a4a30", scale: 1.3 },
  wickebine: { inner: "#c0a0d0", outer: "#4a2a5a", scale: 1.25 },
  egnigem: { inner: "#c0c8d0", outer: "#3a4450", scale: 2.8, boss: true },
  kathryne: { inner: "#e0c0f0", outer: "#4a2a6a", scale: 2.9, boss: true },
  // Abyss
  ferus: { inner: "#e07050", outer: "#5a1808", scale: 1.5 },
  acidus: { inner: "#80c0d0", outer: "#1a4a5a", scale: 1.5 },
  detale: { inner: "#f08040", outer: "#3a1004", scale: 3.4, boss: true },
  nidhoggr: { inner: "#9a4fb0", outer: "#100818", scale: 3.6, boss: true },
  // Geffen Tower
  marionette: { inner: "#e0c0e0", outer: "#6a3a6a", scale: 1.2 },
  nightmare: { inner: "#9a90c0", outer: "#2a2440", scale: 1.4 },
  marduk: { inner: "#d0c060", outer: "#6a5a10", scale: 1.25 },
  doppelganger: { inner: "#9a9ad0", outer: "#1a1430", scale: 2.6, boss: true },
  dark_priest: { inner: "#d0b0e0", outer: "#3a2050", scale: 2.6, boss: true },
  // Niflheim
  loli_ruri: { inner: "#cfe0e8", outer: "#5a6a78", scale: 1.2 },
  quve: { inner: "#c0d0d8", outer: "#48565e", scale: 1.25 },
  gibbet: { inner: "#d8d0b0", outer: "#5a4a30", scale: 1.4 },
  bacsojin: { inner: "#eaf0f4", outer: "#7a8a96", scale: 2.8, boss: true },
  fallen_bishop: { inner: "#d0b0d0", outer: "#2a1830", scale: 3, boss: true },
  // Amatsu
  poison_spore: { inner: "#b0d088", outer: "#4a6a28", scale: 1.1 },
  karakasa: { inner: "#e0d0c0", outer: "#8a3030", scale: 1.3 },
  tengu: { inner: "#e09090", outer: "#7a2424", scale: 1.45 },
  samurai_specter: { inner: "#c0c8d0", outer: "#2a3038", scale: 2.6, boss: true },
  kapha: { inner: "#9ad0c8", outer: "#2a5a54", scale: 2.7, boss: true },
  // Lutie
  cookie: { inner: "#f0e0c0", outer: "#b08a50", scale: 0.95 },
  myst_case: { inner: "#e0b0b0", outer: "#8a3030", scale: 1.2 },
  antonio: { inner: "#f0c0c0", outer: "#a83030", scale: 1.2 },
  stormy_knight: { inner: "#cfe0f0", outer: "#3a5a8a", scale: 2.6, boss: true },
  garm: { inner: "#e0f0f8", outer: "#5a8ab0", scale: 2.9, boss: true },
  // Ayothaya
  kobold: { inner: "#e0a060", outer: "#7a3a18", scale: 1.2 },
  elder_willow: { inner: "#b0d080", outer: "#3a6a28", scale: 1.4 },
  brilight: { inner: "#d0e060", outer: "#5a7a20", scale: 1.0 },
  lady_tanee: { inner: "#a8d088", outer: "#3a6a2c", scale: 2.9, boss: true },
  leak: { inner: "#80c0a0", outer: "#1a5a44", scale: 3, boss: true },
  // Moscovia
  les: { inner: "#c0a070", outer: "#6a4a28", scale: 1.3 },
  mavka: { inner: "#c0e090", outer: "#4a7a30", scale: 1.25 },
  uzhas: { inner: "#a0b0c0", outer: "#3a4450", scale: 1.4 },
  gopinich: { inner: "#e08050", outer: "#5a2010", scale: 2.9, boss: true },
  baba_yaga: { inner: "#c0b0a0", outer: "#4a3a28", scale: 2.7, boss: true },
};

export const DEFAULT_TEMPLATE = "poring";

// Build one texture per species up front (cheap canvas draws).
export function buildMonsterAppearances(): Record<string, MonsterAppearance> {
  const out: Record<string, MonsterAppearance> = {};
  for (const [id, d] of Object.entries(DEFS)) {
    const arch = ARCH[id] ?? "jelly";
    out[id] = {
      arch,
      texture: makePoringTexture(d.inner, d.outer),
      main: hex(d.outer),
      accent: hex(d.inner),
      scale: d.scale,
      boss: d.boss,
    };
  }
  return out;
}
