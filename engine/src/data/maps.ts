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
  pvp?: boolean; // players can attack each other here
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
      { name: "Healer", role: "healer", x: 8, z: 7, facing: Math.PI },
      { name: "Warp Girl", role: "warp", x: -8, z: 7, facing: Math.PI },
      { name: "Cave Portal", role: "portal", x: 14, z: 0, dest: { toMap: "cave", toX: 0, toZ: 18 } },
      { name: "Arena Portal", role: "portal", x: -14, z: 0, dest: { toMap: "arena", toX: 0, toZ: 0 } },
      { name: "Payon Portal", role: "portal", x: 0, z: 14, dest: { toMap: "payon", toX: 0, toZ: 18 } },
    ],
  },
  payon: {
    id: "payon",
    name: "Payon Forest",
    theme: { ground: 0x3e6b46, fog: 0x9fb98a, sky: 0xbfd0a8 },
    spawn: { x: 0, z: 18 },
    zones: [
      { id: "payon-spore-w", templateId: "spore", cx: -26, cz: 0, radius: 13, count: 7 },
      { id: "payon-spore-s", templateId: "spore", cx: 8, cz: -26, radius: 12, count: 6 },
      { id: "payon-wolf", templateId: "wolf", cx: 26, cz: -6, radius: 13, count: 6 },
    ],
    npcs: [{ name: "Payon Exit", role: "portal", x: 0, z: 24, dest: { toMap: "field", toX: 0, toZ: 8 } }],
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
    npcs: [
      { name: "Exit Portal", role: "portal", x: 0, z: 26, dest: { toMap: "field", toX: 16, toZ: 2 } },
      { name: "Glast Heim Portal", role: "portal", x: 0, z: -50, dest: { toMap: "glast_heim", toX: 0, toZ: 20 } },
    ],
  },
  glast_heim: {
    id: "glast_heim",
    name: "Glast Heim",
    theme: { ground: 0x4a4a55, fog: 0x14161f, sky: 0x232838 },
    spawn: { x: 0, z: 20 },
    zones: [
      { id: "gh-zombie", templateId: "zombie", cx: -20, cz: 2, radius: 13, count: 7 },
      { id: "gh-skeleton", templateId: "skeleton", cx: 20, cz: -2, radius: 13, count: 7 },
      { id: "gh-skeleton-2", templateId: "skeleton", cx: -4, cz: -28, radius: 12, count: 6 },
      { id: "gh-baphomet", templateId: "baphomet", cx: 0, cz: -46, radius: 4, count: 1 },
    ],
    npcs: [
      { name: "Glast Heim Exit", role: "portal", x: 0, z: 26, dest: { toMap: "cave", toX: 0, toZ: -44 } },
      { name: "Aldebaran Portal", role: "portal", x: 0, z: -50, dest: { toMap: "aldebaran", toX: 0, toZ: 20 } },
    ],
  },
  aldebaran: {
    id: "aldebaran",
    name: "Aldebaran Clock Tower",
    theme: { ground: 0x6b5d3e, fog: 0x2a2418, sky: 0x3c3424 },
    spawn: { x: 0, z: 20 },
    zones: [
      { id: "ct-punk", templateId: "punk", cx: -20, cz: 2, radius: 13, count: 8 },
      { id: "ct-clock", templateId: "clock", cx: 20, cz: -2, radius: 13, count: 7 },
      { id: "ct-punk-2", templateId: "punk", cx: -2, cz: -28, radius: 12, count: 7 },
      { id: "ct-manager", templateId: "clock_tower_manager", cx: 0, cz: -46, radius: 4, count: 1 },
    ],
    npcs: [
      { name: "Aldebaran Exit", role: "portal", x: 0, z: 26, dest: { toMap: "glast_heim", toX: 0, toZ: -44 } },
      { name: "Comodo Portal", role: "portal", x: 0, z: -50, dest: { toMap: "comodo", toX: 0, toZ: 20 } },
    ],
  },
  comodo: {
    id: "comodo",
    name: "Comodo Beach",
    theme: { ground: 0xe8d49a, fog: 0x8fc6e0, sky: 0xbfe4f0 },
    spawn: { x: 0, z: 20 },
    zones: [
      { id: "cm-sandman", templateId: "sandman", cx: -22, cz: 2, radius: 14, count: 8 },
      { id: "cm-anolian", templateId: "anolian", cx: 22, cz: -2, radius: 14, count: 8 },
      { id: "cm-sandman-2", templateId: "sandman", cx: -2, cz: -28, radius: 12, count: 7 },
    ],
    npcs: [
      { name: "Comodo Exit", role: "portal", x: 0, z: 26, dest: { toMap: "aldebaran", toX: 0, toZ: -44 } },
      { name: "Umbala Portal", role: "portal", x: 0, z: -42, dest: { toMap: "umbala", toX: 0, toZ: 20 } },
    ],
  },
  umbala: {
    id: "umbala",
    name: "Umbala Jungle",
    theme: { ground: 0x2f5a2c, fog: 0x16301a, sky: 0x244a2e },
    spawn: { x: 0, z: 20 },
    zones: [
      { id: "um-dryad", templateId: "dryad", cx: -22, cz: 2, radius: 14, count: 8 },
      { id: "um-stem", templateId: "stem_worm", cx: 22, cz: -2, radius: 14, count: 8 },
      { id: "um-dryad-2", templateId: "dryad", cx: -2, cz: -28, radius: 12, count: 7 },
      { id: "um-mammoth", templateId: "hardrock_mammoth", cx: 0, cz: -46, radius: 4, count: 1 },
    ],
    npcs: [
      { name: "Umbala Exit", role: "portal", x: 0, z: 26, dest: { toMap: "comodo", toX: 0, toZ: -38 } },
      { name: "Tower Portal", role: "portal", x: 0, z: -50, dest: { toMap: "tower", toX: 0, toZ: 20 } },
    ],
  },
  tower: {
    id: "tower",
    name: "Endless Tower",
    theme: { ground: 0x2c2a3e, fog: 0x0c0a16, sky: 0x1a1530 },
    spawn: { x: 0, z: 20 },
    zones: [
      { id: "tower-wraith", templateId: "wraith", cx: -20, cz: 2, radius: 13, count: 8 },
      { id: "tower-gargoyle", templateId: "gargoyle", cx: 20, cz: -2, radius: 13, count: 7 },
      { id: "tower-wraith-2", templateId: "wraith", cx: -2, cz: -28, radius: 12, count: 7 },
      { id: "tower-darklord", templateId: "dark_lord", cx: 0, cz: -46, radius: 4, count: 1 },
    ],
    npcs: [{ name: "Tower Exit", role: "portal", x: 0, z: 26, dest: { toMap: "umbala", toX: 0, toZ: -44 } }],
  },
  arena: {
    id: "arena",
    name: "PvP Arena",
    theme: { ground: 0x9a3030, fog: 0x401016, sky: 0x551b22 },
    spawn: { x: 0, z: 0 },
    zones: [],
    npcs: [{ name: "Arena Exit", role: "portal", x: 0, z: 22, dest: { toMap: "field", toX: -16, toZ: 2 } }],
    pvp: true,
  },
};

export const START_MAP = "field";
