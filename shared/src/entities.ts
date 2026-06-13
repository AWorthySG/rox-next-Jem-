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
  inventory: InventoryEntry[];
  equipped: EquipEntry[];
  refine: Array<{ id: string; level: number }>;
  quests: QuestState;
  x: number;
  z: number;
}
