import type { MapTheme } from "@rox/shared";
import type { NpcSpawn } from "../Npc.js";
import type { SpawnZone } from "./spawns.js";

export interface GameMap {
  id: string;
  name: string;
  theme: MapTheme;
  spawn: { x: number; z: number }; // where players arrive
  zones: SpawnZone[];
  npcs: NpcSpawn[];
}

// The overworld field (town + Poring fields + boss arena) and a tougher cave.
export const MAPS: Record<string, GameMap> = {
  field: {
    id: "field",
    name: "Prontera Field",
    theme: { ground: 0xffffff, fog: 0xbfd8ef, sky: 0xffffff },
    spawn: { x: 0, z: 0 },
    zones: [
      { id: "poring-field-w", templateId: "poring", cx: -34, cz: 4, radius: 13, count: 6 },
      { id: "poring-field-s", templateId: "poring", cx: 6, cz: 34, radius: 13, count: 6 },
      { id: "fabre-glade", templateId: "fabre", cx: 30, cz: 24, radius: 11, count: 5 },
      { id: "drops-dunes", templateId: "drops", cx: 34, cz: -8, radius: 12, count: 5 },
      { id: "lunatic-meadow", templateId: "lunatic", cx: -30, cz: -26, radius: 12, count: 5 },
      { id: "boss-arena", templateId: "poring_king", cx: 0, cz: -48, radius: 4, count: 1 },
    ],
    npcs: [
      { name: "Kafra Employee", role: "shop", x: 5, z: 4, facing: Math.PI },
      { name: "Guide", role: "guide", x: -5, z: 4, facing: Math.PI },
      { name: "Blacksmith", role: "refine", x: 0, z: 7, facing: Math.PI },
      { name: "Cave Portal", role: "portal", x: 14, z: 0, dest: { toMap: "cave", toX: 0, toZ: 18 } },
    ],
  },
  cave: {
    id: "cave",
    name: "Poring Cave",
    theme: { ground: 0x6a5a48, fog: 0x241c2a, sky: 0x3a2c44 },
    spawn: { x: 0, z: 20 },
    zones: [
      { id: "cave-drops", templateId: "drops", cx: -18, cz: 0, radius: 12, count: 7 },
      { id: "cave-lunatic", templateId: "lunatic", cx: 20, cz: -4, radius: 13, count: 8 },
      { id: "cave-lunatic-2", templateId: "lunatic", cx: -6, cz: -30, radius: 12, count: 6 },
      { id: "cave-king", templateId: "poring_king", cx: 0, cz: -44, radius: 4, count: 1 },
    ],
    npcs: [{ name: "Exit Portal", role: "portal", x: 0, z: 26, dest: { toMap: "field", toX: 16, toZ: 2 } }],
  },
};

export const START_MAP = "field";
