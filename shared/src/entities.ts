import { EntityKind, EquipSlot, JobId, MonsterAIState } from "./enums.js";
import type { Stats } from "./stats.js";
import type { QuestState } from "./quests.js";

export interface InventoryEntry {
  id: string;
  qty: number;
}

export interface EquipEntry {
  slot: EquipSlot;
  id: string;
}

// Compact per-entity record sent inside a Snapshot. Only fast-changing fields.
export interface EntitySnapshot {
  id: number;
  x: number;
  z: number;
  facing: number; // radians, yaw around Y
  hp: number;
  maxHp: number;
  aiState?: MonsterAIState; // monsters only (drives animation cues)
  enraged?: boolean; // boss enrage aura
}

// Full entity record sent on Spawn / JoinAck. Includes static descriptive fields
// the snapshot omits (name, kind, job, template).
export interface EntityFull {
  id: number;
  kind: EntityKind;
  name: string;
  x: number;
  z: number;
  facing: number;
  hp: number;
  maxHp: number;
  level: number;
  // players
  job?: JobId;
  colorSeed?: number; // deterministic tint for the procedural character mesh
  guildName?: string; // shown as a [tag] above the player
  // monsters
  templateId?: string;
  aiState?: MonsterAIState;
  // npcs
  npcRole?: string;
}

// The local player's own authoritative state, richer than what others see.
export interface SelfState {
  id: number;
  name: string;
  job: JobId;
  level: number;
  hp: number;
  maxHp: number;
  sp: number;
  maxSp: number;
  exp: number;
  expToNext: number;
  zeny: number;
  stats: Stats;
  statPoints: number;
  skillPoints: number;
  skillLevels: Array<{ id: string; level: number }>;
  inventory: InventoryEntry[];
  equipped: EquipEntry[];
  refine: Array<{ id: string; level: number }>;
  quests: QuestState;
  achievements: string[];
  buffs: Array<{ type: string; remainingMs: number }>;
  pet: string | null;
  mounted: boolean;
  mapId: string;
  x: number;
  z: number;
}
