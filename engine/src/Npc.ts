import { EntityKind, type EntityFull } from "@rox/shared";

// A static, non-combat town NPC (e.g. the shop keeper). NPCs never move and are
// sent once on spawn; they don't appear in periodic snapshots.
export class Npc {
  constructor(
    readonly id: number,
    readonly name: string,
    readonly role: string,
    readonly x: number,
    readonly z: number,
    readonly facing = 0,
  ) {}

  toFull(): EntityFull {
    return {
      id: this.id,
      kind: EntityKind.Npc,
      name: this.name,
      x: this.x,
      z: this.z,
      facing: this.facing,
      hp: 1,
      maxHp: 1,
      level: 0,
      npcRole: this.role,
    };
  }
}

export interface NpcSpawn {
  name: string;
  role: string;
  x: number;
  z: number;
  facing?: number;
}

// Town NPCs near the spawn point.
export const NPC_SPAWNS: NpcSpawn[] = [
  { name: "Kafra Employee", role: "shop", x: 5, z: 4, facing: Math.PI },
];
